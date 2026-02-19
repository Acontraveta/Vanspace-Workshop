/**
 * LeadProductionPanel
 *
 * Shown inside LeadForm when lead.estado === 'Aprobado'.
 * Pulls live data from production_projects + production_tasks
 * matching the lead's client name, and linked quotes from localStorage.
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { QuoteService } from '@/features/quotes/services/quoteService'
import type { Lead } from '../types/crm.types'
import type { ProductionProject, ProductionTask } from '@/features/production/types/production.types'

interface ProjectWithTasks extends ProductionProject {
  tasks: ProductionTask[]
}

interface Props {
  lead: Lead
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WAITING:     { label: '⏳ En espera',      color: 'bg-yellow-100 text-yellow-800' },
  SCHEDULED:   { label: '📅 Planificado',    color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: '🔧 En producción',  color: 'bg-orange-100 text-orange-800' },
  ON_HOLD:     { label: '⏸ Pausado',         color: 'bg-gray-100 text-gray-700' },
  COMPLETED:   { label: '✅ Completado',      color: 'bg-green-100 text-green-800' },
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—'
  try { return new Intl.DateTimeFormat('es-ES').format(new Date(dateStr)) } catch { return dateStr }
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 whitespace-nowrap">{done}/{total}</span>
    </div>
  )
}

export function LeadProductionPanel({ lead }: Props) {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([])
  const [loading, setLoading] = useState(true)

  // Linked quotes from localStorage
  const linkedQuotes = QuoteService.getAllQuotes().filter(q => q.lead_id === lead.id)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        // Fetch production projects matching this client name
        const { data: projs } = await supabase
          .from('production_projects')
          .select('*')
          .ilike('client_name', `%${lead.cliente}%`)
          .order('created_at', { ascending: false })

        if (cancelled || !projs?.length) {
          if (!cancelled) setProjects([])
          return
        }

        // Fetch tasks for all found projects in one query
        const projectIds = projs.map((p: ProductionProject) => p.id)
        const { data: tasks } = await supabase
          .from('production_tasks')
          .select('*')
          .in('project_id', projectIds)
          .order('order_index')

        const tasksByProject: Record<string, ProductionTask[]> = {}
        for (const t of (tasks || []) as ProductionTask[]) {
          if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = []
          tasksByProject[t.project_id].push(t)
        }

        if (!cancelled) {
          setProjects(projs.map((p: ProductionProject) => ({
            ...p,
            tasks: tasksByProject[p.id] || [],
          })))
        }
      } catch {
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [lead.id, lead.cliente])

  const quoteStatusLabel = (s: string) =>
    s === 'DRAFT' ? '📝 Borrador' :
    s === 'SENT' ? '📤 Enviado' :
    s === 'APPROVED' ? '✅ Aprobado' :
    s === 'REJECTED' ? '❌ Cancelado' :
    s === 'EXPIRED' ? '⏰ Caducado' : s

  return (
    <div className="space-y-4">
      {/* Linked Quotes */}
      {linkedQuotes.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-3">
            📄 Presupuestos vinculados
          </h4>
          <div className="space-y-2">
            {linkedQuotes.map(q => (
              <div key={q.id} className="flex items-center justify-between text-sm bg-white rounded-md border border-green-100 px-3 py-2">
                <div>
                  <span className="font-medium text-gray-800">{q.quoteNumber}</span>
                  <span className="ml-2 text-gray-500 text-xs">{fmt(q.createdAt?.toString())}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-800">
                    {q.total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                  <span className="text-xs">{quoteStatusLabel(q.status)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Production Projects */}
      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-orange-700 mb-3">
          🏭 Estado en producción
        </h4>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
            <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-b-transparent rounded-full" />
            Consultando taller…
          </div>
        )}

        {!loading && projects.length === 0 && (
          <p className="text-sm text-gray-500 py-1">
            No hay proyectos de producción para este cliente todavía.
          </p>
        )}

        {!loading && projects.map(proj => {
          const statusCfg = STATUS_LABELS[proj.status] ?? { label: proj.status, color: 'bg-gray-100 text-gray-700' }
          const doneTasks = proj.tasks.filter(t => t.status === 'COMPLETED').length
          const totalTasks = proj.tasks.length

          return (
            <div key={proj.id} className="bg-white rounded-lg border border-orange-100 p-4 space-y-3">
              {/* Project header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{proj.quote_number}</p>
                  {proj.vehicle_model && (
                    <p className="text-xs text-gray-500 mt-0.5">🚐 {proj.vehicle_model}</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
              </div>

              {/* Dates grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-500 mb-0.5">Recepción (inicio real)</p>
                  <p className="font-semibold text-gray-800">{fmt(proj.actual_start_date ?? proj.start_date)}</p>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-gray-500 mb-0.5">Entrega prevista</p>
                  <p className="font-semibold text-gray-800">{fmt(proj.end_date)}</p>
                </div>
                {proj.actual_end_date && (
                  <div className="bg-green-50 rounded p-2 col-span-2">
                    <p className="text-gray-500 mb-0.5">Fecha de entrega real</p>
                    <p className="font-semibold text-green-700">{fmt(proj.actual_end_date)}</p>
                  </div>
                )}
              </div>

              {/* Hours */}
              <div className="flex gap-3 text-xs">
                <div className="bg-blue-50 rounded px-3 py-2 flex-1">
                  <p className="text-gray-500">Horas estimadas</p>
                  <p className="font-semibold text-blue-700">{proj.total_hours}h</p>
                </div>
                {proj.actual_hours != null && (
                  <div className="bg-blue-50 rounded px-3 py-2 flex-1">
                    <p className="text-gray-500">Horas reales</p>
                    <p className="font-semibold text-blue-700">{proj.actual_hours}h</p>
                  </div>
                )}
              </div>

              {/* Task progress */}
              {totalTasks > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Progreso de tareas</p>
                  <ProgressBar done={doneTasks} total={totalTasks} />
                </div>
              )}

              {/* Readiness flags */}
              <div className="flex flex-wrap gap-2">
                {proj.requires_materials && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    proj.materials_ready ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {proj.materials_ready ? '✅ Materiales listos' : '⏳ Esperando materiales'}
                  </span>
                )}
                {proj.requires_design && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    proj.design_ready ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {proj.design_ready ? '✅ Diseño listo' : '⏳ Esperando diseño'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
