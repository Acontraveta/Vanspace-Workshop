import { InteractivePiece, ModuleDimensions } from '../types/furniture.types'

interface FurnitureIsoViewProps {
  module: ModuleDimensions
  pieces: InteractivePiece[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function FurnitureIsoView({ module, pieces, selectedId, onSelect }: FurnitureIsoViewProps) {
  const scale    = 0.24
  const angle    = Math.PI / 6
  const cos      = Math.cos(angle)
  const sin      = Math.sin(angle)

  const w = module.width    * scale
  const h = module.height   * scale
  const d = module.depth    * scale
  const t = module.thickness * scale

  // Project 3D → 2D isometric
  const proj = (X: number, Y: number, Z: number) => ({
    x:  (X - Z) * cos,
    y:  (X + Z) * sin - Y,
  })
  const pt = (X: number, Y: number, Z: number) =>
    `${proj(X, Y, Z).x},${proj(X, Y, Z).y}`

  const vbW = (w + d) * cos + 80
  const vbH = (w + d) * sin + h + 80
  const cx  = d * cos + 30
  const cy  = h + 40

  // Separate frontal from structural pieces
  const structural = pieces.filter(p => p.type === 'estructura' || p.type === 'trasera')
  const frontals   = pieces.filter(p => p.type === 'frontal')

  return (
    <div
      className="bg-slate-900 rounded-3xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden"
      style={{ minHeight: 540 }}
    >
      <div className="absolute top-4 left-5 text-[9px] font-black text-slate-500 uppercase tracking-widest pointer-events-none">
        Vista Isométrica
      </div>

      <svg
        width="100%" height={500}
        viewBox={`${-cx} ${-cy} ${vbW} ${vbH}`}
        className="max-h-[490px] drop-shadow-[0_12px_40px_rgba(0,0,0,.6)]"
        onClick={() => onSelect(null)}
      >
        <defs>
          <linearGradient id="iso-top"   x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="iso-side" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#475569" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Shell — lateral derecho */}
        <polygon points={`${pt(w,0,0)} ${pt(w,h,0)} ${pt(w,h,d)} ${pt(w,0,d)}`} fill="url(#iso-side)" />

        {/* Shell — tapa superior */}
        <polygon points={`${pt(0,h,0)} ${pt(w,h,0)} ${pt(w,h,d)} ${pt(0,h,d)}`} fill="url(#iso-top)" stroke="#e2e8f0" strokeWidth="0.3" />

        {/* Borde frontal tapa */}
        <polygon points={`${pt(0,h,0)} ${pt(w,h,0)} ${pt(w,h-t,0)} ${pt(0,h-t,0)}`} fill="#cbd5e1" />

        {/* Borde frontal laterales */}
        <polygon points={`${pt(0,0,0)} ${pt(t,0,0)} ${pt(t,h-t,0)} ${pt(0,h-t,0)}`} fill="#64748b" />
        <polygon points={`${pt(w-t,0,0)} ${pt(w,0,0)} ${pt(w,h-t,0)} ${pt(w-t,h-t,0)}`} fill="#64748b" />

        {/* Base inferior */}
        <polygon points={`${pt(t,0,0)} ${pt(w-t,0,0)} ${pt(w-t,t,0)} ${pt(t,t,0)}`} fill="#334155" />

        {/* Structural pieces (shelves etc.) */}
        {structural.map(p => {
          const ps = p.x * scale, ys = p.y * scale, zs = p.z * scale
          const ws = p.w * scale, hs = p.h * scale, ds = p.d * scale
          const isSel = selectedId === p.id
          return (
            <g key={p.id} onClick={e => { e.stopPropagation(); onSelect(p.id) }} style={{ cursor: 'pointer' }}>
              {/* Top face */}
              <polygon
                points={`${pt(ps,ys+hs,zs)} ${pt(ps+ws,ys+hs,zs)} ${pt(ps+ws,ys+hs,zs+ds)} ${pt(ps,ys+hs,zs+ds)}`}
                fill={isSel ? '#3b82f6' : '#94a3b8'} stroke={isSel ? '#60a5fa' : '#475569'} strokeWidth="0.5"
              />
              {/* Front face */}
              <polygon
                points={`${pt(ps,ys,zs)} ${pt(ps+ws,ys,zs)} ${pt(ps+ws,ys+hs,zs)} ${pt(ps,ys+hs,zs)}`}
                fill={isSel ? '#2563eb' : '#64748b'} stroke={isSel ? '#60a5fa' : '#475569'} strokeWidth="0.5"
              />
            </g>
          )
        })}

        {/* Frontal pieces (doors / drawers) */}
        {frontals.map(p => {
          const px2 = p.x * scale
          const py2 = p.y * scale
          const pz2 = p.z * scale
          const pw2 = p.w * scale
          const ph2 = p.h * scale
          const pd2 = p.d * scale
          const isSel = selectedId === p.id
          const fill = isSel ? '#60a5fa' : '#3b82f6'
          return (
            <g key={p.id} onClick={e => { e.stopPropagation(); onSelect(p.id) }} style={{ cursor: 'pointer' }}>
              {/* Side edge */}
              <polygon points={`${pt(px2+pw2,py2,pz2)} ${pt(px2+pw2,py2+ph2,pz2)} ${pt(px2+pw2,py2+ph2,pz2+pd2)} ${pt(px2+pw2,py2,pz2+pd2)}`}
                fill={isSel ? '#1d4ed8' : '#1d4ed8'} />
              {/* Top edge */}
              <polygon points={`${pt(px2,py2+ph2,pz2)} ${pt(px2+pw2,py2+ph2,pz2)} ${pt(px2+pw2,py2+ph2,pz2+pd2)} ${pt(px2,py2+ph2,pz2+pd2)}`}
                fill={isSel ? '#60a5fa' : '#2563eb'} />
              {/* Front face */}
              <polygon points={`${pt(px2,py2,pz2)} ${pt(px2+pw2,py2,pz2)} ${pt(px2+pw2,py2+ph2,pz2)} ${pt(px2,py2+ph2,pz2)}`}
                fill={fill} stroke={isSel ? 'white' : '#1d4ed8'} strokeWidth={isSel ? 1 : 0.5} />
            </g>
          )
        })}

        {/* Contorno general */}
        <path d={`M ${pt(0,0,0)} L ${pt(w,0,0)} L ${pt(w,h,0)} L ${pt(0,h,0)} Z`}
          fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="0.5" />
      </svg>

      <div className="absolute bottom-4 right-5 text-[9px] font-black text-blue-500 uppercase tracking-widest">ISO 30°</div>
    </div>
  )
}
