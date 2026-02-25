import { supabase } from '@/lib/supabase'
import type { RentalVehicle, RentalBooking, RentalStatus, BookingStatus } from '../types/rental.types'

export class RentalService {

  // ═══════════════════════════════════════════════════
  // VEHÍCULOS
  // ═══════════════════════════════════════════════════

  static async getVehicles(): Promise<RentalVehicle[]> {
    const { data, error } = await supabase
      .from('rental_vehicles')
      .select('*')
      .order('nombre')
    if (error) throw error
    return (data ?? []).map(this.mapVehicle)
  }

  static async getVehicle(id: string): Promise<RentalVehicle | null> {
    const { data, error } = await supabase
      .from('rental_vehicles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? this.mapVehicle(data) : null
  }

  static async createVehicle(v: Omit<RentalVehicle, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase
      .from('rental_vehicles')
      .insert({
        id: crypto.randomUUID(),
        nombre: v.nombre,
        matricula: v.matricula,
        modelo: v.modelo,
        anio: v.anio,
        plazas: v.plazas,
        camas: v.camas,
        precio_dia_eur: v.precio_dia_eur,
        precio_semana_eur: v.precio_semana_eur,
        fianza_eur: v.fianza_eur,
        equipamiento: JSON.stringify(v.equipamiento),
        fotos: v.fotos ? JSON.stringify(v.fotos) : null,
        notas: v.notas,
        status: v.status,
        km_actual: v.km_actual,
        proxima_itv: v.proxima_itv,
        proximo_mantenimiento: v.proximo_mantenimiento,
      })
    if (error) throw error
  }

  static async updateVehicle(id: string, updates: Partial<RentalVehicle>): Promise<void> {
    const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() }
    if (dbUpdates.equipamiento) dbUpdates.equipamiento = JSON.stringify(dbUpdates.equipamiento)
    if (dbUpdates.fotos) dbUpdates.fotos = JSON.stringify(dbUpdates.fotos)
    delete dbUpdates.id
    delete dbUpdates.created_at

    const { error } = await supabase
      .from('rental_vehicles')
      .update(dbUpdates)
      .eq('id', id)
    if (error) throw error
  }

  static async updateVehicleStatus(id: string, status: RentalStatus): Promise<void> {
    const { error } = await supabase
      .from('rental_vehicles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  private static mapVehicle(row: any): RentalVehicle {
    return {
      ...row,
      equipamiento: typeof row.equipamiento === 'string' ? JSON.parse(row.equipamiento) : (row.equipamiento ?? []),
      fotos: typeof row.fotos === 'string' ? JSON.parse(row.fotos) : (row.fotos ?? []),
    }
  }

  // ═══════════════════════════════════════════════════
  // RESERVAS
  // ═══════════════════════════════════════════════════

  static async getBookings(filters?: { vehicle_id?: string; status?: BookingStatus; from?: string; to?: string }): Promise<RentalBooking[]> {
    let query = supabase
      .from('rental_bookings')
      .select('*, vehicle:rental_vehicles(*)')
      .order('fecha_inicio', { ascending: false })

    if (filters?.vehicle_id) query = query.eq('vehicle_id', filters.vehicle_id)
    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.from) query = query.gte('fecha_inicio', filters.from)
    if (filters?.to) query = query.lte('fecha_inicio', filters.to)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(row => ({
      ...row,
      extras: typeof row.extras === 'string' ? JSON.parse(row.extras) : (row.extras ?? []),
      vehicle: row.vehicle ? this.mapVehicle(row.vehicle) : undefined,
    }))
  }

  static async createBooking(b: Omit<RentalBooking, 'id' | 'created_at' | 'updated_at' | 'vehicle'>): Promise<void> {
    const { error } = await supabase
      .from('rental_bookings')
      .insert({
        id: crypto.randomUUID(),
        vehicle_id: b.vehicle_id,
        cliente_nombre: b.cliente_nombre,
        cliente_telefono: b.cliente_telefono,
        cliente_email: b.cliente_email,
        cliente_dni: b.cliente_dni,
        cliente_carnet: b.cliente_carnet,
        fecha_inicio: b.fecha_inicio,
        fecha_fin: b.fecha_fin,
        precio_total: b.precio_total,
        fianza: b.fianza,
        descuento_pct: b.descuento_pct,
        pagado: b.pagado ?? false,
        metodo_pago: b.metodo_pago,
        status: b.status,
        extras: b.extras ? JSON.stringify(b.extras) : null,
        notas: b.notas,
        lead_id: b.lead_id,
      })
    if (error) throw error

    // Marcar vehículo como reservado
    if (b.status === 'confirmed' || b.status === 'active') {
      await this.updateVehicleStatus(b.vehicle_id, b.status === 'active' ? 'rented' : 'reserved')
    }
  }

  static async updateBooking(id: string, updates: Partial<RentalBooking>): Promise<void> {
    const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() }
    if (dbUpdates.extras) dbUpdates.extras = JSON.stringify(dbUpdates.extras)
    delete dbUpdates.id
    delete dbUpdates.created_at
    delete dbUpdates.vehicle

    const { error } = await supabase
      .from('rental_bookings')
      .update(dbUpdates)
      .eq('id', id)
    if (error) throw error
  }

  static async updateBookingStatus(id: string, status: BookingStatus, vehicleId: string): Promise<void> {
    await this.updateBooking(id, { status })

    // Sincronizar estado del vehículo
    const vehicleStatusMap: Record<BookingStatus, RentalStatus> = {
      pending: 'available',
      confirmed: 'reserved',
      active: 'rented',
      completed: 'maintenance', // Tras devolución → mantenimiento/limpieza
      cancelled: 'available',
    }
    await this.updateVehicleStatus(vehicleId, vehicleStatusMap[status])
  }

  // ═══════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════

  static calcularPrecioTotal(
    precioDia: number,
    precioSemana: number | undefined,
    fechaInicio: string,
    fechaFin: string,
    extras: { precio_dia: number; incluido: boolean }[],
    descuentoPct: number = 0
  ): number {
    const dias = Math.max(1, Math.ceil(
      (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)
    ))

    // Calcular precio base (semanas completas + días sueltos)
    let precioBase: number
    if (precioSemana && dias >= 7) {
      const semanas = Math.floor(dias / 7)
      const diasSueltos = dias % 7
      precioBase = (semanas * precioSemana) + (diasSueltos * precioDia)
    } else {
      precioBase = dias * precioDia
    }

    // Extras seleccionados
    const precioExtras = extras
      .filter(e => e.incluido)
      .reduce((sum, e) => sum + (e.precio_dia * dias), 0)

    const subtotal = precioBase + precioExtras
    return Math.round(subtotal * (1 - descuentoPct / 100) * 100) / 100
  }

  static getDias(fechaInicio: string, fechaFin: string): number {
    return Math.max(1, Math.ceil(
      (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24)
    ))
  }

  static isVehicleAvailable(bookings: RentalBooking[], vehicleId: string, from: string, to: string, excludeBookingId?: string): boolean {
    return !bookings.some(b =>
      b.vehicle_id === vehicleId &&
      b.id !== excludeBookingId &&
      b.status !== 'cancelled' &&
      b.status !== 'completed' &&
      b.fecha_inicio <= to &&
      b.fecha_fin >= from
    )
  }
}
