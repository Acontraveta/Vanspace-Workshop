/**
 * quickDocService.ts
 *
 * Persists Facturas Simplificadas and Proformas to:
 *  - Supabase `quick_docs` table (primary, durable store)
 *  - localStorage (write-through cache for instant reads)
 *
 * On read, data comes from Supabase (async) with localStorage fallback.
 */

import { QuickDocType } from '../components/QuickDocumentModal'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export interface QuickDocLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface QuickDocRecord {
  id: string
  type: QuickDocType
  docNumber: string
  docDate: string       // ISO date string (yyyy-MM-dd)
  clientName: string
  clientNif?: string
  leadId?: string       // Associated CRM lead
  lines: QuickDocLine[]
  vatPct: number
  discountPct: number
  subtotal: number
  vatAmount: number
  total: number
  notes: string
  companyName: string
  createdAt: string     // ISO datetime string
}

const STORAGE_KEY = 'quick_docs_v1'

// ─── Supabase row ↔ QuickDocRecord mapping ───────────────────

function rowToRecord(row: any): QuickDocRecord {
  return {
    id: row.id,
    type: row.type,
    docNumber: row.doc_number,
    docDate: row.doc_date,
    clientName: row.client_name,
    clientNif: row.client_nif || undefined,
    leadId: row.lead_id || undefined,
    lines: row.lines ?? [],
    vatPct: Number(row.vat_pct ?? 21),
    discountPct: Number(row.discount_pct ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    vatAmount: Number(row.vat_amount ?? 0),
    total: Number(row.total ?? 0),
    notes: row.notes ?? '',
    companyName: row.company_name ?? '',
    createdAt: row.created_at,
  }
}

function recordToRow(r: QuickDocRecord) {
  return {
    id: r.id,
    type: r.type,
    doc_number: r.docNumber,
    doc_date: r.docDate,
    client_name: r.clientName,
    client_nif: r.clientNif || null,
    lead_id: r.leadId || null,
    lines: r.lines,
    vat_pct: r.vatPct,
    discount_pct: r.discountPct,
    subtotal: r.subtotal,
    vat_amount: r.vatAmount,
    total: r.total,
    notes: r.notes,
    company_name: r.companyName,
    created_at: r.createdAt,
  }
}

// ─── localStorage helpers (cache) ────────────────────────────

function cacheGetAll(): QuickDocRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function cacheSet(records: QuickDocRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

// ─── Service ─────────────────────────────────────────────────

export class QuickDocService {
  /**
   * Synchronous read from localStorage cache.
   * Use `fetchAll` / `fetchByType` for fresh Supabase data.
   */
  static getAll(): QuickDocRecord[] {
    return cacheGetAll()
  }

  static getByType(type: QuickDocType): QuickDocRecord[] {
    return cacheGetAll().filter(d => d.type === type)
  }

  // ── Async Supabase reads ──────────────────────────────────

  /** Fetch all docs from Supabase, merge with localStorage cache, update cache */
  static async fetchAll(): Promise<QuickDocRecord[]> {
    const { data, error } = await supabase
      .from('quick_docs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('⚠️ QuickDocService.fetchAll Supabase error, using cache:', error.message)
      return cacheGetAll()
    }

    const sbRecords = (data || []).map(rowToRecord)

    // Merge: Supabase is source of truth, but keep localStorage-only records
    const sbDocNumbers = new Set(sbRecords.map(r => r.docNumber))
    const localOnly = cacheGetAll().filter(r => !sbDocNumbers.has(r.docNumber))

    // Push any localStorage-only records to Supabase (recovery)
    let syncedCount = 0
    for (const local of localOnly) {
      const { error: upErr } = await supabase
        .from('quick_docs')
        .upsert(recordToRow(local), { onConflict: 'doc_number' })
      if (upErr) {
        console.warn('⚠️ Failed to sync local doc to Supabase:', local.docNumber, upErr.message)
      } else {
        syncedCount++
      }
    }
    if (syncedCount > 0) {
      toast.success(`☁️ ${syncedCount} documento(s) sincronizado(s) con la nube`)
    }

    const merged = [...sbRecords, ...localOnly]
    cacheSet(merged)
    return merged
  }

  static async fetchByType(type: QuickDocType): Promise<QuickDocRecord[]> {
    const all = await this.fetchAll()
    return all.filter(d => d.type === type)
  }

  // ── Save ──────────────────────────────────────────────────

  static async save(doc: Omit<QuickDocRecord, 'id' | 'createdAt'>): Promise<QuickDocRecord> {
    const all = cacheGetAll()
    // Avoid duplicate by docNumber
    if (all.some(d => d.docNumber === doc.docNumber)) {
      return all.find(d => d.docNumber === doc.docNumber)!
    }

    const record: QuickDocRecord = {
      ...doc,
      id: `qdoc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    }

    // Update localStorage cache immediately
    all.unshift(record)
    cacheSet(all)

    // Persist to Supabase (await result)
    try {
      const { error: upErr } = await supabase
        .from('quick_docs')
        .upsert(recordToRow(record), { onConflict: 'doc_number' })

      if (upErr) {
        console.error('❌ QuickDocService: failed to save to Supabase:', upErr.message, upErr.details, upErr.hint)
        toast.error(`⚠️ Documento guardado local, pero no sincronizado: ${upErr.message}`, { duration: 6000 })
      }
    } catch (err: any) {
      console.error('❌ QuickDocService: Supabase request failed:', err)
      toast.error('⚠️ Documento guardado local, pero no sincronizado con la nube', { duration: 5000 })
    }

    return record
  }

  // ── Delete ────────────────────────────────────────────────

  static delete(id: string): void {
    const all = cacheGetAll().filter(d => d.id !== id)
    cacheSet(all)

    // Also delete from Supabase
    supabase.from('quick_docs').delete().eq('id', id)
      .then(({ error: delErr }) => {
        if (delErr) console.warn('⚠️ QuickDocService: failed to delete from Supabase:', delErr.message)
      })
  }

  // ── Search (uses cache) ───────────────────────────────────

  static search(type: QuickDocType, text: string, dateFrom: string, dateTo: string): QuickDocRecord[] {
    let list = this.getByType(type)

    if (text.trim()) {
      const lower = text.toLowerCase()
      list = list.filter(d =>
        d.clientName.toLowerCase().includes(lower) ||
        d.docNumber.toLowerCase().includes(lower)
      )
    }

    if (dateFrom) {
      list = list.filter(d => d.docDate >= dateFrom)
    }

    if (dateTo) {
      list = list.filter(d => d.docDate <= dateTo)
    }

    return list
  }
}
