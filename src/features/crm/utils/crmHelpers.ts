import type { Lead, LeadStatus, CRMStats } from '../types/crm.types'

// ============================================================
// STATUS CONFIG
// ============================================================

export interface StatusConfig {
  label: string
  color: string        // Tailwind bg color
  textColor: string    // Tailwind text color
  borderColor: string
  order: number
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  'Nuevo': {
    label: 'Nuevo',
    color: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300',
    order: 0
  },
  'Contactado': {
    label: 'Contactado',
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    order: 1
  },
  'Presupuesto enviado': {
    label: 'Presupuesto enviado',
    color: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-300',
    order: 2
  },
  'Negociación': {
    label: 'Negociación',
    color: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    order: 3
  },
  'En espera': {
    label: 'En espera',
    color: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    order: 4
  },
  'Aprobado': {
    label: 'Aprobado ✅',
    color: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300',
    order: 5
  },
  'Entregado': {
    label: 'Entregado 🚐',
    color: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300',
    order: 6
  },
  'Perdido': {
    label: 'Perdido ❌',
    color: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    order: 7
  },
}

export const KANBAN_COLUMNS: LeadStatus[] = [
  'Nuevo',
  'Contactado',
  'Presupuesto enviado',
  'Negociación',
  'En espera',
  'Aprobado',
  'Entregado',
  'Perdido',
]

export const ALL_STATUSES = Object.keys(STATUS_CONFIG)

export function getStatusConfig(estado?: string): StatusConfig {
  return STATUS_CONFIG[estado ?? ''] ?? {
    label: estado ?? 'Desconocido',
    color: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    order: 99
  }
}

// ============================================================
// STATS
// ============================================================

export function computeCRMStats(leads: Lead[]): CRMStats {
  const aprobados = leads.filter(l => l.estado === 'Aprobado' || l.estado === 'Entregado')
  const perdidos = leads.filter(l => l.estado === 'Perdido')
  const enProceso = leads.filter(l =>
    l.estado !== 'Aprobado' && l.estado !== 'Entregado' && l.estado !== 'Perdido'
  )
  const importeTotal = leads.reduce((sum, l) => sum + (l.importe ?? 0), 0)
  const importeAprobado = aprobados.reduce((sum, l) => sum + (l.importe ?? 0), 0)

  return {
    total: leads.length,
    nuevos: leads.filter(l => l.estado === 'Nuevo' || !l.estado).length,
    aprobados: aprobados.length,
    perdidos: perdidos.length,
    enProceso: enProceso.length,
    importeTotal,
    importeAprobado,
    tasaConversion: leads.length > 0
      ? Math.round((aprobados.length / leads.length) * 100)
      : 0
  }
}

// ============================================================
// FORMATTERS
// ============================================================

export function formatCurrency(amount?: number): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES').format(new Date(dateStr))
  } catch {
    return dateStr
  }
}

export function formatPhone(phone?: string): string {
  if (!phone) return '—'
  return phone.replace(/(\d{3})(\d{3})(\d{3,4})/, '$1 $2 $3')
}

// ============================================================
// EXCEL COLUMN MAPPING
// ============================================================
// Maps Excel column headers → crm_leads field names
// Adjust header names to match your actual Excel file

export const EXCEL_COLUMN_MAP: Record<string, keyof import('../types/crm.types').Lead> = {
  'fecha': 'fecha',
  'Fecha': 'fecha',
  'FECHA': 'fecha',
  'mes': 'mes',
  'Mes': 'mes',
  'MES': 'mes',
  'asignado': 'asignado',
  'Asignado': 'asignado',
  'ASIGNADO': 'asignado',
  'cliente': 'cliente',
  'Cliente': 'cliente',
  'CLIENTE': 'cliente',
  'telefono': 'telefono',
  'Teléfono': 'telefono',
  'Telefono': 'telefono',
  'TELEFONO': 'telefono',
  'email': 'email',
  'Email': 'email',
  'EMAIL': 'email',
  'localidad': 'localidad',
  'Localidad': 'localidad',
  'LOCALIDAD': 'localidad',
  'provincia': 'provincia',
  'Provincia': 'provincia',
  'PROVINCIA': 'provincia',
  'region': 'region',
  'Region': 'region',
  'Región': 'region',
  'REGION': 'region',
  'origen': 'origen',
  'Origen': 'origen',
  'ORIGEN': 'origen',
  'vehiculo': 'vehiculo',
  'Vehiculo': 'vehiculo',
  'Vehículo': 'vehiculo',
  'VEHICULO': 'vehiculo',
  'talla': 'talla',
  'Talla': 'talla',
  'TALLA': 'talla',
  'viaj_dorm': 'viaj_dorm',
  'Viaj/Dorm': 'viaj_dorm',
  'viajero/dormitorio': 'viaj_dorm',
  'linea_negocio': 'linea_negocio',
  'Línea negocio': 'linea_negocio',
  'Linea negocio': 'linea_negocio',
  'Línea de negocio': 'linea_negocio',
  'estado': 'estado',
  'Estado': 'estado',
  'ESTADO': 'estado',
  'importe': 'importe',
  'Importe': 'importe',
  'IMPORTE': 'importe',
  'proxima_accion': 'proxima_accion',
  'Próxima acción': 'proxima_accion',
  'Proxima accion': 'proxima_accion',
  'fecha_accion': 'fecha_accion',
  'Fecha acción': 'fecha_accion',
  'Fecha accion': 'fecha_accion',
  'notas': 'notas',
  'Notas': 'notas',
  'NOTAS': 'notas',
  'fecha_entrega': 'fecha_entrega',
  'Fecha entrega': 'fecha_entrega',
  'Fecha de entrega': 'fecha_entrega',
  'satisfaccion': 'satisfaccion',
  'Satisfaccion': 'satisfaccion',
  'Satisfacción': 'satisfaccion',
  'incidencias': 'incidencias',
  'Incidencias': 'incidencias',
  'INCIDENCIAS': 'incidencias',
  'resena': 'resena',
  'Reseña': 'resena',
  'Resena': 'resena',
  'RESENA': 'resena',
}

// ============================================================
// FILTERING
// ============================================================

export function filterLeads(leads: Lead[], filters: import('../types/crm.types').LeadFilters): Lead[] {
  return leads.filter(lead => {
    if (filters.search) {
      const s = filters.search.toLowerCase()
      const matched =
        lead.cliente?.toLowerCase().includes(s) ||
        lead.telefono?.toLowerCase().includes(s) ||
        lead.email?.toLowerCase().includes(s) ||
        lead.vehiculo?.toLowerCase().includes(s) ||
        lead.localidad?.toLowerCase().includes(s) ||
        lead.notas?.toLowerCase().includes(s)
      if (!matched) return false
    }
    if (filters.estado && lead.estado !== filters.estado) return false
    if (filters.asignado && lead.asignado !== filters.asignado) return false
    if (filters.origen && lead.origen !== filters.origen) return false
    if (filters.mes && lead.mes !== filters.mes) return false
    if (filters.region && lead.region !== filters.region) return false
    return true
  })
}
