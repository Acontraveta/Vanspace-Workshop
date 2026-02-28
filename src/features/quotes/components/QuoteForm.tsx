/**
 * QuoteForm.tsx
 * Componente de formulario rápido para editar datos básicos del presupuesto
 * y lanzar el flujo de previsualización + aprobación.
 *
 * Uso típico:
 *   <QuoteForm quote={quote} onApproved={(q) => { ... }} />
 *
 * Flujo:
 *   1. Usuario rellena/edita datos básicos (nombre, vehículo, notas)
 *   2. Pulsa "Vista previa" → abre QuotePreview en modo PRESUPUESTO
 *   3. En el preview puede editar líneas, notas al pie, datos empresa
 *   4. Pulsa "Aprobar" → dispara QuoteAutomation y llama onApproved
 *   5. También puede generar Factura desde un presupuesto APPROVED
 */

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Quote } from '../types/quote.types'
import { QuoteService } from '../services/quoteService'
import { QuoteAutomation } from '../services/quoteAutomation'
import QuotePreview from './QuotePreview'
import toast from 'react-hot-toast'

interface QuoteFormProps {
  quote: Quote
  onApproved?: (approvedQuote: Quote) => void
  onUpdated?: (quote: Quote) => void
}

export default function QuoteForm({ quote: initialQuote, onApproved, onUpdated }: QuoteFormProps) {
  const [quote, setQuote] = useState<Quote>(initialQuote)
  const [notes, setNotes] = useState(initialQuote.notes ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const [previewType, setPreviewType] = useState<'PRESUPUESTO' | 'FACTURA'>('PRESUPUESTO')
  const [approving, setApproving] = useState(false)

  const isApproved = quote.status === 'APPROVED'

  // ─── Guardar notas ───
  const saveNotes = () => {
    const updated = { ...quote, notes }
    QuoteService.saveQuote(updated)
    setQuote(updated)
    onUpdated?.(updated)
    toast.success('Notas guardadas')
  }

  // ─── Aprobar desde preview ───
  const handleApprove = async () => {
    if (isApproved) return
    setApproving(true)
    setShowPreview(false)
    try {
      const approved = await QuoteService.approveQuote(quote.id)
      const result = await QuoteAutomation.executeAutomation(approved)
      setQuote(approved)
      onApproved?.(approved)
      if (!result.success) {
        toast.error('Error en automatización: ' + (result.errors?.[0] ?? 'error desconocido'), { duration: 8000 })
      } else {
        toast.success(
          `✅ Presupuesto aprobado!\n📦 ${result.details.totalPurchaseItems} compras · ⚙️ ${result.details.totalTasks} tareas · 📐 ${result.details.totalDesignInstructions} diseños`,
          { duration: 6000 }
        )
        if (result.errors.length > 0) {
          toast.error('⚠️ ' + result.errors.join('\n'), { duration: 8000 })
        }
      }
    } catch (err: any) {
      toast.error('Error al aprobar: ' + err.message)
    } finally {
      setApproving(false)
    }
  }

  // ─── Abrir preview ───
  const openPreview = (type: 'PRESUPUESTO' | 'FACTURA') => {
    setPreviewType(type)
    setShowPreview(true)
  }

  const statusLabel: Record<string, { label: string; color: string }> = {
    DRAFT:    { label: 'Borrador',  color: 'bg-gray-200 text-gray-700' },
    SENT:     { label: 'Enviado',   color: 'bg-blue-100 text-blue-700' },
    APPROVED: { label: 'Aprobado',  color: 'bg-green-100 text-green-700' },
    REJECTED: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    EXPIRED:  { label: 'Caducado',  color: 'bg-orange-100 text-orange-700' },
    ALBARAN:  { label: 'Albarán',   color: 'bg-purple-100 text-purple-700' },
  }

  const { label: statusTxt, color: statusColor } = statusLabel[quote.status] ?? { label: quote.status, color: 'bg-gray-200 text-gray-700' }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              📄 {quote.quoteNumber}
              <span className={`text-sm font-normal px-2 py-0.5 rounded-full ${statusColor}`}>
                {statusTxt}
              </span>
            </span>
            <span className="text-base font-bold text-gray-800">
              {quote.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </span>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Cliente:</span>{' '}
              <strong>{quote.clientName}</strong>
            </div>
            {quote.vehicleModel && (
              <div>
                <span className="text-gray-500">Vehículo:</span>{' '}
                <strong>{quote.vehicleModel}</strong>
              </div>
            )}
            <div>
              <span className="text-gray-500">Tarifa:</span>{' '}
              {quote.tarifa.name}
            </div>
            <div>
              <span className="text-gray-500">Productos:</span>{' '}
              <Badge variant="secondary">{quote.items.length}</Badge>
            </div>
            <div>
              <span className="text-gray-500">Creado:</span>{' '}
              {new Date(quote.createdAt).toLocaleDateString('es-ES')}
            </div>
            <div>
              <span className="text-gray-500">Válido hasta:</span>{' '}
              {new Date(quote.validUntil).toLocaleDateString('es-ES')}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">NOTAS INTERNAS</label>
            <div className="flex gap-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="flex-1 text-sm border rounded px-2 py-1 resize-none"
                placeholder="Observaciones, condiciones especiales..."
              />
              <Button size="sm" variant="outline" onClick={saveNotes}>
                💾
              </Button>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Vista previa presupuesto — siempre disponible */}
            <Button
              variant="outline"
              onClick={() => openPreview('PRESUPUESTO')}
              className="flex-1"
            >
              👁️ Ver Presupuesto
            </Button>

            {/* Aprobar — solo si no está aprobado */}
            {!isApproved && (
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => openPreview('PRESUPUESTO')}
                disabled={approving}
              >
                {approving ? '⏳ Aprobando...' : '✅ Aprobar'}
              </Button>
            )}

            {/* Factura — solo si está aprobado */}
            {isApproved && (
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => openPreview('FACTURA')}
              >
                🧾 Generar Factura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal preview */}
      {showPreview && (
        <QuotePreview
          quote={quote}
          type={previewType}
          onApprove={previewType === 'PRESUPUESTO' && !isApproved ? handleApprove : undefined}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
