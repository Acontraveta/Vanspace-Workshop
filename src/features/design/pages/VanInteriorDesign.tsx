// ── Van Interior Design ────────────────────────────────────────────
// Floor plan of a van where users can:
// 1) Place furniture items with real dimensions
// 2) Draw electrical diagram (batteries, fusebox, lights, sockets)
// 3) Draw water/plumbing diagram (tank, pump, heater, taps, piping)
//
// Van size is configurable via presets or custom dimensions.
// Floor dimensions derive from the van body config.
// Items are constrained to the floor area.
//
// WO-driven mode: only quote items. Free mode: full default palettes.

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

// ── Floor dimensions derived from van config ─────────────────────
function getFloor(van: VanConfig) {
  return {
    length: van.bodyLength,               // cargo area length
    width: van.width - 280,               // interior width (walls ~140mm each side)
    wallThickness: 40,
    cabinDepth: 400,                      // space for cab seats reference
  }
}

// ── Item types ────────────────────────────────────────────────────
type DiagramLayer = 'furniture' | 'electrical' | 'water'

export interface InteriorItem {
  id: string
  layer: DiagramLayer
  type: string
  label: string
  w: number
  h: number
  x: number
  y: number
  rotation: number
  color: string
  icon: string
  fromQuote?: boolean
  quoteItemName?: string
}

// ── Palette definitions (real product dimensions, mm) ────────────
interface PaletteItem {
  type: string
  label: string
  w: number
  h: number
  color: string
  icon: string
  layer: DiagramLayer
}

// Furniture — top-down: length × depth (as seen from above)
const FURNITURE_PALETTE: PaletteItem[] = [
  { type: 'cama_trans', label: 'Cama transversal', w: 1900, h: 1300, color: '#8b5cf6', icon: '🛏️', layer: 'furniture' },
  { type: 'cama_long', label: 'Cama longitudinal', w: 1900, h: 700, color: '#8b5cf6', icon: '🛏️', layer: 'furniture' },
  { type: 'armario', label: 'Armario columna', w: 600, h: 450, color: '#a855f7', icon: '🗄️', layer: 'furniture' },
  { type: 'cocina', label: 'Bloque cocina', w: 1200, h: 550, color: '#f97316', icon: '🍳', layer: 'furniture' },
  { type: 'cocina_sm', label: 'Cocina compacta', w: 800, h: 500, color: '#f97316', icon: '🍳', layer: 'furniture' },
  { type: 'mesa', label: 'Mesa plegable', w: 600, h: 400, color: '#eab308', icon: '🪵', layer: 'furniture' },
  { type: 'nevera', label: 'Nevera compresor', w: 525, h: 380, color: '#06b6d4', icon: '❄️', layer: 'furniture' },
  { type: 'nevera_top', label: 'Nevera top-load', w: 650, h: 400, color: '#06b6d4', icon: '❄️', layer: 'furniture' },
  { type: 'asiento', label: 'Asiento giratorio', w: 500, h: 460, color: '#64748b', icon: '💺', layer: 'furniture' },
  { type: 'bano', label: 'Baño/ducha', w: 800, h: 700, color: '#0ea5e9', icon: '🚿', layer: 'furniture' },
  { type: 'almacenaje', label: 'Almacenaje bajo', w: 600, h: 400, color: '#78716c', icon: '📦', layer: 'furniture' },
  { type: 'banco', label: 'Banco con cofre', w: 1100, h: 450, color: '#92400e', icon: '🪑', layer: 'furniture' },
]

const ELECTRICAL_PALETTE: PaletteItem[] = [
  { type: 'bateria', label: 'Batería AGM 12V', w: 330, h: 175, color: '#dc2626', icon: '🔋', layer: 'electrical' },
  { type: 'bateria_litio', label: 'Batería LiFePO4', w: 325, h: 175, color: '#dc2626', icon: '⚡', layer: 'electrical' },
  { type: 'fusiblera', label: 'Fusiblera', w: 200, h: 100, color: '#f59e0b', icon: '🔌', layer: 'electrical' },
  { type: 'inversor', label: 'Inversor 12V→220V', w: 260, h: 160, color: '#f97316', icon: '🔄', layer: 'electrical' },
  { type: 'regulador_solar', label: 'Regulador solar MPPT', w: 190, h: 130, color: '#16a34a', icon: '☀️', layer: 'electrical' },
  { type: 'enchufe_220', label: 'Enchufe 220V', w: 80, h: 80, color: '#3b82f6', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_usb', label: 'Toma USB', w: 80, h: 60, color: '#6366f1', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_12v', label: 'Toma 12V', w: 80, h: 80, color: '#0ea5e9', icon: '🔌', layer: 'electrical' },
  { type: 'luz_led', label: 'Tira LED', w: 400, h: 30, color: '#eab308', icon: '💡', layer: 'electrical' },
  { type: 'luz_foco', label: 'Foco LED', w: 80, h: 80, color: '#eab308', icon: '💡', layer: 'electrical' },
  { type: 'interruptor', label: 'Interruptor', w: 80, h: 60, color: '#475569', icon: '🔘', layer: 'electrical' },
  { type: 'panel_control', label: 'Panel de control', w: 200, h: 120, color: '#334155', icon: '📊', layer: 'electrical' },
]

const WATER_PALETTE: PaletteItem[] = [
  { type: 'deposito_limpia', label: 'Depósito agua limpia', w: 500, h: 300, color: '#3b82f6', icon: '💧', layer: 'water' },
  { type: 'deposito_gris', label: 'Depósito agua gris', w: 500, h: 300, color: '#6b7280', icon: '🚰', layer: 'water' },
  { type: 'bomba', label: 'Bomba de agua', w: 150, h: 100, color: '#0ea5e9', icon: '⚙️', layer: 'water' },
  { type: 'calentador', label: 'Calentador (boiler)', w: 250, h: 200, color: '#ef4444', icon: '🔥', layer: 'water' },
  { type: 'grifo_cocina', label: 'Grifo cocina', w: 80, h: 80, color: '#06b6d4', icon: '🚰', layer: 'water' },
  { type: 'grifo_ducha', label: 'Grifo ducha', w: 80, h: 80, color: '#06b6d4', icon: '🚿', layer: 'water' },
  { type: 'filtro', label: 'Filtro de agua', w: 120, h: 80, color: '#14b8a6', icon: '🧪', layer: 'water' },
  { type: 'desague', label: 'Desagüe', w: 80, h: 80, color: '#78716c', icon: '⬇️', layer: 'water' },
  { type: 'tuberia_fria', label: 'Tubería fría (tramo)', w: 400, h: 25, color: '#3b82f6', icon: '〰️', layer: 'water' },
  { type: 'tuberia_caliente', label: 'Tubería caliente (tramo)', w: 400, h: 25, color: '#ef4444', icon: '〰️', layer: 'water' },
]

const LAYER_CONFIG: Record<DiagramLayer, { label: string; icon: string; color: string; palette: PaletteItem[] }> = {
  furniture: { label: 'Muebles', icon: '🪑', color: '#8b5cf6', palette: FURNITURE_PALETTE },
  electrical: { label: 'Eléctrico', icon: '⚡', color: '#f59e0b', palette: ELECTRICAL_PALETTE },
  water: { label: 'Agua', icon: '💧', color: '#3b82f6', palette: WATER_PALETTE },
}

// ── Helpers: map quote item names to interior palette items ──────
const INTERIOR_TYPE_MAP: { keywords: string[]; type: string; layer: DiagramLayer; color: string; icon: string; defaultW: number; defaultH: number }[] = [
  // Furniture
  { keywords: ['cama transversal'], type: 'cama_trans', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 1300 },
  { keywords: ['cama longitudinal'], type: 'cama_long', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 700 },
  { keywords: ['cama'], type: 'cama_trans', layer: 'furniture', color: '#8b5cf6', icon: '🛏️', defaultW: 1900, defaultH: 1300 },
  { keywords: ['armario'], type: 'armario', layer: 'furniture', color: '#a855f7', icon: '🗄️', defaultW: 600, defaultH: 450 },
  { keywords: ['cocina'], type: 'cocina', layer: 'furniture', color: '#f97316', icon: '🍳', defaultW: 1200, defaultH: 550 },
  { keywords: ['mesa'], type: 'mesa', layer: 'furniture', color: '#eab308', icon: '🪵', defaultW: 600, defaultH: 400 },
  { keywords: ['nevera', 'frigorífico'], type: 'nevera', layer: 'furniture', color: '#06b6d4', icon: '❄️', defaultW: 525, defaultH: 380 },
  { keywords: ['asiento', 'silla'], type: 'asiento', layer: 'furniture', color: '#64748b', icon: '💺', defaultW: 500, defaultH: 460 },
  { keywords: ['baño', 'ducha'], type: 'bano', layer: 'furniture', color: '#0ea5e9', icon: '🚿', defaultW: 800, defaultH: 700 },
  { keywords: ['almacenaje', 'cajón'], type: 'almacenaje', layer: 'furniture', color: '#78716c', icon: '📦', defaultW: 600, defaultH: 400 },
  { keywords: ['banco'], type: 'banco', layer: 'furniture', color: '#92400e', icon: '🪑', defaultW: 1100, defaultH: 450 },
  // Electrical
  { keywords: ['batería', 'bateria'], type: 'bateria', layer: 'electrical', color: '#dc2626', icon: '🔋', defaultW: 330, defaultH: 175 },
  { keywords: ['fusiblera', 'fusible'], type: 'fusiblera', layer: 'electrical', color: '#f59e0b', icon: '🔌', defaultW: 200, defaultH: 100 },
  { keywords: ['inversor'], type: 'inversor', layer: 'electrical', color: '#f97316', icon: '🔄', defaultW: 260, defaultH: 160 },
  { keywords: ['regulador solar'], type: 'regulador_solar', layer: 'electrical', color: '#16a34a', icon: '☀️', defaultW: 190, defaultH: 130 },
  { keywords: ['enchufe 220', '220v'], type: 'enchufe_220', layer: 'electrical', color: '#3b82f6', icon: '🔌', defaultW: 80, defaultH: 80 },
  { keywords: ['usb'], type: 'enchufe_usb', layer: 'electrical', color: '#6366f1', icon: '🔌', defaultW: 80, defaultH: 60 },
  { keywords: ['12v'], type: 'enchufe_12v', layer: 'electrical', color: '#0ea5e9', icon: '🔌', defaultW: 80, defaultH: 80 },
  { keywords: ['tira led', 'tira'], type: 'luz_led', layer: 'electrical', color: '#eab308', icon: '💡', defaultW: 400, defaultH: 30 },
  { keywords: ['foco'], type: 'luz_foco', layer: 'electrical', color: '#eab308', icon: '💡', defaultW: 80, defaultH: 80 },
  { keywords: ['interruptor'], type: 'interruptor', layer: 'electrical', color: '#475569', icon: '🔘', defaultW: 80, defaultH: 60 },
  { keywords: ['panel control', 'panel'], type: 'panel_control', layer: 'electrical', color: '#334155', icon: '📊', defaultW: 200, defaultH: 120 },
  // Water
  { keywords: ['depósito limpia', 'deposito limpia', 'agua limpia'], type: 'deposito_limpia', layer: 'water', color: '#3b82f6', icon: '💧', defaultW: 500, defaultH: 300 },
  { keywords: ['depósito gris', 'deposito gris', 'agua gris'], type: 'deposito_gris', layer: 'water', color: '#6b7280', icon: '🚰', defaultW: 500, defaultH: 300 },
  { keywords: ['bomba'], type: 'bomba', layer: 'water', color: '#0ea5e9', icon: '⚙️', defaultW: 150, defaultH: 100 },
  { keywords: ['calentador', 'boiler'], type: 'calentador', layer: 'water', color: '#ef4444', icon: '🔥', defaultW: 250, defaultH: 200 },
  { keywords: ['grifo cocina'], type: 'grifo_cocina', layer: 'water', color: '#06b6d4', icon: '🚰', defaultW: 80, defaultH: 80 },
  { keywords: ['grifo ducha'], type: 'grifo_ducha', layer: 'water', color: '#06b6d4', icon: '🚿', defaultW: 80, defaultH: 80 },
  { keywords: ['filtro'], type: 'filtro', layer: 'water', color: '#14b8a6', icon: '🧪', defaultW: 120, defaultH: 80 },
  { keywords: ['desagüe', 'desague'], type: 'desague', layer: 'water', color: '#78716c', icon: '⬇️', defaultW: 80, defaultH: 80 },
]

function quoteItemToInteriorPalette(item: FurnitureWorkOrderItem, idx: number): PaletteItem & { fromQuote: true } {
  const nameLower = item.quoteItemName.toLowerCase()
  const dimMatch = nameLower.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)
  const parsedW = dimMatch ? parseInt(dimMatch[1]) : undefined
  const parsedH = dimMatch ? parseInt(dimMatch[2]) : undefined

  for (const mapping of INTERIOR_TYPE_MAP) {
    if (mapping.keywords.some(k => nameLower.includes(k))) {
      return {
        type: mapping.type,
        label: item.quoteItemName,
        w: parsedW ?? mapping.defaultW,
        h: parsedH ?? mapping.defaultH,
        color: mapping.color,
        icon: mapping.icon,
        layer: mapping.layer,
        fromQuote: true,
      }
    }
  }
  return {
    type: 'custom',
    label: item.quoteItemName,
    w: parsedW ?? 400,
    h: parsedH ?? 300,
    color: '#64748b',
    icon: '📦',
    layer: 'furniture',
    fromQuote: true,
  }
}

// ── Floor bounds clamp ────────────────────────────────────────────
function clampFloor(x: number, y: number, w: number, h: number, floor: ReturnType<typeof getFloor>) {
  const { cabinDepth: cd, wallThickness: wt, length: fl, width: fw } = floor
  return {
    x: Math.max(cd, Math.min(cd + fl - w, x)),
    y: Math.max(wt, Math.min(wt + fw - h, y)),
  }
}

// ── SVG Floor Plan ────────────────────────────────────────────────
function VanFloorPlanSVG({ floor }: { floor: ReturnType<typeof getFloor> }) {
  const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = floor
  const totalL = l + cd
  return (
    <g className="van-floor" stroke="#94a3b8" strokeWidth="6" fill="none">
      {/* Floor outline with rounded rear */}
      <path d={`
        M ${cd} ${wt}
        L ${totalL - 80} ${wt}
        Q ${totalL} ${wt} ${totalL} ${wt + 80}
        L ${totalL} ${w + wt - 80}
        Q ${totalL} ${w + wt} ${totalL - 80} ${w + wt}
        L ${cd} ${w + wt}
        L ${cd} ${wt}
      `} fill="#f8fafc" stroke="#94a3b8" strokeWidth="8" />

      {/* Walls - double line */}
      <rect x={cd - wt} y={0} width={wt} height={w + wt * 2} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="3" />
      <path d={`
        M ${cd} ${0}
        L ${totalL - 80} ${0}
        Q ${totalL + wt} ${0} ${totalL + wt} ${80}
        L ${totalL + wt} ${w + wt * 2 - 80}
        Q ${totalL + wt} ${w + wt * 2} ${totalL - 80} ${w + wt * 2}
        L ${cd} ${w + wt * 2}
      `} fill="none" stroke="#94a3b8" strokeWidth="3" />

      {/* Cabin reference */}
      <rect x={0} y={wt + 100} width={cd - wt} height={w - 200}
        fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="3" rx={20} />
      <text x={(cd - wt) / 2} y={wt + w / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="60" fill="#94a3b8" fontFamily="Arial">Cabina</text>

      {/* Cabin separation */}
      <line x1={cd} y1={0} x2={cd} y2={w + wt * 2}
        stroke="#94a3b8" strokeWidth="4" strokeDasharray="20,10" />

      {/* Grid (250mm) */}
      {Array.from({ length: Math.floor(l / 250) }, (_, i) => (i + 1) * 250).map(x => (
        <line key={`gx-${x}`} x1={cd + x} y1={wt} x2={cd + x} y2={w + wt}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="10,10" />
      ))}
      {Array.from({ length: Math.floor(w / 250) }, (_, i) => (i + 1) * 250).map(y => (
        <line key={`gy-${y}`} x1={cd} y1={wt + y} x2={totalL} y2={wt + y}
          stroke="#f1f5f9" strokeWidth="1" strokeDasharray="10,10" />
      ))}

      {/* Center line */}
      <line x1={cd} y1={wt + w / 2} x2={totalL} y2={wt + w / 2}
        stroke="#e2e8f0" strokeWidth="2" strokeDasharray="30,15" />

      {/* Side labels */}
      <text x={cd + l / 2} y={-20} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">IZQUIERDO (conductor)</text>
      <text x={cd + l / 2} y={w + wt * 2 + 60} textAnchor="middle" fontSize="60"
        fill="#cbd5e1" fontFamily="Arial">DERECHO (pasajero)</text>

      {/* Dimensions */}
      <text x={cd + l / 2} y={w + wt * 2 + 130} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial">{l} mm</text>
      <text x={-60} y={wt + w / 2} textAnchor="middle" fontSize="60"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${wt + w / 2})`}>{w} mm</text>

      {/* Direction arrow */}
      <text x={cd + 80} y={wt + 80} fontSize="60" fill="#cbd5e1" fontFamily="Arial">← Frontal</text>
      <text x={totalL - 500} y={wt + 80} fontSize="60" fill="#cbd5e1" fontFamily="Arial">Trasera →</text>
    </g>
  )
}

// ── Van Config panel ──────────────────────────────────────────────
function VanConfigPanel({ config, preset, onPreset, onChange }: {
  config: VanConfig
  preset: string
  onPreset: (key: string) => void
  onChange: (c: VanConfig) => void
}) {
  const [open, setOpen] = useState(false)
  const floor = getFloor(config)
  const fields: { key: keyof VanConfig; label: string }[] = [
    { key: 'bodyLength', label: 'Largo carga' },
    { key: 'width', label: 'Ancho total' },
    { key: 'bodyHeight', label: 'Alto carga' },
  ]
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors">
        <span>🚐 Furgoneta: {VAN_PRESETS[preset]?.label ?? 'Personalizado'}</span>
        <span className="text-xs text-slate-400">{open ? '▲' : '▼'} suelo: {floor.length}×{floor.width} mm</span>
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
          <div className="grid grid-cols-3 gap-2 text-xs">
            {fields.map(f => (
              <div key={f.key}>
                <label className="text-slate-400 block mb-0.5">{f.label} (mm)</label>
                <input type="number" value={config[f.key]} step={50}
                  onChange={e => {
                    onChange({ ...config, [f.key]: +e.target.value })
                    onPreset('custom')
                  }}
                  className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            Suelo interior derivado: {floor.length}×{floor.width} mm (descontando paredes)
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function VanInteriorDesign() {
  const navigate = useNavigate()
  const { workOrderId, projectId } = useParams<{ workOrderId?: string; projectId?: string }>()
  const isWoMode = !!workOrderId
  const configId = workOrderId ?? projectId ?? 'free'

  // Van config state
  const [van, setVan] = useState<VanConfig>(() => loadVanConfig(configId) ?? DEFAULT_VAN)
  const [preset, setPreset] = useState<string>(() => findPreset(van) ?? DEFAULT_PRESET)
  const floor = useMemo(() => getFloor(van), [van])

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
  const [woPalettes, setWoPalettes] = useState<Record<DiagramLayer, (PaletteItem & { fromQuote?: boolean })[]>>({
    furniture: [], electrical: [], water: []
  })
  const [items, setItems] = useState<InteriorItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<DiagramLayer>('furniture')
  const [visibleLayers, setVisibleLayers] = useState<Set<DiagramLayer>>(new Set(['furniture', 'electrical', 'water']))
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Load WO data or saved design
  useEffect(() => {
    if (workOrderId) {
      ;(async () => {
        try {
          const wo = await FurnitureWorkOrderService.getById(workOrderId)
          if (wo) {
            setWorkOrder(wo)
            const grouped: Record<DiagramLayer, (PaletteItem & { fromQuote?: boolean })[]> = {
              furniture: [], electrical: [], water: []
            }
            ;(wo.items ?? []).forEach((item, idx) => {
              const mapped = quoteItemToInteriorPalette(item as FurnitureWorkOrderItem, idx)
              grouped[mapped.layer].push(mapped)
            })
            setWoPalettes(grouped)
          }
          const { data } = await supabase
            .from('interior_designs')
            .select('items')
            .eq('work_order_id', workOrderId)
            .maybeSingle()
          if (data?.items) setItems(data.items)
        } catch { /* empty */ }
      })()
    } else if (projectId) {
      ;(async () => {
        try {
          const { data } = await supabase
            .from('interior_designs')
            .select('items')
            .eq('project_id', projectId)
            .maybeSingle()
          if (data?.items) setItems(data.items)
        } catch { /* empty */ }
      })()
    }
  }, [workOrderId, projectId])

  const snap = (v: number) => Math.round(v / 50) * 50

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault()
      e.stopPropagation()
      const item = items.find(i => i.id === id)
      if (!item) return
      const pt = svgPoint(e.clientX, e.clientY)
      setDragging({ id, offsetX: pt.x - item.x, offsetY: pt.y - item.y })
      setSelected(id)
    }, [items, svgPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const pt = svgPoint(e.clientX, e.clientY)
      setItems(prev =>
        prev.map(it => {
          if (it.id !== dragging.id) return it
          const raw = { x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
          const clamped = clampFloor(raw.x, raw.y, it.w, it.h, floor)
          return { ...it, ...clamped }
        }),
      )
    }, [dragging, svgPoint, floor],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  const addItem = (tpl: PaletteItem) => {
    const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = floor
    const rawX = snap(cd + l / 2 - tpl.w / 2)
    const rawY = snap(wt + w / 2 - tpl.h / 2)
    const clamped = clampFloor(rawX, rawY, tpl.w, tpl.h, floor)
    const item: InteriorItem = {
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      layer: tpl.layer,
      type: tpl.type,
      label: tpl.label,
      w: tpl.w,
      h: tpl.h,
      ...clamped,
      rotation: 0,
      color: tpl.color,
      icon: tpl.icon,
    }
    setItems(prev => [...prev, item])
    setSelected(item.id)
    toast.success(`${tpl.label} añadido`)
  }

  const deleteSelected = () => {
    if (!selected) return
    setItems(prev => prev.filter(i => i.id !== selected))
    setSelected(null)
  }

  const rotateSelected = () => {
    if (!selected) return
    setItems(prev =>
      prev.map(it => {
        if (it.id !== selected) return it
        const rotated = { ...it, rotation: (it.rotation + 90) % 360, w: it.h, h: it.w }
        const clamped = clampFloor(rotated.x, rotated.y, rotated.w, rotated.h, floor)
        return { ...rotated, ...clamped }
      }),
    )
  }

  const duplicateSelected = () => {
    const src = items.find(i => i.id === selected)
    if (!src) return
    const dup: InteriorItem = {
      ...src,
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: src.x + 100,
      y: src.y + 100,
    }
    const clamped = clampFloor(dup.x, dup.y, dup.w, dup.h, floor)
    setItems(prev => [...prev, { ...dup, ...clamped }])
    setSelected(dup.id)
  }

  const toggleLayerVisibility = (layer: DiagramLayer) => {
    setVisibleLayers(prev => {
      const next = new Set(prev)
      if (next.has(layer)) next.delete(layer)
      else next.add(layer)
      return next
    })
  }

  const save = async () => {
    if (!workOrderId && !projectId) {
      toast.error('Guarda primero el proyecto para vincular el diseño interior')
      return
    }
    setSaving(true)
    try {
      if (workOrderId) {
        const { data: existing } = await supabase
          .from('interior_designs')
          .select('id')
          .eq('work_order_id', workOrderId)
          .maybeSingle()
        if (existing) {
          await supabase
            .from('interior_designs')
            .update({ items, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('interior_designs')
            .insert({ work_order_id: workOrderId, project_id: workOrder?.project_id, items })
        }
        if (workOrder) {
          const updatedItems = (workOrder.items as FurnitureWorkOrderItem[]).map(item => ({
            ...item,
            designStatus: items.length > 0 ? 'designed' as const : item.designStatus,
          }))
          await FurnitureWorkOrderService.updateItems(workOrder.id, updatedItems)
        }
      } else {
        await supabase
          .from('interior_designs')
          .upsert({ project_id: projectId, items, updated_at: new Date().toISOString() })
      }
      toast.success('Diseño interior guardado')
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  const visibleItems = useMemo(
    () => items.filter(i => visibleLayers.has(i.layer)),
    [items, visibleLayers],
  )

  const selectedItem = items.find(i => i.id === selected)
  const layerCfg = LAYER_CONFIG[activeLayer]

  // SVG viewBox
  const totalL = floor.length + floor.cabinDepth
  const totalW = floor.width + floor.wallThickness * 2
  const pad = 180

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(isWoMode ? '/design/interior' : '/design')}
            className="text-sm text-blue-600 hover:underline">← {isWoMode ? 'Órdenes' : 'Diseño'}</button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🏠 Diseño Interior
            </h1>
            {workOrder ? (
              <p className="text-xs text-slate-500 mt-0.5">
                📋 {workOrder.quote_number} · {workOrder.client_name} · {(workOrder.items ?? []).length} elementos
              </p>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">
                Distribución de muebles, diagrama eléctrico y diagrama de agua
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

      {/* Layer tabs + visibility toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(Object.entries(LAYER_CONFIG) as [DiagramLayer, typeof LAYER_CONFIG['furniture']][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setActiveLayer(key)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
                activeLayer === key ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 text-xs">
          <span className="text-slate-400 self-center">Capas visibles:</span>
          {(Object.entries(LAYER_CONFIG) as [DiagramLayer, typeof LAYER_CONFIG['furniture']][]).map(([key, cfg]) => (
            <button key={key} onClick={() => toggleLayerVisibility(key)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all ${
                visibleLayers.has(key)
                  ? 'bg-white border-slate-300 text-slate-700'
                  : 'bg-slate-100 border-slate-200 text-slate-300 line-through'
              }`}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* ── Canvas ────────────────────────────────────────────── */}
        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 overflow-auto shadow-sm">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`${-pad} ${-pad} ${totalL + pad * 2 + floor.wallThickness} ${totalW + pad * 2}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            <VanFloorPlanSVG floor={floor} />

            {/* Placed items */}
            {visibleItems.map(item => {
              const isSelected = item.id === selected
              const opacity = item.layer === activeLayer ? 1 : 0.4
              return (
                <g key={item.id}
                  onMouseDown={e => handleMouseDown(e, item.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'grab', opacity }}
                >
                  <rect
                    x={item.x} y={item.y} width={item.w} height={item.h}
                    rx={6}
                    fill={item.color + '25'}
                    stroke={isSelected ? '#f43f5e' : item.color}
                    strokeWidth={isSelected ? 6 : 3}
                    strokeDasharray={isSelected ? '12,4' : item.layer === 'water' ? '8,4' : item.layer === 'electrical' ? '4,4' : 'none'}
                  />
                  <text
                    x={item.x + item.w / 2}
                    y={item.y + item.h / 2 - 15}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(50, Math.max(20, item.w / 5))}
                    fill={item.color}
                    fontWeight="700"
                    fontFamily="Arial"
                    style={{ pointerEvents: 'none' }}
                  >
                    {item.icon}
                  </text>
                  <text
                    x={item.x + item.w / 2}
                    y={item.y + item.h / 2 + 25}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(40, Math.max(16, item.w / 7))}
                    fill={item.color}
                    fontWeight="600"
                    fontFamily="Arial"
                    style={{ pointerEvents: 'none' }}
                  >
                    {item.label}
                  </text>
                  {item.w > 150 && (
                    <text
                      x={item.x + item.w / 2}
                      y={item.y + item.h - 10}
                      textAnchor="middle"
                      fontSize={Math.min(30, item.w / 10)}
                      fill={item.color}
                      fontFamily="Arial"
                      style={{ pointerEvents: 'none', opacity: 0.5 }}
                    >
                      {item.w}×{item.h}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          <div className="mt-2 flex justify-between text-xs text-slate-400">
            <span>
              {items.filter(i => i.layer === 'furniture').length} muebles ·{' '}
              {items.filter(i => i.layer === 'electrical').length} eléctricos ·{' '}
              {items.filter(i => i.layer === 'water').length} agua
            </span>
            <span>Cuadrícula: 50 mm · Acotados al suelo</span>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="space-y-4">
          {selectedItem && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                {selectedItem.icon} {selectedItem.label}
                <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
                  style={{ backgroundColor: selectedItem.color + '20', color: selectedItem.color }}>
                  {LAYER_CONFIG[selectedItem.layer].label}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">X (mm)</label>
                  <input type="number" value={selectedItem.x} step={50}
                    onChange={e => {
                      const c = clampFloor(+e.target.value, selectedItem.y, selectedItem.w, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, x: c.x } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedItem.y} step={50}
                    onChange={e => {
                      const c = clampFloor(selectedItem.x, +e.target.value, selectedItem.w, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, y: c.y } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedItem.w} step={10}
                    onChange={e => {
                      const nw = +e.target.value
                      const c = clampFloor(selectedItem.x, selectedItem.y, nw, selectedItem.h, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, w: nw, ...c } : it))
                    }}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedItem.h} step={10}
                    onChange={e => {
                      const nh = +e.target.value
                      const c = clampFloor(selectedItem.x, selectedItem.y, selectedItem.w, nh, floor)
                      setItems(prev => prev.map(it => it.id === selected ? { ...it, h: nh, ...c } : it))
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

          {/* Palette for active layer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {(() => {
              const paletteItems = isWoMode ? (woPalettes[activeLayer] ?? []) : layerCfg.palette
              return (
                <>
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    {layerCfg.icon} {isWoMode ? `${layerCfg.label} (presupuesto)` : layerCfg.label}
                    <span className="text-[10px] text-slate-400 ml-auto font-normal">
                      {paletteItems.length} elementos
                    </span>
                  </h3>
                  {paletteItems.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No hay elementos de {layerCfg.label.toLowerCase()} en esta orden
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                      {paletteItems.map((tpl, idx) => (
                        <button key={`${tpl.type}-${idx}`} onClick={() => addItem(tpl)}
                          className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-xs">
                          <span className="text-base flex-shrink-0">{tpl.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 truncate">{tpl.label}</p>
                            <p className="text-[10px] text-slate-400">{tpl.w}×{tpl.h} mm</p>
                          </div>
                          {(tpl as any).fromQuote && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded-full font-bold flex-shrink-0">
                              PRESU
                            </span>
                          )}
                          <span className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tpl.color }} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Legend */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Selecciona la capa (Muebles / Eléctrico / Agua)</p>
            <p>• Añade elementos desde la paleta (medidas reales)</p>
            <p>• Arrastra para posicionar (acotado al suelo)</p>
            <p>• Activa/desactiva capas para ver cada diagrama</p>
            <p>• Configura el tamaño de la furgoneta con ▼ arriba</p>
          </div>
        </div>
      </div>
    </div>
  )
}
