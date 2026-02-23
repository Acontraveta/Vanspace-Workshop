// ─────────────────────────────────────────────────────────────
// UNIFIED CALENDAR TYPES
// Covers all branches: produccion, crm, pedidos, presupuestos, general
// ─────────────────────────────────────────────────────────────

export type EventBranch = 'produccion' | 'crm' | 'pedidos' | 'presupuestos' | 'general'

export type EventType =
  // CRM / Vehículos
  | 'RECEPCION'
  | 'ENTREGA'
  | 'REVISION'
  | 'CITA'
  // Producción
  | 'PROYECTO_INICIO'
  | 'PROYECTO_FIN'
  | 'PROYECTO_SPAN'  // multi-day project (rendered as a span)
  // Pedidos
  | 'ENTREGA_ESPERADA'
  | 'SEGUIMIENTO_PEDIDO'
  // Presupuestos
  | 'SEGUIMIENTO_PRESUPUESTO'
  | 'VENCIMIENTO'
  // General
  | 'REUNION'
  | 'RECORDATORIO'
  | 'NOTA'

export interface BranchMeta {
  label: string
  icon: string
  bgClass: string
  borderClass: string
  textClass: string
  badgeClass: string
}

export const BRANCH_META: Record<EventBranch, BranchMeta> = {
  produccion: {
    label: 'Producción',
    icon: '🔧',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-400',
    textClass: 'text-blue-800',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-300',
  },
  crm: {
    label: 'CRM / Vehículos',
    icon: '🚐',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-400',
    textClass: 'text-green-800',
    badgeClass: 'bg-green-100 text-green-700 border border-green-300',
  },
  pedidos: {
    label: 'Pedidos',
    icon: '📦',
    bgClass: 'bg-orange-100',
    borderClass: 'border-orange-400',
    textClass: 'text-orange-800',
    badgeClass: 'bg-orange-100 text-orange-700 border border-orange-300',
  },
  presupuestos: {
    label: 'Presupuestos',
    icon: '💰',
    bgClass: 'bg-yellow-100',
    borderClass: 'border-yellow-400',
    textClass: 'text-yellow-800',
    badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-300',
  },
  general: {
    label: 'General',
    icon: '📌',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-400',
    textClass: 'text-gray-700',
    badgeClass: 'bg-gray-100 text-gray-700 border border-gray-300',
  },
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  RECEPCION: 'Recepción vehículo',
  ENTREGA: 'Entrega vehículo',
  REVISION: 'Revisión',
  CITA: 'Cita',
  PROYECTO_INICIO: 'Inicio de proyecto',
  PROYECTO_FIN: 'Fin de proyecto',
  PROYECTO_SPAN: 'Proyecto en producción',
  ENTREGA_ESPERADA: 'Entrega esperada pedido',
  SEGUIMIENTO_PEDIDO: 'Seguimiento pedido',
  SEGUIMIENTO_PRESUPUESTO: 'Seguimiento presupuesto',
  VENCIMIENTO: 'Vencimiento presupuesto',
  REUNION: 'Reunión',
  RECORDATORIO: 'Recordatorio',
  NOTA: 'Nota',
}

export const EVENT_TYPES_BY_BRANCH: Record<EventBranch, EventType[]> = {
  crm: ['RECEPCION', 'ENTREGA', 'REVISION', 'CITA'],
  produccion: ['PROYECTO_INICIO', 'PROYECTO_FIN', 'PROYECTO_SPAN'],
  pedidos: ['ENTREGA_ESPERADA', 'SEGUIMIENTO_PEDIDO'],
  presupuestos: ['SEGUIMIENTO_PRESUPUESTO', 'VENCIMIENTO'],
  general: ['REUNION', 'RECORDATORIO', 'NOTA'],
}

export const ROLES_BY_BRANCH: Record<EventBranch, string[]> = {
  produccion: ['admin', 'encargado', 'encargado_taller', 'operario'],
  crm: ['admin', 'encargado', 'compras'],
  pedidos: ['admin', 'encargado', 'compras'],
  presupuestos: ['admin', 'encargado'],
  general: ['admin', 'encargado', 'encargado_taller', 'compras', 'operario'],
}

// ─── Unified event model ────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  /** Start date: yyyy-MM-dd */
  date: string
  /** End date for multi-day events: yyyy-MM-dd */
  endDate?: string
  /** HH:mm */
  time?: string
  branch: EventBranch
  eventType: string
  /** ID of the originating record (project, quote, purchase…) */
  sourceId?: string
  metadata?: Record<string, any>
  visibleRoles: string[]
  createdBy?: string
  createdAt?: string
}

// ─── Form model (for EventModal) ────────────────────────────

export interface CalendarEventForm {
  title: string
  description: string
  date: string
  endDate: string
  time: string
  branch: EventBranch
  eventType: EventType | ''
  clientName: string
  vehicleModel: string
  plate: string
  projectNumber: string
  leadId: string
  visibleRoles: string[]
}

export const emptyEventForm = (): CalendarEventForm => ({
  title: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  endDate: '',
  time: '',
  branch: 'general',
  eventType: 'NOTA',
  clientName: '',
  vehicleModel: '',
  plate: '',
  projectNumber: '',
  leadId: '',
  visibleRoles: ['admin', 'encargado', 'encargado_taller', 'compras', 'operario'],
})

// ─── Supabase DB row ────────────────────────────────────────

export interface CalendarEventRow {
  id: string
  title: string
  description: string | null
  event_date: string
  end_date: string | null
  event_time: string | null
  branch: string
  event_type: string | null
  source_id: string | null
  metadata: Record<string, any> | null
  visible_roles: string[]
  created_by: string | null
  created_at: string
}
