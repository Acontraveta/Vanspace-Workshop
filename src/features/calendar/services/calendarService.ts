import { supabase } from '@/lib/supabase'
import {
  CalendarEvent,
  CalendarEventForm,
  CalendarEventRow,
  EventBranch,
} from '../types/calendar.types'
import { ProductionProject } from '../types/production.types'
import { PurchaseItem } from '@/features/purchases/types/purchase.types'
import { Quote } from '@/features/quotes/types/quote.types'
import { format, addDays, parseISO, isAfter, isBefore } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// Converters: raw data → unified CalendarEvent
// ─────────────────────────────────────────────────────────────

function rowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    date: row.event_date.substring(0, 10),
    endDate: row.end_date ? row.end_date.substring(0, 10) : undefined,
    time: row.event_time ?? undefined,
    branch: row.branch as EventBranch,
    eventType: row.event_type ?? 'NOTA',
    sourceId: row.source_id ?? undefined,
    metadata: row.metadata ?? undefined,
    visibleRoles: row.visible_roles ?? [],
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

function projectToEvents(p: ProductionProject): CalendarEvent[] {
  if (!p.start_date || !p.end_date) return []
  const events: CalendarEvent[] = []

  // Normalise to plain yyyy-MM-dd (Supabase DATE cols sometimes return with time component)
  const startDate = p.start_date.substring(0, 10)
  const endDate = p.end_date.substring(0, 10)

  // Span event (renders across all days of the project)
  const statusLabel = p.status === 'IN_PROGRESS' ? '▶ En taller' : '🗓 Planificado'
  events.push({
    id: `prod-span-${p.id}`,
    title: p.client_name + (p.vehicle_model ? ` · ${p.vehicle_model}` : ''),
    description: `${p.quote_number} · ${statusLabel}${p.notes ? ' · ' + p.notes : ''}`,
    date: startDate,
    endDate: endDate,
    branch: 'produccion',
    eventType: 'PROYECTO_SPAN',
    sourceId: p.id,
    metadata: {
      status: p.status,
      totalHours: p.total_hours,
      vehicleModel: p.vehicle_model,
    },
    visibleRoles: ['admin', 'encargado', 'encargado_taller', 'operario'],
  })

  return events
}

function purchaseToEvent(item: PurchaseItem): CalendarEvent | null {
  // We generate an "expected delivery" event when an item is ORDERED
  // and has orderedAt. Delivery expected = orderedAt + deliveryDays (default 7).
  if (item.status !== 'ORDERED' || !item.orderedAt) return null

  const orderedDate = item.orderedAt instanceof Date ? item.orderedAt : new Date(item.orderedAt)
  const deliveryDays = item.deliveryDays ?? 7
  const expectedDate = addDays(orderedDate, deliveryDays)
  const dateStr = format(expectedDate, 'yyyy-MM-dd')

  return {
    id: `pedido-${item.id}`,
    title: `Entrega: ${item.materialName}`,
    description: `Proveedor: ${item.provider ?? 'No especificado'} · ${item.quantity} ${item.unit}`,
    date: dateStr,
    branch: 'pedidos',
    eventType: 'ENTREGA_ESPERADA',
    sourceId: item.id,
    metadata: {
      priority: item.priority,
      provider: item.provider,
      projectNumber: item.projectNumber,
    },
    visibleRoles: ['admin', 'encargado', 'compras'],
  }
}

function quoteToEvent(quote: Quote): CalendarEvent | null {
  // Only SENT quotes with a follow-up date (sent more than 5 days ago)
  if (quote.status !== 'SENT' || !quote.createdAt) return null

  const sentDate = new Date(quote.createdAt)
  const followUpDate = addDays(sentDate, 5)

  // Only show if follow-up is in the future (or in the last 7 days)
  const sevenDaysAgo = addDays(new Date(), -7)
  if (isBefore(followUpDate, sevenDaysAgo)) return null

  return {
    id: `pres-${quote.id}`,
    title: `Seguimiento ${quote.quoteNumber}`,
    description: `Presupuesto enviado sin respuesta · ${quote.total?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`,
    date: format(followUpDate, 'yyyy-MM-dd'),
    branch: 'presupuestos',
    eventType: 'SEGUIMIENTO_PRESUPUESTO',
    sourceId: quote.id,
    metadata: {
      quoteNumber: quote.quoteNumber,
      total: quote.total,
    },
    visibleRoles: ['admin', 'encargado'],
  }
}

// ─────────────────────────────────────────────────────────────
// UnifiedCalendarService
// ─────────────────────────────────────────────────────────────

export class UnifiedCalendarService {
  // ── Fetch all events ─────────────────────────────────

  static async getAllEvents(): Promise<CalendarEvent[]> {
    const [customEvents, productionEvents, purchaseEvents, quoteEvents] = await Promise.all([
      this.getCustomEvents(),
      this.getProductionEvents(),
      this.getPurchaseEvents(),
      this.getQuoteEvents(),
    ])

    return [...customEvents, ...productionEvents, ...purchaseEvents, ...quoteEvents].sort(
      (a, b) => a.date.localeCompare(b.date),
    )
  }

  // ── Custom events (Supabase table) ───────────────────

  static async getCustomEvents(): Promise<CalendarEvent[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true })

      if (error) throw error
      return (data ?? []).map((r) => rowToEvent(r as CalendarEventRow))
    } catch (err) {
      console.error('[CalendarService] Error fetching custom events:', err)
      return []
    }
  }

  // ── Production events (from production_projects) ─────

  static async getProductionEvents(): Promise<CalendarEvent[]> {
    try {
      const { data, error } = await supabase
        .from('production_projects')
        .select(
          'id,quote_number,client_name,vehicle_model,start_date,end_date,status,total_hours,total_days,notes,priority',
        )
        .in('status', ['SCHEDULED', 'IN_PROGRESS'])
        .not('start_date', 'is', null)
        .order('start_date', { ascending: true })
        .limit(200)

      if (error) throw error
      return (data as ProductionProject[]).flatMap((p) => projectToEvents(p))
    } catch (err) {
      console.error('[CalendarService] Error fetching production events:', err)
      return []
    }
  }

  // ── Purchase delivery events ──────────────────────────

  static async getPurchaseEvents(): Promise<CalendarEvent[]> {
    try {
      // Try Supabase first
      const { data, error } = await supabase
        .from('purchase_items')
        .select('id,material_name,status,priority,ordered_at,provider,delivery_days,quantity,unit,project_number')
        .eq('status', 'ORDERED')
        .not('ordered_at', 'is', null)
        .limit(200)

      if (!error && data && data.length > 0) {
        const items: PurchaseItem[] = data.map((r: any) => ({
          id: r.id,
          materialName: r.material_name,
          status: r.status,
          priority: r.priority ?? 5,
          orderedAt: r.ordered_at ? new Date(r.ordered_at) : undefined,
          provider: r.provider,
          deliveryDays: r.delivery_days ?? 7,
          quantity: r.quantity ?? 1,
          unit: r.unit ?? 'ud',
          projectNumber: r.project_number,
          createdAt: new Date(),
        }))
        return items.flatMap((i) => purchaseToEvent(i) ?? [])
      }

      // Fallback: localStorage
      const stored = localStorage.getItem('purchase_items')
      if (!stored) return []
      const items: PurchaseItem[] = JSON.parse(stored)
      return items.flatMap((i) => purchaseToEvent(i) ?? [])
    } catch (err) {
      console.error('[CalendarService] Error fetching purchase events:', err)
      return []
    }
  }

  // ── Quote follow-up events ────────────────────────────

  static async getQuoteEvents(): Promise<CalendarEvent[]> {
    try {
      // Intentar traer quotes de Supabase primero
      const { data, error } = await supabase
        .from('quotes')
        .select('id,quote_number,client_name,client_email,client_phone,vehicle_model,status,total,created_at,valid_until,lead_id')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        const quotes: Quote[] = data.map((r: any) => ({
          id: r.id,
          quoteNumber: r.quote_number ?? '',
          clientName: r.client_name ?? '',
          clientEmail: r.client_email,
          clientPhone: r.client_phone,
          vehicleModel: r.vehicle_model,
          status: r.status,
          total: Number(r.total ?? 0),
          createdAt: new Date(r.created_at),
          validUntil: new Date(r.valid_until ?? r.created_at),
          lead_id: r.lead_id,
          items: [],
          subtotalMaterials: 0,
          subtotalLabor: 0,
          subtotal: 0,
          profitMargin: 0,
          profitAmount: 0,
          totalHours: 0,
          tarifa: {},
        } as Quote))
        return quotes.flatMap((q) => quoteToEvent(q) ?? [])
      }

      // Fallback a localStorage
      const stored = localStorage.getItem('saved_quotes')
      if (!stored) return []
      const quotes: Quote[] = JSON.parse(stored)
      return quotes.flatMap((q) => quoteToEvent(q) ?? [])
    } catch (err) {
      console.error('[CalendarService] Error fetching quote events:', err)
      return []
    }
  }

  // ── CRUD for custom events ────────────────────────────

  static async createEvent(form: CalendarEventForm, createdBy?: string): Promise<CalendarEvent> {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.date,
      end_date: form.endDate || null,
      event_time: form.time || null,
      branch: form.branch,
      event_type: form.eventType || null,
      source_id: null,
      metadata: {
        ...(form.clientName ? { clientName: form.clientName } : {}),
        ...(form.vehicleModel ? { vehicleModel: form.vehicleModel } : {}),
        ...(form.plate ? { plate: form.plate } : {}),
        ...(form.projectNumber ? { projectNumber: form.projectNumber } : {}),
        ...(form.leadId ? { leadId: form.leadId } : {}),
      },
      visible_roles: form.visibleRoles,
      created_by: createdBy ?? null,
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return rowToEvent(data as CalendarEventRow)
  }

  static async updateEvent(id: string, form: Partial<CalendarEventForm>): Promise<void> {
    const payload: Record<string, any> = {}
    if (form.title !== undefined) payload.title = form.title
    if (form.description !== undefined) payload.description = form.description
    if (form.date !== undefined) payload.event_date = form.date
    if (form.endDate !== undefined) payload.end_date = form.endDate || null
    if (form.time !== undefined) payload.event_time = form.time || null
    if (form.branch !== undefined) payload.branch = form.branch
    if (form.eventType !== undefined) payload.event_type = form.eventType
    if (form.visibleRoles !== undefined) payload.visible_roles = form.visibleRoles

    const { error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', id)

    if (error) throw error
  }

  static async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) throw error
  }

  // ── Helpers ───────────────────────────────────────────

  static filterByRole(events: CalendarEvent[], role: string): CalendarEvent[] {
    return events.filter((e) => e.visibleRoles.includes(role))
  }

  static filterByBranch(events: CalendarEvent[], branches: EventBranch[]): CalendarEvent[] {
    if (branches.length === 0) return events
    return events.filter((e) => branches.includes(e.branch))
  }

  /**
   * Returns all events that "touch" the given date:
   * - Single-day events with date === dateStr
   * - Multi-day events where start <= date <= end
   */
  static eventsForDay(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
    return events.filter((e) => {
      if (e.endDate && e.endDate !== e.date) {
        return dateStr >= e.date && dateStr <= e.endDate
      }
      return e.date === dateStr
    })
  }
}
