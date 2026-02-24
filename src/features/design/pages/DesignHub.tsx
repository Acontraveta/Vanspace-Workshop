import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FurnitureWorkOrderService } from '../services/furnitureDesignService'
import { DesignType } from '../types/furniture.types'

type DesignSection = 'furniture' | 'exterior' | 'interior'

const SECTIONS: { key: DesignSection; icon: string; label: string; desc: string }[] = [
  { key: 'furniture', icon: '🪑', label: 'Muebles', desc: 'Diseño, despiece y optimización de corte de muebles' },
  { key: 'exterior', icon: '🚐', label: 'Exterior', desc: 'Ventanas, claraboyas, aireadores y elementos exteriores' },
  { key: 'interior', icon: '🏠', label: 'Interior', desc: 'Distribución de muebles, diagrama eléctrico y de agua' },
]

export default function DesignHub() {
  const navigate = useNavigate()
  const [hover, setHover] = useState<DesignSection | null>(null)
  const [counts, setCounts] = useState<Record<DesignType, { total: number; pending: number }>>({
    furniture: { total: 0, pending: 0 },
    exterior: { total: 0, pending: 0 },
    interior: { total: 0, pending: 0 },
  })

  useEffect(() => {
    ;(async () => {
      try {
        const all = await FurnitureWorkOrderService.getAll()
        const result: Record<string, { total: number; pending: number }> = {
          furniture: { total: 0, pending: 0 },
          exterior: { total: 0, pending: 0 },
          interior: { total: 0, pending: 0 },
        }
        for (const wo of all) {
          const dt = (wo.design_type || 'furniture') as DesignType
          if (result[dt]) {
            result[dt].total++
            if (wo.status === 'pending' || wo.status === 'in_progress') result[dt].pending++
          }
        }
        setCounts(result as Record<DesignType, { total: number; pending: number }>)
      } catch { /* silent */ }
    })()
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          ✏️ Diseño
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Herramientas de diseño para todos los aspectos de la camperización
        </p>
      </div>

      {/* Section cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {SECTIONS.map(s => {
          const c = counts[s.key]
          return (
            <button
              key={s.key}
              onClick={() => navigate(`/design/${s.key}`)}
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              className={`text-left bg-white border-2 rounded-2xl p-6 transition-all shadow-sm
                ${hover === s.key ? 'border-blue-400 shadow-lg shadow-blue-100 scale-[1.02]' : 'border-slate-200 hover:border-blue-300'}`}
            >
              <div className="text-4xl mb-3">{s.icon}</div>
              <h2 className="text-lg font-black text-slate-800">{s.label}</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.desc}</p>

              {/* Quick stats */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                {c.total > 0 ? (
                  <span>
                    {c.total} orden{c.total !== 1 ? 'es' : ''}
                    {c.pending > 0 && (
                      <span className="text-amber-500 font-bold ml-1">
                        ({c.pending} pendiente{c.pending !== 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                ) : (
                  <span>Sin órdenes</span>
                )}
                <span>Acceder →</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
