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
const PENDING_KEY  = 'quick_docs_pending'   // Set of IDs created locally but not yet confirmed in Supabase

// ─── Pending-sync tracking ───────────────────────────────────
// Docs created locally are marked "pending" until confirmed in Supabase.
// During merge, only pending docs are pushed back; non-pending docs that
// are missing from Supabase were deleted remotely → remove from cache.

function pendingIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]'))
  } catch { return new Set() }
}
function pendingAdd(id: string) {
  const s = pendingIds(); s.add(id)
  localStorage.setItem(PENDING_KEY, JSON.stringify([...s]))
}
function pendingRemove(id: string) {
  const s = pendingIds(); s.delete(id)
  localStorage.setItem(PENDING_KEY, JSON.stringify([...s]))
}
function pendingRemoveMany(ids: Iterable<string>) {
  const s = pendingIds()
  for (const id of ids) s.delete(id)
  localStorage.setItem(PENDING_KEY, JSON.stringify([...s]))
}

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
    type: r.type || 'FACTURA_SIMPLIFICADA',
    doc_number: r.docNumber,
    doc_date: r.docDate,
    client_name: r.clientName || 'Sin nombre',
    client_nif: r.clientNif || null,
    lead_id: r.leadId || null,
    lines: r.lines ?? [],
    vat_pct: r.vatPct ?? 21,
    discount_pct: r.discountPct ?? 0,
    subtotal: r.subtotal ?? 0,
    vat_amount: r.vatAmount ?? 0,
    total: r.total ?? 0,
    notes: r.notes ?? '',
    company_name: r.companyName ?? '',
    created_at: r.createdAt || new Date().toISOString(),
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

    // ── Smart merge ──────────────────────────────────────────
    // Supabase is source of truth.
    // Only push back localStorage-only records that are PENDING (created locally, never confirmed).
    // Records missing from Supabase that are NOT pending → deleted remotely → purge from cache.
    const sbIds = new Set(sbRecords.map(r => r.id))
    const sbDocNumbers = new Set(sbRecords.map(r => r.docNumber))
    const pending = pendingIds()
    const localAll = cacheGetAll()
    const localOnly = localAll.filter(r => !sbIds.has(r.id) && !sbDocNumbers.has(r.docNumber))

    // Separate: truly new (pending) vs remotely deleted
    const toSync = localOnly.filter(r => pending.has(r.id))
    const deletedRemotely = localOnly.filter(r => !pending.has(r.id))

    if (deletedRemotely.length > 0) {
      console.info(`🗑️ QuickDocService: ${deletedRemotely.length} doc(s) deleted remotely, purging from local cache`)
    }

    // Push pending-only records to Supabase (recovery)
    let syncedCount = 0
    let failedCount = 0
    for (const local of toSync) {
      const { error: upErr } = await supabase
        .from('quick_docs')
        .upsert(recordToRow(local), { onConflict: 'doc_number' })
      if (upErr) {
        failedCount++
        console.error('❌ Failed to sync local doc to Supabase:', local.docNumber, upErr.message, upErr.details, upErr.hint)
      } else {
        syncedCount++
        pendingRemove(local.id)   // Confirmed in Supabase
      }
    }
    if (syncedCount > 0) {
      toast.success(`☁️ ${syncedCount} documento(s) sincronizado(s) con la nube`)
    }
    if (failedCount > 0) {
      toast.error(`⚠️ ${failedCount} documento(s) no se pudieron sincronizar`, { duration: 6000 })
    }

    // Clear pending flags for all records now confirmed in Supabase
    pendingRemoveMany(sbRecords.map(r => r.id))

    // Final merged list: Supabase records + pending local-only (no resurrected deletes)
    const merged = [...sbRecords, ...toSync]
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

    // Mark as pending-sync (so fetchAll won't discard it if Supabase hasn't confirmed yet)
    pendingAdd(record.id)

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
      } else {
        // Confirmed in Supabase — no longer pending
        pendingRemove(record.id)
      }
    } catch (err: any) {
      console.error('❌ QuickDocService: Supabase request failed:', err)
      toast.error('⚠️ Documento guardado local, pero no sincronizado con la nube', { duration: 5000 })
    }

    return record
  }

  // ── Delete ────────────────────────────────────────────────

  static async delete(id: string): Promise<void> {
    const all = cacheGetAll().filter(d => d.id !== id)
    cacheSet(all)

    // Remove from pending set so fetchAll won't try to re-push it
    pendingRemove(id)

    // Also delete from Supabase (awaited so callers can refresh safely)
    const { error: delErr } = await supabase.from('quick_docs').delete().eq('id', id)
    if (delErr) console.warn('⚠️ QuickDocService: failed to delete from Supabase:', delErr.message)
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
