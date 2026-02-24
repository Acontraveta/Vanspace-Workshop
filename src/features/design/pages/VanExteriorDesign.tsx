// ── Van Exterior Design ────────────────────────────────────────────
// Shows 3 views (side / top / rear) of a generic van where the user
// can drag-and-drop catalog elements that require exterior placement:
// windows, skylights, vents, grilles, etc.
//
// In WO-driven mode: only quote items from the work order are available as palette.
// In free mode: the full default palette is available.

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { FurnitureWorkOrderService } from '../services/furnitureDesignService'
import { FurnitureWorkOrder, FurnitureWorkOrderItem } from '../types/furniture.types'

// ── SVG Van dimensions (mm, proportional to a generic LWB van) ───
const VAN = {
  length: 6000,   // overall length mm
  width:  2000,   // overall width mm
  height: 2600,   // overall height mm (top of roof)
  bodyStart: 1400, // where the cargo body starts from front
  bodyLength: 4200,
  bodyHeight: 1900,
  roofArc: 200,    // roof curvature offset
  wheelDia: 700,
  wheelY: 2600,    // bottom
  frontWheelX: 1000,
  rearWheelX: 4800,
  floorY: 2600 - 700 / 2, // wheel center
}

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
  view: 'side' | 'top' | 'rear'
  rotation: number
}

// ── Default palette (common van exterior elements) ───────────────
const DEFAULT_PALETTE: ExteriorElement[] = [
  { id: 'pal-vent-60x40', type: 'ventana', label: 'Ventana 600×400', w: 600, h: 400, color: '#3b82f6' },
  { id: 'pal-vent-90x50', type: 'ventana', label: 'Ventana 900×500', w: 900, h: 500, color: '#3b82f6' },
  { id: 'pal-vent-120x60', type: 'ventana', label: 'Ventana 1200×600', w: 1200, h: 600, color: '#3b82f6' },
  { id: 'pal-clara-40x40', type: 'claraboya', label: 'Claraboya 400×400', w: 400, h: 400, color: '#8b5cf6' },
  { id: 'pal-clara-70x50', type: 'claraboya', label: 'Claraboya 700×500', w: 700, h: 500, color: '#8b5cf6' },
  { id: 'pal-aireador', type: 'aireador', label: 'Aireador 200×200', w: 200, h: 200, color: '#10b981' },
  { id: 'pal-rejilla-30x15', type: 'rejilla', label: 'Rejilla 300×150', w: 300, h: 150, color: '#f59e0b' },
  { id: 'pal-rejilla-20x10', type: 'rejilla', label: 'Rejilla 200×100', w: 200, h: 100, color: '#f59e0b' },
  { id: 'pal-placa-lg', type: 'placa_solar', label: 'Placa solar 1600×1000', w: 1600, h: 1000, color: '#1e3a5f' },
  { id: 'pal-placa-sm', type: 'placa_solar', label: 'Placa solar 800×600', w: 800, h: 600, color: '#1e3a5f' },
  { id: 'pal-toldo', type: 'toldo', label: 'Toldo lateral 3000×2500', w: 3000, h: 2500, color: '#be185d' },
  { id: 'pal-portabicis', type: 'portabicis', label: 'Portabicis trasero', w: 600, h: 500, color: '#64748b' },
]

const ELEMENT_ICONS: Record<string, string> = {
  ventana: '🪟', claraboya: '☀️', aireador: '🌀', rejilla: '🔲',
  portabicis: '🚲', toldo: '⛺', placa_solar: '🔋', custom: '📦',
}

type ViewId = 'side' | 'top' | 'rear'

interface ViewConfig {
  id: ViewId
  label: string
  icon: string
  svgW: number
  svgH: number
}

const VIEWS: ViewConfig[] = [
  { id: 'side', label: 'Perfil (lado)', icon: '↔️', svgW: VAN.length, svgH: VAN.height },
  { id: 'top', label: 'Planta (arriba)', icon: '⬇️', svgW: VAN.length, svgH: VAN.width },
  { id: 'rear', label: 'Alzado (trasero)', icon: '🔙', svgW: VAN.width, svgH: VAN.height },
]

// ── SVG Van drawings ─────────────────────────────────────────────
function VanSideSVG() {
  const { bodyStart: bs, bodyLength: bl, bodyHeight: bh, height: h, wheelDia: wd,
    frontWheelX: fwx, rearWheelX: rwx, roofArc: ra, length: len } = VAN
  const bodyTop = h - bh
  const bodyEnd = bs + bl
  // cabin from 0 → bodyStart
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      {/* Cabin outline */}
      <path d={`M ${bs} ${bodyTop} L ${bs * 0.3} ${bodyTop + 300}
        Q 40 ${h - wd * 0.6} 40 ${h - wd * 0.4}
        L 40 ${h} L ${len - 40} ${h}
        L ${len - 40} ${bodyTop + ra}
        Q ${len - 40} ${bodyTop} ${bodyEnd} ${bodyTop}
        L ${bs} ${bodyTop} Z`}
        fill="#f1f5f9" />
      {/* Roof arc */}
      <path d={`M ${bs} ${bodyTop} Q ${bs + bl / 2} ${bodyTop - ra} ${bodyEnd} ${bodyTop}`}
        fill="none" strokeWidth="6" />
      {/* Cab windshield */}
      <line x1={bs} y1={bodyTop} x2={bs * 0.3} y2={bodyTop + 300}
        strokeWidth="6" stroke="#60a5fa" />
      {/* Wheels */}
      <circle cx={fwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={rwx} cy={h - 20} r={wd / 2} fill="#475569" stroke="#334155" strokeWidth="10" />
      <circle cx={fwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      <circle cx={rwx} cy={h - 20} r={wd / 4} fill="#64748b" />
      {/* Grid lines for reference */}
      {[1000, 2000, 3000, 4000, 5000].map(x => (
        <line key={x} x1={x} y1={bodyTop - 40} x2={x} y2={h + 30}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      {/* Dimension marks */}
      <text x={len / 2} y={h + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{VAN.length} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
    </g>
  )
}

function VanTopSVG() {
  const { length: len, width: w, bodyStart: bs, bodyLength: bl } = VAN
  const bodyEnd = bs + bl
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      {/* Body outline */}
      <rect x={40} y={40} width={len - 80} height={w - 80}
        rx={80} fill="#f1f5f9" />
      {/* Cabin separation */}
      <line x1={bs} y1={60} x2={bs} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      {/* Rear doors separation */}
      <line x1={bodyEnd} y1={60} x2={bodyEnd} y2={w - 60}
        strokeWidth="4" strokeDasharray="20,10" stroke="#cbd5e1" />
      {/* Center line */}
      <line x1={0} y1={w / 2} x2={len} y2={w / 2}
        strokeWidth="2" strokeDasharray="30,15" stroke="#e2e8f0" />
      {/* Grid */}
      {[1000, 2000, 3000, 4000, 5000].map(x => (
        <line key={x} x1={x} y1={20} x2={x} y2={w - 20}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="20,10" />
      ))}
      {/* Dimensions */}
      <text x={len / 2} y={w + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{len} mm</text>
      <text x={-60} y={w / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${w / 2})`}>{w} mm</text>
    </g>
  )
}

function VanRearSVG() {
  const { width: w, height: h, bodyHeight: bh, roofArc: ra } = VAN
  const bodyTop = h - bh
  return (
    <g className="van-body" stroke="#94a3b8" strokeWidth="8" fill="none">
      {/* Body outline */}
      <path d={`M 60 ${h} L 60 ${bodyTop + ra}
        Q ${w / 2} ${bodyTop - ra} ${w - 60} ${bodyTop + ra}
        L ${w - 60} ${h} Z`}
        fill="#f1f5f9" />
      {/* Door split */}
      <line x1={w / 2} y1={bodyTop + ra + 40} x2={w / 2} y2={h - 40}
        strokeWidth="4" strokeDasharray="15,8" stroke="#cbd5e1" />
      {/* Door handles */}
      <rect x={w / 2 - 60} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      <rect x={w / 2 + 10} y={h - bh / 2 - 30} width={50} height={60} rx={10} fill="none" stroke="#94a3b8" strokeWidth="4" />
      {/* Wheels */}
      <ellipse cx={160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      <ellipse cx={w - 160} cy={h - 20} rx={140} ry={100} fill="#475569" stroke="#334155" strokeWidth="8" />
      {/* Dimensions */}
      <text x={w / 2} y={h + 80} textAnchor="middle" fontSize="80"
        fill="#94a3b8" fontFamily="Arial">{w} mm</text>
      <text x={-60} y={bodyTop + bh / 2} textAnchor="middle" fontSize="70"
        fill="#94a3b8" fontFamily="Arial"
        transform={`rotate(-90 -60 ${bodyTop + bh / 2})`}>{bh} mm</text>
    </g>
  )
}

// ── Helpers: map quote item names to ExteriorElement types ──────
const EXTERIOR_TYPE_MAP: { keywords: string[]; type: ExteriorElement['type']; color: string; defaultW: number; defaultH: number }[] = [
  { keywords: ['ventana'],                   type: 'ventana',      color: '#3b82f6', defaultW: 600, defaultH: 400 },
  { keywords: ['claraboya'],                 type: 'claraboya',    color: '#8b5cf6', defaultW: 400, defaultH: 400 },
  { keywords: ['aireador'],                  type: 'aireador',     color: '#10b981', defaultW: 200, defaultH: 200 },
  { keywords: ['rejilla'],                   type: 'rejilla',      color: '#f59e0b', defaultW: 300, defaultH: 150 },
  { keywords: ['placa solar', 'placa_solar', 'solar'], type: 'placa_solar', color: '#1e3a5f', defaultW: 1600, defaultH: 1000 },
  { keywords: ['toldo'],                     type: 'toldo',        color: '#be185d', defaultW: 3000, defaultH: 2500 },
  { keywords: ['portabicis', 'bici'],        type: 'portabicis',   color: '#64748b', defaultW: 600, defaultH: 500 },
]

function quoteItemToExteriorElement(item: FurnitureWorkOrderItem, idx: number): ExteriorElement {
  const nameLower = item.quoteItemName.toLowerCase()
  // Try to extract dimensions from the name (e.g., "Ventana 600×400" or "Ventana 600x400")
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
  // Fallback: generic custom element
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

// ── Main Component ────────────────────────────────────────────────
export default function VanExteriorDesign() {
  const navigate = useNavigate()
  const { workOrderId, projectId } = useParams<{ workOrderId?: string; projectId?: string }>()
  const isWoMode = !!workOrderId

  const [workOrder, setWorkOrder] = useState<FurnitureWorkOrder | null>(null)
  const [woPalette, setWoPalette] = useState<ExteriorElement[]>([])
  const [elements, setElements] = useState<PlacedElement[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ViewId>('side')
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
            // Build palette from WO items
            const palette = (wo.items ?? []).map((item, idx) =>
              quoteItemToExteriorElement(item as FurnitureWorkOrderItem, idx)
            )
            setWoPalette(palette)
          }
          // Load saved design for this WO
          const { data } = await supabase
            .from('exterior_designs')
            .select('elements')
            .eq('work_order_id', workOrderId)
            .maybeSingle()
          if (data?.elements) setElements(data.elements)
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
          if (data?.elements) setElements(data.elements)
        } catch { /* empty */ }
      })()
    }
  }, [workOrderId, projectId])

  // The palette to show: WO items only in WO mode, default palette in free mode
  const activePalette = isWoMode ? woPalette : DEFAULT_PALETTE

  const viewConfig = VIEWS.find(v => v.id === activeView)!

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
    },
    [],
  )

  // ── Drag handlers ────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, elId: string) => {
      e.preventDefault()
      e.stopPropagation()
      const el = elements.find(p => p.id === elId)
      if (!el) return
      const pt = svgPoint(e.clientX, e.clientY)
      setDragging({ id: elId, offsetX: pt.x - el.x, offsetY: pt.y - el.y })
      setSelected(elId)
    },
    [elements, svgPoint],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const pt = svgPoint(e.clientX, e.clientY)
      setElements(prev =>
        prev.map(el =>
          el.id === dragging.id
            ? { ...el, x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
            : el,
        ),
      )
    },
    [dragging, svgPoint],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  // ── Add element from palette ─────────────────────────────────
  const addElement = (tpl: ExteriorElement) => {
    const vc = VIEWS.find(v => v.id === activeView)!
    const placed: PlacedElement = {
      ...tpl,
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: snap(vc.svgW / 2 - tpl.w / 2),
      y: snap(vc.svgH / 2 - tpl.h / 2),
      view: activeView,
      rotation: 0,
    }
    setElements(prev => [...prev, placed])
    setSelected(placed.id)
    toast.success(`${tpl.label} añadido`)
  }

  // ── Delete element ───────────────────────────────────────────
  const deleteSelected = () => {
    if (!selected) return
    setElements(prev => prev.filter(e => e.id !== selected))
    setSelected(null)
  }

  // ── Rotate element ───────────────────────────────────────────
  const rotateSelected = () => {
    if (!selected) return
    setElements(prev =>
      prev.map(el =>
        el.id === selected
          ? { ...el, rotation: (el.rotation + 90) % 360, w: el.h, h: el.w }
          : el,
      ),
    )
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
        // WO-driven: save linked to work order
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
            .insert({
              work_order_id: workOrderId,
              project_id: workOrder?.project_id,
              elements,
            })
        }
        // Update WO items status
        if (workOrder) {
          const updatedItems = (workOrder.items as FurnitureWorkOrderItem[]).map(item => ({
            ...item,
            designStatus: elements.some(el => el.fromQuote) ? 'designed' as const : item.designStatus,
          }))
          await FurnitureWorkOrderService.updateItems(workOrder.id, updatedItems)
        }
      } else {
        // Free mode: save linked to project
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

  // Elements for current view
  const viewElements = useMemo(
    () => elements.filter(e => e.view === activeView),
    [elements, activeView],
  )

  const selectedEl = elements.find(e => e.id === selected)

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
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
                📋 {workOrder.quote_number} · {workOrder.client_name} · {(workOrder.items ?? []).length} elementos del presupuesto
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

      {/* View selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${
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
            viewBox={`-100 -100 ${viewConfig.svgW + 200} ${viewConfig.svgH + 200}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            {/* Van drawing by view */}
            {activeView === 'side' && <VanSideSVG />}
            {activeView === 'top' && <VanTopSVG />}
            {activeView === 'rear' && <VanRearSVG />}

            {/* Placed elements */}
            {viewElements.map(el => {
              const isSelected = el.id === selected
              return (
                <g key={el.id}
                  onMouseDown={e => handleMouseDown(e, el.id)}
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
                  {/* Label */}
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
                  {/* Dimensions */}
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

          {/* Element count */}
          <div className="mt-2 text-xs text-slate-400 text-right">
            {viewElements.length} elemento{viewElements.length !== 1 ? 's' : ''} en esta vista ·
            {elements.length} total
          </div>
        </div>

        {/* ── Sidebar: Palette + Properties ─────────────────── */}
        <div className="space-y-4">
          {/* Selected element properties */}
          {selectedEl && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                {ELEMENT_ICONS[selectedEl.type]} {selectedEl.label}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-0.5">X (mm)</label>
                  <input type="number" value={selectedEl.x} step={50}
                    onChange={e => setElements(prev => prev.map(el => el.id === selected ? { ...el, x: +e.target.value } : el))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedEl.y} step={50}
                    onChange={e => setElements(prev => prev.map(el => el.id === selected ? { ...el, y: +e.target.value } : el))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedEl.w} step={50}
                    onChange={e => setElements(prev => prev.map(el => el.id === selected ? { ...el, w: +e.target.value } : el))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedEl.h} step={50}
                    onChange={e => setElements(prev => prev.map(el => el.id === selected ? { ...el, h: +e.target.value } : el))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={rotateSelected}
                  className="flex-1 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg hover:bg-blue-100">
                  ↻ Rotar 90°
                </button>
                <button onClick={deleteSelected}
                  className="flex-1 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100">
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
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
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

          {/* Legend */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Haz clic en un elemento de la paleta para añadirlo</p>
            <p>• Arrastra para moverlo sobre la furgoneta</p>
            <p>• Selecciona para editar posición, tamaño o eliminar</p>
            <p>• Cuadrícula de ajuste: 50 mm</p>
          </div>
        </div>
      </div>
    </div>
  )
}
