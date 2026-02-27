/**
 * FiscalReportModal.tsx
 *
 * Modal para generar informes fiscales para auditorías, pagos de impuestos
 * y la Agencia Tributaria (Hacienda).
 *
 * Tipos de informe:
 *  1. Libro de Facturas Emitidas  — listado completo con desglose IVA
 *  2. Facturas Recibidas (compras) — facturas de proveedores
 *  3. Resumen IVA Trimestral      — para modelo 303 (emitidas − recibidas)
 *  4. Resumen Anual               — para modelo 390
 *  5. Desglose por Cliente
 */

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '@/shared/utils/portalRoot'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Quote } from '../types/quote.types'
import { QuickDocRecord } from '../services/quickDocService'
import { PurchaseItem } from '@/features/purchases/types/purchase.types'
import { RentalBooking } from '@/features/rental/types/rental.types'

// ─── Types ───────────────────────────────────────────────────

type ReportType = 'libro-facturas' | 'facturas-recibidas' | 'iva-trimestral' | 'resumen-anual' | 'por-cliente'

interface FiscalReportModalProps {
  facturas: Quote[]
  simplificadas: QuickDocRecord[]
  proformas: QuickDocRecord[]
  purchaseItems: PurchaseItem[]
  rentalBookings?: RentalBooking[]
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getQuarter(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3)
}

function getQuarterLabel(q: number): string {
  return `${q}T`
}

function getQuarterDates(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0, 23, 59, 59),
  }
}

/** Normalize any date-like value to a Date object */
function toDate(v: string | Date): Date {
  return v instanceof Date ? v : new Date(v)
}

// ─── Unified invoice row for reports ─────────────────────────

interface InvoiceRow {
  number: string
  date: Date
  client: string
  nif: string
  base: number
  vatPct: number
  vatAmount: number
  total: number
  type: 'factura' | 'simplificada' | 'proforma' | 'alquiler'
  invoiceImageUrl?: string
}

function quoteToRow(q: Quote): InvoiceRow {
  const vatPct = 21 // Default IVA for quotes
  const base = q.subtotal ?? q.total / 1.21
  const vatAmt = q.total - base
  return {
    number: q.quoteNumber,
    date: toDate(q.approvedAt || q.createdAt),
    client: q.clientName,
    nif: q.billingData?.nif ?? '',
    base,
    vatPct,
    vatAmount: vatAmt,
    total: q.total,
    type: 'factura',
  }
}

function docToRow(d: QuickDocRecord): InvoiceRow {
  return {
    number: d.docNumber,
    date: new Date(d.docDate),
    client: d.clientName,
    nif: d.clientNif ?? '',
    base: d.subtotal,
    vatPct: d.vatPct,
    vatAmount: d.vatAmount,
    total: d.total,
    type: d.type === 'PROFORMA' ? 'proforma' : 'simplificada',
  }
}

function rentalToRow(b: RentalBooking): InvoiceRow {
  const vatPct = 21
  const base = b.precio_total / (1 + vatPct / 100)
  const vatAmount = b.precio_total - base
  // Include km extra cost if present
  const extraKm = b.coste_km_extra ?? 0
  const totalWithExtra = b.precio_total + extraKm
  const baseWithExtra = totalWithExtra / (1 + vatPct / 100)
  const vatWithExtra = totalWithExtra - baseWithExtra
  return {
    number: `ALQ-${b.id.slice(0, 8).toUpperCase()}`,
    date: b.fecha_devolucion_real ? new Date(b.fecha_devolucion_real)
         : b.fecha_fin ? new Date(b.fecha_fin)
         : new Date(b.fecha_inicio),
    client: b.cliente_nombre,
    nif: b.cliente_dni ?? '',
    base: Math.round(baseWithExtra * 100) / 100,
    vatPct,
    vatAmount: Math.round(vatWithExtra * 100) / 100,
    total: Math.round(totalWithExtra * 100) / 100,
    type: 'alquiler',
  }
}

// ─── Component ───────────────────────────────────────────────

export default function FiscalReportModal({ facturas, simplificadas, proformas, purchaseItems, rentalBookings = [], onClose }: FiscalReportModalProps) {
  const [reportType, setReportType] = useState<ReportType>('libro-facturas')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [quarter, setQuarter] = useState<number>(getQuarter(new Date()))
  const [includeSimp, setIncludeSimp] = useState(true)
  const [includeRentals, setIncludeRentals] = useState(true)
  const [includeProformas, setIncludeProformas] = useState(false)

  // Build unified rows (emitidas)
  const allRows = useMemo(() => {
    // Only include completed rentals that have been paid
    const paidRentals = rentalBookings.filter(b =>
      b.status === 'completed' && b.pagado
    )
    const rows: InvoiceRow[] = [
      ...facturas.map(quoteToRow),
      ...(includeSimp ? simplificadas.map(docToRow) : []),
      ...(includeProformas ? proformas.map(docToRow) : []),
      ...(includeRentals ? paidRentals.map(rentalToRow) : []),
    ]
    return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [facturas, simplificadas, proformas, rentalBookings, includeSimp, includeProformas, includeRentals])

  // ── Purchase invoice rows (recibidas) ─────────────────────
  // Group purchase items by orderGroupId. Items without a group
  // that still have invoice data get their own row.
  const purchaseInvoiceRows = useMemo(() => {
    const rows: InvoiceRow[] = []
    const groups = new Map<string, PurchaseItem[]>()
    const ungrouped: PurchaseItem[] = []

    for (const p of purchaseItems) {
      if (p.orderGroupId) {
        const arr = groups.get(p.orderGroupId) || []
        arr.push(p)
        groups.set(p.orderGroupId, arr)
      } else if (p.invoiceNumber || p.invoiceAmount != null) {
        ungrouped.push(p)
      }
    }

    // Grouped → one row per group
    for (const [, items] of groups) {
      const first = items[0]
      const vatPct = first.invoiceVatPct ?? 21
      const total = first.invoiceAmount ?? 0
      const base = total / (1 + vatPct / 100)
      const vatAmt = total - base
      rows.push({
        number: first.invoiceNumber || first.orderGroupId || '—',
        date: first.invoiceDate ? new Date(first.invoiceDate) : (first.orderedAt ? new Date(first.orderedAt) : new Date(first.createdAt)),
        client: first.provider || 'Sin proveedor',
        nif: first.invoiceProviderNif || '',
        base: Math.round(base * 100) / 100,
        vatPct,
        vatAmount: Math.round(vatAmt * 100) / 100,
        total,
        type: 'factura',
        invoiceImageUrl: first.invoiceImageUrl,
      })
    }

    // Ungrouped with invoice data
    for (const p of ungrouped) {
      const vatPct = p.invoiceVatPct ?? 21
      const total = p.invoiceAmount ?? 0
      const base = total / (1 + vatPct / 100)
      const vatAmt = total - base
      rows.push({
        number: p.invoiceNumber || '—',
        date: p.invoiceDate ? new Date(p.invoiceDate) : (p.orderedAt ? new Date(p.orderedAt) : new Date(p.createdAt)),
        client: p.provider || 'Sin proveedor',
        nif: p.invoiceProviderNif || '',
        base: Math.round(base * 100) / 100,
        vatPct,
        vatAmount: Math.round(vatAmt * 100) / 100,
        total,
        type: 'factura',
        invoiceImageUrl: p.invoiceImageUrl,
      })
    }

    return rows.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [purchaseItems])

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    allRows.forEach(r => years.add(r.date.getFullYear()))
    purchaseInvoiceRows.forEach(r => years.add(r.date.getFullYear()))
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [allRows, purchaseInvoiceRows])

  // Filtered by year
  const yearRows = useMemo(() =>
    allRows.filter(r => r.date.getFullYear() === year)
  , [allRows, year])

  const yearPurchaseRows = useMemo(() =>
    purchaseInvoiceRows.filter(r => r.date.getFullYear() === year)
  , [purchaseInvoiceRows, year])

  // Filtered by year + quarter
  const quarterRows = useMemo(() => {
    const { start, end } = getQuarterDates(year, quarter)
    return allRows.filter(r => r.date >= start && r.date <= end)
  }, [allRows, year, quarter])

  // ── Export CSV ─────────────────────────────────────────────
  const downloadCSV = (rows: InvoiceRow[], filename: string) => {
    const header = 'Nº Factura;Fecha;Cliente;NIF/CIF;Base Imponible;% IVA;Cuota IVA;Total;Tipo'
    const lines = rows.map(r =>
      [
        r.number,
        r.date.toLocaleDateString('es-ES'),
        `"${r.client}"`,
        r.nif,
        fmt(r.base),
        r.vatPct,
        fmt(r.vatAmount),
        fmt(r.total),
        r.type === 'factura' ? 'Factura' : r.type === 'simplificada' ? 'Simplificada' : r.type === 'alquiler' ? 'Alquiler' : 'Proforma',
      ].join(';')
    )
    const csv = '\uFEFF' + [header, ...lines].join('\n') // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render helpers ─────────────────────────────────────────

  const SummaryBlock = ({ label, value, color = 'text-gray-900' }: { label: string; value: string; color?: string }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )

  // ── Report content ─────────────────────────────────────────

  const renderLibroFacturas = () => {
    const rows = yearRows
    const totals = rows.reduce(
      (acc, r) => ({ base: acc.base + r.base, vat: acc.vat + r.vatAmount, total: acc.total + r.total }),
      { base: 0, vat: 0, total: 0 }
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">📒 Libro de Facturas Emitidas — {year}</h3>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(rows, `libro-facturas-${year}`)}>
            📥 Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <SummaryBlock label="Total facturas" value={String(rows.length)} />
          <SummaryBlock label="Base imponible" value={`${fmt(totals.base)} €`} />
          <SummaryBlock label="Total IVA" value={`${fmt(totals.vat)} €`} color="text-orange-600" />
          <SummaryBlock label="Total facturado" value={`${fmt(totals.total)} €`} color="text-green-700" />
        </div>

        <div className="max-h-[350px] overflow-y-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Nº</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">NIF</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-center">IVA%</th>
                <th className="px-3 py-2 text-right">Cuota IVA</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono">{r.number}</td>
                  <td className="px-3 py-1.5">{r.date.toLocaleDateString('es-ES')}</td>
                  <td className="px-3 py-1.5 truncate max-w-[160px]">{r.client}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{r.nif || '—'}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.base)} €</td>
                  <td className="px-3 py-1.5 text-center">{r.vatPct}%</td>
                  <td className="px-3 py-1.5 text-right text-orange-600">{fmt(r.vatAmount)} €</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(r.total)} €</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      r.type === 'factura' ? 'bg-green-100 text-green-700' :
                      r.type === 'simplificada' ? 'bg-blue-100 text-blue-700' :
                      r.type === 'alquiler' ? 'bg-amber-100 text-amber-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      {r.type === 'factura' ? 'Factura' : r.type === 'simplificada' ? 'Simpl.' : r.type === 'alquiler' ? 'Alquiler' : 'Proforma'}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">No hay facturas en {year}</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t-2">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">TOTALES</td>
                  <td className="px-3 py-2 text-right">{fmt(totals.base)} €</td>
                  <td />
                  <td className="px-3 py-2 text-right text-orange-600">{fmt(totals.vat)} €</td>
                  <td className="px-3 py-2 text-right text-green-700">{fmt(totals.total)} €</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  const renderIVATrimestral = () => {
    // Group emitidas and recibidas by quarter for the selected year
    const quarters = [1, 2, 3, 4].map(q => {
      const { start, end } = getQuarterDates(year, q)
      // Emitidas (IVA repercutido)
      const emitRows = allRows.filter(r => r.date.getFullYear() === year && r.date >= start && r.date <= end)
      const emitBase = emitRows.reduce((s, r) => s + r.base, 0)
      const emitVat = emitRows.reduce((s, r) => s + r.vatAmount, 0)
      // Recibidas (IVA soportado)
      const recRows = purchaseInvoiceRows.filter(r => r.date.getFullYear() === year && r.date >= start && r.date <= end)
      const recBase = recRows.reduce((s, r) => s + r.base, 0)
      const recVat = recRows.reduce((s, r) => s + r.vatAmount, 0)
      // Resultado (a ingresar o a compensar)
      const resultado = emitVat - recVat
      return { q, emitRows, emitBase, emitVat, recRows, recBase, recVat, resultado }
    })

    const annualEmitVat = quarters.reduce((s, q) => s + q.emitVat, 0)
    const annualRecVat = quarters.reduce((s, q) => s + q.recVat, 0)
    const annualResultado = annualEmitVat - annualRecVat

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">📊 Resumen IVA Trimestral — {year} (Modelo 303)</h3>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(yearRows, `iva-trimestral-${year}`)}>
            📥 Exportar datos
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quarters.map(qData => (
            <Card key={qData.q} className={`${quarter === qData.q ? 'ring-2 ring-blue-400' : ''}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-700">{getQuarterLabel(qData.q)} Trimestre</h4>
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                    {qData.emitRows.length} emit. / {qData.recRows.length} recib.
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">IVA repercutido (ventas)</span>
                    <span className="font-semibold text-orange-600">{fmt(qData.emitVat)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">IVA soportado (compras)</span>
                    <span className="font-semibold text-blue-600">−{fmt(qData.recVat)} €</span>
                  </div>
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Resultado</span>
                    <span className={`font-bold ${qData.resultado >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {qData.resultado >= 0 ? `A ingresar: ${fmt(qData.resultado)} €` : `A compensar: ${fmt(Math.abs(qData.resultado))} €`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Annual summary */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-bold text-blue-800 mb-3">📋 Resumen Anual {year} — Modelo 303</h4>
            <div className="grid grid-cols-3 gap-4">
              <SummaryBlock label="IVA repercutido total" value={`${fmt(annualEmitVat)} €`} color="text-orange-600" />
              <SummaryBlock label="IVA soportado total" value={`${fmt(annualRecVat)} €`} color="text-blue-600" />
              <SummaryBlock
                label={annualResultado >= 0 ? 'A ingresar (Hacienda)' : 'A compensar'}
                value={`${fmt(Math.abs(annualResultado))} €`}
                color={annualResultado >= 0 ? 'text-red-600' : 'text-green-700'}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderResumenAnual = () => {
    // Monthly breakdown
    const months = Array.from({ length: 12 }, (_, i) => {
      const rows = allRows.filter(r => r.date.getFullYear() === year && r.date.getMonth() === i)
      const base = rows.reduce((s, r) => s + r.base, 0)
      const vat = rows.reduce((s, r) => s + r.vatAmount, 0)
      const total = rows.reduce((s, r) => s + r.total, 0)
      return { month: i, rows, base, vat, total }
    })

    const annualBase = months.reduce((s, m) => s + m.base, 0)
    const annualVat = months.reduce((s, m) => s + m.vat, 0)
    const annualTotal = months.reduce((s, m) => s + m.total, 0)

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">📈 Resumen Anual — {year} (Modelo 390)</h3>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(yearRows, `resumen-anual-${year}`)}>
            📥 Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <SummaryBlock label="Total facturas" value={String(yearRows.length)} />
          <SummaryBlock label="Base imponible" value={`${fmt(annualBase)} €`} />
          <SummaryBlock label="IVA repercutido" value={`${fmt(annualVat)} €`} color="text-orange-600" />
          <SummaryBlock label="Facturación total" value={`${fmt(annualTotal)} €`} color="text-green-700" />
        </div>

        <div className="max-h-[400px] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Mes</th>
                <th className="px-4 py-2 text-center">Nº Facturas</th>
                <th className="px-4 py-2 text-right">Base Imponible</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month} className={`border-t ${m.rows.length > 0 ? 'hover:bg-gray-50' : 'text-gray-300'}`}>
                  <td className="px-4 py-2 font-medium">{monthNames[m.month]}</td>
                  <td className="px-4 py-2 text-center">{m.rows.length}</td>
                  <td className="px-4 py-2 text-right">{m.rows.length > 0 ? `${fmt(m.base)} €` : '—'}</td>
                  <td className="px-4 py-2 text-right text-orange-600">{m.rows.length > 0 ? `${fmt(m.vat)} €` : '—'}</td>
                  <td className="px-4 py-2 text-right font-semibold">{m.rows.length > 0 ? `${fmt(m.total)} €` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold border-t-2">
              <tr>
                <td className="px-4 py-2">TOTAL {year}</td>
                <td className="px-4 py-2 text-center">{yearRows.length}</td>
                <td className="px-4 py-2 text-right">{fmt(annualBase)} €</td>
                <td className="px-4 py-2 text-right text-orange-600">{fmt(annualVat)} €</td>
                <td className="px-4 py-2 text-right text-green-700">{fmt(annualTotal)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  const renderPorCliente = () => {
    const rows = yearRows
    const byClient = new Map<string, { client: string; nif: string; count: number; base: number; vat: number; total: number }>()

    for (const r of rows) {
      const key = r.client
      const existing = byClient.get(key) || { client: r.client, nif: r.nif, count: 0, base: 0, vat: 0, total: 0 }
      existing.count++
      existing.base += r.base
      existing.vat += r.vatAmount
      existing.total += r.total
      if (!existing.nif && r.nif) existing.nif = r.nif
      byClient.set(key, existing)
    }

    const clients = Array.from(byClient.values()).sort((a, b) => b.total - a.total)
    const totals = clients.reduce(
      (acc, c) => ({ base: acc.base + c.base, vat: acc.vat + c.vat, total: acc.total + c.total }),
      { base: 0, vat: 0, total: 0 }
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">👥 Desglose por Cliente — {year}</h3>
          <Button size="sm" variant="outline" onClick={() => {
            const header = 'Cliente;NIF/CIF;Nº Facturas;Base Imponible;IVA;Total'
            const lines = clients.map(c =>
              [`"${c.client}"`, c.nif, c.count, fmt(c.base), fmt(c.vat), fmt(c.total)].join(';')
            )
            const csv = '\uFEFF' + [header, ...lines].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `desglose-clientes-${year}.csv`
            a.click()
            URL.revokeObjectURL(url)
          }}>
            📥 Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SummaryBlock label="Total clientes" value={String(clients.length)} />
          <SummaryBlock label="Base total" value={`${fmt(totals.base)} €`} />
          <SummaryBlock label="Facturado total" value={`${fmt(totals.total)} €`} color="text-green-700" />
        </div>

        <div className="max-h-[350px] overflow-y-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">NIF/CIF</th>
                <th className="px-4 py-2 text-center">Facturas</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium truncate max-w-[200px]">{c.client}</td>
                  <td className="px-4 py-2 font-mono text-gray-500 text-xs">{c.nif || '—'}</td>
                  <td className="px-4 py-2 text-center">{c.count}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.base)} €</td>
                  <td className="px-4 py-2 text-right text-orange-600">{fmt(c.vat)} €</td>
                  <td className="px-4 py-2 text-right font-bold">{fmt(c.total)} €</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-8">No hay datos para {year}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderFacturasRecibidas = () => {
    const rows = yearPurchaseRows
    const totals = rows.reduce(
      (acc, r) => ({ base: acc.base + r.base, vat: acc.vat + r.vatAmount, total: acc.total + r.total }),
      { base: 0, vat: 0, total: 0 }
    )

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">🧾 Facturas Recibidas (Compras) — {year}</h3>
          <Button size="sm" variant="outline" onClick={() => downloadCSV(rows, `facturas-recibidas-${year}`)}>
            📥 Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <SummaryBlock label="Total facturas" value={String(rows.length)} />
          <SummaryBlock label="Base imponible" value={`${fmt(totals.base)} €`} />
          <SummaryBlock label="IVA soportado" value={`${fmt(totals.vat)} €`} color="text-blue-600" />
          <SummaryBlock label="Total compras" value={`${fmt(totals.total)} €`} color="text-red-600" />
        </div>

        <div className="max-h-[350px] overflow-y-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">Nº Factura</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">NIF</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-center">IVA%</th>
                <th className="px-3 py-2 text-right">Cuota IVA</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Doc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono">{r.number}</td>
                  <td className="px-3 py-1.5">{r.date.toLocaleDateString('es-ES')}</td>
                  <td className="px-3 py-1.5 truncate max-w-[160px]">{r.client}</td>
                  <td className="px-3 py-1.5 font-mono text-gray-500">{r.nif || '—'}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(r.base)} €</td>
                  <td className="px-3 py-1.5 text-center">{r.vatPct}%</td>
                  <td className="px-3 py-1.5 text-right text-blue-600">{fmt(r.vatAmount)} €</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(r.total)} €</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.invoiceImageUrl ? (
                      <a href={r.invoiceImageUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700" title="Ver factura">
                        📄
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8">
                    No hay facturas de compra registradas en {year}.
                    <br /><span className="text-xs">Registra datos de factura al marcar pedidos como enviados.</span>
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t-2">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">TOTALES</td>
                  <td className="px-3 py-2 text-right">{fmt(totals.base)} €</td>
                  <td />
                  <td className="px-3 py-2 text-right text-blue-600">{fmt(totals.vat)} €</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmt(totals.total)} €</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    )
  }

  // ── Report selector ────────────────────────────────────────

  const reportButtons: { key: ReportType; label: string; icon: string; desc: string }[] = [
    { key: 'libro-facturas',     label: 'Facturas Emitidas', icon: '📒', desc: 'Libro de facturas emitidas' },
    { key: 'facturas-recibidas', label: 'Facturas Recibidas', icon: '🧾', desc: 'Facturas de compra (proveedores)' },
    { key: 'iva-trimestral',     label: 'IVA Trimestral',    icon: '📊', desc: 'Resumen para Modelo 303' },
    { key: 'resumen-anual',      label: 'Resumen Anual',     icon: '📈', desc: 'Desglose mensual — Modelo 390' },
    { key: 'por-cliente',        label: 'Por Cliente',        icon: '👥', desc: 'Desglose de facturación por cliente' },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[9998] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              🏛️ Informes Fiscales
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Genera informes para auditorías, Hacienda y control fiscal</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* Controls row */}
        <div className="bg-white border-b px-6 py-3 flex flex-wrap items-center gap-4 shrink-0">
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Año:</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Quarter selector (only for trimestral) */}
          {reportType === 'iva-trimestral' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Trimestre:</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(q => (
                  <button
                    key={q}
                    onClick={() => setQuarter(q)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      quarter === q ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {getQuarterLabel(q)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-5 w-px bg-gray-200" />

          {/* Include switches */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeSimp} onChange={e => setIncludeSimp(e.target.checked)} className="rounded" />
            <span className="text-xs text-gray-600">Incluir simplificadas</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeProformas} onChange={e => setIncludeProformas(e.target.checked)} className="rounded" />
            <span className="text-xs text-gray-600">Incluir proformas</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={includeRentals} onChange={e => setIncludeRentals(e.target.checked)} className="rounded" />
            <span className="text-xs text-gray-600">Incluir alquileres</span>
          </label>
        </div>

        {/* Report type tabs */}
        <div className="bg-white border-b px-6 py-2 flex gap-2 overflow-x-auto shrink-0">
          {reportButtons.map(rb => (
            <button
              key={rb.key}
              onClick={() => setReportType(rb.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                reportType === rb.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{rb.icon}</span>
              <div className="text-left">
                <span className="block">{rb.label}</span>
                {reportType === rb.key && <span className="block text-[10px] opacity-80">{rb.desc}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto p-6">
          {reportType === 'libro-facturas' && renderLibroFacturas()}
          {reportType === 'facturas-recibidas' && renderFacturasRecibidas()}
          {reportType === 'iva-trimestral' && renderIVATrimestral()}
          {reportType === 'resumen-anual' && renderResumenAnual()}
          {reportType === 'por-cliente' && renderPorCliente()}
        </div>
      </div>
    </div>,
    getPortalRoot()
  )
}
