import React, { useRef, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { CRMTable } from './CRMTable'
import { LeadKanban } from './LeadKanban'
import { LeadForm } from './LeadForm'
import { useCRMStore } from '../store/crmStore'
import { useLeads } from '../hooks/useLeads'
import { useExcelSync } from '../hooks/useExcelSync'
import { formatCurrency } from '../utils/crmHelpers'
import type { CRMStats } from '../types/crm.types'

export default function CRMDashboard() {
  const { view, setView, isFormOpen, selectedLead, openForm, closeForm, syncStatus } = useCRMStore()
  const { leads, stats, isLoading, error, reload } = useLeads()
  const { importFromStorage, importFromFile, exportToStorage, downloadExcelFile, log } = useExcelSync()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const excelMenuRef = useRef<HTMLDivElement>(null)
  const [excelMenuOpen, setExcelMenuOpen] = useState(false)

  // Open a specific lead form when navigating from alerts panel
  useEffect(() => {
    const state = location.state as { openLeadId?: string } | null
    if (state?.openLeadId && leads.length > 0) {
      const lead = leads.find(l => l.id === state.openLeadId)
      if (lead) {
        openForm(lead)
        // Clear state so refreshing doesn't re-open it
        window.history.replaceState({}, '')
      }
    }
  }, [location.state, leads])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) {
        setExcelMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await importFromFile(file)
    e.target.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 CRM — Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} visibles
            {syncStatus.lastSync && (
              <span className="ml-2 text-xs text-green-600">
                · Última sync: {new Date(syncStatus.lastSync).toLocaleString('es-ES')}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setView('table')}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                view === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 Tabla
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                view === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              🗂️ Kanban
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => openForm()}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Nuevo lead
          </button>

          <button
            onClick={reload}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            title="Recargar"
          >
            🔄
          </button>

          {/* Excel dropdown */}
          <div className="relative" ref={excelMenuRef}>
            <button
              onClick={() => setExcelMenuOpen(o => !o)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition"
            >
              📊 Excel ▾
            </button>
            {excelMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-52">
              <button
                onClick={() => { importFromStorage(); setExcelMenuOpen(false) }}
                disabled={syncStatus.isImporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition border-b border-gray-100 disabled:opacity-50"
              >
                📥 Importar desde Storage
              </button>
              <button
                onClick={() => { setExcelMenuOpen(false); fileInputRef.current?.click() }}
                disabled={syncStatus.isImporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition border-b border-gray-100 disabled:opacity-50"
              >
                📂 Importar archivo local
              </button>
              <button
                onClick={() => { exportToStorage(); setExcelMenuOpen(false) }}
                disabled={syncStatus.isExporting}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition border-b border-gray-100 disabled:opacity-50"
              >
                📤 Exportar a Storage
              </button>
              <button
                onClick={() => { downloadExcelFile(); setExcelMenuOpen(false) }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition"
              >
                💾 Descargar Excel local
              </button>
            </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ── Sync progress log ── */}
      {(syncStatus.isImporting || syncStatus.isExporting || log.length > 0) && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-700 mb-1">
            {syncStatus.isImporting && '⏳ Importando...'}
            {syncStatus.isExporting && '⏳ Exportando...'}
            {!syncStatus.isImporting && !syncStatus.isExporting && '✅ Completado'}
          </div>
          <div className="text-xs text-blue-600 space-y-0.5 max-h-24 overflow-y-auto">
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          {syncStatus.error && (
            <div className="text-xs text-red-600 mt-1">❌ {syncStatus.error}</div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* ── Stats cards ── */}
      <StatsBar stats={stats} />

      {/* ── Main content ── */}
      <div className="mt-4">
        {view === 'table'
          ? <CRMTable leads={leads} isLoading={isLoading} />
          : <LeadKanban leads={leads} />
        }
      </div>

      {/* ── Lead form modal ── */}
      {isFormOpen && (
        <LeadForm
          lead={selectedLead}
          onClose={closeForm}
        />
      )}
    </div>
  )
}

// ── Stats Bar ─────────────────────────────────────────────────

function StatsBar({ stats }: { stats: CRMStats }) {
  const cards = [
    { label: 'Total leads', value: stats.total, color: 'text-gray-800', bg: 'bg-white' },
    { label: 'Nuevos', value: stats.nuevos, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'En proceso', value: stats.enProceso, color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Aprobados', value: stats.aprobados, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Perdidos', value: stats.perdidos, color: 'text-red-700', bg: 'bg-red-50' },
    { label: 'Tasa conversión', value: `${stats.tasaConversion}%`, color: 'text-purple-700', bg: 'bg-purple-50' },
    { label: 'Importe total', value: formatCurrency(stats.importeTotal), color: 'text-gray-800', bg: 'bg-white' },
    { label: 'Importe aprobado', value: formatCurrency(stats.importeAprobado), color: 'text-green-700', bg: 'bg-green-50' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map(card => (
        <div
          key={card.label}
          className={`${card.bg} rounded-lg border border-gray-200 px-3 py-3 shadow-sm`}
        >
          <div className={`text-lg font-bold truncate ${card.color}`}>{card.value}</div>
          <div className="text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</div>
        </div>
      ))}
    </div>
  )
}

