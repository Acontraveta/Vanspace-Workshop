import { PlacedPiece } from '../types/furniture.types'
import { BOARD_WIDTH, BOARD_HEIGHT } from '../constants/furniture.constants'
import { boardCount, boardWaste } from '../utils/geometry'
import { useMemo } from 'react'

interface FurnitureOptimizerViewProps {
  placements: PlacedPiece[]
}

/** Group boards by material for display */
interface MaterialGroup {
  materialId: string
  materialName: string
  boards: number[]        // global board indices belonging to this material
  pieces: PlacedPiece[]
}

export function FurnitureOptimizerView({ placements }: FurnitureOptimizerViewProps) {
  const containerW   = 760
  const scale        = containerW / BOARD_WIDTH
  const containerH   = BOARD_HEIGHT * scale
  const boards       = boardCount(placements)

  // Group placements by material
  const materialGroups = useMemo((): MaterialGroup[] => {
    const map = new Map<string, MaterialGroup>()
    for (const p of placements) {
      const key = p.materialId || '__default__'
      let group = map.get(key)
      if (!group) {
        group = {
          materialId: key,
          materialName: p.materialName || 'Material por defecto',
          boards: [],
          pieces: [],
        }
        map.set(key, group)
      }
      group.pieces.push(p)
      const bi = p.board ?? 0
      if (!group.boards.includes(bi)) group.boards.push(bi)
    }
    // Sort boards within each group
    for (const g of map.values()) g.boards.sort((a, b) => a - b)
    return Array.from(map.values())
  }, [placements])

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
            {materialGroups.length > 1 ? ` · ${materialGroups.length} materiales` : ''}
            {' · '}
            <span className={totalWaste > 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
              {100 - totalWaste}% aprovechamiento
            </span>
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-400 uppercase">{placements.length} piezas</span>
      </div>

      {/* Material groups */}
      {materialGroups.map((group, gi) => (
        <div key={group.materialId} className={gi > 0 ? 'mt-8' : ''}>
          {/* Material header (only when multiple materials) */}
          {materialGroups.length > 1 && (
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
              <div className="w-4 h-4 rounded border border-slate-300"
                style={{ backgroundColor: group.pieces[0]?.materialId ? undefined : '#888' }} />
              <span className="text-sm font-bold text-slate-700">{group.materialName}</span>
              <span className="text-[10px] text-slate-400 ml-auto">
                {group.boards.length} tablero{group.boards.length !== 1 ? 's' : ''} · {group.pieces.length} piezas
              </span>
            </div>
          )}

          {/* Boards in this material group */}
          {group.boards.map((bi, localIdx) => {
            const boardPieces = group.pieces.filter(p => (p.board ?? 0) === bi)
            const waste = boardWaste(boardPieces)

            return (
              <div key={bi} className={localIdx > 0 ? 'mt-4' : ''}>
                <div className="flex items-center gap-3 mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    {materialGroups.length > 1
                      ? `Tablero ${localIdx + 1}`
                      : (boards > 1 ? `Tablero ${bi + 1}` : '')}
                  </p>
                  <p className="text-[10px] font-medium ml-auto"
                     style={{ color: waste > 30 ? '#d97706' : '#059669' }}>
                    Desperdicio {waste}%
                  </p>
                </div>
                <div className="relative border-4 border-slate-300 rounded-lg bg-slate-50 overflow-hidden"
                  style={{ width: containerW, height: containerH }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}>
                    {boardPieces.map((p, i) => {
                      const dimW = Math.round(p.w)
                      const dimH = Math.round(p.h)
                      const textFill = p.rotated ? '#6d28d9' : '#1e3a8a'
                      const dimFill = p.rotated ? '#7c3aed' : '#2563eb'
                      const dimPad = 8
                      const dimFontSize = Math.min(20, Math.max(12, p.w / 12))
                      return (
                      <g key={i}>
                        <rect x={p.x} y={p.y} width={p.w} height={p.h}
                          fill={p.rotated ? 'rgba(139,92,246,.12)' : 'rgba(59,130,246,.1)'}
                          stroke={p.rotated ? '#8b5cf6' : '#2563eb'} strokeWidth="3" />
                        {/* Ref name (centred) */}
                        {p.w > 100 && p.h > 40 && (
                          <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize="20"
                            textAnchor="middle" dominantBaseline="middle"
                            style={{ fill: textFill, fontWeight: 700 }}>
                            {p.ref}
                          </text>
                        )}
                        {/* Width dimension (top edge, horizontal) */}
                        {p.w > 60 && (
                          <text x={p.x + p.w / 2} y={p.y + dimPad + dimFontSize}
                            fontSize={dimFontSize} textAnchor="middle"
                            style={{ fill: dimFill, fontWeight: 600 }}>
                            {dimW}
                          </text>
                        )}
                        {/* Height dimension (right edge, vertical rotated) */}
                        {p.h > 60 && (
                          <text x={p.x + p.w - dimPad - dimFontSize * 0.4} y={p.y + p.h / 2}
                            fontSize={dimFontSize} textAnchor="middle" dominantBaseline="middle"
                            transform={`rotate(-90 ${p.x + p.w - dimPad - dimFontSize * 0.4} ${p.y + p.h / 2})`}
                            style={{ fill: dimFill, fontWeight: 600 }}>
                            {dimH}
                          </text>
                        )}
                        {/* Rotation indicator */}
                        {p.rotated && p.w > 60 && p.h > 60 && (
                          <text x={p.x + p.w - 20} y={p.y + p.h - 10} fontSize="18"
                            style={{ fill: '#8b5cf6' }}>↻</text>
                        )}
                      </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      ))}

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
