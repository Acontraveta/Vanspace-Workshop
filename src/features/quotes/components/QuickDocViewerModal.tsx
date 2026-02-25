/**
 * QuickDocViewerModal.tsx
 *
 * Read-only viewer for a saved QuickDocRecord (factura simplificada / proforma).
 * Renders the A4 preview with print/download PDF support.
 */

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { QuickDocRecord } from '../services/quickDocService'
import { generatePdfBlob } from '../services/pdfGenerator'
import { loadCompanyInfo, LOGO_URL } from '@/shared/utils/companyInfo'

// ─── Types ───────────────────────────────────────────────────

interface CompanyInfo {
  name: string
  nif: string
  address: string
  phone: string
  email: string
  logoUrl: string
}

interface QuickDocViewerModalProps {
  doc: QuickDocRecord
  onClose: () => void
}

// ─── Meta ────────────────────────────────────────────────────

const DOC_META: Record<string, { label: string; color: string }> = {
  FACTURA_SIMPLIFICADA: { label: 'Factura Simplificada', color: '#1d4ed8' },
  PROFORMA:             { label: 'Proforma',             color: '#7c3aed' },
}

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Component ───────────────────────────────────────────────

export default function QuickDocViewerModal({ doc, onClose }: QuickDocViewerModalProps) {
  const meta = DOC_META[doc.type] ?? DOC_META.FACTURA_SIMPLIFICADA
  const printRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const [company, setCompany] = useState<CompanyInfo>({
    name: doc.companyName || 'VanSpace Workshop',
    nif: '',
    address: '',
    phone: '',
    email: '',
    logoUrl: LOGO_URL,
  })

  useEffect(() => {
    loadCompanyInfo().then(c => setCompany({
      name: c.name,
      nif: c.nif,
      address: c.address,
      phone: c.phone,
      email: c.email,
      logoUrl: c.logoUrl,
    }))
  }, [])

  // Calculations
  const subtotal = doc.subtotal
  const discountPct = doc.discountPct
  const discountAmt = subtotal * (discountPct / 100)
  const base = subtotal - discountAmt
  const vatAmt = doc.vatAmount
  const total = doc.total

  // ─── Actions ──────────────────────────────────────────────

  const handlePrint = () => {
    const elem = printRef.current
    if (!elem) return
    const pw = window.open('', '_blank', 'width=900,height=700')
    if (!pw) { alert('Activa las ventanas emergentes para imprimir.'); return }
    pw.document.write(`<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8"/>
<title>${meta.label} ${doc.docNumber}</title>
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

  const handleDownloadPdf = async () => {
    const elem = printRef.current
    if (!elem) return
    setGenerating(true)
    try {
      const blob = await generatePdfBlob(elem)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.docNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setGenerating(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-stretch justify-center overflow-hidden">

      {/* ── Left panel: info + actions ── */}
      <div className="w-64 min-w-[240px] bg-white flex flex-col shadow-2xl border-r border-gray-200 z-10">

        {/* Header */}
        <div className="px-4 py-4 text-white font-bold text-base" style={{ background: meta.color }}>
          {doc.type === 'FACTURA_SIMPLIFICADA' ? '🧾' : '📋'} {meta.label}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Doc number */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Nº DOCUMENTO</label>
            <div className="text-sm font-mono font-bold px-2 py-1.5 bg-gray-100 rounded border">{doc.docNumber}</div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">FECHA</label>
            <div className="text-sm px-2 py-1.5 bg-gray-50 rounded border">{fmtDate(doc.docDate)}</div>
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">CLIENTE</label>
            <div className="text-sm px-2 py-1.5 bg-gray-50 rounded border">{doc.clientName}</div>
            {doc.clientNif && (
              <div className="text-xs text-gray-400 mt-1 px-2">NIF: {doc.clientNif}</div>
            )}
          </div>

          {/* Lines summary */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">LÍNEAS</label>
            <div className="space-y-1">
              {doc.lines.map((line, idx) => (
                <div key={line.id || idx} className="text-xs bg-gray-50 rounded border px-2 py-1.5">
                  <div className="font-medium truncate">{line.description || '—'}</div>
                  <div className="text-gray-400">{line.quantity} × {fmt(line.unitPrice)} €</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded border border-gray-200 p-3 text-xs space-y-1 bg-gray-50">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)} €</span></div>
            {discountPct > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Dto. {discountPct}%</span><span>−{fmt(discountAmt)} €</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Base imp.</span><span className="font-semibold">{fmt(base)} €</span></div>
            <div className="flex justify-between"><span className="text-gray-500">IVA {doc.vatPct}%</span><span>+{fmt(vatAmt)} €</span></div>
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
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={generating}
          >
            {generating ? '⏳ Generando…' : '📥 Descargar PDF'}
          </Button>
          <Button className="w-full" variant="outline" onClick={handlePrint}>
            🖨️ Imprimir
          </Button>
          <Button className="w-full" variant="ghost" onClick={onClose}>
            ✕ Cerrar
          </Button>
        </div>
      </div>

      {/* ── Right panel: A4 preview ── */}
      <div className="flex-1 overflow-auto bg-gray-300 flex justify-center py-6 px-4">
        <div className="shadow-2xl">
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
                {company.logoUrl && (
                  <img src={company.logoUrl} alt="logo" style={{ height: '50px', marginBottom: '6px', display: 'block', objectFit: 'contain' }} crossOrigin="anonymous" />
                )}
                <div style={{ fontSize: '22px', fontWeight: 800, color: meta.color, letterSpacing: '-0.5px' }}>
                  {meta.label.toUpperCase()}
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{doc.docNumber}</div>
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
                <div style={{ fontWeight: 600 }}>{fmtDate(doc.docDate)}</div>
              </div>
              <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '4mm' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '2px' }}>
                  {doc.type === 'FACTURA_SIMPLIFICADA' ? 'Cliente' : 'Destinatario'}
                </div>
                <div style={{ fontWeight: 600 }}>{doc.clientName || '—'}</div>
                {doc.clientNif && <div style={{ color: '#6b7280' }}>{doc.clientNif}</div>}
              </div>
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
                {doc.lines.filter(l => l.description || l.unitPrice > 0).map((line, idx) => (
                  <tr key={line.id || idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
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
                  <span style={{ color: '#6b7280' }}>IVA {doc.vatPct}%</span>
                  <span>+{fmt(vatAmt)} €</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3mm 4mm', background: meta.color, color: '#fff', borderRadius: '4px', marginTop: '2mm' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>TOTAL</span>
                  <span style={{ fontWeight: 800, fontSize: '15px' }}>{fmt(total)} €</span>
                </div>
              </div>
            </div>

            {/* ── Footer notes ── */}
            {doc.notes && (
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '4mm', fontSize: '9px', color: '#6b7280', lineHeight: 1.5 }}>
                {doc.notes}
              </div>
            )}

            {/* ── Watermark for proforma ── */}
            {doc.type === 'PROFORMA' && (
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
