import { PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'
import { boardCount } from '../utils/geometry'

interface FurnitureOptimizerViewProps {
  placements: PlacedPiece[]
}

export function FurnitureOptimizerView({ placements }: FurnitureOptimizerViewProps) {
  const containerW   = 760
  const scale        = containerW / BOARD_WIDTH
  const containerH   = BOARD_HEIGHT * scale
  const boards       = boardCount(placements)
  const boardOffsetPx = (BOARD_HEIGHT + 80) * scale  // gap between boards in px

  if (!placements.length) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
        Añade piezas al diseño para ver la optimización de corte
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-x-auto">
      <div className="mb-4 flex items-end justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">Optimización de Corte</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tablero estándar {BOARD_WIDTH} × {BOARD_HEIGHT} mm · {boards} tablero{boards !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400 uppercase">{placements.length} piezas</span>
      </div>

      {/* One board per section */}
      {Array.from({ length: boards }).map((_, bi) => {
        const fromY = bi * (BOARD_HEIGHT + 80)
        const toY   = fromY + BOARD_HEIGHT
        const boardPieces = placements.filter(p => p.y >= fromY && p.y < toY)

        return (
          <div key={bi} className={bi > 0 ? 'mt-6' : ''}>
            {boards > 1 && (
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tablero {bi + 1}</p>
            )}
            <div className="relative border-4 border-slate-300 rounded-lg bg-slate-50 overflow-hidden"
              style={{ width: containerW, height: containerH }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
                {boardPieces.map((p, i) => {
                  const py = p.y - fromY   // local Y within this board
                  return (
                    <g key={i}>
                      <rect x={p.x} y={py} width={p.w} height={p.h}
                        fill="rgba(59,130,246,.1)" stroke="#3b82f6" strokeWidth="2" />
                      {p.w > 120 && p.h > 50 && (
                        <text x={p.x + p.w / 2} y={py + p.h / 2} fontSize="22"
                          textAnchor="middle" dominantBaseline="middle"
                          style={{ fill: '#1d4ed8', fontWeight: 600 }}>
                          {p.ref}
                        </text>
                      )}
                      {p.w > 120 && p.h > 80 && (
                        <text x={p.x + p.w / 2} y={py + p.h / 2 + 28} fontSize="18"
                          textAnchor="middle" dominantBaseline="middle"
                          style={{ fill: '#3b82f6' }}>
                          {p.w}×{p.h}
                        </text>
                      )}
                    </g>
                  )
                })}
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
            <span className="text-slate-500 whitespace-nowrap">{p.w}×{p.h}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
