// ── Van Exterior Design ────────────────────────────────────────────
// 4 views: side-left (conductor), side-right (pasajero), top, rear.
// Van size is configurable via presets or custom dimensions.
// Elements are constrained to the van body area and use real product
// dimensions (mm).
//
// WO-driven mode: palette = quote items only.
// Free mode: full default palette.

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { FurnitureWorkOrderService } from '../services/furnitureDesignService'
import { FurnitureWorkOrder, FurnitureWorkOrderItem } from '../types/furniture.types'
import {
  VanConfig, VAN_PRESETS, DEFAULT_VAN, DEFAULT_PRESET,
  findPreset, saveVanConfig, loadVanConfig,
} from '../constants/vanPresets'

// ── Catalog element types ─────────────────────────────────────────
export interface ExteriorElement {
  id: string
  type: 'ventana' | 'claraboya' | 'aireador' | 'rejilla' | 'portabicis' | 'toldo' | 'placa_solar' | 'custom'
  label: string
  w: number  // mm
  h: number  // mm
  color: string
  fromQuote?: boolean
  quoteItemId?: string
}

export interface PlacedElement extends ExteriorElement {
  x: number
  y: number
  view: ViewId
  rotation: number
}

// ── Default palette (real product dimensions) ────────────────────
const DEFAULT_PALETTE: ExteriorElement[] = [
  // Windows — Dometic S4 series & Carbest
  { id: 'pal-vent-50x35', type: 'ventana', label: 'Ventana 500×350', w: 500, h: 350, color: '#3b82f6' },
  { id: 'pal-vent-70x40', type: 'ventana', label: 'Ventana 700×400', w: 700, h: 400, color: '#3b82f6' },
  { id: 'pal-vent-90x45', type: 'ventana', label: 'Ventana 900×450', w: 900, h: 450, color: '#3b82f6' },
  { id: 'pal-vent-110x45', type: 'ventana', label: 'Ventana 1100×450', w: 1100, h: 450, color: '#3b82f6' },
  // Skylights — Fiamma & Maxxfan
  { id: 'pal-clara-40x40', type: 'claraboya', label: 'Claraboya 400×400', w: 400, h: 400, color: '#8b5cf6' },
  { id: 'pal-clara-70x50', type: 'claraboya', label: 'Claraboya 700×500', w: 700, h: 500, color: '#8b5cf6' },
  { id: 'pal-maxxfan', type: 'claraboya', label: 'Maxxfan 355×355', w: 355, h: 355, color: '#8b5cf6' },
  // Vents
  { id: 'pal-aireador', type: 'aireador', label: 'Aireador 217×217', w: 217, h: 217, color: '#10b981' },
  { id: 'pal-rejilla-26x13', type: 'rejilla', label: 'Rejilla 260×126', w: 260, h: 126, color: '#f59e0b' },
  { id: 'pal-rejilla-20x10', type: 'rejilla', label: 'Rejilla 200×100', w: 200, h: 100, color: '#f59e0b' },
  // Solar panels
  { id: 'pal-placa-200w', type: 'placa_solar', label: 'Panel solar 200 W (1580×808)', w: 1580, h: 808, color: '#1e3a5f' },
  { id: 'pal-placa-100w', type: 'placa_solar', label: 'Panel solar 100 W (1020×510)', w: 1020, h: 510, color: '#1e3a5f' },
  { id: 'pal-placa-300w', type: 'placa_solar', label: 'Panel solar 300 W (1650×1000)', w: 1650, h: 1000, color: '#1e3a5f' },
  // Awning & bike rack
  { id: 'pal-toldo', type: 'toldo', label: 'Toldo lateral 3000×2100', w: 3000, h: 2100, color: '#be185d' },
  { id: 'pal-portabicis', type: 'portabicis', label: 'Portabicis trasero 580×420', w: 580, h: 420, color: '#64748b' },
]

const ELEMENT_ICONS: Record<string, string> = {
  ventana: '🪟', claraboya: '☀️', aireador: '🌀', rejilla: '🔲',
  portabicis: '🚲', toldo: '⛺', placa_solar: '🔋', custom: '📦',
}

// ── Views ─────────────────────────────────────────────────────────
type ViewId = 'side-left' | 'side-right' | 'top' | 'rear'

interface ViewConfig {
  id: ViewId
  label: string
  icon: string
  svgW: number
  svgH: number
}

function getViews(van: VanConfig): ViewConfig[] {
  return [
    { id: 'side-left', label: 'Izquierdo (conductor)', icon: '◀️', svgW: van.length, svgH: van.height },
    { id: 'side-right', label: 'Derecho (pasajero)', icon: '▶️', svgW: van.length, svgH: van.height },
    { id: 'top', label: 'Planta (techo)', icon: '⬇️', svgW: van.length, svgH: van.width },
    { id: 'rear', label: 'Trasero', icon: '🔙', svgW: van.width, svgH: van.height },
  ]
}

// ── Body bounds per view (valid placement area) ──────────────────
function getBodyBounds(view: ViewId, van: VanConfig) {
  const bodyTop = van.height - van.bodyHeight
  switch (view) {
    case 'side-left':
    case 'side-right':
      return { minX: van.bodyStart, maxX: van.bodyStart + van.bodyLength, minY: bodyTop, maxY: van.height - 100 }
    case 'top':
      return { minX: van.bodyStart, maxX: van.bodyStart + van.bodyLength, minY: 60, maxY: van.width - 60 }
    case 'rear':
      return { minX: 80, maxX: van.width - 80, minY: bodyTop, maxY: van.height - 100 }
  }
}

function clamp(x: number, y: number, w: number, h: number, view: ViewId, van: VanConfig) {
  const b = getBodyBounds(view, van)
  return {
    x: Math.max(b.minX, Math.min(b.maxX - w, x)),
    y: Math.max(b.minY, Math.min(b.maxY - h, y)),
  }
}

// ── SVG Van drawings ─────────────────────────────────────────────
function VanSideLeftSVG({ van }: { van: VanConfig }) {
  const { bodyStart: bs, bodyLength: bl, bodyHeight: bh, height: h,
    wheelDia: wd, frontWheelX: fwx, rearWheelX: rwx, roofArc: ra, length: len } = van
  const bodyTop = h - bh
  const bodyEnd = bs + bl
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M ${bs} ${bodyTop} L ${bs * 0.3} ${bodyTop + 300}
        Q 40 ${h - wd * 0.6} 40 ${h - wd * 0.4}
        L 40 ${h} L ${len - 40} ${h}
        L ${len - 40} ${bodyTop + ra}
        Q ${len - 40} ${bodyTop} ${bodyEnd} ${bodyTop}
        L ${bs} ${bodyTop} Z`} fill="#f1f5f9" />
      <path d={`M ${bs} ${bodyTop} Q ${bs + bl / 2} ${bodyTop - ra} ${bodyEnd} ${bodyTop}`}
        fill="none" strokeWidth="6" />
      {/* Driver door */}
      <rect x={bs * 0.35} y={bodyTop + 320} width={bs * 0.55} height={bh - 520}
        rx={12} fill="none" stroke="#94a3b8" strokeWidth="4" strokeDasharray="15,8" />
      <text x={bs * 0.62} y={bodyTop + bh / 2 + 40} textAnchor="middle"
        fontSize="55" fill="#cbd5e1" fontFamily="Arial">Puerta</text>
      {/* Windshield */}
      <line x1={bs} y1={bodyTop} x2={bs * 0.3} y2={bodyTop + 300}
        strokeWidth="6" stroke="#60a5fa" />
      {/* Wheels */}
      <circle cx={fwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={rwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={fwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      <circle cx={rwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      {/* Grid */}
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={bodyTop - 40} x2={x} y2={h + 30}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      {/* Dimension marks */}
      <text x={bs + bl / 2} y={h + 100} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={h + 180} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">zona carga: {bl} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      {/* Body start/end marks */}
      <line x1={bs} y1={bodyTop - 30} x2={bs} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <line x1={bodyEnd} y1={bodyTop - 30} x2={bodyEnd} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      {/* Side label */}
      <text x={len / 2} y={bodyTop - 60} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontWeight="600" fontFamily="Arial">LADO IZQUIERDO (conductor)</text>
    </g>
  )
}

function VanSideRightSVG({ van }: { van: VanConfig }) {
  const { bodyStart: bs, bodyLength: bl, bodyHeight: bh, height: h,
    wheelDia: wd, frontWheelX: fwx, rearWheelX: rwx, roofArc: ra, length: len } = van
  const bodyTop = h - bh
  const bodyEnd = bs + bl
  // Sliding door area: ~200mm from body start, ~1200mm wide
  const doorX = bs + 200
  const doorW = Math.min(1200, bl * 0.35)
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M ${bs} ${bodyTop} L ${bs * 0.3} ${bodyTop + 300}
        Q 40 ${h - wd * 0.6} 40 ${h - wd * 0.4}
        L 40 ${h} L ${len - 40} ${h}
        L ${len - 40} ${bodyTop + ra}
        Q ${len - 40} ${bodyTop} ${bodyEnd} ${bodyTop}
        L ${bs} ${bodyTop} Z`} fill="#f1f5f9" />
      <path d={`M ${bs} ${bodyTop} Q ${bs + bl / 2} ${bodyTop - ra} ${bodyEnd} ${bodyTop}`}
        fill="none" strokeWidth="6" />
      {/* Sliding door */}
      <rect x={doorX} y={bodyTop + 60} width={doorW} height={bh - 180}
        rx={12} fill="#e0f2fe20" stroke="#38bdf8" strokeWidth="5" strokeDasharray="20,10" />
      <text x={doorX + doorW / 2} y={bodyTop + bh / 2} textAnchor="middle"
        fontSize="60" fill="#7dd3fc" fontFamily="Arial">Puerta corredera</text>
      {/* Windshield */}
      <line x1={bs} y1={bodyTop} x2={bs * 0.3} y2={bodyTop + 300}
        strokeWidth="6" stroke="#60a5fa" />
      {/* Wheels */}
      <circle cx={fwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={rwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={fwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      <circle cx={rwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      {/* Grid */}
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={bodyTop - 40} x2={x} y2={h + 30}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      {/* Dimensions */}
      <text x={bs + bl / 2} y={h + 100} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={h + 180} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">zona carga: {bl} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      <line x1={bs} y1={bodyTop - 30} x2={bs} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <line x1={bodyEnd} y1={bodyTop - 30} x2={bodyEnd} y2={h + 30}
        stroke="#60a5fa" strokeWidth="2" strokeDasharray="10,6" />
      <text x={len / 2} y={bodyTop - 60} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontWeight="600" fontFamily="Arial">LADO DERECHO (pasajero)</text>
    </g>
  )
}

function VanTopSVG({ van }: { van: VanConfig }) {
  const { length: len, width: w, bodyStart: bs, bodyLength: bl } = van
  const bodyEnd = bs + bl
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <rect x={40} y={40} width={len - 80} height={w - 80} rx={80} fill="#f1f5f9" />
      <line x1={bs} y1={60} x2={bs} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      <line x1={bodyEnd} y1={60} x2={bodyEnd} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      <line x1={0} y1={w / 2} x2={len} y2={w / 2}
        strokeWidth="2" strokeDasharray="30,15" stroke="#e2e8f0" />
      {Array.from({ length: Math.floor(len / 1000) }, (_, i) => (i + 1) * 1000).map(x => (
        <line key={x} x1={x} y1={20} x2={x} y2={w - 20}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      <text x={bs + bl / 2} y={w + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={bs + bl / 2} y={w + 160} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">techo carga: {bl} mm</text>
      <text x={-60} y={w / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${w / 2})`}>{w} mm</text>
      {/* Labels for sides */}
      <text x={bs + bl / 2} y={80} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial">IZQUIERDO (conductor)</text>
      <text x={bs + bl / 2} y={w - 30} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial">DERECHO (pasajero)</text>
      <text x={bs - 120} y={w / 2} textAnchor="middle" fontSize="60" fill="#cbd5e1" fontFamily="Arial"
        transform={`rotate(-90 ${bs - 120} ${w / 2})`}>← FRONTAL</text>
    </g>
  )
}

function VanRearSVG({ van }: { van: VanConfig }) {
  const { width: w, height: h, bodyHeight: bh, roofArc: ra } = van
  const bodyTop = h - bh
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      <path d={`M 60 ${h} L 60 ${bodyTop + ra}
        Q ${w / 2} ${bodyTop - ra} ${w - 60} ${bodyTop + ra}
        L ${w - 60} ${h} Z`} fill="#f1f5f9" />
      <line x1={w / 2} y1={bodyTop + ra + 40} x2={w / 2} y2={h - 40}
        strokeWidth="4" strokeDasharray="15,8" stroke="#cbd5e1" />
      <rect x={w / 2 - 60} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      <rect x={w / 2 + 10} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      <ellipse cx={160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      <ellipse cx={w - 160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      <text x={w / 2} y={h + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{w} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
      <text x={100} y={bodyTop + ra + 100} fontSize="55" fill="#cbd5e1" fontFamily="Arial">IZQ</text>
      <text x={w - 260} y={bodyTop + ra + 100} fontSize="55" fill="#cbd5e1" fontFamily="Arial">DER</text>
    </g>
  )
}

// ── Helpers: map quote item names to ExteriorElement types ──────
const EXTERIOR_TYPE_MAP: { keywords: string[]; type: ExteriorElement['type']; color: string; defaultW: number; defaultH: number }[] = [
  { keywords: ['ventana'],                   type: 'ventana',      color: '#3b82f6', defaultW: 700, defaultH: 400 },
  { keywords: ['claraboya'],                 type: 'claraboya',    color: '#8b5cf6', defaultW: 400, defaultH: 400 },
  { keywords: ['maxxfan', 'maxfan'],         type: 'claraboya',    color: '#8b5cf6', defaultW: 355, defaultH: 355 },
  { keywords: ['aireador'],                  type: 'aireador',     color: '#10b981', defaultW: 217, defaultH: 217 },
  { keywords: ['rejilla'],                   type: 'rejilla',      color: '#f59e0b', defaultW: 260, defaultH: 126 },
  { keywords: ['placa solar', 'placa_solar', 'solar'], type: 'placa_solar', color: '#1e3a5f', defaultW: 1580, defaultH: 808 },
  { keywords: ['toldo'],                     type: 'toldo',        color: '#be185d', defaultW: 3000, defaultH: 2100 },
  { keywords: ['portabicis', 'bici'],        type: 'portabicis',   color: '#64748b', defaultW: 580, defaultH: 420 },
]

function quoteItemToExteriorElement(item: FurnitureWorkOrderItem, idx: number): ExteriorElement {
  const nameLower = item.quoteItemName.toLowerCase()
  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  for (const mapping of EXTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => nameLower.includes(k))) {
      return {
        id: `wo-ext-${idx}-${Date.now()}`,
        type: mapping.type,
        label: item.quoteItemName,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        fromQuote: true,
        quoteItemId: item.quoteItemSku,
      }
    }
  }
  return {
    id: `wo-ext-${idx}-${Date.now()}`,
    type: 'custom',
    label: item.quoteItemName,
    w: parsedW ?? 400,
    h: parsedH ?? 300,
    color: '#64748b',
    fromQuote: true,
    quoteItemId: item.quoteItemSku,
  }
}

// ── Van config panel ──────────────────────────────────────────────
function VanConfigPanel({ config, preset, onPreset, onChange }: {
  config: VanConfig
  preset: string
  onPreset: (key: string) => void
  onChange: (c: VanConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const fields: { key: keyof VanConfig; label: string }[] = [
    { key: 'length', label: 'Largo total' },
    { key: 'width', label: 'Ancho total' },
    { key: 'height', label: 'Alto total' },
    { key: 'bodyStart', label: 'Inicio carga' },
    { key: 'bodyLength', label: 'Largo carga' },
    { key: 'bodyHeight', label: 'Alto carga' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
        <span>🚐 Furgoneta: {VAN_PRESETS[preset]?.label ?? 'Personalizado'}</span>
        <span className="text-xs text-slate-400">{open ? '▲' : '▼'} {config.length}×{config.width}×{config.height} mm</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          <div className="flex items-center gap-2 pt-3">
            <label className="text-xs text-slate-500">Modelo:</label>
            <select value={preset}
              onChange={e => onPreset(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1.5 flex-1">
              {Object.entries(VAN_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-slate-400 block mb-0.5">{f.label}</label>
                <input type="number" value={config[f.key]} step={50}
                  onChange={e => {
                    onChange({ ...config, [f.key]: +e.target.value })
                    onPreset('custom')
                  }}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Todas las medidas en mm. Modifica para ajustar a tu furgoneta.</p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function VanExteriorDesign() {
  const navigate = useNavigate()
  const { workOrderId, projectId } = useParams<{ workOrderId?: string; projectId?: string }>()
  const isWoMode = !!workOrderId
  const configId = workOrderId ?? projectId ?? 'free'

  // Van config state
  const [van, setVan] = useState<VanConfig>(() => loadVanConfig(configId) ?? DEFAULT_VAN)
  const [preset, setPreset] = useState<string>(() => findPreset(van) ?? DEFAULT_PRESET)

  const handlePreset = (key: string) => {
    setPreset(key)
    if (key !== 'custom' && VAN_PRESETS[key]) {
      const cfg = { ...VAN_PRESETS[key] }
      delete (cfg as any).label
      setVan(cfg)
      saveVanConfig(configId, cfg)
    }
  }
  const handleVanChange = (cfg: VanConfig) => {
    setVan(cfg)
    saveVanConfig(configId, cfg)
  }

  const [workOrder, setWorkOrder] = useState<FurnitureWorkOrder | null>(null)
  const [woPalette, setWoPalette] = useState<ExteriorElement[]>([])
  const [elements, setElements] = useState<PlacedElement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ViewId>('side-left')
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const views = useMemo(() => getViews(van), [van])
  const viewConfig = views.find(v => v.id === activeView)!

  // Load WO data or saved design
  useEffect(() => {
    if (workOrderId) {
      ;(async () => {
        try {
          const wo = await FurnitureWorkOrderService.getById(workOrderId)
          if (wo) {
            setWorkOrder(wo)
            const palette = (wo.items ?? []).map((item, idx) =>
              quoteItemToExteriorElement(item as FurnitureWorkOrderItem, idx)
            )
            setWoPalette(palette)
          }
          const { data } = await supabase
            .from('exterior_designs')
            .select('elements')
            .eq('work_order_id', workOrderId)
            .maybeSingle()
          if (data?.elements) {
            // Migrate old 'side' view to 'side-left'
            const migrated = (data.elements as PlacedElement[]).map(el =>
              (el as any).view === 'side' ? { ...el, view: 'side-left' as ViewId } : el
            )
            setElements(migrated)
          }
        } catch { /* empty */ }
      })()
    } else if (projectId) {
      ;(async () => {
        try {
          const { data } = await supabase
            .from('exterior_designs')
            .select('elements')
            .eq('project_id', projectId)
            .maybeSingle()
          if (data?.elements) {
            const migrated = (data.elements as PlacedElement[]).map(el =>
              (el as any).view === 'side' ? { ...el, view: 'side-left' as ViewId } : el
            )
            setElements(migrated)
          }
        } catch { /* empty */ }
      })()
    }
  }, [workOrderId, projectId])

  const activePalette = isWoMode ? woPalette : DEFAULT_PALETTE

  // ── Snap grid (50mm) ─────────────────────────────────────────
  const snap = (v: number) => Math.round(v / 50) * 50

  // ── SVG coordinate conversion ────────────────────────────────
  const svgPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const svgPt = pt.matrixTransform(ctm.inverse())
      return { x: svgPt.x, y: svgPt.y }
    }, [],
  )

  // ── Drag handlers (with clamping) ────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const el = elements.find(p => p.id === elId)
      if (!el) return
      const pt = svgPoint(e.clientX, e.clientY)
      setDragging({ id: elId, offsetX: pt.x - el.x, offsetY: pt.y - el.y })
      setSelected(elId)
    }, [elements, svgPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const pt = svgPoint(e.clientX, e.clientY)
      setElements(prev =>
        prev.map(el => {
          if (el.id !== dragging.id) return el
          const raw = { x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
          const clamped = clamp(raw.x, raw.y, el.w, el.h, el.view, van)
          return { ...el, ...clamped }
        }),
      )
    }, [dragging, svgPoint, van],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  // ── Add element from palette (centered & clamped) ────────────
  const addElement = (tpl: ExteriorElement) => {
    const vc = views.find(v => v.id === activeView)!
    const rawX = snap(vc.svgW / 2 - tpl.w / 2)
    const rawY = snap(vc.svgH / 2 - tpl.h / 2)
    const clamped = clamp(rawX, rawY, tpl.w, tpl.h, activeView, van)
    const placed: PlacedElement = {
      ...tpl,
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...clamped,
      view: activeView,
      rotation: 0,
    }
    setElements(prev => [...prev, placed])
    setSelected(placed.id)
    toast.success(`${tpl.label} añadido`)
  }

  const deleteSelected = () => {
    if (!selected) return
    setElements(prev => prev.filter(e => e.id !== selected))
    setSelected(null)
  }

  const rotateSelected = () => {
    if (!selected) return
    setElements(prev =>
      prev.map(el => {
        if (el.id !== selected) return el
        const rotated = { ...el, rotation: (el.rotation + 90) % 360, w: el.h, h: el.w }
        const clamped = clamp(rotated.x, rotated.y, rotated.w, rotated.h, rotated.view, van)
        return { ...rotated, ...clamped }
      }),
    )
  }

  const duplicateSelected = () => {
    const src = elements.find(e => e.id === selected)
    if (!src) return
    const dup: PlacedElement = {
      ...src,
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: src.x + 100,
      y: src.y + 100,
    }
    const clamped = clamp(dup.x, dup.y, dup.w, dup.h, dup.view, van)
    setElements(prev => [...prev, { ...dup, ...clamped }])
    setSelected(dup.id)
  }

  // ── Save ─────────────────────────────────────────────────────
  const save = async () => {
    if (!workOrderId && !projectId) {
      toast.error('Guarda primero el proyecto para vincular el diseño exterior')
      return
    }
    setSaving(true)
    try {
      if (workOrderId) {
        const { data: existing } = await supabase
          .from('exterior_designs')
          .select('id')
          .eq('work_order_id', workOrderId)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('exterior_designs')
            .update({ elements, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('exterior_designs')
            .insert({ work_order_id: workOrderId, project_id: workOrder?.project_id, elements })
        }
        if (workOrder) {
          const updatedItems = (workOrder.items as FurnitureWorkOrderItem[]).map(item => ({
            ...item,
            designStatus: elements.some(el => el.fromQuote) ? 'designed' as const : item.designStatus,
          }))
          await FurnitureWorkOrderService.updateItems(workOrder.id, updatedItems)
        }
      } else {
        await supabase
          .from('exterior_designs')
          .upsert({ project_id: projectId, elements, updated_at: new Date().toISOString() })
      }
      toast.success('Diseño exterior guardado')
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const viewElements = useMemo(
    () => elements.filter(e => e.view === activeView),
    [elements, activeView],
  )

  const selectedEl = elements.find(e => e.id === selected)

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(isWoMode ? '/design/exterior' : '/design')}
            className="text-sm text-blue-600 hover:underline">← {isWoMode ? 'Órdenes' : 'Diseño'}</button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🚐 Diseño Exterior
            </h1>
            {workOrder ? (
              <p className="text-xs text-slate-500 mt-0.5">
                📋 {workOrder.quote_number} · {workOrder.client_name} · {(workOrder.items ?? []).length} elementos
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Coloca ventanas, claraboyas, aireadores y demás elementos en la furgoneta
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {(workOrderId || projectId) && (
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
              {saving ? '⏳ Guardando…' : '💾 Guardar'}
            </button>
          )}
        </div>
      </div>

      {/* Van config panel */}
      <VanConfigPanel config={van} preset={preset}
        onPreset={handlePreset} onChange={handleVanChange} />

      {/* View selector — 4 views */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {views.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
              activeView === v.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ────────────────────────────────────────────── */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 overflow-auto shadow-sm">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`-120 -120 ${viewConfig.svgW + 240} ${viewConfig.svgH + 300}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            {activeView === 'side-left' && <VanSideLeftSVG van={van} />}
            {activeView === 'side-right' && <VanSideRightSVG van={van} />}
            {activeView === 'top' && <VanTopSVG van={van} />}
            {activeView === 'rear' && <VanRearSVG van={van} />}

            {/* Placed elements */}
            {viewElements.map(el => {
              const isSelected = el.id === selected
              return (
                <g key={el.id}
                  onMouseDown={e => handleMouseDown(e, el.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'grab' }}
                >
                  <rect
                    x={el.x} y={el.y} width={el.w} height={el.h}
                    rx={8}
                    fill={el.color + '30'}
                    stroke={isSelected ? '#f43f5e' : el.color}
                    strokeWidth={isSelected ? 8 : 4}
                    strokeDasharray={isSelected ? '15,5' : 'none'}
                  />
                  <text
                    x={el.x + el.w / 2}
                    y={el.y + el.h / 2 - 20}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(60, el.w / 6)}
                    fontWeight="700"
                    fill={el.color}
                    fontFamily="Arial"
                    style={{ pointerEvents: 'none' }}
                  >
                    {ELEMENT_ICONS[el.type] ?? '📦'} {el.label}
                  </text>
                  <text
                    x={el.x + el.w / 2}
                    y={el.y + el.h / 2 + 30}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(50, el.w / 7)}
                    fill={el.color}
                    fontFamily="Arial"
                    style={{ pointerEvents: 'none', opacity: 0.7 }}
                  >
                    {el.w}×{el.h} mm
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>
              {viewElements.length} elemento{viewElements.length !== 1 ? 's' : ''} en esta vista ·
              {elements.length} total en todas las vistas
            </span>
            <span>Cuadrícula: 50 mm · Elementos acotados al cuerpo</span>
          </div>
        </div>

        {/* ── Sidebar: Properties + Palette ─────────────────── */}
        <div className="space-y-4">
          {selectedEl && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                {ELEMENT_ICONS[selectedEl.type]} {selectedEl.label}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">X (mm)</label>
                  <input type="number" value={selectedEl.x} step={50}
                    onChange={e => {
                      const c = clamp(+e.target.value, selectedEl.y, selectedEl.w, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, x: c.x } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedEl.y} step={50}
                    onChange={e => {
                      const c = clamp(selectedEl.x, +e.target.value, selectedEl.w, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, y: c.y } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedEl.w} step={10}
                    onChange={e => {
                      const nw = +e.target.value
                      const c = clamp(selectedEl.x, selectedEl.y, nw, selectedEl.h, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, w: nw, ...c } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedEl.h} step={10}
                    onChange={e => {
                      const nh = +e.target.value
                      const c = clamp(selectedEl.x, selectedEl.y, selectedEl.w, nh, selectedEl.view, van)
                      setElements(prev => prev.map(el => el.id === selected ? { ...el, h: nh, ...c } : el))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={rotateSelected}
                  className="py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">
                  ↻ Rotar
                </button>
                <button onClick={duplicateSelected}
                  className="py-1.5 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-100">
                  📋 Duplicar
                </button>
                <button onClick={deleteSelected}
                  className="py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100">
                  🗑 Eliminar
                </button>
              </div>
            </div>
          )}

          {/* Element palette */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              {isWoMode ? '📋 Elementos del presupuesto' : '🧩 Elementos exteriores'}
            </h3>
            {isWoMode && activePalette.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No hay elementos exteriores en esta orden
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                {activePalette.map(tpl => (
                  <button key={tpl.id} onClick={() => addElement(tpl)}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-xs">
                    <span className="text-base flex-shrink-0">{ELEMENT_ICONS[tpl.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 truncate">{tpl.label}</p>
                      <p className="text-[10px] text-slate-400">{tpl.w}×{tpl.h} mm</p>
                    </div>
                    {tpl.fromQuote && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold flex-shrink-0">
                        PRESU
                      </span>
                    )}
                    <span className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tpl.color }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary per view */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-[10px] space-y-1">
            <p className="font-bold text-slate-600 text-xs mb-1">📊 Resumen por vista</p>
            {views.map(v => {
              const count = elements.filter(e => e.view === v.id).length
              return (
                <p key={v.id} className="text-slate-500 flex justify-between">
                  <span>{v.icon} {v.label}</span>
                  <span className="font-bold">{count}</span>
                </p>
              )
            })}
          </div>

          {/* Legend */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Selecciona la vista (izquierdo, derecho, techo, trasero)</p>
            <p>• Haz clic en un elemento de la paleta para añadirlo</p>
            <p>• Arrastra para moverlo (acotado al cuerpo de la furgo)</p>
            <p>• Medidas reales en mm · Cuadrícula: 50 mm</p>
            <p>• Configura el tamaño de la furgoneta con ▼ arriba</p>
          </div>
        </div>
      </div>
    </div>
  )
}
