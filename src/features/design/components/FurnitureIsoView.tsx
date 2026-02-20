import { useState, useMemo } from 'react'
import { InteractivePiece, ModuleDimensions } from '../types/furniture.types'

interface FurnitureIsoViewProps {
  module: ModuleDimensions
  pieces: InteractivePiece[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

// ─── Isometric helpers ────────────────────────────────────────────────────────

const DEG_30  = Math.PI / 6
const COS_30  = Math.cos(DEG_30)
const SIN_30  = Math.sin(DEG_30)

type Face = {
  points: string
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  depth: number
  pieceId: string
}

export function FurnitureIsoView({ module, pieces, selectedId, onSelect }: FurnitureIsoViewProps) {
  const [showFrontals, setShowFrontals] = useState(true)
  const [frontalOpacity, setFrontalOpacity] = useState(0.7)

  const scale = Math.min(0.28, 180 / Math.max(module.width, module.height, module.depth))

  const proj = (X: number, Y: number, Z: number) => ({
    x:  (X - Z) * COS_30,
    y: -(X + Z) * SIN_30 - Y,  // SVG: y grows downward, so negate
  })
  const pt = (x: number, y: number, z: number) => {
    const p = proj(x * scale, y * scale, z * scale)
    return `${p.x},${p.y}`
  }

  // viewport
  const w = module.width  * scale
  const h = module.height * scale
  const d = module.depth  * scale
  const vbW = (w + d) * COS_30 + 100
  const vbH = (w + d) * SIN_30 + h + 100
  const cx  = d * COS_30 + 50
  const cy  = h + 50

  // ─── Generate faces for proper depth sorting ───────────────────────────────

  const faces = useMemo(() => {
    const all: Face[] = []

    const addBox = (
      px: number, py: number, pz: number,
      bw: number, bh: number, bd: number,
      isSel: boolean, isFrontal: boolean, pid: string
    ) => {
      const baseFill   = isSel ? '#3b82f6' : isFrontal ? '#3b82f6' : '#6b7280'
      const selStroke  = '#f59e0b'
      const normStroke = isFrontal ? '#2563eb' : '#4b5563'
      const stroke     = isSel ? selStroke : normStroke
      const sw         = isSel ? 1.5 : 0.5
      const opacity    = isFrontal ? frontalOpacity : 1

      // Average depth for sorting (higher = farther)
      const avgDepth = (px + bw / 2) + (pz + bd / 2)

      // Front face (Z = pz, facing viewer)
      all.push({
        points: `${pt(px,py,pz)} ${pt(px+bw,py,pz)} ${pt(px+bw,py+bh,pz)} ${pt(px,py+bh,pz)}`,
        fill: baseFill, stroke, strokeWidth: sw, opacity,
        depth: avgDepth - 0.1, pieceId: pid,
      })

      // Top face (Y = py+bh)
      all.push({
        points: `${pt(px,py+bh,pz)} ${pt(px+bw,py+bh,pz)} ${pt(px+bw,py+bh,pz+bd)} ${pt(px,py+bh,pz+bd)}`,
        fill: lighten(baseFill, 20), stroke, strokeWidth: sw * 0.7, opacity,
        depth: avgDepth + 0.1, pieceId: pid,
      })

      // Right side face (X = px+bw)
      all.push({
        points: `${pt(px+bw,py,pz)} ${pt(px+bw,py+bh,pz)} ${pt(px+bw,py+bh,pz+bd)} ${pt(px+bw,py,pz+bd)}`,
        fill: darken(baseFill, 15), stroke, strokeWidth: sw * 0.7, opacity,
        depth: avgDepth, pieceId: pid,
      })
    }

    pieces.forEach(p => {
      if (p.type === 'frontal' && !showFrontals) return
      addBox(p.x, p.y, p.z, p.w, p.h, p.d, p.id === selectedId, p.type === 'frontal', p.id)
    })

    // Sort back-to-front: pieces farther from viewer first
    all.sort((a, b) => a.depth - b.depth)
    return all
  }, [pieces, selectedId, showFrontals, frontalOpacity, scale])

  return (
    <div className="flex flex-col bg-slate-900 rounded-2xl border border-slate-800/60 overflow-hidden select-none relative"
      style={{ minHeight: 560 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
          Vista 3D Isométrica
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showFrontals} onChange={e => setShowFrontals(e.target.checked)}
              className="w-3 h-3 rounded border-slate-600 accent-blue-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase">Frontales</span>
          </label>
          {showFrontals && (
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-slate-600">Opacidad</span>
              <input type="range" min="0.1" max="1" step="0.1" value={frontalOpacity}
                onChange={e => setFrontalOpacity(Number(e.target.value))}
                className="w-16 h-1 accent-blue-500" />
            </div>
          )}
        </div>
      </div>

      <svg
        width="100%" height={500}
        viewBox={`${-cx} ${-cy} ${vbW} ${vbH}`}
        className="flex-1 drop-shadow-[0_8px_32px_rgba(0,0,0,.5)]"
        onClick={() => onSelect(null)}
      >
        <defs>
          <linearGradient id="iso-ambient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Ground plane reference */}
        <polygon
          points={`${pt(0,0,0)} ${pt(module.width,0,0)} ${pt(module.width,0,module.depth)} ${pt(0,0,module.depth)}`}
          fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"
          strokeDasharray="4 4"
        />

        {/* Rendered faces (depth sorted) */}
        {faces.map((f, i) => (
          <polygon key={i}
            points={f.points}
            fill={f.fill}
            stroke={f.stroke}
            strokeWidth={f.strokeWidth}
            opacity={f.opacity}
            onClick={e => { e.stopPropagation(); onSelect(f.pieceId) }}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Dimension annotations */}
        <g opacity="0.5">
          {/* Width */}
          <line {...lineCoords(pt(0, -20, 0), pt(module.width, -20, 0))} stroke="#60a5fa" strokeWidth="0.5" />
          <text x={proj(module.width / 2 * scale, 20 * scale, 0).x} y={proj(module.width / 2 * scale, 20 * scale, 0).y}
            textAnchor="middle" style={{ fontSize: 8, fill: '#60a5fa', fontFamily: 'monospace', fontWeight: 700 }}>
            {module.width}mm
          </text>
          {/* Height */}
          <text x={proj(-15 * scale, module.height / 2 * scale, 0).x} y={proj(-15 * scale, module.height / 2 * scale, 0).y}
            textAnchor="end" dominantBaseline="middle"
            style={{ fontSize: 8, fill: '#60a5fa', fontFamily: 'monospace', fontWeight: 700 }}>
            {module.height}mm
          </text>
          {/* Depth */}
          <text x={proj(module.width * scale + 10 * scale, 0, module.depth / 2 * scale).x} y={proj(module.width * scale + 10 * scale, 0, module.depth / 2 * scale).y}
            textAnchor="start" dominantBaseline="middle"
            style={{ fontSize: 8, fill: '#60a5fa', fontFamily: 'monospace', fontWeight: 700 }}>
            {module.depth}mm
          </text>
        </g>
      </svg>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60 bg-slate-900/50">
        <span className="text-[9px] font-bold text-slate-600 uppercase">{pieces.length} piezas</span>
        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">ISO 30°</span>
      </div>
    </div>
  )
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

function lineCoords(p1Str: string, p2Str: string) {
  const [x1, y1] = p1Str.split(',').map(Number)
  const [x2, y2] = p2Str.split(',').map(Number)
  return { x1, y1, x2, y2 }
}

function lighten(hex: string, pct: number): string {
  const c = parseInt(hex.slice(1), 16)
  const r = Math.min(255, (c >> 16) + Math.floor(255 * pct / 100))
  const g = Math.min(255, ((c >> 8) & 0xff) + Math.floor(255 * pct / 100))
  const b = Math.min(255, (c & 0xff) + Math.floor(255 * pct / 100))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function darken(hex: string, pct: number): string {
  const c = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (c >> 16) - Math.floor(255 * pct / 100))
  const g = Math.max(0, ((c >> 8) & 0xff) - Math.floor(255 * pct / 100))
  const b = Math.max(0, (c & 0xff) - Math.floor(255 * pct / 100))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
