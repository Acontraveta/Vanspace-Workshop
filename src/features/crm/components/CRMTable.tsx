import React, { useState, useMemo } from 'react'
import type { Lead, LeadFilters } from '../types/crm.types'
import { getStatusConfig, formatCurrency, formatDate } from '../utils/crmHelpers'
import { useCRMStore } from '../store/crmStore'
import { ALL_STATUSES } from '../utils/crmHelpers'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { openWhatsApp } from '../utils/whatsappHelper'

interface CRMTableProps {
  leads: Lead[]
  isLoading: boolean
}

const SORT_FIELDS: Array<{ key: keyof Lead; label: string }> = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'estado', label: 'Estado' },
  { key: 'importe', label: 'Importe' },
  { key: 'asignado', label: 'Asignado' },
]

export function CRMTable({ leads, isLoading }: CRMTableProps) {
  const { filters, setFilters, openForm, deleteLead } = useCRMStore()
  const [sortKey, setSortKey] = useState<keyof Lead>('fecha')
  const [sortAsc, setSortAsc] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Build a Map<lead_id, quoteStatus> from localStorage for fast lookup
  const quoteStatusByLead = useMemo(() => {
    const map = new Map<string, 'APPROVED' | 'ACTIVE'>() // APPROVED > ACTIVE
    for (const q of QuoteService.getAllQuotes()) {
      if (!q.lead_id) continue
      if (q.status === 'APPROVED') {
        map.set(q.lead_id, 'APPROVED')
      } else if ((q.status === 'DRAFT' || q.status === 'SENT') && map.get(q.lead_id) !== 'APPROVED') {
        map.set(q.lead_id, 'ACTIVE')
      }
    }
    return map
  }, [])  // computed once per table mount (quotes change rarely)

  const handleSort = (key: keyof Lead) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(true) }
  }

  const sorted = [...leads].sort((a, b) => {
    const av = (a[sortKey] ?? '') as any
    const bv = (b[sortKey] ?? '') as any
    if (av < bv) return sortAsc ? -1 : 1
    if (av > bv) return sortAsc ? 1 : -1
    return 0
  })

  const handleDelete = async (id: string) => {
    try {
      await deleteLead(id)
    } finally {
      setConfirmDelete(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-3" />
          <p>Cargando leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 bg-white p-3 rounded-lg border border-gray-200">
        <input
          type="text"
          placeholder="🔍 Buscar cliente, teléfono, vehículo..."
          value={filters.search ?? ''}
          onChange={e => setFilters({ ...filters, search: e.target.value || undefined })}
          className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={filters.estado ?? ''}
          onChange={e => setFilters({ ...filters, estado: e.target.value || undefined })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Asignado"
          value={filters.asignado ?? ''}
          onChange={e => setFilters({ ...filters, asignado: e.target.value || undefined })}
          className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Mes (ej. Enero)"
          value={filters.mes ?? ''}
          onChange={e => setFilters({ ...filters, mes: e.target.value || undefined })}
          className="w-36 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        />
        {Object.values(filters).some(Boolean) && (
          <button
            onClick={() => setFilters({})}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 transition"
          >
            ✕ Limpiar filtros
          </button>
        )}
        <span className="px-2 py-1.5 text-sm text-gray-500 ml-auto">
          {sorted.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[
                { key: 'fecha', label: 'Fecha' },
                { key: 'cliente', label: 'Cliente' },
                { key: 'vehiculo', label: 'Vehículo' },
                { key: 'estado', label: 'Estado' },
                { key: 'asignado', label: 'Asignado' },
                { key: 'importe', label: 'Importe' },
                { key: 'proxima_accion', label: 'Próx. acción' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key as keyof Lead)}
                  className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer select-none hover:bg-gray-100 transition whitespace-nowrap"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1 text-blue-500">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  No se encontraron leads con los filtros actuales
                </td>
              </tr>
            ) : (
              sorted.map(lead => {
                const statusCfg = getStatusConfig(lead.estado)
                const quoteStatus = quoteStatusByLead.get(lead.id)
                return (
                  <tr key={lead.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {formatDate(lead.fecha)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900">{lead.cliente}</div>
                      {lead.telefono && (
                        <div className="text-xs text-gray-500">{lead.telefono}</div>
                      )}
                      {quoteStatus === 'APPROVED' && (
                        <span className="inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-800">
                          ✅ Presupuesto aprobado
                        </span>
                      )}
                      {quoteStatus === 'ACTIVE' && (
                        <span className="inline-block mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          📄 Con presupuesto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <div>{lead.vehiculo ?? '—'}</div>
                      {lead.talla && (
                        <div className="text-xs text-gray-500">{lead.talla}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color} ${statusCfg.textColor}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {lead.asignado ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                      {formatCurrency(lead.importe)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate">
                      <div>{lead.proxima_accion ?? '—'}</div>
                      {lead.fecha_accion && (
                        <div className="text-xs text-orange-500">{formatDate(lead.fecha_accion)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {lead.telefono && (
                          <button
                            onClick={() => openWhatsApp(lead.telefono!, `Hola ${lead.cliente}, le contactamos desde VanSpace Workshop.`)}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded transition"
                            title="WhatsApp"
                          >
                            💬
                          </button>
                        )}
                        <button
                          onClick={() => openForm(lead)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        {confirmDelete === lead.id ? (
                          <>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              className="p-1 text-xs text-red-600 font-semibold hover:bg-red-100 rounded transition"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="p-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(lead.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
