import { Quote } from '../types/quote.types'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// Map Quote → Supabase row
function toDb(q: Quote) {
  return {
    id: q.id,
    quote_number: q.quoteNumber,
    lead_id: q.lead_id ?? null,
    client_name: q.clientName,
    client_email: q.clientEmail ?? null,
    client_phone: q.clientPhone ?? null,
    vehicle_model: q.vehicleModel ?? null,
    vehicle_size: (q as any).vehicleSize ?? null,
    business_line: 'Camperización',
    billing_data: q.billingData ?? null,
    tarifa: q.tarifa ?? {},
    items: q.items ?? [],
    subtotal_materials: q.subtotalMaterials ?? 0,
    subtotal_labor: q.subtotalLabor ?? 0,
    subtotal: q.subtotal ?? 0,
    profit_margin: q.profitMargin ?? 0,
    profit_amount: q.profitAmount ?? 0,
    total: q.total ?? 0,
    total_hours: q.totalHours ?? 0,
    valid_until: q.validUntil instanceof Date ? q.validUntil.toISOString() : q.validUntil,
    approved_at: q.approvedAt instanceof Date ? q.approvedAt.toISOString() : (q.approvedAt ?? null),
    cancelled_at: q.cancelledAt instanceof Date ? q.cancelledAt.toISOString() : (q.cancelledAt ?? null),
    status: q.status,
    notes: (q as any).notes ?? null,
    document_data: q.documentData ?? null,
    created_at: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
  }
}

// Map Supabase row → Quote
function fromDb(row: any): Quote {
  return {
    id: row.id,
    quoteNumber: row.quote_number ?? '',
    lead_id: row.lead_id ?? undefined,
    clientName: row.client_name ?? '',
    clientEmail: row.client_email ?? undefined,
    clientPhone: row.client_phone ?? undefined,
    vehicleModel: row.vehicle_model ?? undefined,
    billingData: row.billing_data ?? undefined,
    tarifa: row.tarifa ?? {},
    items: row.items ?? [],
    subtotalMaterials: Number(row.subtotal_materials ?? 0),
    subtotalLabor: Number(row.subtotal_labor ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    profitMargin: Number(row.profit_margin ?? 0),
    profitAmount: Number(row.profit_amount ?? 0),
    total: Number(row.total ?? 0),
    totalHours: Number(row.total_hours ?? 0),
    validUntil: new Date(row.valid_until ?? row.created_at),
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    status: row.status ?? 'DRAFT',
    documentData: row.document_data ?? undefined,
    createdAt: new Date(row.created_at),
  } as Quote
}

/** Aplicar auto-expiración a un quote */
function applyExpiration(q: Quote): Quote {
  if (q.status === 'DRAFT' || q.status === 'SENT') {
    const now = new Date()
    const daysSinceCreation = Math.floor((now.getTime() - q.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceCreation > 15) {
      q.status = 'EXPIRED'
    }
  }
  return q
}

/** Parsear fechas de un objeto Quote crudo */
function parseDates(q: any): Quote {
  return {
    ...q,
    createdAt: new Date(q.createdAt),
    validUntil: new Date(q.validUntil),
    approvedAt: q.approvedAt ? new Date(q.approvedAt) : undefined,
    cancelledAt: q.cancelledAt ? new Date(q.cancelledAt) : undefined,
  }
}

export class QuoteService {
  private static STORAGE_KEY = 'saved_quotes'
  private static DELETED_IDS_KEY = 'deleted_quote_ids'

  // ── Gestión de IDs eliminados ──────────────────────────
  // Persiste IDs de facturas/presupuestos eliminados para que
  // syncFromSupabase nunca los restaure, incluso si Supabase
  // no pudo borrar la fila (type mismatch, FK constraint, etc.)

  private static getDeletedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(this.DELETED_IDS_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch { return new Set() }
  }

  private static addDeletedId(id: string): void {
    const ids = this.getDeletedIds()
    ids.add(id)
    localStorage.setItem(this.DELETED_IDS_KEY, JSON.stringify([...ids]))
  }

  private static removeDeletedId(id: string): void {
    const ids = this.getDeletedIds()
    ids.delete(id)
    localStorage.setItem(this.DELETED_IDS_KEY, JSON.stringify([...ids]))
  }

  // ── Sincronización con Supabase ────────────────────────

  /**
   * Descarga todos los presupuestos de Supabase, fusiona con localStorage
   * y actualiza el caché local.  Llamar al montar la vista de presupuestos.
   */
  static async syncFromSupabase(): Promise<Quote[]> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('⚠️ QuoteService.syncFromSupabase error:', error.message)
        return this.getAllQuotes()
      }

      // IDs marcados para eliminar localmente
      const deletedIds = this.getDeletedIds()

      // Filtrar resultados de Supabase: excluir cualquier ID marcado como eliminado
      const sbQuotes = (data || [])
        .filter((row: any) => !deletedIds.has(row.id))
        .map(fromDb)
        .map(applyExpiration)
      const sbIds = new Set(sbQuotes.map(q => q.id))

      // Reintentar eliminación en Supabase de IDs pendientes
      if (deletedIds.size > 0) {
        for (const delId of deletedIds) {
          const { error: retryErr } = await supabase
            .from('quotes')
            .delete()
            .eq('id', delId)
          if (!retryErr) {
            // También intentar con cast por si el campo es UUID
            await supabase
              .from('quotes')
              .delete()
              .filter('id', 'eq', delId)
          }
        }
      }

      // Detectar quotes en localStorage que NO estén en Supabase (creados offline)
      const localQuotes = this.getAllQuotes()
      const localOnly = localQuotes.filter(q => !sbIds.has(q.id) && !deletedIds.has(q.id))

      // Subir registros solo-locales a Supabase (recuperación)
      let syncedCount = 0
      for (const local of localOnly) {
        const { error: upErr } = await supabase.from('quotes').upsert(toDb(local))
        if (upErr) {
          console.warn('⚠️ Failed to sync local quote to Supabase:', local.quoteNumber, upErr.message)
        } else {
          syncedCount++
        }
      }
      if (syncedCount > 0) {
        toast.success(`☁️ ${syncedCount} documento(s) sincronizado(s) con la nube`)
      }

      const merged = [...sbQuotes, ...localOnly]
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged))
      return merged
    } catch (err) {
      console.error('❌ syncFromSupabase failed:', err)
      return this.getAllQuotes()
    }
  }

  // Guardar presupuesto
  static saveQuote(quote: Quote): void {
    const quotes = this.getAllQuotes()
    
    const existingIndex = quotes.findIndex(q => q.id === quote.id)
    
    if (existingIndex >= 0) {
      quotes[existingIndex] = quote
    } else {
      quotes.push(quote)
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(quotes))
    // Persist to Supabase in background
    supabase.from('quotes').upsert(toDb(quote)).then(({ error }) => {
      if (error) {
        console.error('❌ Supabase quote sync failed:', error.message)
        toast.error('⚠️ Guardado local OK, pero no se sincronizó con la nube. Inténtalo de nuevo.', { duration: 5000 })
      }
    })
    toast.success('Presupuesto guardado')
  }

  // Obtener todos los presupuestos (desde caché localStorage)
  // Para datos frescos de Supabase, llamar antes a syncFromSupabase()
  static getAllQuotes(): Quote[] {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    const deletedIds = this.getDeletedIds()
    if (stored) {
      try {
        const quotes = JSON.parse(stored)
        const updatedQuotes = quotes
          .filter((q: any) => !deletedIds.has(q.id))
          .map((q: any) => applyExpiration(parseDates(q)))
        
        // Guardar cambios si hubo filtrados o expirados
        if (updatedQuotes.length !== quotes.length) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedQuotes))
        } else {
          const hasExpired = updatedQuotes.some((q: Quote, i: number) => q.status !== quotes[i].status)
          if (hasExpired) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedQuotes))
          }
        }
        
        return updatedQuotes
      } catch (e) {
        return []
      }
    }
    return []
  }

  // Obtener presupuesto por ID
  static getQuoteById(id: string): Quote | undefined {
    return this.getAllQuotes().find(q => q.id === id)
  }

  // Validar datos de facturación
  private static validateBillingData(quote: Quote): boolean {
    if (!quote.billingData) return false
    
    const { nif, address, postalCode, city, province, country } = quote.billingData
    
    return !!(
      nif && nif.trim() !== '' &&
      address && address.trim() !== '' &&
      postalCode && postalCode.trim() !== '' &&
      city && city.trim() !== '' &&
      province && province.trim() !== '' &&
      country && country.trim() !== ''
    )
  }

  // Aprobar presupuesto
  static approveQuote(quoteId: string): Quote {
    const quotes = this.getAllQuotes()
    const quote = quotes.find(q => q.id === quoteId)
    
    if (!quote) {
      throw new Error('Presupuesto no encontrado')
    }
    
    if (quote.status === 'APPROVED') {
      throw new Error('El presupuesto ya está aprobado')
    }
    
    if (quote.status === 'EXPIRED') {
      throw new Error('El presupuesto ha caducado. No se puede aprobar.')
    }

    // VALIDACIÓN DE DATOS DE FACTURACIÓN
    if (!this.validateBillingData(quote)) {
      throw new Error('Faltan datos de facturación obligatorios (NIF, dirección completa, código postal, ciudad, provincia, país)')
    }
    
    quote.status = 'APPROVED'
    quote.approvedAt = new Date()
    
    this.saveQuote(quote)

    // Actualizar el lead en CRM si el presupuesto está vinculado a uno
    if (quote.lead_id) {
      import('@/features/crm/services/leadService')
        .then(({ updateLead }) =>
          updateLead(quote.lead_id!, { estado: 'Aprobado' })
        )
        .catch(e => console.warn('No se pudo actualizar el lead en CRM:', e))
    }
    
    toast.success('¡Presupuesto aprobado! Iniciando automatización...')
    
    return quote
  }

  // Cancelar presupuesto
  static cancelQuote(quoteId: string): Quote {
    const quotes = this.getAllQuotes()
    const quote = quotes.find(q => q.id === quoteId)
    
    if (!quote) {
      throw new Error('Presupuesto no encontrado')
    }
    
    if (quote.status === 'APPROVED') {
      throw new Error('No se puede cancelar un presupuesto aprobado')
    }
    
    quote.status = 'REJECTED'
    quote.cancelledAt = new Date()
    
    this.saveQuote(quote)
    
    toast.success('Presupuesto cancelado')
    return quote
  }

  // Eliminar presupuesto o factura
  static async deleteQuote(quoteId: string): Promise<void> {
    const quotes = this.getAllQuotes()
    const quote = quotes.find(q => q.id === quoteId)
    const wasFactura = quote?.status === 'APPROVED'

    // 1. Registrar ID como eliminado (SIEMPRE, antes de intentar Supabase)
    // Esto garantiza que syncFromSupabase nunca lo restaure
    this.addDeletedId(quoteId)

    // 2. Eliminar de localStorage inmediatamente
    const filtered = quotes.filter(q => q.id !== quoteId)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))

    // 3. Intentar eliminar de Supabase (best effort)
    try {
      await supabase.from('quotes').delete().eq('id', quoteId)
    } catch (err) {
      console.warn('⚠️ Supabase delete attempt failed (will retry on next sync):', err)
    }

    toast.success(wasFactura ? 'Factura eliminada del sistema' : 'Presupuesto eliminado')
  }

  // Obtener presupuestos por estado
  static getQuotesByStatus(status: Quote['status']): Quote[] {
    return this.getAllQuotes().filter(q => q.status === status)
  }

  // Obtener presupuestos agrupados por categoría
  static getQuotesByCategory(): {
    active: Quote[]
    approved: Quote[]
    cancelled: Quote[]
    expired: Quote[]
  } {
    const all = this.getAllQuotes()
    
    return {
      active: all.filter(q => q.status === 'DRAFT' || q.status === 'SENT'),
      approved: all.filter(q => q.status === 'APPROVED'),
      cancelled: all.filter(q => q.status === 'REJECTED'),
      expired: all.filter(q => q.status === 'EXPIRED'),
    }
  }

  /** Versión async que sincroniza desde Supabase antes de agrupar */
  static async fetchQuotesByCategory(): Promise<{
    active: Quote[]
    approved: Quote[]
    cancelled: Quote[]
    expired: Quote[]
  }> {
    await this.syncFromSupabase()
    return this.getQuotesByCategory()
  }

  // Obtener días restantes hasta expiración
  static getDaysUntilExpiration(quote: Quote): number {
    const now = new Date()
    const daysSinceCreation = Math.floor((now.getTime() - quote.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, 15 - daysSinceCreation)
  }

  // Verificar si un presupuesto puede ser aprobado
  static canBeApproved(quote: Quote): { can: boolean, reason?: string } {
    if (quote.status === 'APPROVED') {
      return { can: false, reason: 'Ya está aprobado' }
    }
    
    if (quote.status === 'EXPIRED') {
      return { can: false, reason: 'Ha caducado' }
    }
    
    if (!this.validateBillingData(quote)) {
      return { can: false, reason: 'Faltan datos de facturación' }
    }
    
    return { can: true }
  }
}