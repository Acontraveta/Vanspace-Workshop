/**
 * QuotePDF.tsx
 * Renderiza el documento imprimible (presupuesto o factura) en HTML/CSS puro.
 * Se usa dentro del preview (QuotePreview) y también para imprimir/descargar.
 *
 * Estrategia de impresión:
 *   - El elemento con id="quote-pdf-content" se extrae y se abre en window.print()
 *   - El resto de la página queda oculto con @media print { body > * { display:none } #quote-pdf-print { display:block } }
 */

import { Fragment } from 'react'
import { Quote, QuoteItem } from '../types/quote.types'

export interface QuoteDocumentData {
  quote: Quote
  /** Sobreescribir líneas de items (permite edición ad-hoc antes de imprimir) */
  customLines?: CustomLine[]
  /** Datos de la empresa emisora */
  company: {
    name: string
    nif: string
    address: string
    phone: string
    email: string
    logoUrl?: string
  }
  /** Tipo de documento */
  type: 'PRESUPUESTO' | 'FACTURA'
  /** Número de factura (solo tipo FACTURA) */
  invoiceNumber?: string
  /** Notas al pie editables */
  footerNotes?: string
  /** Mostrar desglose materiales + mano de obra por línea */
  showBreakdown?: boolean
  /** Plan de pagos fraccionado */
  paymentInstallments?: PaymentInstallment[]
}

export interface CustomLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
  isLabor?: boolean
  /** Preserved from QuoteItem for breakdown rendering */
  materialsTotal?: number
  laborCost?: number
  laborHours?: number
}

export interface PaymentInstallment {
  id: string
  label: string      // e.g. "Señal", "Entrega materiales", "Finalización"
  percentage: number // 0-100
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildLines(quote: Quote): CustomLine[] {
  return quote.items.map((item: QuoteItem) => {
    const matCost = (item as any).materialCost ?? item.materialsTotal ?? 0
    const laborCost = item.laborCost ?? 0
    return {
      id: item.id,
      description: item.productName,
      quantity: item.quantity,
      unitPrice: (matCost + laborCost) / (item.quantity || 1),
      total: matCost + laborCost,
      isLabor: false,
      materialsTotal: matCost,
      laborCost,
      laborHours: item.laborHours,
    }
  })
}

// ──────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────
interface QuotePDFProps {
  data: QuoteDocumentData
}

export function QuotePDF({ data }: QuotePDFProps) {
  const { quote, company, type, invoiceNumber, footerNotes, showBreakdown, paymentInstallments } = data
  const lines = data.customLines ?? buildLines(quote)

  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const profitPct = quote.profitMargin ?? 0
  const profitAmount = subtotal * (profitPct / 100)
  const total = subtotal + profitAmount
  const vatAmount = total * 0.21
  const totalWithVat = total + vatAmount

  const docNumber = type === 'FACTURA' ? (invoiceNumber ?? `FAC-${quote.quoteNumber}`) : quote.quoteNumber
  const docDate = type === 'FACTURA'
    ? (quote.approvedAt ? new Date(quote.approvedAt) : new Date())
    : new Date(quote.createdAt)

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div
      id="quote-pdf-content"
      style={{
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
        fontSize: '11px',
        color: '#1a1a1a',
        background: '#fff',
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '16mm 14mm',
        boxSizing: 'border-box',
        lineHeight: 1.5,
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10mm' }}>
        {/* Logo / Empresa emisora */}
        <div>
          {company.logoUrl && (
            <img src={company.logoUrl} alt="logo" style={{ height: '40px', marginBottom: '6px', display: 'block' }} />
          )}
          <div style={{ fontWeight: 700, fontSize: '15px' }}>{company.name}</div>
          <div style={{ color: '#555' }}>{company.address}</div>
          <div style={{ color: '#555' }}>NIF: {company.nif}</div>
          <div style={{ color: '#555' }}>{company.phone} · {company.email}</div>
        </div>

        {/* Título documento */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            background: type === 'FACTURA' ? '#1d4ed8' : '#15803d',
            color: '#fff',
            padding: '6px 18px',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '1px',
            marginBottom: '6px',
          }}>
            {type}
          </div>
          <div><strong>Nº:</strong> {docNumber}</div>
          <div><strong>Fecha:</strong> {fmtDate(docDate)}</div>
          {type === 'PRESUPUESTO' && (
            <div><strong>Válido hasta:</strong> {fmtDate(new Date(quote.validUntil))}</div>
          )}
        </div>
      </div>

      {/* ── CLIENTE ── */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '8px 12px',
        marginBottom: '8mm',
        background: '#f9fafb',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '12px', color: '#374151' }}>
          DATOS DEL CLIENTE
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          <div><strong>Nombre:</strong> {quote.clientName}</div>
          {quote.billingData?.fiscalName && (
            <div><strong>Razón social:</strong> {quote.billingData.fiscalName}</div>
          )}
          {quote.billingData?.nif && (
            <div><strong>NIF/CIF:</strong> {quote.billingData.nif}</div>
          )}
          {quote.clientEmail && (
            <div><strong>Email:</strong> {quote.clientEmail}</div>
          )}
          {quote.clientPhone && (
            <div><strong>Teléfono:</strong> {quote.clientPhone}</div>
          )}
          {quote.vehicleModel && (
            <div><strong>Vehículo:</strong> {quote.vehicleModel}</div>
          )}
        </div>
        {quote.billingData?.address && (
          <div style={{ marginTop: '4px' }}>
            <strong>Dirección:</strong>{' '}
            {quote.billingData.address}, {quote.billingData.postalCode} {quote.billingData.city},{' '}
            {quote.billingData.province} ({quote.billingData.country})
          </div>
        )}
      </div>

      {/* ── TABLA DE LÍNEAS ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8mm' }}>
        <thead>
          <tr style={{ background: type === 'FACTURA' ? '#1d4ed8' : '#15803d', color: '#fff' }}>
            {['#', 'Descripción', 'Cant.', 'Precio unit.', 'Total'].map((h, i) => (
              <th
                key={h}
                style={{
                  padding: '6px 8px',
                  textAlign: i === 0 ? 'center' : i >= 2 ? 'right' : 'left',
                  fontWeight: 600,
                  fontSize: '10.5px',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <Fragment key={line.id}>
              <tr
                style={{
                  background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                  borderBottom: (showBreakdown && line.materialsTotal != null && line.laborCost != null)
                    ? 'none'
                    : '1px solid #e5e7eb',
                }}
              >
                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                <td style={{ padding: '6px 8px' }}>{line.description}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{line.quantity}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(line.unitPrice)} €</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(line.total)} €</td>
              </tr>
              {showBreakdown && line.materialsTotal != null && line.laborCost != null && (
                <>
                  <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic' }}>
                    <td />
                    <td style={{ padding: '2px 8px 2px 20px' }}>↳ Materiales</td>
                    <td />
                    <td />
                    <td style={{ padding: '2px 8px', textAlign: 'right' }}>{fmt(line.materialsTotal)} €</td>
                  </tr>
                  <tr style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb', fontSize: '9.5px', color: '#6b7280', fontStyle: 'italic', borderBottom: '1px solid #e5e7eb' }}>
                    <td />
                    <td style={{ padding: '2px 8px 5px 20px' }}>
                      ↳ Mano de obra{line.laborHours ? ` (${line.laborHours}h)` : ''}
                    </td>
                    <td />
                    <td />
                    <td style={{ padding: '2px 8px 5px', textAlign: 'right' }}>{fmt(line.laborCost)} €</td>
                  </tr>
                </>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* ── TOTALES ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
        <table style={{ width: '220px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', color: '#6b7280' }}>Subtotal</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(subtotal)} €</td>
            </tr>
            {profitPct > 0 && (
              <tr>
                <td style={{ padding: '4px 8px', color: '#6b7280' }}>Margen ({profitPct}%)</td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>+{fmt(profitAmount)} €</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '4px 8px', color: '#6b7280' }}>Base imponible</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(total)} €</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px', color: '#6b7280' }}>IVA (21%)</td>
              <td style={{ padding: '4px 8px', textAlign: 'right' }}>+{fmt(vatAmount)} €</td>
            </tr>
            <tr style={{ background: type === 'FACTURA' ? '#1d4ed8' : '#15803d', color: '#fff', borderRadius: '4px' }}>
              <td style={{ padding: '8px', fontWeight: 700, fontSize: '13px' }}>TOTAL</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>
                {fmt(totalWithVat)} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── PLAN DE PAGOS ── */}
      {paymentInstallments && paymentInstallments.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', marginBottom: '6mm', marginTop: '4mm' }}>
          <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: '#374151' }}>📅 Plan de Pagos</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: type === 'FACTURA' ? '#1d4ed8' : '#15803d', color: '#fff' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Concepto</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, width: '40px' }}>%</th>
                <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, width: '70px' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {paymentInstallments.map((inst, i) => (
                <tr key={inst.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '4px 8px' }}>{inst.label || `Pago ${i + 1}`}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>{inst.percentage}%</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>
                    {fmt(totalWithVat * (inst.percentage / 100))} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NOTAS ── */}
      {footerNotes && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '6mm',
          fontSize: '10px',
          color: '#6b7280',
        }}>
          <strong style={{ color: '#374151' }}>Notas:</strong>
          <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{footerNotes}</div>
        </div>
      )}

      {/* ── PIE ── */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        paddingTop: '6px',
        fontSize: '9px',
        color: '#9ca3af',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>{company.name} · NIF {company.nif}</span>
        <span>Generado el {fmtDate(new Date())}</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Función de impresión
// ──────────────────────────────────────────────
export function printQuoteDocument(data: QuoteDocumentData) {
  const elem = document.getElementById('quote-pdf-content')
  if (!elem) return

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) {
    alert('Activa las ventanas emergentes para imprimir.')
    return
  }

  printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${data.type} ${data.type === 'FACTURA' ? data.invoiceNumber ?? '' : data.quote.quoteNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; }
    @page { size: A4; margin: 0; }
    @media print { html, body { width: 210mm; height: 297mm; } }
  </style>
</head>
<body>
  ${elem.outerHTML}
  <script>window.onload = function(){ window.print(); window.close(); }<\/script>
</body>
</html>`)
  printWindow.document.close()
}

export default QuotePDF
