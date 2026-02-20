import { useRef, useState, useMemo } from 'react'
import { InteractivePiece } from '../types/furniture.types'
import { SNAP_DISTANCE } from '../constants/furniture.constants'

interface FurnitureFrontViewProps {
  pieces: InteractivePiece[]
  onUpdatePieces: (pieces: InteractivePiece[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

type ViewType  = 'frontal' | 'lateral' | 'planta'
type DragMode  = 'move' | 'resize-tl' | 'resize-br'

export function FurnitureFrontView({
  pieces, onUpdatePieces, selectedId, onSelect,
}: FurnitureFrontViewProps) {
  const [view, setView]         = useState<ViewType>('frontal')
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const dragRef = useRef<{ id: string; initial: InteractivePiece; mx: number; my: number } | null>(null)

  const get2D = (p: InteractivePiece) => {
    switch (view) {
      case 'frontal': return { x: p.x, y: p.y, w: p.w, h: p.h }
      case 'lateral': return { x: p.z, y: p.y, w: p.d, h: p.h }
      case 'planta':  return { x: p.x, y: p.z, w: p.w, h: p.d }
    }
  }

  const workspace = useMemo(() => {
    const all = pieces.map(get2D)
    return {
      w: Math.max(...all.map(p => p.x + p.w), 900) + 100,
      h: Math.max(...all.map(p => p.y + p.h), 750) + 100,
    }
  }, [pieces, view])

  const scale = Math.min(480 / workspace.w, 480 / workspace.h)

  const snap = (val: number, targets: number[]) => {
    for (const t of targets) if (Math.abs(val - t) < SNAP_DISTANCE) return t
    return val
  }

  const handleMouseDown = (e: React.MouseEvent, id: string, mode: DragMode) => {
    e.stopPropagation()
    const p = pieces.find(x => x.id === id)
    if (!p) return
    dragRef.current = { id, initial: { ...p }, mx: e.clientX, my: e.clientY }
    setDragMode(mode)
    onSelect(id)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current || !dragMode) return
    const dx = (e.clientX - dragRef.current.mx) / scale
    const dy = (e.clientY - dragRef.current.my) / scale
    const others = pieces.filter(p => p.id !== dragRef.current?.id).map(get2D)
    const snapX  = others.flatMap(o => [o.x, o.x + o.w])
    const snapY  = others.flatMap(o => [o.y, o.y + o.h])

    onUpdatePieces(pieces.map(p => {
      if (p.id !== dragRef.current?.id) return p
      const init = dragRef.current!.initial
      let { x, y, z, w, h, d } = init
      const ry = -dy  // SVG Y is inverted

      if (view === 'frontal') {
        if (dragMode === 'move') { x = snap(init.x + dx, snapX); y = snap(init.y + ry, snapY) }
        else if (dragMode === 'resize-br') { w = Math.max(10, snap(init.w + dx, snapX.map(s => s - x))); h = Math.max(10, snap(init.h + ry, snapY.map(s => s - y))) }
        else if (dragMode === 'resize-tl') { const nx = snap(init.x + dx, snapX); const ny = snap(init.y + ry, snapY); w = Math.max(10, init.w + (init.x - nx)); h = Math.max(10, init.h + (init.y - ny)); x = nx; y = ny }
      } else if (view === 'lateral') {
        if (dragMode === 'move') { z = snap(init.z + dx, snapX); y = snap(init.y + ry, snapY) }
        else if (dragMode === 'resize-br') { d = Math.max(10, snap(init.d + dx, snapX.map(s => s - z))); h = Math.max(10, snap(init.h + ry, snapY.map(s => s - y))) }
      } else {
        if (dragMode === 'move') { x = snap(init.x + dx, snapX); z = snap(init.z + ry, snapY) }
        else if (dragMode === 'resize-br') { w = Math.max(10, snap(init.w + dx, snapX.map(s => s - x))); d = Math.max(10, snap(init.d + ry, snapY.map(s => s - z))) }
      }
      return { ...p, x, y, z, w, h, d }
    }))
  }

  const handleMouseUp = () => { setDragMode(null); dragRef.current = null }

  return (
    <div className="flex flex-col items-center bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden select-none relative" style={{ minHeight: 540 }}>
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* View selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700 backdrop-blur">
        {(['frontal', 'lateral', 'planta'] as ViewType[]).map(v => (
          <button key={v} onClick={() => { setView(v); onSelect(null) }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              view === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {v === 'frontal' ? 'Alzado' : v === 'lateral' ? 'Perfil' : 'Planta'}
          </button>
        ))}
      </div>

      <svg
        width="100%" height={500}
        viewBox={`-50 ${-workspace.h * scale + 50} ${workspace.w * scale + 100} ${workspace.h * scale + 100}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => onSelect(null)}
        className="mt-12 cursor-crosshair"
      >
        <defs>
          <pattern id="grid-fw" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse">
            <path d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="-100" y={-workspace.h * scale - 100} width={workspace.w * scale + 200} height={workspace.h * scale + 200} fill="url(#grid-fw)" />
        <line x1="0" y1="0" x2={workspace.w * scale} y2="0" stroke="#334155" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2={-workspace.h * scale} stroke="#334155" strokeWidth="2" />

        {pieces.map(p => {
          const isSelected = selectedId === p.id
          const c  = get2D(p)
          const px = c.x * scale
          const py = -c.y * scale - c.h * scale
          const pw = c.w * scale
          const ph = c.h * scale
          return (
            <g key={p.id} onClick={e => { e.stopPropagation(); onSelect(p.id) }}>
              <rect
                x={px} y={py} width={pw} height={ph}
                fill={isSelected ? 'rgba(59,130,246,.25)' : p.type === 'estructura' ? 'rgba(255,255,255,.05)' : 'rgba(59,130,246,.1)'}
                stroke={isSelected ? '#3b82f6' : p.type === 'estructura' ? '#475569' : '#3b82f6'}
                strokeWidth={isSelected ? 2.5 : 1}
                onMouseDown={e => handleMouseDown(e, p.id, 'move')}
                className="cursor-move"
              />
              {isSelected && (
                <g>
                  <circle cx={px}      cy={py}      r={5} fill="white" stroke="#3b82f6" className="cursor-nwse-resize" onMouseDown={e => handleMouseDown(e, p.id, 'resize-tl')} />
                  <circle cx={px + pw} cy={py + ph} r={5} fill="white" stroke="#3b82f6" className="cursor-nwse-resize" onMouseDown={e => handleMouseDown(e, p.id, 'resize-br')} />
                  <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: '#93c5fd', fontFamily: 'monospace', pointerEvents: 'none', fontWeight: 700 }}>
                    {Math.round(c.w)} × {Math.round(c.h)}
                  </text>
                </g>
              )}
              {!isSelected && pw > 50 && ph > 20 && (
                <text x={px + pw / 2} y={py + ph / 2} textAnchor="middle" dominantBaseline="middle"
                  style={{ fontSize: 9, fill: '#64748b', fontFamily: 'sans-serif', pointerEvents: 'none' }}>
                  {p.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 px-5 py-2 bg-slate-900/70 rounded-full border border-slate-800 backdrop-blur">
        <span className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Snap {SNAP_DISTANCE}mm
        </span>
        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Arrastra piezas o esquinas</span>
      </div>
    </div>
  )
}
