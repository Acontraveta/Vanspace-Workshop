import { PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'
import { boardCount, boardWaste } from '../utils/geometry'

interface FurnitureOptimizerViewProps {
  placements: PlacedPiece[]
}

export function FurnitureOptimizerView({ placements }: FurnitureOptimizerViewProps) {
  const containerW   = 760
  const scale        = containerW / BOARD_WIDTH
  const containerH   = BOARD_HEIGHT * scale
  const boards       = boardCount(placements)

  if (!placements.length) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
        Añade piezas al diseño para ver la optimización de corte
      </div>
    )
  }

  const totalUsed = placements.reduce((s, p) => s + p.w * p.h, 0)
  const totalArea = boards * BOARD_WIDTH * BOARD_HEIGHT
  const totalWaste = Math.round((1 - totalUsed / totalArea) * 100)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-x-auto">
      <div className="mb-4 flex items-end justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">Optimización de Corte</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tablero estándar {BOARD_WIDTH} × {BOARD_HEIGHT} mm · {boards} tablero{boards !== 1 ? 's' : ''}
            {' · '}
            <span className={totalWaste > 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
              {100 - totalWaste}% aprovechamiento
            </span>
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400 uppercase">{placements.length} piezas</span>
      </div>

      {/* One board per section */}
      {Array.from({ length: boards }).map((_, bi) => {
        const boardPieces = placements.filter(p => (p.board ?? 0) === bi)
        const waste = boardWaste(boardPieces)

        return (
          <div key={bi} className={bi > 0 ? 'mt-6' : ''}>
            <div className="flex items-center gap-3 mb-1">
              {boards > 1 && (
                <p className="text-[10px] font-bold text-slate-400 uppercase">Tablero {bi + 1}</p>
              )}
              <p className="text-[10px] font-medium ml-auto"
                 style={{ color: waste > 30 ? '#d97706' : '#059669' }}>
                Desperdicio {waste}%
              </p>
            </div>
            <div className="relative border-4 border-slate-300 rounded-lg bg-slate-50 overflow-hidden"
              style={{ width: containerW, height: containerH }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
                {boardPieces.map((p, i) => (
                  <g key={i}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={p.rotated ? 'rgba(139,92,246,.12)' : 'rgba(59,130,246,.1)'}
                      stroke={p.rotated ? '#8b5cf6' : '#3b82f6'} strokeWidth="2" />
                    {p.w > 120 && p.h > 50 && (
                      <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize="22"
                        textAnchor="middle" dominantBaseline="middle"
                        style={{ fill: p.rotated ? '#6d28d9' : '#1d4ed8', fontWeight: 600 }}>
                        {p.ref}
                      </text>
                    )}
                    {p.w > 120 && p.h > 80 && (
                      <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 28} fontSize="18"
                        textAnchor="middle" dominantBaseline="middle"
                        style={{ fill: p.rotated ? '#8b5cf6' : '#3b82f6' }}>
                        {p.w}×{p.h}{p.rotated ? ' ↻' : ''}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )
      })}

      {/* Piece list */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        {placements.map((p, i) => (
          <div key={i} className="flex justify-between text-xs p-2 bg-slate-50 border rounded">
            <span className="font-bold text-slate-700 truncate mr-2">{p.ref}</span>
            <span className="text-slate-500 whitespace-nowrap">
              {p.w}×{p.h}{p.rotated ? ' ↻' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
