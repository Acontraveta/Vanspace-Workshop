import React from 'react'
import type { Lead } from '../types/crm.types'
import { KANBAN_COLUMNS, getStatusConfig, STATUS_CONFIG } from '../utils/crmHelpers'
import { LeadCard } from './LeadCard'
import { useCRMStore } from '../store/crmStore'

interface LeadKanbanProps {
  leads: Lead[]
}

export function LeadKanban({ leads }: LeadKanbanProps) {
  const { updateLead } = useCRMStore()

  // Group leads by estado
  const grouped = KANBAN_COLUMNS.reduce<Record<string, Lead[]>>((acc, col) => {
    acc[col] = leads.filter(l => (l.estado ?? 'Nuevo') === col)
    return acc
  }, {})

  // Simple drag-and-drop via HTML5 DnD API
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId)
  }

  const handleDrop = async (e: React.DragEvent, newEstado: string) => {
    e.preventDefault()
    const leadId = e.dataTransfer.getData('leadId')
    if (!leadId) return
    try {
      await updateLead(leadId, { estado: newEstado } as any)
    } catch (err) {
      console.error('Error moving lead:', err)
    }
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {KANBAN_COLUMNS.map(col => {
        const cfg = getStatusConfig(col)
        const colLeads = grouped[col] ?? []

        return (
          <div
            key={col}
            className="flex-shrink-0 w-56 flex flex-col rounded-xl bg-gray-50 border border-gray-200"
            onDrop={e => handleDrop(e, col)}
            onDragOver={handleDragOver}
          >
            {/* Column header */}
            <div className={`px-3 py-2.5 rounded-t-xl border-b border-gray-200 ${cfg.color}`}>
              <div className={`text-xs font-bold uppercase tracking-wide ${cfg.textColor}`}>
                {cfg.label}
              </div>
              <div className={`text-xs mt-0.5 ${cfg.textColor} opacity-75`}>
                {colLeads.length} lead{colLeads.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: '75vh' }}>
              {colLeads.length === 0 ? (
                <div className="text-center text-gray-300 text-xs py-8">
                  Sin leads
                </div>
              ) : (
                colLeads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={e => handleDragStart(e, lead.id)}
                  >
                    <LeadCard lead={lead} />
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
