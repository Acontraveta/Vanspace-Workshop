// ============================================================
// RENTAL TYPES — Alquiler de furgonetas camper
// ============================================================

export type RentalStatus =
  | 'available'      // Disponible para alquilar
  | 'reserved'       // Reservada (señal recibida)
  | 'rented'         // En alquiler activo
  | 'returning'      // En proceso de devolución
  | 'maintenance'    // En mantenimiento / limpieza
  | 'inactive'       // Fuera de servicio

export interface RentalVehicle {
  id: string
  nombre: string              // Nombre comercial "Furgo Aventura"
  matricula: string
  modelo: string              // "Mercedes Sprinter 316"
  anio?: number
  plazas: number
  camas: number
  precio_dia_eur: number       // Precio base por día
  precio_semana_eur?: number   // Precio semanal (descuento)
  fianza_eur: number
  km_incluidos?: number         // Km incluidos por día (ej. 200)
  precio_km_extra?: number     // €/km extra sobre el límite
  equipamiento: string[]       // ["Nevera", "Ducha", "Calefacción", ...]
  fotos?: string[]             // URLs Supabase Storage
  notas?: string
  status: RentalStatus
  km_actual?: number
  proxima_itv?: string         // DATE
  proximo_mantenimiento?: string // DATE
  created_at?: string
  updated_at?: string
}

export type BookingStatus =
  | 'pending'        // Pendiente de confirmar
  | 'confirmed'      // Confirmada (señal pagada)
  | 'active'         // En curso
  | 'completed'      // Finalizada y devuelta
  | 'cancelled'      // Cancelada

export interface RentalBooking {
  id: string
  vehicle_id: string
  // Cliente
  cliente_nombre: string
  cliente_telefono?: string
  cliente_email?: string
  cliente_dni?: string
  cliente_carnet?: string      // Nº carnet conducir
  // Fechas
  fecha_inicio: string         // DATE
  fecha_fin: string            // DATE
  fecha_entrega_real?: string  // DATE — cuando se entregó realmente
  fecha_devolucion_real?: string // DATE — cuando se devolvió realmente
  // Económico
  precio_total: number
  fianza: number
  fianza_devuelta?: boolean
  descuento_pct?: number
  pagado: boolean
  metodo_pago?: string         // "Transferencia", "Tarjeta", "Efectivo"
  // Estado
  status: BookingStatus
  km_salida?: number
  km_llegada?: number
  incidencias?: string
  notas?: string
  // Km extra
  coste_km_extra?: number      // Coste calculado por km extra
  // Extras
  extras?: RentalExtra[]
  // Lead CRM vinculado
  lead_id?: string
  created_at?: string
  updated_at?: string

  // Joined
  vehicle?: RentalVehicle
}

export interface RentalExtra {
  nombre: string
  precio_dia: number
  incluido: boolean
}

export const RENTAL_EXTRAS: RentalExtra[] = [
  { nombre: 'Sillas camping', precio_dia: 5, incluido: false },
  { nombre: 'Mesa exterior', precio_dia: 3, incluido: false },
  { nombre: 'Juego sábanas', precio_dia: 8, incluido: false },
  { nombre: 'Kit cocina', precio_dia: 6, incluido: false },
  { nombre: 'Toldo lateral', precio_dia: 10, incluido: false },
  { nombre: 'GPS', precio_dia: 5, incluido: false },
  { nombre: 'Portabicis', precio_dia: 8, incluido: false },
  { nombre: 'Silla bebé', precio_dia: 5, incluido: false },
]

export const VEHICLE_STATUS_CONFIG: Record<RentalStatus, { label: string; color: string; textColor: string; icon: string }> = {
  available:    { label: 'Disponible',     color: 'bg-green-100',  textColor: 'text-green-700',  icon: '✅' },
  reserved:     { label: 'Reservada',      color: 'bg-amber-100',  textColor: 'text-amber-700',  icon: '📋' },
  rented:       { label: 'En alquiler',    color: 'bg-blue-100',   textColor: 'text-blue-700',   icon: '🚐' },
  returning:    { label: 'Devolviendo',    color: 'bg-purple-100', textColor: 'text-purple-700', icon: '🔄' },
  maintenance:  { label: 'Mantenimiento',  color: 'bg-orange-100', textColor: 'text-orange-700', icon: '🔧' },
  inactive:     { label: 'Inactiva',       color: 'bg-gray-100',   textColor: 'text-gray-500',   icon: '⛔' },
}

export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; textColor: string; icon: string }> = {
  pending:    { label: 'Pendiente',   color: 'bg-amber-100',  textColor: 'text-amber-700',  icon: '⏳' },
  confirmed:  { label: 'Confirmada',  color: 'bg-blue-100',   textColor: 'text-blue-700',   icon: '✅' },
  active:     { label: 'En curso',    color: 'bg-green-100',  textColor: 'text-green-700',  icon: '🚐' },
  completed:  { label: 'Finalizada',  color: 'bg-gray-100',   textColor: 'text-gray-600',   icon: '🏁' },
  cancelled:  { label: 'Cancelada',   color: 'bg-red-100',    textColor: 'text-red-600',    icon: '❌' },
}
