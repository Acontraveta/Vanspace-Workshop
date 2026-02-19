/**
 * quickDocService.ts
 *
 * Persists Facturas Simplificadas and Proformas generated via QuickDocumentModal
 * to localStorage so they can be listed and searched later.
 */

import { QuickDocType } from '../components/QuickDocumentModal'

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

export class QuickDocService {
  static getAll(): QuickDocRecord[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return []
    }
  }

  static getByType(type: QuickDocType): QuickDocRecord[] {
    return this.getAll().filter(d => d.type === type)
  }

  static save(doc: Omit<QuickDocRecord, 'id' | 'createdAt'>): QuickDocRecord {
    const all = this.getAll()
    // Avoid duplicate by docNumber
    if (all.some(d => d.docNumber === doc.docNumber)) {
      return all.find(d => d.docNumber === doc.docNumber)!
    }
    const record: QuickDocRecord = {
      ...doc,
      id: `qdoc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    }
    all.unshift(record)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    return record
  }

  static delete(id: string): void {
    const all = this.getAll().filter(d => d.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }

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
