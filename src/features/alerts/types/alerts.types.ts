// ============================================================
// ALERT SYSTEM TYPES — unified configurable alerts
// ============================================================

export type AlertPriority = 'alta' | 'media' | 'baja'

export type AlertInstanceState = 'pendiente' | 'vista' | 'resuelta' | 'descartada'

/** Modules that can produce alerts */
export type AlertModule = 'crm' | 'produccion' | 'pedidos' | 'stock' | 'presupuestos'

export const MODULE_META: Record<AlertModule, { label: string; icon: string; navPath: string }> = {
  crm:           { label: 'CRM',           icon: '👥', navPath: '/crm' },
  produccion:    { label: 'Producción',    icon: '🏭', navPath: '/production' },
  pedidos:       { label: 'Pedidos',       icon: '📦', navPath: '/purchases' },
  stock:         { label: 'Stock',         icon: '📊', navPath: '/purchases' },
  presupuestos:  { label: 'Presupuestos',  icon: '💰', navPath: '/quotes' },
}

export type CRMAlertTipo =
  | 'presupuesto_caducando'
  | 'llamada_calidad'
  | 'revision_programada'
  | 'sin_actividad'
  | 'fecha_accion_vencida'
  | 'seguimiento_negociacion'

export const ALERT_TIPO_META: Record<CRMAlertTipo, { icono: string; label: string }> = {
  presupuesto_caducando:  { icono: '📄', label: 'Presupuesto sin respuesta' },
  llamada_calidad:        { icono: '📞', label: 'Control de calidad' },
  revision_programada:    { icono: '🔧', label: 'Revisión programada' },
  sin_actividad:          { icono: '😴', label: 'Sin actividad' },
  fecha_accion_vencida:   { icono: '⏰', label: 'Acción vencida' },
  seguimiento_negociacion:{ icono: '🤝', label: 'Seguimiento negociación' },
}

/** Row in alert_settings (extended for all modules) */
export interface CRMAlertConfig {
  tipo_alerta: CRMAlertTipo | string
  nombre: string
  descripcion: string
  icono: string
  activa: boolean
  dias_umbral: number
  roles_destino: string[]
  prioridad: AlertPriority
  modulo: AlertModule
  destinatario?: string
  condicion?: string
  updated_at?: string
}

/** Row in crm_alert_instances (Supabase-persisted — CRM only) */
export interface CRMAlertInstance {
  id: string
  tipo_alerta: CRMAlertTipo | string
  lead_id: string
  titulo: string
  descripcion: string
  prioridad: AlertPriority
  roles_destino: string[]
  estado: AlertInstanceState
  fecha_generada: string
  resuelta_por?: string
  resuelta_at?: string
  created_at?: string
  /** Populated client-side via join */
  lead?: {
    cliente: string
    telefono?: string
    email?: string
    vehiculo?: string
    estado?: string
  }
}

/**
 * Live alert — computed in-memory from production / purchases / stock data.
 * Not persisted in Supabase. Dismissal tracked in localStorage for 24h.
 */
export interface LiveAlert {
  /** Deterministic: `${tipo_alerta}__${contextId}` */
  id: string
  tipo_alerta: string
  modulo: AlertModule
  titulo: string
  descripcion: string
  prioridad: AlertPriority
  roles_destino: string[]
  /** Link for "Ver en …" button */
  navPath: string
  /** Extra metadata (project name, SKU, etc.) */
  meta?: Record<string, string | number>
}

/** Unified alert shown in the panel — either persisted (CRM) or live */
export type UnifiedAlert =
  | (CRMAlertInstance & { _kind: 'crm'; modulo: 'crm' })
  | (LiveAlert       & { _kind: 'live'; estado: AlertInstanceState })

export const PRIORITY_ORDER: Record<AlertPriority, number> = {
  alta: 0,
  media: 1,
  baja: 2,
}

export const PRIORITY_COLORS: Record<AlertPriority, string> = {
  alta:  'bg-red-100 text-red-700 border-red-200',
  media: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  baja:  'bg-blue-100 text-blue-700 border-blue-200',
}

export const PRIORITY_DOT: Record<AlertPriority, string> = {
  alta:  'bg-red-500',
  media: 'bg-yellow-500',
  baja:  'bg-blue-500',
}

export const MODULE_COLORS: Record<AlertModule, string> = {
  crm:          'bg-purple-100 text-purple-700',
  produccion:   'bg-orange-100 text-orange-700',
  pedidos:      'bg-blue-100 text-blue-700',
  stock:        'bg-teal-100 text-teal-700',
  presupuestos: 'bg-green-100 text-green-700',
}
