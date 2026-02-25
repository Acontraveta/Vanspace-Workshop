// ============================================================
// CRM TYPES — matches crm_leads Supabase table schema
// ============================================================

export type LeadStatus =
  | 'Nuevo'
  | 'Contactado'
  | 'Presupuesto enviado'
  | 'Negociación'
  | 'Aprobado'
  | 'Perdido'
  | 'En espera'
  | 'Entregado'

// A completed commercial cycle archived into the lead's oportunidades array
export interface LeadOpportunity {
  id: string
  estado: string
  importe?: number
  linea_negocio?: string
  vehiculo?: string
  notas?: string
  fecha_inicio?: string
  fecha_entrega?: string
  satisfaccion?: string
  created_at: string
}

export type LeadOrigen =
  | 'Instagram'
  | 'Facebook'
  | 'Referido'
  | 'Feria'
  | 'Llamada'
  | 'Email'
  | 'Otro'

export interface Lead {
  id: string
  excel_row_number?: number

  // Identificación
  fecha?: string          // DATE
  mes?: string
  asignado?: string
  cliente: string
  telefono?: string
  email?: string
  localidad?: string
  provincia?: string
  region?: string

  // Vehículo / proyecto
  origen?: string         // canal de captación
  vehiculo?: string
  matricula?: string
  talla?: string
  viaj_dorm?: string      // viajero/dormitorio
  linea_negocio?: string

  // Estado comercial
  estado?: LeadStatus | string
  importe?: number
  proxima_accion?: string
  fecha_accion?: string | null   // DATE

  // Seguimiento
  notas?: string
  fecha_entrega?: string | null  // DATE
  satisfaccion?: string
  incidencias?: string
  resena?: string

  // Recepción del vehículo
  fecha_recepcion?: string | null   // DATE — scheduled reception
  hora_recepcion?: string | null     // TIME — scheduled reception
  recepcion_confirmada?: boolean     // true after the vehicle is actually received

  // Oportunidades (historical commercial states)
  oportunidades?: LeadOpportunity[]

  // Timestamps
  created_at?: string
  updated_at?: string
  synced_at?: string
}

export interface LeadFilters {
  search?: string
  estado?: string
  asignado?: string
  origen?: string
  mes?: string
  region?: string
  linea_negocio?: string
}

export interface LeadFormData extends Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'synced_at'> {}

export interface CRMStats {
  total: number
  nuevos: number
  aprobados: number
  perdidos: number
  enProceso: number
  importeTotal: number
  importeAprobado: number
  tasaConversion: number
}

export type CRMView = 'table' | 'kanban'

export interface ExcelSyncStatus {
  isImporting: boolean
  isExporting: boolean
  lastSync?: string
  error?: string
  rowsImported?: number
}
