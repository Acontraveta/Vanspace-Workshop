import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Lead } from '@/features/crm/types/crm.types'

export interface LinkedLeadData {
  lead_id: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  vehicleModel?: string
}

interface CRMLinkModalProps {
  onSelect: (data: LinkedLeadData) => void
  onClose: () => void
}

export default function CRMLinkModal({ onSelect, onClose }: CRMLinkModalProps) {
  const [search, setSearch] = useState('')
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load all leads once on open, then filter client-side
  useEffect(() => {
    inputRef.current?.focus()

    supabase
      .from('crm_leads')
      .select('id, cliente, telefono, email, vehiculo, talla, estado, importe')
      .order('cliente')
      .limit(500)
      .then(({ data, error }) => {
        setAllLeads(error ? [] : (data as Lead[]) || [])
      })
      .then(() => setLoading(false))
  }, [])

  // Instant client-side filtering — no debounce needed
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allLeads
    return allLeads.filter(l =>
      l.cliente?.toLowerCase().includes(term) ||
      l.telefono?.toLowerCase().includes(term) ||
      l.email?.toLowerCase().includes(term) ||
      l.vehiculo?.toLowerCase().includes(term)
    )
  }, [search, allLeads])

  const handleSelect = (lead: Lead) => {
    onSelect({
      lead_id: lead.id,
      clientName: lead.cliente,
      clientPhone: lead.telefono ?? undefined,
      clientEmail: lead.email ?? undefined,
      vehicleModel: lead.vehiculo
        ? `${lead.vehiculo}${lead.talla ? ' ' + lead.talla : ''}`
        : undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-900">👥 Vincular lead del CRM</h3>
            {!loading && (
              <p className="text-xs text-gray-400 mt-0.5">
                {filtered.length} de {allLeads.length} leads
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por nombre, teléfono, email o vehículo..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading && (
            <div className="flex items-center gap-2 justify-center py-8 text-gray-400">
              <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-b-transparent rounded-full" />
              <span className="text-sm">Cargando leads…</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {search.trim() ? 'No hay leads que coincidan' : 'No hay leads en el CRM'}
            </p>
          )}

          {!loading && filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => handleSelect(lead)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 transition border border-transparent hover:border-blue-200 mb-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm text-gray-900 block truncate">
                    {lead.cliente}
                  </span>
                  <span className="text-xs text-gray-500 block truncate">
                    {[lead.telefono, lead.email].filter(Boolean).join(' · ') || '—'}
                  </span>
                  {lead.vehiculo && (
                    <span className="text-xs text-blue-600 block truncate">
                      🚐 {lead.vehiculo}{lead.talla ? ` ${lead.talla}` : ''}
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {lead.estado && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full block mb-1">
                      {lead.estado}
                    </span>
                  )}
                  {lead.importe != null && (
                    <span className="text-xs text-green-700 font-medium">
                      {lead.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
