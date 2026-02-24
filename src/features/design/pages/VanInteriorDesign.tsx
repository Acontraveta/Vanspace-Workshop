// ── Van Interior Design ────────────────────────────────────────────
// Floor plan of a generic van where users can:
// 1) Place furniture items (from the project quote) with real dimensions
// 2) Draw electrical diagram (batteries, fusebox, lights, sockets, wiring)
// 3) Draw water/plumbing diagram (tank, pump, heater, taps, piping)

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ── Van floor plan dimensions (mm) ───────────────────────────────
const FLOOR = {
  length: 4200, // cargo area length
  width: 1700,  // interior width between walls
  wallThickness: 40,
  cabinDepth: 400, // space for cab seats shown as reference
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

// ── Palette definitions ──────────────────────────────────────────
interface PaletteItem {
  type: string
  label: string
  w: number
  h: number
  color: string
  icon: string
  layer: DiagramLayer
}

const FURNITURE_PALETTE: PaletteItem[] = [
  { type: 'cama', label: 'Cama', w: 1800, h: 1300, color: '#8b5cf6', icon: '🛏️', layer: 'furniture' },
  { type: 'armario', label: 'Armario', w: 600, h: 500, color: '#a855f7', icon: '🪑', layer: 'furniture' },
  { type: 'cocina', label: 'Bloque cocina', w: 800, h: 500, color: '#f97316', icon: '🍳', layer: 'furniture' },
  { type: 'mesa', label: 'Mesa', w: 600, h: 400, color: '#eab308', icon: '🪵', layer: 'furniture' },
  { type: 'nevera', label: 'Nevera', w: 500, h: 500, color: '#06b6d4', icon: '❄️', layer: 'furniture' },
  { type: 'asiento', label: 'Asiento giratorio', w: 500, h: 500, color: '#64748b', icon: '💺', layer: 'furniture' },
  { type: 'bano', label: 'Baño/ducha', w: 700, h: 700, color: '#0ea5e9', icon: '🚿', layer: 'furniture' },
  { type: 'almacenaje', label: 'Almacenaje bajo', w: 600, h: 400, color: '#78716c', icon: '📦', layer: 'furniture' },
]

const ELECTRICAL_PALETTE: PaletteItem[] = [
  { type: 'bateria', label: 'Batería aux. 12V', w: 300, h: 200, color: '#dc2626', icon: '🔋', layer: 'electrical' },
  { type: 'bateria_litio', label: 'Batería LiFePO4', w: 350, h: 200, color: '#dc2626', icon: '⚡', layer: 'electrical' },
  { type: 'fusiblera', label: 'Fusiblera', w: 200, h: 100, color: '#f59e0b', icon: '🔌', layer: 'electrical' },
  { type: 'inversor', label: 'Inversor 12V→220V', w: 250, h: 150, color: '#f97316', icon: '🔄', layer: 'electrical' },
  { type: 'regulador_solar', label: 'Regulador solar', w: 200, h: 120, color: '#16a34a', icon: '☀️', layer: 'electrical' },
  { type: 'enchufe_220', label: 'Enchufe 220V', w: 80, h: 80, color: '#3b82f6', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_usb', label: 'Toma USB', w: 80, h: 60, color: '#6366f1', icon: '🔌', layer: 'electrical' },
  { type: 'enchufe_12v', label: 'Toma 12V', w: 80, h: 80, color: '#0ea5e9', icon: '🔌', layer: 'electrical' },
  { type: 'luz_led', label: 'Tira LED', w: 400, h: 40, color: '#eab308', icon: '💡', layer: 'electrical' },
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
  { type: 'tuberia_fria', label: 'Tubería fría (tramo)', w: 400, h: 30, color: '#3b82f6', icon: '〰️', layer: 'water' },
  { type: 'tuberia_caliente', label: 'Tubería caliente (tramo)', w: 400, h: 30, color: '#ef4444', icon: '〰️', layer: 'water' },
]

const LAYER_CONFIG: Record<DiagramLayer, { label: string; icon: string; color: string; palette: PaletteItem[] }> = {
  furniture:   { label: 'Muebles', icon: '🪑', color: '#8b5cf6', palette: FURNITURE_PALETTE },
  electrical:  { label: 'Eléctrico', icon: '⚡', color: '#f59e0b', palette: ELECTRICAL_PALETTE },
  water:       { label: 'Agua', icon: '💧', color: '#3b82f6', palette: WATER_PALETTE },
}

// ── SVG Floor Plan ────────────────────────────────────────────────
function VanFloorPlanSVG() {
  const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = FLOOR
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

      {/* Cabin reference (seats) */}
      <rect x={0} y={wt + 100} width={cd - wt} height={w - 200}
        fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="3" rx={20} />
      <text x={(cd - wt) / 2} y={wt + w / 2} textAnchor="middle" dominantBaseline="middle"
        fontSize="60" fill="#94a3b8" fontFamily="Arial">Cabina</text>

      {/* Cabin separation line */}
      <line x1={cd} y1={0} x2={cd} y2={w + wt * 2}
        stroke="#94a3b8" strokeWidth="4" strokeDasharray="20,10" />

      {/* Rear doors */}
      <line x1={totalL - 20} y1={wt + w / 2 - 10} x2={totalL - 20} y2={wt + w / 2 + 10}
        stroke="#cbd5e1" strokeWidth="3" />

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

      {/* Dimensions */}
      <text x={cd + l / 2} y={w + wt * 2 + 80} textAnchor="middle" fontSize="70"
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

// ── Main Component ────────────────────────────────────────────────
export default function VanInteriorDesign() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId?: string }>()

  const [items, setItems] = useState<InteriorItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<DiagramLayer>('furniture')
  const [visibleLayers, setVisibleLayers] = useState<Set<DiagramLayer>>(new Set(['furniture', 'electrical', 'water']))
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  // Load saved design
  useEffect(() => {
    if (!projectId) return
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
  }, [projectId])

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
        prev.map(it =>
          it.id === dragging.id
            ? { ...it, x: snap(pt.x - dragging.offsetX), y: snap(pt.y - dragging.offsetY) }
            : it,
        ),
      )
    }, [dragging, svgPoint],
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  const addItem = (tpl: PaletteItem) => {
    const { length: l, width: w, wallThickness: wt, cabinDepth: cd } = FLOOR
    const item: InteriorItem = {
      id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      layer: tpl.layer,
      type: tpl.type,
      label: tpl.label,
      w: tpl.w,
      h: tpl.h,
      x: snap(cd + l / 2 - tpl.w / 2),
      y: snap(wt + w / 2 - tpl.h / 2),
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
      prev.map(it =>
        it.id === selected
          ? { ...it, rotation: (it.rotation + 90) % 360, w: it.h, h: it.w }
          : it,
      ),
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
    setItems(prev => [...prev, dup])
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
    if (!projectId) {
      toast.error('Guarda primero el proyecto para vincular el diseño interior')
      return
    }
    setSaving(true)
    try {
      await supabase
        .from('interior_designs')
        .upsert({ project_id: projectId, items, updated_at: new Date().toISOString() })
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
  const totalL = FLOOR.length + FLOOR.cabinDepth
  const totalW = FLOOR.width + FLOOR.wallThickness * 2
  const pad = 150

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/design')}
            className="text-sm text-blue-600 hover:underline">← Diseño</button>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              🏠 Diseño Interior
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribución de muebles, diagrama eléctrico y diagrama de agua
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {projectId && (
            <button onClick={save} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all">
              {saving ? '⏳ Guardando…' : '💾 Guardar'}
            </button>
          )}
        </div>
      </div>

      {/* Layer tabs + visibility toggles */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Active layer (determines palette) */}
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

        {/* Visibility toggles */}
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
            viewBox={`${-pad} ${-pad} ${totalL + pad * 2 + FLOOR.wallThickness} ${totalW + pad * 2}`}
            className="bg-white rounded-xl cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={() => setSelected(null)}
          >
            <VanFloorPlanSVG />

            {/* Placed items */}
            {visibleItems.map(item => {
              const isSelected = item.id === selected
              const opacity = item.layer === activeLayer ? 1 : 0.4
              return (
                <g key={item.id}
                  onMouseDown={e => handleMouseDown(e, item.id)}
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
                  {/* Icon + label */}
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
                  {/* Dimensions */}
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
              {items.filter(i => i.layer === 'furniture').length} muebles ·
              {items.filter(i => i.layer === 'electrical').length} eléctricos ·
              {items.filter(i => i.layer === 'water').length} agua
            </span>
            <span>Cuadrícula: 50 mm</span>
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Selected item properties */}
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
                    onChange={e => setItems(prev => prev.map(it => it.id === selected ? { ...it, x: +e.target.value } : it))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Y (mm)</label>
                  <input type="number" value={selectedItem.y} step={50}
                    onChange={e => setItems(prev => prev.map(it => it.id === selected ? { ...it, y: +e.target.value } : it))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Ancho (mm)</label>
                  <input type="number" value={selectedItem.w} step={50}
                    onChange={e => setItems(prev => prev.map(it => it.id === selected ? { ...it, w: +e.target.value } : it))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-slate-400 block mb-0.5">Alto (mm)</label>
                  <input type="number" value={selectedItem.h} step={50}
                    onChange={e => setItems(prev => prev.map(it => it.id === selected ? { ...it, h: +e.target.value } : it))}
                    className="w-full border rounded-lg px-2 py-1.5 text-xs" />
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
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              {layerCfg.icon} {layerCfg.label}
              <span className="text-[10px] text-slate-400 ml-auto font-normal">
                {layerCfg.palette.length} elementos
              </span>
            </h3>
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {layerCfg.palette.map(tpl => (
                <button key={tpl.type} onClick={() => addItem(tpl)}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all text-xs">
                  <span className="text-base flex-shrink-0">{tpl.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-700 truncate">{tpl.label}</p>
                    <p className="text-[10px] text-slate-400">{tpl.w}×{tpl.h} mm</p>
                  </div>
                  <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tpl.color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 text-xs">💡 Instrucciones</p>
            <p>• Selecciona la capa (Muebles / Eléctrico / Agua)</p>
            <p>• Añade elementos desde la paleta</p>
            <p>• Arrastra para posicionar en la planta de la furgo</p>
            <p>• Activa/desactiva capas para ver cada diagrama</p>
            <p>• Los elementos de otras capas se atenúan</p>
          </div>
        </div>
      </div>
    </div>
  )
}
