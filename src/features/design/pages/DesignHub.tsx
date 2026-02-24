import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type DesignSection = 'furniture' | 'exterior' | 'interior'

const SECTIONS: { key: DesignSection; icon: string; label: string; desc: string }[] = [
  { key: 'furniture', icon: '🪑', label: 'Muebles', desc: 'Diseño, despiece y optimización de corte de muebles' },
  { key: 'exterior', icon: '🚐', label: 'Exterior', desc: 'Ventanas, claraboyas, aireadores y elementos exteriores' },
  { key: 'interior', icon: '🏠', label: 'Interior', desc: 'Distribución de muebles, diagrama eléctrico y de agua' },
]

export default function DesignHub() {
  const navigate = useNavigate()
  const [hover, setHover] = useState<DesignSection | null>(null)

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
        {SECTIONS.map(s => (
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

            {/* Quick stats / status */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
              <span>Acceder →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
