import { useRef, useState, useMemo, useCallback } from 'react'
import { InteractivePiece, CatalogMaterial } from '../types/furniture.types'
import { SNAP_DISTANCE, PIECE_COLORS } from '../constants/furniture.constants'

interface FurnitureFrontViewProps {
  pieces: InteractivePiece[]
  onUpdatePieces: (pieces: InteractivePiece[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  catalogMaterials?: CatalogMaterial[]
}

type ViewType = 'frontal' | 'lateral' | 'planta'
type HandleId = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right'

const VIEW_LABELS: Record<ViewType, string> = { frontal: 'Alzado', lateral: 'Perfil', planta: 'Planta' }

export function FurnitureFrontView({
  pieces, onUpdatePieces, selectedId, onSelect, catalogMaterials = [],
}: FurnitureFrontViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView]         = useState<ViewType>('frontal')
  const [handle, setHandle]     = useState<HandleId | null>(null)
  const [zoom, setZoom]         = useState(1)
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const dragRef = useRef<{
    id: string; initial: InteractivePiece
    svgX0: number; svgY0: number; frozenScale: number
  } | null>(null)

  /** Project a 3D piece to 2D based on the active view */
  const get2D = useCallback((p: InteractivePiece) => {
    switch (view) {
      case 'frontal': return { x: p.x, y: p.y, w: p.w, h: p.h }
      case 'lateral': return { x: p.z, y: p.y, w: p.d, h: p.h }
      case 'planta':  return { x: p.x, y: p.z, w: p.w, h: p.d }
    }
  }, [view])

  // Workspace auto-fit — frozen during drag via ref
  const isDragging = handle !== null && dragRef.current !== null
  const frozenWS = useRef<{ w: number; h: number } | null>(null)

  const liveWorkspace = useMemo(() => {
    const all = pieces.map(get2D)
    return {
      w: Math.max(...all.map(p => p.x + p.w), 600) + 100,
      h: Math.max(...all.map(p => p.y + p.h), 500) + 100,
    }
  }, [pieces, get2D])

  // Freeze workspace at drag start, unfreeze when drag ends
  if (isDragging && !frozenWS.current) frozenWS.current = { ...liveWorkspace }
  if (!isDragging && frozenWS.current) frozenWS.current = null

  const workspace = frozenWS.current ?? liveWorkspace

  const baseScale = Math.min(560 / workspace.w, 520 / workspace.h)
  const scale = baseScale * zoom
  const HANDLE_R = 5 / scale

  /** Convert client (mouse) coords to SVG user-space coords */
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    return {
      x: (clientX - ctm.e) / ctm.a,
      y: (clientY - ctm.f) / ctm.d,
    }
  }, [])

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
    const svg0 = clientToSvg(e.clientX, e.clientY)
    dragRef.current = { id, initial: { ...p }, svgX0: svg0.x, svgY0: svg0.y, frozenScale: scale }
    setHandle(h)
    onSelect(id)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    // Pan mode
    if (isPanning) {
      const dxPx = e.clientX - panRef.current.mx
      const dyPx = e.clientY - panRef.current.my
      setPan({ x: panRef.current.ox + dxPx, y: panRef.current.oy + dyPx })
      return
    }

    if (!dragRef.current || !handle) return
    const svgNow = clientToSvg(e.clientX, e.clientY)
    const s = dragRef.current.frozenScale
    // Delta in piece-space millimetres
    const dx = (svgNow.x - dragRef.current.svgX0) / s   // rightward = positive X
    const dy = -(svgNow.y - dragRef.current.svgY0) / s   // upward = positive (invert SVG Y)
    const others = pieces.filter(p => p.id !== dragRef.current?.id).map(get2D)
    const snapX  = others.flatMap(o => [o.x, o.x + o.w])
    const snapY  = others.flatMap(o => [o.y, o.y + o.h])

    onUpdatePieces(pieces.map(p => {
      if (p.id !== dragRef.current?.id) return p
      const init = dragRef.current!.initial
      let { x, y, z, w, h, d } = init

      // dx = rightward in piece-space mm.  dy = upward in piece-space mm (SVG Y already inverted above).

      if (view === 'frontal') {
        // Projected: px=x, py=y, pw=w, ph=h.  Screen-right→+X, screen-up→+Y.
        const edgeL = () => snap(init.x + dx, snapX)
        const edgeR = () => snap(init.x + init.w + dx, snapX)
        const edgeT = () => snap(init.y + init.h + dy, snapY)  // top edge = y+h
        const edgeB = () => snap(init.y + dy, snapY)            // bottom edge = y

        switch (handle) {
          case 'move':   x = edgeL(); y = edgeB(); break
          case 'tl':     { const nx = edgeL(); const nt = edgeT(); w = Math.max(20, init.w + (init.x - nx)); h = Math.max(20, nt - init.y); x = nx; break }
          case 'tr':     { const nr = edgeR(); const nt = edgeT(); w = Math.max(20, nr - init.x); h = Math.max(20, nt - init.y); break }
          case 'bl':     { const nx = edgeL(); const nb = edgeB(); w = Math.max(20, init.w + (init.x - nx)); h = Math.max(20, (init.y + init.h) - nb); x = nx; y = nb; break }
          case 'br':     { const nr = edgeR(); const nb = edgeB(); w = Math.max(20, nr - init.x); h = Math.max(20, (init.y + init.h) - nb); y = nb; break }
          case 'top':    { const nt = edgeT(); h = Math.max(20, nt - init.y); break }
          case 'bottom': { const nb = edgeB(); h = Math.max(20, (init.y + init.h) - nb); y = nb; break }
          case 'left':   { const nx = edgeL(); w = Math.max(20, init.w + (init.x - nx)); x = nx; break }
          case 'right':  { const nr = edgeR(); w = Math.max(20, nr - init.x); break }
        }
      } else if (view === 'lateral') {
        // Projected: px=z, py=y, pw=d, ph=h.  Screen-right→+Z, screen-up→+Y.
        const edgeL = () => snap(init.z + dx, snapX)
        const edgeR = () => snap(init.z + init.d + dx, snapX)
        const edgeT = () => snap(init.y + init.h + dy, snapY)
        const edgeB = () => snap(init.y + dy, snapY)

        switch (handle) {
          case 'move':   z = edgeL(); y = edgeB(); break
          case 'tl':     { const nz = edgeL(); const nt = edgeT(); d = Math.max(10, init.d + (init.z - nz)); h = Math.max(20, nt - init.y); z = nz; break }
          case 'tr':     { const nr = edgeR(); const nt = edgeT(); d = Math.max(10, nr - init.z); h = Math.max(20, nt - init.y); break }
          case 'bl':     { const nz = edgeL(); const nb = edgeB(); d = Math.max(10, init.d + (init.z - nz)); h = Math.max(20, (init.y + init.h) - nb); z = nz; y = nb; break }
          case 'br':     { const nr = edgeR(); const nb = edgeB(); d = Math.max(10, nr - init.z); h = Math.max(20, (init.y + init.h) - nb); y = nb; break }
          case 'top':    { const nt = edgeT(); h = Math.max(20, nt - init.y); break }
          case 'bottom': { const nb = edgeB(); h = Math.max(20, (init.y + init.h) - nb); y = nb; break }
          case 'left':   { const nz = edgeL(); d = Math.max(10, init.d + (init.z - nz)); z = nz; break }
          case 'right':  { const nr = edgeR(); d = Math.max(10, nr - init.z); break }
        }
      } else {
        // planta: Projected: px=x, py=z, pw=w, ph=d.
        // SVG top → large z (z+d), SVG bottom → small z (z).
        // Screen-right→+X.  Screen-up→+Z (SVG Y inverted, dy already positive-up).
        const edgeL = () => snap(init.x + dx, snapX)
        const edgeR = () => snap(init.x + init.w + dx, snapX)
        const edgeT = () => snap(init.z + init.d + dy, snapY)   // visual top = z+d
        const edgeB = () => snap(init.z + dy, snapY)             // visual bottom = z

        switch (handle) {
          case 'move':   x = edgeL(); z = edgeB(); break
          case 'tl':     { const nx = edgeL(); const nt = edgeT(); w = Math.max(20, init.w + (init.x - nx)); d = Math.max(10, nt - init.z); x = nx; break }
          case 'tr':     { const nr = edgeR(); const nt = edgeT(); w = Math.max(20, nr - init.x); d = Math.max(10, nt - init.z); break }
          case 'bl':     { const nx = edgeL(); const nb = edgeB(); w = Math.max(20, init.w + (init.x - nx)); d = Math.max(10, (init.z + init.d) - nb); x = nx; z = nb; break }
          case 'br':     { const nr = edgeR(); const nb = edgeB(); w = Math.max(20, nr - init.x); d = Math.max(10, (init.z + init.d) - nb); z = nb; break }
          case 'top':    { const nt = edgeT(); d = Math.max(10, nt - init.z); break }
          case 'bottom': { const nb = edgeB(); d = Math.max(10, (init.z + init.d) - nb); z = nb; break }
          case 'left':   { const nx = edgeL(); w = Math.max(20, init.w + (init.x - nx)); x = nx; break }
          case 'right':  { const nr = edgeR(); w = Math.max(20, nr - init.x); break }
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
          const mat = catalogMaterials.find(m => m.id === p.materialId)
          const fillColor = mat ? mat.color_hex : colors.fill
          const px = c.x * scale
          const py = -c.y * scale - c.h * scale
          const pw = c.w * scale
          const ph = c.h * scale

          return (
            <g key={p.id}>
              <rect x={px} y={py} width={pw} height={ph} rx={1}
                fill={isSelected ? 'rgba(59,130,246,.2)' : mat ? `${fillColor}30` : p.type === 'frontal' ? 'rgba(59,130,246,.12)' : 'rgba(255,255,255,.04)'}
                stroke={isSelected ? colors.selected : mat ? fillColor : colors.stroke}
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
