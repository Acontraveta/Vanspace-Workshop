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
        km_incluidos: v.km_incluidos,
        precio_km_extra: v.precio_km_extra,
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
      fotos_entrega: typeof row.fotos_entrega === 'string' ? JSON.parse(row.fotos_entrega) : (row.fotos_entrega ?? []),
      fotos_devolucion: typeof row.fotos_devolucion === 'string' ? JSON.parse(row.fotos_devolucion) : (row.fotos_devolucion ?? []),
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
        coste_km_extra: b.coste_km_extra ?? 0,
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
    if (dbUpdates.fotos_entrega) dbUpdates.fotos_entrega = JSON.stringify(dbUpdates.fotos_entrega)
    if (dbUpdates.fotos_devolucion) dbUpdates.fotos_devolucion = JSON.stringify(dbUpdates.fotos_devolucion)
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
  // FOTOS ENTREGA / DEVOLUCIÓN
  // ═══════════════════════════════════════════════════

  private static readonly PHOTO_BUCKET = 'rental-photos'

  static async uploadBookingPhotos(
    bookingId: string,
    files: File[],
    phase: 'entrega' | 'devolucion',
  ): Promise<string[]> {
    const urls: string[] = []

    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const path = `${bookingId}/${phase}/${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from(this.PHOTO_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from(this.PHOTO_BUCKET)
        .getPublicUrl(path)
      urls.push(urlData.publicUrl)
    }

    // Append to existing photos on the booking
    const field = phase === 'entrega' ? 'fotos_entrega' : 'fotos_devolucion'
    const { data: current } = await supabase
      .from('rental_bookings')
      .select(field)
      .eq('id', bookingId)
      .single()

    const existing: string[] = current
      ? (typeof current[field] === 'string' ? JSON.parse(current[field]) : (current[field] ?? []))
      : []

    const merged = [...existing, ...urls]
    await this.updateBooking(bookingId, { [field]: merged } as any)

    return merged
  }

  static async deleteBookingPhoto(
    bookingId: string,
    photoUrl: string,
    phase: 'entrega' | 'devolucion',
  ): Promise<string[]> {
    // Extract storage path from public URL
    const bucketSegment = `${this.PHOTO_BUCKET}/`
    const idx = photoUrl.indexOf(bucketSegment)
    if (idx >= 0) {
      const storagePath = photoUrl.slice(idx + bucketSegment.length)
      await supabase.storage.from(this.PHOTO_BUCKET).remove([storagePath])
    }

    // Remove from DB array
    const field = phase === 'entrega' ? 'fotos_entrega' : 'fotos_devolucion'
    const { data: current } = await supabase
      .from('rental_bookings')
      .select(field)
      .eq('id', bookingId)
      .single()

    const existing: string[] = current
      ? (typeof current[field] === 'string' ? JSON.parse(current[field]) : (current[field] ?? []))
      : []

    const updated = existing.filter(u => u !== photoUrl)
    await this.updateBooking(bookingId, { [field]: updated } as any)

    return updated
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

  static calcularCosteKmExtra(
    kmSalida: number | undefined,
    kmLlegada: number | undefined,
    kmIncluidosDia: number | undefined,
    precioKmExtra: number | undefined,
    fechaInicio: string,
    fechaFin: string,
  ): { kmRecorridos: number; kmPermitidos: number; kmExceso: number; coste: number } {
    if (!kmSalida || !kmLlegada || !kmIncluidosDia || !precioKmExtra) {
      return { kmRecorridos: 0, kmPermitidos: 0, kmExceso: 0, coste: 0 }
    }
    const kmRecorridos = Math.max(0, kmLlegada - kmSalida)
    const dias = this.getDias(fechaInicio, fechaFin)
    const kmPermitidos = kmIncluidosDia * dias
    const kmExceso = Math.max(0, kmRecorridos - kmPermitidos)
    const coste = Math.round(kmExceso * precioKmExtra * 100) / 100
    return { kmRecorridos, kmPermitidos, kmExceso, coste }
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
