/**
 * QuickDocumentModal.tsx
 *
 * Modal para crear documentos de cobro rápidos:
 *   - Factura Simplificada  (no requiere datos fiscales del cliente)
 *   - Proforma              (presupuesto en formato factura, sin validez fiscal)
 *
 * Funciona de forma independiente: no necesita un presupuesto previo.
 * Incluye previsualización A4 en tiempo real + impresión/PDF.
 */

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { ConfigService } from '@/features/config/services/configService'
import { QuickDocService } from '../services/quickDocService'
import { LeadDocumentsService } from '@/features/crm/services/leadDocumentsService'

// ─── Tipos ───────────────────────────────────────────────────

export type QuickDocType = 'FACTURA_SIMPLIFICADA' | 'PROFORMA'

interface QuickLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

interface CompanyInfo {
  name: string
  nif: string
  address: string
  phone: string
  email: string
}

export interface QuickDocInitialData {
  clientName?: string
  clientNif?: string
  lines?: QuickLine[]
  leadId?: string   // if set, auto-attach generated doc to lead
}

interface QuickDocumentModalProps {
  type: QuickDocType
  initialData?: QuickDocInitialData
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────

const DOC_META: Record<QuickDocType, { label: string; prefix: string; color: string; bgColor: string; description: string }> = {
  FACTURA_SIMPLIFICADA: {
    label: 'Factura Simplificada',
    prefix: 'FS',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    description: 'Factura sin datos fiscales del destinatario. Válida hasta 400 € (o en taller autorizado).',
  },
  PROFORMA: {
    label: 'Proforma',
    prefix: 'PRO',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    description: 'Documento informativo de precio. No tiene validez fiscal.',
  },
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'VanSpace Workshop',
  nif: 'B00000000',
  address: 'C/ Ejemplo 1, 28001 Madrid',
  phone: '+34 600 000 000',
  email: 'info@vanspace.es',
}

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function nextDocNumber(prefix: string): string {
  const year = new Date().getFullYear()
  const key = `quick_doc_seq_${prefix}_${year}`
  const seq = parseInt(localStorage.getItem(key) ?? '0', 10) + 1
  localStorage.setItem(key, String(seq))
  return `${prefix}-${year}-${String(seq).padStart(3, '0')}`
}

function emptyLine(): QuickLine {
  return { id: `l-${Date.now()}-${Math.random()}`, description: '', quantity: 1, unitPrice: 0 }
}

// ─── Componente ──────────────────────────────────────────────

export default function QuickDocumentModal({ type, initialData, onClose }: QuickDocumentModalProps) {
  const meta = DOC_META[type]
  const printRef = useRef<HTMLDivElement>(null)

  // Form state
  const [docNumber] = useState(() => nextDocNumber(meta.prefix))
  const [docDate] = useState(() => new Date())
  const [clientName, setClientName] = useState(initialData?.clientName ?? '')
  const [clientNif, setClientNif] = useState(initialData?.clientNif ?? '')
  const [lines, setLines] = useState<QuickLine[]>(
    initialData?.lines?.length ? initialData.lines : [emptyLine()]
  )
  const [vatPct, setVatPct] = useState(21)
  const [discountPct, setDiscountPct] = useState(0)
  const [footerNotes, setFooterNotes] = useState(
    type === 'FACTURA_SIMPLIFICADA'
      ? 'Factura simplificada emitida conforme al art. 7.2 del Real Decreto 1619/2012.'
      : 'Este documento es una proforma y no tiene validez fiscal. Precios sujetos a confirmación.'
  )
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY)

  // Load company from Supabase
  useEffect(() => {
    ConfigService.getCompanyInfo()
      .then(rows => {
        if (!rows?.length) return
        const get = (c: string) => rows.find(r => r.campo === c)?.valor ?? ''
        setCompany({
          name: get('nombre_empresa') || DEFAULT_COMPANY.name,
          nif: get('nif') || DEFAULT_COMPANY.nif,
          address: get('direccion') || DEFAULT_COMPANY.address,
          phone: get('telefono') || DEFAULT_COMPANY.phone,
          email: get('email') || DEFAULT_COMPANY.email,
        })
      })
      .catch(() => {})
  }, [])

  // Calculations
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const discountAmt = subtotal * (discountPct / 100)
  const base = subtotal - discountAmt
  const vatAmt = base * (vatPct / 100)
  const total = base + vatAmt

  // ─── Line ops ─────────────────────────────────────────────

  const updateLine = (id: string, field: keyof QuickLine, value: string) => {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l
      if (field === 'description') return { ...l, description: value }
      return { ...l, [field]: parseFloat(value) || 0 }
    }))
  }

  const addLine = () => setLines(prev => [...prev, emptyLine()])
  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id))

  // ─── Save & Print ─────────────────────────────────────────

  const [saved, setSaved] = useState(false)

  const saveDoc = () => {
    const docDateStr = docDate.toISOString().substring(0, 10)
    QuickDocService.save({
      type,
      docNumber,
      docDate: docDateStr,
      clientName: clientName || (type === 'FACTURA_SIMPLIFICADA' ? 'Sin nombre' : 'Cliente'),
      clientNif: clientNif || undefined,
      lines,
      vatPct,
      discountPct,
      subtotal,
      vatAmount: vatAmt,
      total,
      notes: footerNotes,
      companyName: company.name,
    })
    setSaved(true)

    // Auto-attach to lead if leadId provided
    if (initialData?.leadId && printRef.current) {
      const htmlContent = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>${meta.label} ${docNumber}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#fff}</style></head><body>${printRef.current.outerHTML}</body></html>`
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const file = new File([blob], `${docNumber}.html`, { type: 'text/html' })
      const category = type === 'FACTURA_SIMPLIFICADA' ? 'factura' : 'presupuesto'
      LeadDocumentsService.upload(
        initialData.leadId,
        file,
        category as any,
        `Generado automáticamente — ${meta.label}`,
        ''
      ).catch(err => console.warn('Auto-attach quick doc failed:', err))
    }
  }

  const handlePrint = () => {
    saveDoc()
    const elem = printRef.current
    if (!elem) return
    const pw = window.open('', '_blank', 'width=900,height=700')
    if (!pw) { alert('Activa las ventanas emergentes para imprimir.'); return }
    pw.document.write(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<title>${meta.label} ${docNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff}
  @page{size:A4;margin:0}
  @media print{html,body{width:210mm;height:297mm}}
</style>
</head><body>
${elem.outerHTML}
<script>window.onload=function(){window.print();window.close()}<\/script>
</body></html>`)
    pw.document.close()
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-stretch justify-center overflow-hidden">

      {/* ── Left panel: controls ── */}
      <div className="w-72 min-w-[260px] bg-white flex flex-col shadow-2xl border-r border-gray-200 z-10">

        {/* Header */}
        <div className="px-4 py-4 text-white font-bold text-base" style={{ background: meta.color }}>
          {type === 'FACTURA_SIMPLIFICADA' ? '🧾' : '📋'} {meta.label}
          <p className="text-xs font-normal opacity-80 mt-0.5">{meta.description}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Nº documento */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nº DOCUMENTO</label>
            <div className="text-sm font-mono font-bold px-2 py-1.5 bg-gray-100 rounded border">{docNumber}</div>
          </div>

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

          {/* Cliente (siempre opcional) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              CLIENTE <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Nombre / Razón social"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              className="text-xs h-7 mb-1"
            />
            {type === 'PROFORMA' && (
              <Input
                placeholder="NIF / CIF"
                value={clientNif}
                onChange={e => setClientNif(e.target.value)}
                className="text-xs h-7"
              />
            )}
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500">LÍNEAS</label>
              <button onClick={addLine} className="text-xs text-blue-600 hover:underline">+ Añadir</button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={line.id} className="rounded border border-gray-200 p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-500">#{idx + 1}</span>
                    {lines.length > 1 && (
                      <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-600">🗑️</button>
                    )}
                  </div>
                  <Input
                    value={line.description}
                    onChange={e => updateLine(line.id, 'description', e.target.value)}
                    placeholder="Descripción"
                    className="h-6 text-xs mb-1"
                  />
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      min="0"
                      value={line.quantity}
                      onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                      placeholder="Cant."
                      className="h-6 text-xs w-14"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice || ''}
                      onChange={e => updateLine(line.id, 'unitPrice', e.target.value)}
                      placeholder="Precio/u"
                      className="h-6 text-xs flex-1"
                    />
                    <span className="text-gray-500 text-xs self-center whitespace-nowrap">
                      = {fmt(line.quantity * line.unitPrice)} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* IVA y descuento */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">IVA %</label>
              <select
                value={vatPct}
                onChange={e => setVatPct(Number(e.target.value))}
                className="w-full text-xs border rounded h-7 px-1"
              >
                <option value={21}>21%</option>
                <option value={10}>10%</option>
                <option value={4}>4%</option>
                <option value={0}>0%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Dto. %</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPct || ''}
                onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="h-7 text-xs"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">NOTAS AL PIE</label>
            <textarea
              value={footerNotes}
              onChange={e => setFooterNotes(e.target.value)}
              rows={3}
              className="w-full text-xs border rounded px-2 py-1 resize-none"
            />
          </div>

          {/* Totales */}
          <div className="rounded border border-gray-200 p-3 text-xs space-y-1 bg-gray-50">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)} €</span></div>
            {discountPct > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Dto. {discountPct}%</span><span>−{fmt(discountAmt)} €</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Base imp.</span><span className="font-semibold">{fmt(base)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IVA {vatPct}%</span><span>+{fmt(vatAmt)} €</span></div>
            <div className="flex justify-between border-t pt-1 font-bold text-sm">
              <span>TOTAL</span>
              <span style={{ color: meta.color }}>{fmt(total)} €</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t space-y-2">
          <Button
            className="w-full"
            style={{ background: meta.color, color: '#fff', border: 'none' }}
            onClick={saveDoc}
            disabled={saved}
          >
            {saved ? '✅ Guardado' : '💾 Guardar'}
          </Button>
          <Button className="w-full" variant="outline" onClick={handlePrint}>
            🖨️ Imprimir / PDF
          </Button>
          <Button className="w-full" variant="ghost" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>
      </div>

      {/* ── Right panel: A4 preview ── */}
      <div className="flex-1 overflow-auto bg-gray-300 flex justify-center py-6 px-4">
        <div className="shadow-2xl">
          {/* A4 document */}
          <div
            ref={printRef}
            style={{
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
              fontSize: '11px',
              color: '#1a1a1a',
              background: '#fff',
              width: '210mm',
              minHeight: '297mm',
              padding: '12mm 14mm',
            }}
          >
            {/* ── Document header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10mm', borderBottom: `3px solid ${meta.color}`, paddingBottom: '6mm' }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: meta.color, letterSpacing: '-0.5px' }}>
                  {meta.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{docNumber}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10px', color: '#374151' }}>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{company.name}</div>
                <div>{company.nif}</div>
                <div>{company.address}</div>
                <div>{company.phone} · {company.email}</div>
              </div>
            </div>

            {/* ── Meta row: date + client ── */}
            <div style={{ display: 'flex', gap: '8mm', marginBottom: '8mm' }}>
              <div style={{ flex: '0 0 auto', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4mm', minWidth: '50mm' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' }}>Fecha</div>
                <div style={{ fontWeight: 600 }}>{fmtDate(docDate)}</div>
              </div>
              {(clientName || type === 'PROFORMA') && (
                <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4mm' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' }}>
                    {type === 'FACTURA_SIMPLIFICADA' ? 'Cliente' : 'Destinatario'}
                  </div>
                  <div style={{ fontWeight: 600 }}>{clientName || '—'}</div>
                  {clientNif && <div style={{ color: '#6b7280' }}>{clientNif}</div>}
                </div>
              )}
              {type === 'FACTURA_SIMPLIFICADA' && !clientName && (
                <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4mm' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' }}>Cliente</div>
                  <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin identificar</div>
                </div>
              )}
            </div>

            {/* ── Lines table ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm' }}>
              <thead>
                <tr style={{ background: meta.color, color: '#fff' }}>
                  <th style={{ padding: '3mm 4mm', textAlign: 'left', fontWeight: 700, fontSize: '10px' }}>Descripción</th>
                  <th style={{ padding: '3mm 4mm', textAlign: 'center', fontWeight: 700, fontSize: '10px', width: '20mm' }}>Cant.</th>
                  <th style={{ padding: '3mm 4mm', textAlign: 'right', fontWeight: 700, fontSize: '10px', width: '28mm' }}>Precio/u</th>
                  <th style={{ padding: '3mm 4mm', textAlign: 'right', fontWeight: 700, fontSize: '10px', width: '28mm' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.filter(l => l.description || l.unitPrice > 0).map((line, idx) => (
                  <tr key={line.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '3mm 4mm' }}>{line.description || '—'}</td>
                    <td style={{ padding: '3mm 4mm', textAlign: 'center' }}>{line.quantity}</td>
                    <td style={{ padding: '3mm 4mm', textAlign: 'right' }}>{fmt(line.unitPrice)} €</td>
                    <td style={{ padding: '3mm 4mm', textAlign: 'right', fontWeight: 600 }}>{fmt(line.quantity * line.unitPrice)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Totals block ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
              <div style={{ width: '70mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', borderBottom: '1px solid #e5e7eb', fontSize: '10px' }}>
                  <span style={{ color: '#6b7280' }}>Subtotal</span>
                  <span>{fmt(subtotal)} €</span>
                </div>
                {discountPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', borderBottom: '1px solid #e5e7eb', fontSize: '10px', color: '#dc2626' }}>
                    <span>Descuento {discountPct}%</span>
                    <span>−{fmt(discountAmt)} €</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', borderBottom: '1px solid #e5e7eb', fontSize: '10px' }}>
                  <span style={{ color: '#6b7280' }}>Base imponible</span>
                  <span style={{ fontWeight: 600 }}>{fmt(base)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', borderBottom: '1px solid #e5e7eb', fontSize: '10px' }}>
                  <span style={{ color: '#6b7280' }}>IVA {vatPct}%</span>
                  <span>+{fmt(vatAmt)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3mm 4mm', background: meta.color, color: '#fff', borderRadius: '4px', marginTop: '2mm' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>TOTAL</span>
                  <span style={{ fontWeight: 800, fontSize: '15px' }}>{fmt(total)} €</span>
                </div>
              </div>
            </div>

            {/* ── Footer notes ── */}
            {footerNotes && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '4mm', fontSize: '9px', color: '#6b7280', lineHeight: 1.5 }}>
                {footerNotes}
              </div>
            )}

            {/* ── Watermark for proforma ── */}
            {type === 'PROFORMA' && (
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%) rotate(-35deg)',
                fontSize: '60px',
                fontWeight: 900,
                color: 'rgba(124,58,237,0.07)',
                pointerEvents: 'none',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                zIndex: 0,
              }}>
                PROFORMA
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
