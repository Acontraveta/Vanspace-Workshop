import { differenceInDays, parseISO, isValid, isBefore } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { CRMAlertConfig, CRMAlertInstance, AlertPriority, AlertInstanceState, LiveAlert } from '../types/alerts.types'
import type { Lead } from '@/features/crm/types/crm.types'
import type { Quote } from '@/features/quotes/types/quote.types'
import type { ProductionProject, ProductionTask } from '@/features/production/types/production.types'
import type { PurchaseItem } from '@/features/purchases/types/purchase.types'

// ─── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date()

function safeParse(dateStr?: string | Date | null): Date | null {
  if (!dateStr) return null
  if (dateStr instanceof Date) return isValid(dateStr) ? dateStr : null
  const d = parseISO(dateStr)
  return isValid(d) ? d : null
}

function daysSince(dateStr?: string | Date | null): number {
  const d = safeParse(dateStr)
  if (!d) return 0
  return Math.max(0, differenceInDays(today(), d))
}

function daysUntil(dateStr?: string | null): number {
  const d = safeParse(dateStr)
  if (!d) return Infinity
  return differenceInDays(d, today())
}

function quotesFromStorage(): Quote[] {
  try {
    // Sincronizar desde Supabase si hay caché
    return JSON.parse(localStorage.getItem('saved_quotes') ?? '[]') as Quote[]
  } catch {
    return []
  }
}

const TERMINAL_STATES = new Set(['Entregado', 'Perdido', 'Aprobado'])

// ─── trigger evaluators ──────────────────────────────────────────────────────

type TriggerResult = {
  lead: Lead
  titulo: string
  descripcion: string
}

function evalPresupuestoCaducando(leads: Lead[], umbral: number): TriggerResult[] {
  const quotes = quotesFromStorage()
  const nonApproved = quotes.filter(q =>
    q.lead_id &&
    q.status !== 'APPROVED' &&
    daysSince(q.createdAt ?? (q as any).created_at) >= umbral
  )
  const leadIds = new Set(nonApproved.map(q => q.lead_id!))
  // Map lead_id → oldest quote age
  const ageMap: Record<string, { days: number; quote: Quote }> = {}
  for (const q of nonApproved) {
    const days = daysSince(q.createdAt ?? (q as any).created_at)
    if (!ageMap[q.lead_id!] || days > ageMap[q.lead_id!].days) {
      ageMap[q.lead_id!] = { days, quote: q }
    }
  }
  return leads
    .filter(l => leadIds.has(l.id))
    .map(l => ({
      lead: l,
      titulo: `📄 Presupuesto sin respuesta — ${l.cliente}`,
      descripcion: `El presupuesto lleva ${ageMap[l.id]?.days ?? umbral}+ días sin aprobación ni rechazo`,
    }))
}

function evalLlamadaCalidad(leads: Lead[], umbral: number): TriggerResult[] {
  return leads
    .filter(l => l.estado === 'Entregado' && l.fecha_entrega)
    .filter(l => {
      const days = daysSince(l.fecha_entrega)
      // Fire window: [umbral, umbral*4] days after delivery to avoid permanent alerts
      return days >= umbral && days <= umbral * 4
    })
    .map(l => ({
      lead: l,
      titulo: `📞 Control de calidad — ${l.cliente}`,
      descripcion: `Han pasado ${daysSince(l.fecha_entrega)} días desde la entrega${l.vehiculo ? ` del ${l.vehiculo}` : ''}`,
    }))
}

function evalRevisionProgramada(leads: Lead[], umbral: number): TriggerResult[] {
  return leads
    .filter(l => l.proxima_accion && l.fecha_accion)
    .filter(l => {
      const remaining = daysUntil(l.fecha_accion)
      // Fires when the action date is between today and today+umbral (upcoming, not overdue)
      return remaining >= 0 && remaining <= umbral
    })
    .map(l => {
      const remaining = daysUntil(l.fecha_accion)
      return {
        lead: l,
        titulo: `🔧 Revisión próxima — ${l.cliente}`,
        descripcion: remaining === 0
          ? `Hoy: ${l.proxima_accion}`
          : `En ${remaining} día${remaining !== 1 ? 's' : ''}: ${l.proxima_accion} (${l.fecha_accion})`,
      }
    })
}

function evalSinActividad(leads: Lead[], umbral: number): TriggerResult[] {
  return leads
    .filter(l => !TERMINAL_STATES.has(l.estado ?? ''))
    .filter(l => daysSince(l.updated_at) >= umbral)
    .map(l => ({
      lead: l,
      titulo: `😴 Sin actividad — ${l.cliente}`,
      descripcion: `Lleva ${daysSince(l.updated_at)} días sin cambios (estado: ${l.estado ?? '—'})`,
    }))
}

function evalFechaAccionVencida(leads: Lead[], _umbral: number): TriggerResult[] {
  return leads
    .filter(l => l.proxima_accion && l.fecha_accion && !TERMINAL_STATES.has(l.estado ?? ''))
    .filter(l => {
      const d = safeParse(l.fecha_accion)
      return d ? isBefore(d, today()) : false
    })
    .map(l => {
      const overdue = Math.abs(daysUntil(l.fecha_accion))
      return {
        lead: l,
        titulo: `⏰ Acción vencida — ${l.cliente}`,
        descripcion: `"${l.proxima_accion}" — vencida hace ${overdue} día${overdue !== 1 ? 's' : ''}`,
      }
    })
}

function evalSeguimientoNegociacion(leads: Lead[], umbral: number): TriggerResult[] {
  return leads
    .filter(l => l.estado === 'Negociación' && daysSince(l.updated_at) >= umbral)
    .map(l => ({
      lead: l,
      titulo: `🤝 Seguimiento en negociación — ${l.cliente}`,
      descripcion: `Lleva ${daysSince(l.updated_at)} días en negociación sin actualización registrada`,
    }))
}

const EVALUATORS: Record<string, (leads: Lead[], umbral: number) => TriggerResult[]> = {
  presupuesto_caducando:   evalPresupuestoCaducando,
  llamada_calidad:         evalLlamadaCalidad,
  revision_programada:     evalRevisionProgramada,
  sin_actividad:           evalSinActividad,
  fecha_accion_vencida:    evalFechaAccionVencida,
  seguimiento_negociacion: evalSeguimientoNegociacion,
}

// ─── public service ──────────────────────────────────────────────────────────

export const AlertsService = {

  // ── CONFIG ────────────────────────────────────────────────────────────────

  async getConfigs(): Promise<CRMAlertConfig[]> {
    const { data, error } = await supabase
      .from('alert_settings')
      .select('*')
      .order('tipo_alerta')
    if (error) throw error
    return (data ?? []) as CRMAlertConfig[]
  },

  async updateConfig(tipo: string, updates: Partial<CRMAlertConfig>): Promise<void> {
    const { error } = await supabase
      .from('alert_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('tipo_alerta', tipo)
    if (error) throw error
  },

  // ── INSTANCES ─────────────────────────────────────────────────────────────

  async getInstances(state?: AlertInstanceState): Promise<CRMAlertInstance[]> {
    let q = supabase
      .from('crm_alert_instances')
      .select('*')
      .not('estado', 'eq', 'descartada')
      .order('fecha_generada', { ascending: false })

    if (state) {
      q = q.eq('estado', state)
    }

    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as CRMAlertInstance[]
  },

  async getInstancesWithLeads(): Promise<CRMAlertInstance[]> {
    const { data, error } = await supabase
      .from('crm_alert_instances')
      .select(`
        *,
        lead:lead_id ( cliente, telefono, email, vehiculo, estado )
      `)
      .not('estado', 'eq', 'descartada')
      .order('fecha_generada', { ascending: false })
    if (error) throw error
    return (data ?? []) as CRMAlertInstance[]
  },

  async markVista(id: string): Promise<void> {
    const { error } = await supabase
      .from('crm_alert_instances')
      .update({ estado: 'vista' })
      .eq('id', id)
      .eq('estado', 'pendiente') // only transition from pendiente
    if (error) throw error
  },

  async resolve(id: string, resolvedBy?: string): Promise<void> {
    const { error } = await supabase
      .from('crm_alert_instances')
      .update({
        estado: 'resuelta',
        resuelta_por: resolvedBy,
        resuelta_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
  },

  async dismiss(id: string): Promise<void> {
    const { error } = await supabase
      .from('crm_alert_instances')
      .update({ estado: 'descartada' })
      .eq('id', id)
    if (error) throw error
  },

  async countPending(): Promise<number> {
    const { count, error } = await supabase
      .from('crm_alert_instances')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
    if (error) return 0
    return count ?? 0
  },

  // ── ENGINE ────────────────────────────────────────────────────────────────

  /**
   * Runs all active alert rules against the current CRM data and
   * upserts/removes instances accordingly. Returns the total number
   * of new alerts created.
   */
  async runEngine(): Promise<{ created: number; removed: number }> {
    // 1. Load active configs
    const configs = await this.getConfigs()
    const activeConfigs = configs.filter(c => c.activa)
    if (activeConfigs.length === 0) return { created: 0, removed: 0 }

    // 2. Load all non-terminal leads (broad query to cover most rules)
    const { data: leadsData, error: leadsError } = await supabase
      .from('crm_leads')
      .select('id, cliente, telefono, email, vehiculo, talla, estado, fecha_entrega, proxima_accion, fecha_accion, updated_at, importe, linea_negocio')
      .limit(2000)
    if (leadsError) throw leadsError
    const leads: Lead[] = (leadsData ?? []) as Lead[]

    let created = 0
    let removed = 0

    for (const config of activeConfigs) {
      const evaluator = EVALUATORS[config.tipo_alerta]
      if (!evaluator) continue

      const triggers = evaluator(leads, config.dias_umbral ?? 30)
      const triggerLeadIds = new Set(triggers.map(t => t.lead.id))

      // Fetch existing pendiente instances for this tipo
      const { data: existing } = await supabase
        .from('crm_alert_instances')
        .select('id, lead_id')
        .eq('tipo_alerta', config.tipo_alerta)
        .eq('estado', 'pendiente')

      const existingByLeadId = new Map((existing ?? []).map(e => [e.lead_id, e.id]))
      const existingLeadIds = new Set(existingByLeadId.keys())

      // Insert new triggers (not already pending)
      const toInsert = triggers.filter(t => !existingLeadIds.has(t.lead.id))
      if (toInsert.length > 0) {
        const rows = toInsert.map(t => ({
          tipo_alerta:    config.tipo_alerta,
          lead_id:        t.lead.id,
          titulo:         t.titulo,
          descripcion:    t.descripcion,
          prioridad:      config.prioridad ?? 'media',
          roles_destino:  config.roles_destino ?? ['admin'],
          estado:         'pendiente',
          fecha_generada: new Date().toISOString(),
        }))
        const { error: insertError } = await supabase
          .from('crm_alert_instances')
          .insert(rows)
        if (!insertError) created += rows.length
      }

      // Remove stale pendiente instances (condition no longer met)
      const staleIds = [...existingByLeadId.entries()]
        .filter(([leadId]) => !triggerLeadIds.has(leadId))
        .map(([, id]) => id)
      if (staleIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('crm_alert_instances')
          .delete()
          .in('id', staleIds)
        if (!deleteError) removed += staleIds.length
      }
    }

    return { created, removed }
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE ALERT ENGINE  (Production · Purchases · Stock · Quotes)
// No Supabase writes — computed fresh, dismissals in localStorage for 24h
// ═══════════════════════════════════════════════════════════════════════════

const DISMISS_KEY = 'vanspace_dismissed_live_alerts'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000  // 24 h

type DismissRecord = Record<string, number> // id → dismissedAt ms

function getDismissed(): DismissRecord {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return {}
    const rec = JSON.parse(raw) as DismissRecord
    const now = Date.now()
    // prune expired entries
    const pruned: DismissRecord = {}
    for (const [id, ts] of Object.entries(rec)) {
      if (now - ts < DISMISS_TTL_MS) pruned[id] = ts
    }
    return pruned
  } catch { return {} }
}

function saveDismissed(rec: DismissRecord) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(rec)) } catch {}
}

export function dismissLiveAlert(id: string) {
  const rec = getDismissed()
  rec[id] = Date.now()
  saveDismissed(rec)
}

export function undismissLiveAlert(id: string) {
  const rec = getDismissed()
  delete rec[id]
  saveDismissed(rec)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function liveId(tipo: string, ctx: string) { return `${tipo}__${ctx}` }

// Fallback defaults so live alerts fire even if 007 migration hasn't run yet
const LIVE_DEFAULTS: Record<string, Partial<CRMAlertConfig>> = {
  proyecto_atrasado:          { activa: true, dias_umbral: 0,  prioridad: 'alta',  roles_destino: ['admin','encargado','encargado_taller'] },
  proyecto_sin_inicio:        { activa: true, dias_umbral: 3,  prioridad: 'media', roles_destino: ['admin','encargado','encargado_taller'] },
  tarea_bloqueada:            { activa: true, dias_umbral: 0,  prioridad: 'alta',  roles_destino: ['admin','encargado','encargado_taller'] },
  materiales_pendientes:      { activa: true, dias_umbral: 0,  prioridad: 'alta',  roles_destino: ['admin','encargado','compras'] },
  diseno_pendiente:           { activa: true, dias_umbral: 0,  prioridad: 'media', roles_destino: ['admin','encargado'] },
  pedido_urgente_sin_pedir:   { activa: true, dias_umbral: 0,  prioridad: 'alta',  roles_destino: ['admin','encargado','compras'] },
  pedidos_pendientes_resumen: { activa: true, dias_umbral: 0,  prioridad: 'media', roles_destino: ['admin','encargado','compras'] },
  pedido_sin_recibir:         { activa: true, dias_umbral: 10, prioridad: 'media', roles_destino: ['admin','compras'] },
  stock_bajo:                 { activa: true, dias_umbral: 0,  prioridad: 'media', roles_destino: ['admin','compras'] },
  stock_cero:                 { activa: true, dias_umbral: 0,  prioridad: 'alta',  roles_destino: ['admin','compras'] },
  presupuesto_alto_perdido:   { activa: true, dias_umbral: 14, prioridad: 'alta',  roles_destino: ['admin','encargado','compras'] },
}

function configFor(
  tipo: string,
  configs: CRMAlertConfig[]
): CRMAlertConfig | undefined {
  const fromDB = configs.find(c => c.tipo_alerta === tipo)
  if (fromDB) return fromDB.activa ? fromDB : undefined
  // Not in DB yet → use fallback default (always active)
  const defaults = LIVE_DEFAULTS[tipo]
  if (!defaults) return undefined
  return { tipo_alerta: tipo, activa: true, ...defaults } as CRMAlertConfig
}

// ── Production evaluators ────────────────────────────────────────────────────

function evalProyectoAtrasado(
  projects: ProductionProject[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  return projects
    .filter(p =>
      p.status !== 'COMPLETED' &&
      p.status !== 'ON_HOLD' &&
      p.end_date &&
      isBefore(parseISO(p.end_date), new Date())
    )
    .map(p => {
      const days = daysSince(p.end_date)
      return {
        id: liveId('proyecto_atrasado', p.id),
        tipo_alerta: 'proyecto_atrasado',
        modulo: 'produccion' as const,
        titulo: `${days === 0 ? '⏰' : '🚨'} Proyecto ${days === 0 ? 'termina hoy' : 'atrasado'} — ${p.client_name}`,
        descripcion: `"${p.quote_number}" ${days === 0 ? 'termina hoy' : `lleva ${days} día${days !== 1 ? 's' : ''} de retraso`}${p.vehicle_model ? ` (${p.vehicle_model})` : ''}`,
        prioridad: 'alta' as AlertPriority,
        roles_destino: cfg.roles_destino ?? ['admin'],
        navPath: '/production',
        meta: { projectId: p.id, projectName: p.quote_number },
      }
    })
}

function evalProyectoSinInicio(
  projects: ProductionProject[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  const umbral = cfg.dias_umbral ?? 3
  return projects
    .filter(p =>
      (p.status === 'SCHEDULED' || p.status === 'WAITING') &&
      p.start_date &&
      daysSince(p.start_date) >= umbral
    )
    .map(p => ({
      id: liveId('proyecto_sin_inicio', p.id),
      tipo_alerta: 'proyecto_sin_inicio',
      modulo: 'produccion' as const,
      titulo: `⏳ Proyecto sin iniciar — ${p.client_name}`,
      descripcion: `"${p.quote_number}" lleva ${daysSince(p.start_date)} día${daysSince(p.start_date) !== 1 ? 's' : ''} sin iniciarse (estado: ${p.status})`,
      prioridad: cfg.prioridad ?? 'media',
      roles_destino: cfg.roles_destino ?? ['admin'],
      navPath: '/production',
      meta: { projectId: p.id },
    }))
}

function evalTareaBloqueada(
  tasks: ProductionTask[],
  projects: ProductionProject[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  const blocked = tasks.filter(t => t.status === 'BLOCKED')
  // Group by project for a cleaner alert
  const byProject = new Map<string, ProductionTask[]>()
  for (const t of blocked) {
    if (!byProject.has(t.project_id)) byProject.set(t.project_id, [])
    byProject.get(t.project_id)!.push(t)
  }
  const alerts: LiveAlert[] = []
  for (const [projectId, ptasks] of byProject) {
    const proj = projects.find(p => p.id === projectId)
    alerts.push({
      id: liveId('tarea_bloqueada', projectId),
      tipo_alerta: 'tarea_bloqueada',
      modulo: 'produccion' as const,
      titulo: `🔒 Tareas bloqueadas — ${proj?.client_name ?? 'Proyecto'}`,
      descripcion: `${ptasks.length} tarea${ptasks.length !== 1 ? 's' : ''} bloqueada${ptasks.length !== 1 ? 's' : ''} en "${proj?.quote_number ?? projectId}"`,
      prioridad: 'alta' as AlertPriority,
      roles_destino: cfg.roles_destino ?? ['admin'],
      navPath: '/production',
      meta: { projectId, blockedCount: ptasks.length },
    })
  }
  return alerts
}

function evalMaterialesPendientes(
  projects: ProductionProject[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  return projects
    .filter(p =>
      p.status === 'IN_PROGRESS' &&
      p.requires_materials &&
      !p.materials_ready
    )
    .map(p => ({
      id: liveId('materiales_pendientes', p.id),
      tipo_alerta: 'materiales_pendientes',
      modulo: 'produccion' as const,
      titulo: `📦 Materiales pendientes — ${p.client_name}`,
      descripcion: `El proyecto "${p.quote_number}" está en marcha pero faltan materiales`,
      prioridad: 'alta' as AlertPriority,
      roles_destino: cfg.roles_destino ?? ['admin'],
      navPath: '/purchases',
      meta: { projectId: p.id },
    }))
}

function evalDisenoPendiente(
  projects: ProductionProject[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  return projects
    .filter(p =>
      p.status === 'IN_PROGRESS' &&
      p.requires_design &&
      !p.design_ready
    )
    .map(p => ({
      id: liveId('diseno_pendiente', p.id),
      tipo_alerta: 'diseno_pendiente',
      modulo: 'produccion' as const,
      titulo: `🎨 Diseño pendiente — ${p.client_name}`,
      descripcion: `El proyecto "${p.quote_number}" está en marcha pero el diseño no está aprobado`,
      prioridad: cfg.prioridad ?? 'media',
      roles_destino: cfg.roles_destino ?? ['admin'],
      navPath: '/production',
      meta: { projectId: p.id },
    }))
}

// ── Purchase evaluators ──────────────────────────────────────────────────────

function purchasesFromStorage(): PurchaseItem[] {
  try {
    const raw = localStorage.getItem('purchase_items')
    return raw ? (JSON.parse(raw) as PurchaseItem[]) : []
  } catch { return [] }
}

function evalPedidoUrgentesinPedir(
  purchases: PurchaseItem[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  const items = purchases.filter(
    p => p.status === 'PENDING' && (p.priority ?? 0) >= 6
  )
  if (items.length === 0) return []
  return [{
    id: liveId('pedido_urgente_sin_pedir', 'global'),
    tipo_alerta: 'pedido_urgente_sin_pedir',
    modulo: 'pedidos' as const,
    titulo: `🔴 ${items.length} material${items.length !== 1 ? 'es' : ''} urgente${items.length !== 1 ? 's' : ''} sin pedir`,
    descripcion: items.slice(0, 3).map(i => i.materialName).join(', ') + (items.length > 3 ? ` y ${items.length - 3} más` : ''),
    prioridad: 'alta' as AlertPriority,
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/purchases',
    meta: { count: items.length },
  }]
}

function evalPedidosPendientesResumen(
  purchases: PurchaseItem[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  const pending = purchases.filter(p => p.status === 'PENDING')
  if (pending.length === 0) return []
  return [{
    id: liveId('pedidos_pendientes_resumen', 'global'),
    tipo_alerta: 'pedidos_pendientes_resumen',
    modulo: 'pedidos' as const,
    titulo: `📋 ${pending.length} pedido${pending.length !== 1 ? 's' : ''} pendiente${pending.length !== 1 ? 's' : ''} de tramitar`,
    descripcion: pending.slice(0, 3).map(i => i.materialName).join(', ') + (pending.length > 3 ? ` y ${pending.length - 3} más` : ''),
    prioridad: cfg.prioridad ?? 'media',
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/purchases',
    meta: { count: pending.length },
  }]
}

function evalPedidoSinRecibir(
  purchases: PurchaseItem[],
  cfg: CRMAlertConfig
): LiveAlert[] {
  const umbral = cfg.dias_umbral ?? 10
  const items = purchases.filter(p => {
    if (p.status !== 'ORDERED') return false
    const orderedAt = p.orderedAt ? new Date(p.orderedAt) : null
    if (!orderedAt) return false
    return differenceInDays(new Date(), orderedAt) >= umbral
  })
  return items.map(p => ({
    id: liveId('pedido_sin_recibir', p.id),
    tipo_alerta: 'pedido_sin_recibir',
    modulo: 'pedidos' as const,
    titulo: `📬 Pedido sin recibir — ${p.materialName}`,
    descripcion: `Pedido hace ${differenceInDays(new Date(), new Date(p.orderedAt!))} días${p.provider ? ` (${p.provider})` : ''}${p.projectNumber ? ` · Proyecto ${p.projectNumber}` : ''}`,
    prioridad: cfg.prioridad ?? 'media',
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/purchases',
    meta: { purchaseId: p.id },
  }))
}

// ── Stock evaluators ─────────────────────────────────────────────────────────

type StockItem = { REFERENCIA?: string; ARTICULO?: string; DESCRIPCION?: string; CANTIDAD: number; STOCK_MINIMO?: number; COSTE_IVA_INCLUIDO?: number }

function stockFromStorage(): StockItem[] {
  try {
    const raw = localStorage.getItem('stock_items')
    return raw ? (JSON.parse(raw) as StockItem[]) : []
  } catch { return [] }
}

function evalStockBajo(stock: StockItem[], cfg: CRMAlertConfig): LiveAlert[] {
  const items = stock.filter(
    s => s.STOCK_MINIMO != null && s.CANTIDAD > 0 && s.CANTIDAD < s.STOCK_MINIMO!
  )
  if (items.length === 0) return []
  return [{
    id: liveId('stock_bajo', 'global'),
    tipo_alerta: 'stock_bajo',
    modulo: 'stock' as const,
    titulo: `📉 ${items.length} artículo${items.length !== 1 ? 's' : ''} por debajo del mínimo`,
    descripcion: items.slice(0, 3).map(s => s.DESCRIPCION ?? s.ARTICULO ?? s.REFERENCIA ?? '').filter(Boolean).join(', ') + (items.length > 3 ? ` y ${items.length - 3} más` : ''),
    prioridad: cfg.prioridad ?? 'media',
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/purchases',
    meta: { count: items.length },
  }]
}

function evalStockCero(stock: StockItem[], cfg: CRMAlertConfig): LiveAlert[] {
  const items = stock.filter(s => s.CANTIDAD === 0)
  if (items.length === 0) return []
  return [{
    id: liveId('stock_cero', 'global'),
    tipo_alerta: 'stock_cero',
    modulo: 'stock' as const,
    titulo: `❌ ${items.length} artículo${items.length !== 1 ? 's' : ''} agotado${items.length !== 1 ? 's' : ''}`,
    descripcion: items.slice(0, 3).map(s => s.DESCRIPCION ?? s.ARTICULO ?? s.REFERENCIA ?? '').filter(Boolean).join(', ') + (items.length > 3 ? ` y ${items.length - 3} más` : ''),
    prioridad: 'alta' as AlertPriority,
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/purchases',
    meta: { count: items.length },
  }]
}

// ── Quotes evaluators ────────────────────────────────────────────────────────

function evalPresupuestoAltoValor(quotes: Quote[], cfg: CRMAlertConfig): LiveAlert[] {
  const umbral = cfg.dias_umbral ?? 14
  const HIGH_VALUE = 5000  // €
  const items = quotes.filter(q => {
    if (q.status === 'APPROVED' || q.status === 'REJECTED') return false
    if ((q.total ?? 0) < HIGH_VALUE) return false
    return daysSince(q.createdAt ?? (q as any).created_at) >= umbral
  })
  return items.map(q => ({
    id: liveId('presupuesto_alto_perdido', q.id),
    tipo_alerta: 'presupuesto_alto_perdido',
    modulo: 'presupuestos' as const,
    titulo: `💰 Presupuesto alto sin respuesta — ${q.clientName ?? q.quoteNumber}`,
    descripcion: `Valor: ${(q.total ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · ${daysSince(q.createdAt ?? (q as any).created_at)} días en estado ${q.status}`,
    prioridad: 'alta' as AlertPriority,
    roles_destino: cfg.roles_destino ?? ['admin'],
    navPath: '/quotes',
    meta: { quoteId: q.id, total: q.total ?? 0 },
  }))
}

// ── Main live engine ─────────────────────────────────────────────────────────

export const LiveAlertsEngine = {
  async getLiveAlerts(configs: CRMAlertConfig[]): Promise<LiveAlert[]> {
    const dismissed = getDismissed()

    // Fetch all data from Supabase in parallel
    let projects: ProductionProject[] = []
    let tasks: ProductionTask[] = []
    let purchases: PurchaseItem[] = []
    let stock: StockItem[] = stockFromStorage()            // localStorage as fallback
    let quotes: Quote[] = quotesFromStorage()              // localStorage as fallback
    try {
      const [projRes, taskRes, purchRes, stockRes, quotesRes] = await Promise.all([
        supabase
          .from('production_projects')
          .select('id,quote_number,client_name,vehicle_model,status,start_date,end_date,requires_materials,materials_ready,requires_design,design_ready')
          .not('status', 'eq', 'COMPLETED')
          .limit(500),
        supabase
          .from('production_tasks')
          .select('id,project_id,task_name,status,blocked_reason')
          .eq('status', 'BLOCKED')
          .limit(500),
        supabase
          .from('purchase_items')
          .select('id,material_name,status,priority,ordered_at,provider,project_number')
          .in('status', ['PENDING', 'ORDERED'])
          .limit(500),
        supabase
          .from('stock_items')
          .select('referencia,articulo,descripcion,cantidad,stock_minimo')
          .limit(2000),
        supabase
          .from('quotes')
          .select('id,quote_number,client_name,total,status,created_at,lead_id')
          .not('status', 'in', '("APPROVED","REJECTED")')
          .limit(200),
      ])
      projects = (projRes.data ?? []) as ProductionProject[]
      tasks = (taskRes.data ?? []) as ProductionTask[]
      // Merge Supabase purchases (normalize snake_case → camelCase) with localStorage
      // localStorage is primary (has orderedAt), Supabase supplements with DB-only items
      const dbPurchases = (purchRes.data ?? []).map((r: any) => ({
        id: r.id,
        materialName: r.material_name ?? '',
        status: r.status,
        priority: r.priority ?? 5,
        orderedAt: r.ordered_at ? new Date(r.ordered_at) : undefined,
        provider: r.provider,
        projectNumber: r.project_number,
      } as PurchaseItem))
      if (dbPurchases.length > 0) {
        // Merge: DB items that aren't already in localStorage (by id)
        const lsIds = new Set(purchases.map(p => p.id))
        const newFromDB = dbPurchases.filter(p => !lsIds.has(p.id))
        purchases = [...purchases, ...newFromDB]
      }
      // Map stock from Supabase (lowercase columns) to uppercase StockItem shape
      const dbStock = (stockRes.data ?? []).map((r: any) => ({
        REFERENCIA: r.referencia,
        ARTICULO: r.articulo,
        DESCRIPCION: r.descripcion,
        CANTIDAD: r.cantidad ?? 0,
        STOCK_MINIMO: r.stock_minimo,
      } as StockItem))
      if (dbStock.length > 0) stock = dbStock
      // Map quotes from Supabase (snake_case → Quote shape)
      const dbQuotes = (quotesRes.data ?? []).map((r: any) => ({
        id: r.id,
        quoteNumber: r.quote_number,
        clientName: r.client_name ?? '',
        total: r.total ?? 0,
        status: r.status,
        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        lead_id: r.lead_id ?? undefined,
      } as unknown as Quote))
      if (dbQuotes.length > 0) quotes = dbQuotes
    } catch { /* DB unavailable — use localStorage fallback */ }

    const all: LiveAlert[] = []

    const run = (tipo: string, fn: (cfg: CRMAlertConfig) => LiveAlert[]) => {
      const cfg = configFor(tipo, configs)
      if (!cfg) return
      all.push(...fn(cfg))
    }
    const runWithProjects = (tipo: string, fn: (p: ProductionProject[], cfg: CRMAlertConfig) => LiveAlert[]) => {
      const cfg = configFor(tipo, configs)
      if (!cfg) return
      all.push(...fn(projects, cfg))
    }

    runWithProjects('proyecto_atrasado',   evalProyectoAtrasado)
    runWithProjects('proyecto_sin_inicio', evalProyectoSinInicio)
    runWithProjects('materiales_pendientes', evalMaterialesPendientes)
    runWithProjects('diseno_pendiente',    evalDisenoPendiente)

    const cfgBlocked = configFor('tarea_bloqueada', configs)
    if (cfgBlocked) all.push(...evalTareaBloqueada(tasks, projects, cfgBlocked))

    const runWithPurchases = (tipo: string, fn: (p: PurchaseItem[], cfg: CRMAlertConfig) => LiveAlert[]) => {
      const cfg = configFor(tipo, configs)
      if (!cfg) return
      all.push(...fn(purchases, cfg))
    }
    const runWithStock = (tipo: string, fn: (s: StockItem[], cfg: CRMAlertConfig) => LiveAlert[]) => {
      const cfg = configFor(tipo, configs)
      if (!cfg) return
      all.push(...fn(stock, cfg))
    }

    const runWithQuotes = (tipo: string, fn: (q: Quote[], cfg: CRMAlertConfig) => LiveAlert[]) => {
      const cfg = configFor(tipo, configs)
      if (!cfg) return
      all.push(...fn(quotes, cfg))
    }

    runWithPurchases('pedido_urgente_sin_pedir',   evalPedidoUrgentesinPedir)
    runWithPurchases('pedidos_pendientes_resumen',  evalPedidosPendientesResumen)
    runWithPurchases('pedido_sin_recibir',           evalPedidoSinRecibir)
    runWithStock('stock_bajo',                   evalStockBajo)
    runWithStock('stock_cero',                   evalStockCero)
    runWithQuotes('presupuesto_alto_perdido', evalPresupuestoAltoValor)

    // Filter dismissed
    return all.filter(a => !dismissed[a.id])
  },
}
