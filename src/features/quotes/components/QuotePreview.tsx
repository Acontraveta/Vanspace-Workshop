/**
 * QuotePreview.tsx
 * Modal de previsualización del documento (presupuesto o factura) antes de aprobar/imprimir.
 *
 * Funcionalidades:
 *   - Muestra el documento QuotePDF a tamaño real dentro de un scroll
 *   - Permite editar: descripción de líneas, cantidades, precios unitarios, notas al pie
 *   - Permite añadir/eliminar líneas ad-hoc
 *   - Botón "Imprimir / Descargar PDF"
 *   - Botón "Aprobar y cerrar" → dispara onApprove()
 *   - Botón "Cerrar" sin aprobar
 */

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Quote, QuoteItem } from '../types/quote.types'
import { QuotePDF, QuoteDocumentData, CustomLine, PaymentInstallment, printQuoteDocument } from './QuotePDF'
import { generatePdfBlob, downloadPdf } from '../services/pdfGenerator'
import { LeadDocumentsService } from '@/features/crm/services/leadDocumentsService'
import { loadCompanyInfo, DEFAULT_COMPANY as SHARED_DEFAULT_COMPANY, LOGO_URL } from '@/shared/utils/companyInfo'
import toast from 'react-hot-toast'

interface QuotePreviewProps {
  quote: Quote
  type: 'PRESUPUESTO' | 'FACTURA' | 'ALBARAN'
  invoiceNumber?: string
  /** Llamada cuando el usuario confirma la aprobación desde el preview */
  onApprove?: () => void
  /** Llamada para persistir los cambios editados en el documento */
  onSaveEdits?: (data: {
    customLines: CustomLine[]
    footerNotes: string
    showBreakdown: boolean
    paymentInstallments: PaymentInstallment[]
    company: QuoteDocumentData['company']
  }) => void
  /** Llamada al cerrar sin aprobar */
  onClose: () => void
}

// Genera CustomLines a partir de los items del presupuesto
function quoteToCusomLines(quote: Quote): CustomLine[] {
  return quote.items.map((item: QuoteItem) => {
    const matCost = (item as any).materialCost ?? item.materialsTotal ?? 0
    const laborCost = item.laborCost ?? 0
    const total = matCost + laborCost
    return {
      id: item.id,
      description: item.productName,
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? total / item.quantity : 0,
      total,
      materialsTotal: matCost,
      laborCost,
      laborHours: item.laborHours,
    }
  })
}

// Valores por defecto de empresa cuando Supabase no responde
const DEFAULT_COMPANY = {
  ...SHARED_DEFAULT_COMPANY,
  nif: SHARED_DEFAULT_COMPANY.nif || '',
  logoUrl: SHARED_DEFAULT_COMPANY.logoUrl || LOGO_URL,
}

export default function QuotePreview({ quote, type, invoiceNumber, onApprove, onSaveEdits, onClose }: QuotePreviewProps) {
  // Si el presupuesto tiene datos editados guardados, inicializar desde ahí
  const savedDoc = quote.documentData
  const [lines, setLines] = useState<CustomLine[]>(() =>
    savedDoc?.customLines ?? quoteToCusomLines(quote)
  )
  const [footerNotes, setFooterNotes] = useState(
    savedDoc?.footerNotes ??
    quote.notes ??
    (type === 'PRESUPUESTO'
      ? 'Este presupuesto tiene una validez de 30 días. Los precios incluyen mano de obra y materiales. IVA no incluido en las líneas, se aplica al total.'
      : type === 'ALBARAN'
        ? 'Albarán de entrega conforme a lo acordado. Este documento acredita la entrega de los materiales y servicios descritos.'
        : 'Factura emitida conforme a lo acordado. Pago a 30 días desde la fecha de emisión.')
  )
  const [company, setCompany] = useState(savedDoc?.company ?? DEFAULT_COMPANY)
  const [editingLine, setEditingLine] = useState<string | null>(null)
  const [invoiceNum, setInvoiceNum] = useState(invoiceNumber ?? quote.invoiceNumber ?? `FAC-${quote.quoteNumber}`)
  const [showBreakdown, setShowBreakdown] = useState(savedDoc?.showBreakdown ?? false)
  const [installments, setInstallments] = useState<PaymentInstallment[]>(savedDoc?.paymentInstallments ?? [])
  const [savingPdf, setSavingPdf] = useState(false)

  // Cargar datos empresa desde Supabase (solo si no hay datos guardados)
  useEffect(() => {
    if (savedDoc?.company) return // ya cargado desde documentData
    loadCompanyInfo().then(c => setCompany({
      name: c.name,
      nif: c.nif,
      address: c.address,
      phone: c.phone,
      email: c.email,
      logoUrl: c.logoUrl,
    }))
  }, [])

  // ─── Edición de líneas ───

  const updateLine = (id: string, field: keyof CustomLine, rawValue: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      const value = field === 'description' ? rawValue : parseFloat(rawValue) || 0
      const updated = { ...l, [field]: value } as CustomLine
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = updated.quantity * updated.unitPrice
        // keep mat+labor in sync proportionally when editing price directly
        const mat = updated.materialsTotal ?? 0
        const lab = updated.laborCost ?? 0
        const oldTotal = mat + lab
        if (oldTotal > 0) {
          const ratio = updated.total / oldTotal
          updated.materialsTotal = mat * ratio
          updated.laborCost = lab * ratio
        }
      } else if (field === 'total' && updated.quantity > 0) {
        updated.unitPrice = updated.total / updated.quantity
      } else if (field === 'materialsTotal' || field === 'laborCost') {
        // Recompute total and unitPrice from mat + labor
        const mat = field === 'materialsTotal' ? (value as number) : (updated.materialsTotal ?? 0)
        const lab = field === 'laborCost' ? (value as number) : (updated.laborCost ?? 0)
        updated.total = mat + lab
        updated.unitPrice = updated.quantity > 0 ? updated.total / updated.quantity : 0
      }
      return updated
    }))
  }

  const addLine = () => {
    const newLine: CustomLine = {
      id: `custom-${Date.now()}`,
      description: 'Nueva línea',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    }
    setLines(prev => [...prev, newLine])
    setEditingLine(newLine.id)
  }

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const addInstallment = () => {
    setInstallments(prev => [...prev, { id: `inst-${Date.now()}`, label: '', percentage: 0 }])
  }
  const removeInstallment = (id: string) => setInstallments(prev => prev.filter(i => i.id !== id))
  const updateInstallment = (id: string, field: 'label' | 'percentage', value: string) => {
    setInstallments(prev => prev.map(i => i.id !== id ? i : {
      ...i,
      [field]: field === 'percentage' ? (parseFloat(value) || 0) : value,
    }))
  }

  // ─── Guardar ediciones en el presupuesto ───
  const handleSaveEdits = () => {
    if (onSaveEdits) {
      onSaveEdits({
        customLines: lines,
        footerNotes,
        showBreakdown,
        paymentInstallments: installments,
        company,
      })
      toast.success('Cambios del documento guardados')
    }
  }

  // ─── Descargar PDF ───
  const handleDownloadPdf = async () => {
    setSavingPdf(true)
    try {
      const filename = type === 'FACTURA'
        ? `${invoiceNum}.pdf`
        : type === 'ALBARAN'
          ? `ALB-${quote.quoteNumber}.pdf`
          : `${quote.quoteNumber}.pdf`
      await downloadPdf(filename)
      toast.success('PDF descargado')
    } catch (err: any) {
      console.error('Error generando PDF:', err)
      toast.error('Error al generar el PDF')
    } finally {
      setSavingPdf(false)
    }
  }

  // ─── Guardar PDF en documentos del lead ───
  const handleSaveToLeadDocs = async () => {
    if (!quote.lead_id) {
      toast.error('Este presupuesto no está vinculado a un lead')
      return
    }
    setSavingPdf(true)
    try {
      // 1. Guardar ediciones en el presupuesto primero
      if (onSaveEdits) {
        onSaveEdits({
          customLines: lines,
          footerNotes,
          showBreakdown,
          paymentInstallments: installments,
          company,
        })
      }
      // 2. Generar PDF
      const blob = await generatePdfBlob()
      const filename = type === 'FACTURA'
        ? `${invoiceNum}.pdf`
        : type === 'ALBARAN'
          ? `ALB-${quote.quoteNumber}.pdf`
          : `${quote.quoteNumber}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })
      const category = type === 'FACTURA' ? 'factura' : type === 'ALBARAN' ? 'albaran' : 'presupuesto'
      await LeadDocumentsService.upload(
        quote.lead_id,
        file,
        category,
        `${type === 'FACTURA' ? 'Factura' : type === 'ALBARAN' ? 'Albarán' : 'Presupuesto'} generado desde el editor`,
        ''
      )
      toast.success(`PDF guardado en documentos del cliente`)
    } catch (err: any) {
      console.error('Error guardando PDF en lead:', err)
      toast.error('Error al guardar PDF en documentos')
    } finally {
      setSavingPdf(false)
    }
  }

  // ─── Documento ───

  const docData: QuoteDocumentData = {
    quote,
    customLines: lines,
    company,
    type,
    invoiceNumber: type === 'FACTURA' ? invoiceNum : undefined,
    footerNotes,
    showBreakdown,
    paymentInstallments: installments.length > 0 ? installments : undefined,
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const profitPct = quote.profitMargin ?? 0
  const profitAmount = subtotal * (profitPct / 100)
  const base = subtotal + profitAmount
  const vat = base * 0.21
  const totalWithVat = base + vat

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-stretch justify-center overflow-hidden">
      {/* Panel lateral de controles */}
      <div className="w-72 min-w-[260px] bg-white flex flex-col shadow-2xl border-r border-gray-200 z-10">
        {/* Header panel */}
        <div className={`px-4 py-4 text-white font-bold text-lg ${type === 'FACTURA' ? 'bg-blue-700' : 'bg-green-700'}`}>
          {type === 'FACTURA' ? '🧾 Vista Factura' : '📄 Vista Presupuesto'}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Número documento */}
          {type === 'FACTURA' && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nº FACTURA</label>
              <Input
                value={invoiceNum}
                onChange={e => setInvoiceNum(e.target.value)}
                className="text-sm"
              />
            </div>
          )}

          {/* Empresa emisora */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">EMPRESA EMISORA</label>
            <div className="space-y-1">
              {(['name', 'nif', 'address', 'phone', 'email'] as const).map(field => (
                <Input
                  key={field}
                  placeholder={field}
                  value={company[field]}
                  onChange={e => setCompany(prev => ({ ...prev, [field]: e.target.value }))}
                  className="text-xs h-7"
                />
              ))}
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500">LÍNEAS</label>
              <button
                onClick={addLine}
                className="text-xs text-blue-600 hover:underline"
              >
                + Añadir
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={line.id} className={`rounded border p-2 text-xs ${editingLine === line.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-600">#{idx + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingLine(editingLine === line.id ? null : line.id)}
                        className="text-blue-500 hover:text-blue-700 px-1"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => removeLine(line.id)}
                        className="text-red-400 hover:text-red-600 px-1"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {editingLine === line.id ? (
                    <div className="space-y-1">
                      <Input
                        value={line.description}
                        onChange={e => updateLine(line.id, 'description', e.target.value)}
                        placeholder="Descripción"
                        className="h-6 text-xs"
                      />
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                          placeholder="Cant"
                          className="h-6 text-xs w-16"
                        />
                        <Input
                          type="number"
                          value={line.unitPrice.toFixed(2)}
                          onChange={e => updateLine(line.id, 'unitPrice', e.target.value)}
                          placeholder="Precio/u"
                          className="h-6 text-xs flex-1"
                        />
                      </div>
                      {/* Breakdown fields — only visible when desglose is active */}
                      {showBreakdown && (
                        <div className="rounded bg-gray-50 border border-gray-200 p-1.5 space-y-1">
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Desglose</p>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 w-20 shrink-0">📦 Materiales</span>
                            <Input
                              type="number" min="0" step="0.01"
                              value={line.materialsTotal?.toFixed(2) ?? '0.00'}
                              onChange={e => updateLine(line.id, 'materialsTotal', e.target.value)}
                              className="h-6 text-xs flex-1"
                            />
                            <span className="text-[10px] text-gray-400">€</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 w-20 shrink-0">🔧 M. obra{line.laborHours ? ` (${line.laborHours}h)` : ''}</span>
                            <Input
                              type="number" min="0" step="0.01"
                              value={line.laborCost?.toFixed(2) ?? '0.00'}
                              onChange={e => updateLine(line.id, 'laborCost', e.target.value)}
                              className="h-6 text-xs flex-1"
                            />
                            <span className="text-[10px] text-gray-400">€</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-gray-500">
                        <span>Total: <strong>{fmt(line.total)} €</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-700 truncate">{line.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notas al pie */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">NOTAS AL PIE</label>
            <textarea
              value={footerNotes}
              onChange={e => setFooterNotes(e.target.value)}
              rows={4}
              className="w-full text-xs border rounded px-2 py-1 resize-none"
            />
          </div>

          {/* Desglose de precios */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-500">DESGLOSE DE PRECIOS</label>
              <button
                onClick={() => setShowBreakdown(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  showBreakdown ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  showBreakdown ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {showBreakdown && (
              <p className="text-[10px] text-gray-400 mt-1">Muestra materiales + mano de obra por línea</p>
            )}
          </div>

          {/* Plan de pagos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500">PLAN DE PAGOS</label>
              <button onClick={addInstallment} className="text-xs text-blue-600 hover:underline">+ Añadir</button>
            </div>
            {installments.length > 0 && (
              <div className="space-y-2">
                {installments.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-1">
                    <Input
                      value={inst.label}
                      onChange={e => updateInstallment(inst.id, 'label', e.target.value)}
                      placeholder="Concepto"
                      className="h-6 text-xs flex-1"
                    />
                    <Input
                      type="number" min="0" max="100"
                      value={inst.percentage || ''}
                      onChange={e => updateInstallment(inst.id, 'percentage', e.target.value)}
                      placeholder="%"
                      className="h-6 text-xs w-12"
                    />
                    <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">
                      {fmt(totalWithVat * (inst.percentage / 100))}€
                    </span>
                    <button onClick={() => removeInstallment(inst.id)} className="text-red-400 hover:text-red-600 shrink-0">✕</button>
                  </div>
                ))}
                {(() => {
                  const total = installments.reduce((s, i) => s + i.percentage, 0)
                  return Math.abs(total - 100) > 0.1 ? (
                    <p className="text-[10px] text-orange-600">Total: {total}% (debe sumar 100%)</p>
                  ) : (
                    <p className="text-[10px] text-green-600">✓ Plan completo (100%)</p>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Totales resumen */}
          <div className="rounded border border-gray-200 p-3 text-xs space-y-1 bg-gray-50">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)} €</span></div>
            {profitPct > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Margen ({profitPct}%)</span><span>+{fmt(profitAmount)} €</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Base imp.</span><span className="font-semibold">{fmt(base)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IVA 21%</span><span>+{fmt(vat)} €</span></div>
            <div className="flex justify-between border-t pt-1 font-bold text-sm">
              <span>TOTAL</span><span className={type === 'FACTURA' ? 'text-blue-700' : 'text-green-700'}>{fmt(totalWithVat)} €</span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="p-4 border-t space-y-2">
          {/* Guardar cambios editados */}
          {onSaveEdits && (
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              onClick={handleSaveEdits}
            >
              💾 Guardar cambios
            </Button>
          )}

          {/* Guardar PDF en documentación del lead */}
          {quote.lead_id && (
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSaveToLeadDocs}
              disabled={savingPdf}
            >
              {savingPdf ? '⏳ Generando…' : '📎 Guardar PDF en cliente'}
            </Button>
          )}

          {/* Descargar PDF */}
          <Button
            className="w-full"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={savingPdf}
          >
            {savingPdf ? '⏳ Generando…' : '📥 Descargar PDF'}
          </Button>

          <Button
            className="w-full"
            variant="outline"
            onClick={() => printQuoteDocument(docData)}
          >
            🖨️ Imprimir
          </Button>

          {onApprove && (
            <Button
              className={`w-full font-bold ${type === 'FACTURA' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
              onClick={onApprove}
            >
              {type === 'FACTURA' ? '✅ Emitir Factura' : '✅ Aprobar Presupuesto'}
            </Button>
          )}

          <Button className="w-full" variant="ghost" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>
      </div>

      {/* Vista previa del PDF */}
      <div className="flex-1 overflow-auto bg-gray-300 flex justify-center py-6 px-4">
        <div className="shadow-2xl">
          <QuotePDF data={docData} />
        </div>
      </div>
    </div>
  )
}
