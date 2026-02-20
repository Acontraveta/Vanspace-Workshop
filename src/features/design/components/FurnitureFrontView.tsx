import { useRef, useState, useMemo, useCallback } from 'react'
import { InteractivePiece } from '../types/furniture.types'
import { SNAP_DISTANCE, PIECE_COLORS } from '../constants/furniture.constants'

interface FurnitureFrontViewProps {
  pieces: InteractivePiece[]
  onUpdatePieces: (pieces: InteractivePiece[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

type ViewType = 'frontal' | 'lateral' | 'planta'
type HandleId = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right'

const VIEW_LABELS: Record<ViewType, string> = { frontal: 'Alzado', lateral: 'Perfil', planta: 'Planta' }

export function FurnitureFrontView({
  pieces, onUpdatePieces, selectedId, onSelect,
}: FurnitureFrontViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView]         = useState<ViewType>('frontal')
  const [handle, setHandle]     = useState<HandleId | null>(null)
  const [zoom, setZoom]         = useState(1)
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const dragRef = useRef<{ id: string; initial: InteractivePiece; mx: number; my: number } | null>(null)

  /** Project a 3D piece to 2D based on the active view */
  const get2D = useCallback((p: InteractivePiece) => {
    switch (view) {
      case 'frontal': return { x: p.x, y: p.y, w: p.w, h: p.h }
      case 'lateral': return { x: p.z, y: p.y, w: p.d, h: p.h }
      case 'planta':  return { x: p.x, y: p.z, w: p.w, h: p.d }
    }
  }, [view])

  const workspace = useMemo(() => {
    const all = pieces.map(get2D)
    return {
      w: Math.max(...all.map(p => p.x + p.w), 600) + 100,
      h: Math.max(...all.map(p => p.y + p.h), 500) + 100,
    }
  }, [pieces, get2D])

  const baseScale = Math.min(560 / workspace.w, 520 / workspace.h)
  const scale = baseScale * zoom
  const HANDLE_R = 5 / scale

  /** Snap value to nearby edges */
  const snap = (val: number, targets: number[]) => {
    for (const t of targets) if (Math.abs(val - t) < SNAP_DISTANCE) return t
    return val
  }

  // ─── DRAG HANDLERS ────────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent, id: string, h: HandleId) => {
    e.stopPropagation()
    e.preventDefault()
    const p = pieces.find(x => x.id === id)
    if (!p) return
    dragRef.current = { id, initial: { ...p }, mx: e.clientX, my: e.clientY }
    setHandle(h)
    onSelect(id)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // Pan mode
    if (isPanning) {
      const dx = e.clientX - panRef.current.mx
      const dy = e.clientY - panRef.current.my
      setPan({ x: panRef.current.ox + dx, y: panRef.current.oy + dy })
      return
    }

    if (!dragRef.current || !handle) return
    const dx = (e.clientX - dragRef.current.mx) / scale
    const dy = (e.clientY - dragRef.current.my) / scale
    const others = pieces.filter(p => p.id !== dragRef.current?.id).map(get2D)
    const snapX  = others.flatMap(o => [o.x, o.x + o.w])
    const snapY  = others.flatMap(o => [o.y, o.y + o.h])

    onUpdatePieces(pieces.map(p => {
      if (p.id !== dragRef.current?.id) return p
      const init = dragRef.current!.initial
      let { x, y, z, w, h, d } = init
      const ry = -dy // SVG Y inverted

      if (view === 'frontal') {
        switch (handle) {
          case 'move':   x = snap(init.x + dx, snapX); y = snap(init.y + ry, snapY); break
          case 'br':     w = Math.max(20, snap(init.w + dx, snapX.map(s => s - x))); h = Math.max(20, snap(init.h + ry, snapY.map(s => s - y))); break
          case 'tl':     { const nx = snap(init.x + dx, snapX); const ny = snap(init.y + ry, snapY); w = Math.max(20, init.w + (init.x - nx)); h = Math.max(20, init.h + (init.y - ny)); x = nx; y = ny; break }
          case 'tr':     { const ny = snap(init.y + ry, snapY); w = Math.max(20, snap(init.w + dx, snapX.map(s => s - x))); h = Math.max(20, init.h + (init.y - ny)); y = ny; break }
          case 'bl':     { const nx = snap(init.x + dx, snapX); w = Math.max(20, init.w + (init.x - nx)); h = Math.max(20, snap(init.h + ry, snapY.map(s => s - y))); x = nx; break }
          case 'top':    { const ny = snap(init.y + ry, snapY); h = Math.max(20, init.h + (init.y - ny)); y = ny; break }
          case 'bottom': { h = Math.max(20, snap(init.h + ry, snapY.map(s => s - y))); break }
          case 'left':   { const nx = snap(init.x + dx, snapX); w = Math.max(20, init.w + (init.x - nx)); x = nx; break }
          case 'right':  { w = Math.max(20, snap(init.w + dx, snapX.map(s => s - x))); break }
        }
      } else if (view === 'lateral') {
        switch (handle) {
          case 'move': z = snap(init.z + dx, snapX); y = snap(init.y + ry, snapY); break
          case 'br':   d = Math.max(10, snap(init.d + dx, snapX.map(s => s - z))); h = Math.max(20, snap(init.h + ry, snapY.map(s => s - y))); break
          case 'tl':   { const nz = snap(init.z + dx, snapX); const ny = snap(init.y + ry, snapY); d = Math.max(10, init.d + (init.z - nz)); h = Math.max(20, init.h + (init.y - ny)); z = nz; y = ny; break }
          default:     break
        }
      } else {
        switch (handle) {
          case 'move': x = snap(init.x + dx, snapX); z = snap(init.z + ry, snapY); break
          case 'br':   w = Math.max(20, snap(init.w + dx, snapX.map(s => s - x))); d = Math.max(10, snap(init.d + ry, snapY.map(s => s - z))); break
          case 'tl':   { const nx = snap(init.x + dx, snapX); const nz = snap(init.z + ry, snapY); w = Math.max(20, init.w + (init.x - nx)); d = Math.max(10, init.d + (init.z - nz)); x = nx; z = nz; break }
          default:     break
        }
      }
      return { ...p, x, y, z, w, h, d }
    }))
  }

  const handleMouseUp = () => {
    setHandle(null)
    dragRef.current = null
    setIsPanning(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(4, z - e.deltaY * 0.001)))
  }

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true)
      panRef.current = { mx: e.clientX, my: e.clientY, ox: pan.x, oy: pan.y }
    } else {
      onSelect(null)
    }
  }

  // ─── View ─────────────────────────────────────────────────────────────────
  const vbW = workspace.w * scale + 80
  const vbH = workspace.h * scale + 80
  const originX = -40 + pan.x
  const originY = -workspace.h * scale - 40 + pan.y

  return (
    <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800/60 overflow-hidden select-none relative"
      style={{ minHeight: 560 }}>

      <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

      {/* View selector + zoom */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <div className="flex gap-1 bg-slate-900/80 p-0.5 rounded-lg">
          {(['frontal', 'lateral', 'planta'] as ViewType[]).map(v => (
            <button key={v} onClick={() => { setView(v); onSelect(null) }}
              className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                view === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.min(4, z + 0.2))}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-700 hover:text-white transition-all">+</button>
          <span className="text-[9px] font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 text-xs font-bold hover:bg-slate-700 hover:text-white transition-all">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 text-[9px] font-bold hover:bg-slate-700 hover:text-white transition-all" title="Resetear">⟲</button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg ref={svgRef}
        width="100%" height={500}
        viewBox={`${originX} ${originY} ${vbW} ${vbH}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseDown={handleBgMouseDown}
        onWheel={handleWheel}
        className="cursor-crosshair flex-1"
        style={{ touchAction: 'none' }}
      >
        <defs>
          <pattern id="grid-2d" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse">
            <path d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x={originX} y={originY} width={vbW} height={vbH} fill="url(#grid-2d)" />
        <line x1="0" y1="0" x2={workspace.w * scale} y2="0" stroke="#334155" strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2={-workspace.h * scale} stroke="#334155" strokeWidth="1" />

        {pieces.map(p => {
          const isSelected = selectedId === p.id
          const c = get2D(p)
          const colors = PIECE_COLORS[p.type]
          const px = c.x * scale
          const py = -c.y * scale - c.h * scale
          const pw = c.w * scale
          const ph = c.h * scale

          return (
            <g key={p.id}>
              <rect x={px} y={py} width={pw} height={ph} rx={1}
                fill={isSelected ? 'rgba(59,130,246,.2)' : p.type === 'frontal' ? 'rgba(59,130,246,.12)' : 'rgba(255,255,255,.04)'}
                stroke={isSelected ? colors.selected : colors.stroke}
                strokeWidth={isSelected ? 2 : 0.8}
                strokeDasharray={p.type === 'trasera' ? '4 2' : undefined}
                onMouseDown={e => handleMouseDown(e, p.id, 'move')}
                onClick={e => { e.stopPropagation(); onSelect(p.id) }}
                className="cursor-move"
              />

              {pw > 35 && ph > 18 && (
                <text x={px + pw / 2} y={py + ph / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: isSelected ? 11 : 9, fill: isSelected ? '#93c5fd' : '#64748b', fontFamily: 'monospace', pointerEvents: 'none', fontWeight: isSelected ? 700 : 400 }}>
                  {Math.round(c.w)}×{Math.round(c.h)}
                </text>
              )}

              {!isSelected && pw > 60 && ph > 30 && (
                <text x={px + pw / 2} y={py + ph / 2 - 10}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: 8, fill: '#475569', fontFamily: 'sans-serif', pointerEvents: 'none' }}>
                  {p.name}
                </text>
              )}

              {isSelected && (
                <g>
                  {([
                    { cx: px, cy: py, id: 'tl' as HandleId, cursor: 'nwse-resize' },
                    { cx: px + pw, cy: py, id: 'tr' as HandleId, cursor: 'nesw-resize' },
                    { cx: px, cy: py + ph, id: 'bl' as HandleId, cursor: 'nesw-resize' },
                    { cx: px + pw, cy: py + ph, id: 'br' as HandleId, cursor: 'nwse-resize' },
                  ]).map(hh => (
                    <circle key={hh.id} cx={hh.cx} cy={hh.cy} r={HANDLE_R}
                      fill="white" stroke="#3b82f6" strokeWidth={1.5}
                      onMouseDown={e => handleMouseDown(e, p.id, hh.id)}
                      style={{ cursor: hh.cursor }} />
                  ))}

                  {([
                    { cx: px + pw / 2, cy: py, id: 'top' as HandleId, cursor: 'ns-resize' },
                    { cx: px + pw / 2, cy: py + ph, id: 'bottom' as HandleId, cursor: 'ns-resize' },
                    { cx: px, cy: py + ph / 2, id: 'left' as HandleId, cursor: 'ew-resize' },
                    { cx: px + pw, cy: py + ph / 2, id: 'right' as HandleId, cursor: 'ew-resize' },
                  ]).map(hh => (
                    <rect key={hh.id}
                      x={hh.cx - HANDLE_R * 0.7} y={hh.cy - HANDLE_R * 0.7}
                      width={HANDLE_R * 1.4} height={HANDLE_R * 1.4} rx={1}
                      fill="#3b82f6" stroke="white" strokeWidth={0.8}
                      onMouseDown={e => handleMouseDown(e, p.id, hh.id)}
                      style={{ cursor: hh.cursor }} />
                  ))}

                  <text x={px + pw / 2} y={py - 8}
                    textAnchor="middle" style={{ fontSize: 9, fill: '#60a5fa', fontFamily: 'monospace', fontWeight: 700, pointerEvents: 'none' }}>
                    {Math.round(c.w)} mm
                  </text>
                  <text x={px + pw + 8} y={py + ph / 2}
                    textAnchor="start" dominantBaseline="middle"
                    style={{ fontSize: 9, fill: '#60a5fa', fontFamily: 'monospace', fontWeight: 700, pointerEvents: 'none' }}>
                    {Math.round(c.h)} mm
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Snap {SNAP_DISTANCE}mm
          </span>
          <span className="text-[9px] font-bold text-slate-600 uppercase">{pieces.length} piezas</span>
        </div>
        <span className="text-[9px] text-slate-600">Arrastra · Esquinas para redimensionar · Alt+drag para mover</span>
      </div>
    </div>
  )
}
