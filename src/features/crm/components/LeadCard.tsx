import React, { useMemo } from 'react'
import type { Lead } from '../types/crm.types'
import { getStatusConfig, formatCurrency, formatDate } from '../utils/crmHelpers'
import { useCRMStore } from '../store/crmStore'
import { useWorkshopStatus } from '../hooks/useWorkshopStatus'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { openWhatsApp } from '../utils/whatsappHelper'

interface LeadCardProps {
  lead: Lead
  isDragging?: boolean
}

export function LeadCard({ lead, isDragging }: LeadCardProps) {
  const { openForm } = useCRMStore()
  const statusCfg = getStatusConfig(lead.estado)
  const workshopStatus = useWorkshopStatus(lead.cliente)

  // Check quotes linked to this lead (synchronous localStorage read)
  const linkedQuotes = useMemo(
    () => QuoteService.getAllQuotes().filter(q => q.lead_id === lead.id),
    [lead.id]
  )
  const hasApprovedQuote = linkedQuotes.some(q => q.status === 'APPROVED')
  const hasActiveQuote = linkedQuotes.some(q => q.status === 'DRAFT' || q.status === 'SENT')

  // Workshop badge label
  const workshopBadge =
    workshopStatus === 'IN_PROGRESS' ? { label: '🔧 En taller', color: 'bg-orange-100 text-orange-800' } :
    workshopStatus === 'SCHEDULED'   ? { label: '📅 Planificado', color: 'bg-blue-100 text-blue-800' } :
    workshopStatus === 'WAITING'     ? { label: '⏳ En espera', color: 'bg-yellow-100 text-yellow-800' } :
    workshopStatus === 'ON_HOLD'     ? { label: '⏸ Pausado', color: 'bg-gray-100 text-gray-700' } :
    null

  return (
    <div
      className={`bg-white rounded-lg border p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50 rotate-1 shadow-lg' : ''
      } ${statusCfg.borderColor}`}
      onClick={() => openForm(lead)}
    >
      {/* Client name */}
      <div className="font-semibold text-gray-900 text-sm truncate">{lead.cliente}</div>

      {/* Vehicle */}
      {lead.vehiculo && (
        <div className="text-xs text-gray-500 mt-0.5 truncate">🚐 {lead.vehiculo}{lead.talla ? ` — ${lead.talla}` : ''}</div>
      )}

      {/* Phone + WhatsApp */}
      {lead.telefono && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-blue-600">📞 {lead.telefono}</span>
          <button
            onClick={e => { e.stopPropagation(); openWhatsApp(lead.telefono!, `Hola ${lead.cliente}, le contactamos desde VanSpace Workshop.`) }}
            className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition font-medium"
            title="Contactar por WhatsApp"
          >
            💬 WA
          </button>
        </div>
      )}

      {/* Importe */}
      {lead.importe != null && (
        <div className="text-xs font-medium text-green-700 mt-1">
          {formatCurrency(lead.importe)}
        </div>
      )}

      {/* Footer: assignee + date */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400 truncate">{lead.asignado ?? 'Sin asignar'}</span>
        {lead.fecha_accion && (
          <span className="text-xs text-orange-500 whitespace-nowrap ml-1">
            ⏰ {formatDate(lead.fecha_accion)}
          </span>
        )}
      </div>

      {/* Next action */}
      {lead.proxima_accion && (
        <div className="mt-1.5 text-xs text-gray-600 italic line-clamp-2">
          {lead.proxima_accion}
        </div>
      )}

      {/* Badges: Quotes + Workshop status */}
      {(workshopBadge || hasApprovedQuote || hasActiveQuote) && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
          {workshopBadge && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${workshopBadge.color}`}>
              {workshopBadge.label}
            </span>
          )}
          {hasApprovedQuote && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">
              ✅ Presupuesto aprobado
            </span>
          )}
          {!hasApprovedQuote && hasActiveQuote && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              📄 Presupuesto activo
            </span>
          )}
        </div>
      )}
    </div>
  )
}
