import { useState, useMemo, useCallback, useEffect } from 'react'
import { InteractivePiece, ModuleDimensions, Piece, PlacedPiece, ModuleType, CatalogMaterial } from '../types/furniture.types'
import { DEFAULT_THICKNESS, BACK_THICKNESS, MATERIALS, MODULE_TYPES, PIECE_COLORS, DEFAULT_CATALOG_MATERIALS } from '../constants/furniture.constants'
import { optimizeCutList } from '../utils/geometry'
import { FurnitureFrontView } from './FurnitureFrontView'
import { FurnitureIsoView } from './FurnitureIsoView'
import { FurnitureOptimizerView } from './FurnitureOptimizerView'
import { FurnitureStickersView } from './FurnitureStickersView'
import { FurnitureDesign } from '../types/furniture.types'
import { MaterialCatalogService } from '../services/materialCatalogService'
import toast from 'react-hot-toast'

type Tab = 'diseno' | 'optimizado' | 'pegatinas'

interface FurniturePieceEditorProps {
  itemName: string
  itemSku?: string
  savedDesign?: FurnitureDesign | null
  projectInfo?: string
  onSave: (module: ModuleDimensions, pieces: InteractivePiece[], cuts: PlacedPiece[]) => Promise<void>
  onClose: () => void
}

// ─── Default module: 5 structural panels + 2 doors ──────────────────────────

function buildInitialPieces(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerH = h - t * 2
  const halfW  = Math.floor(innerW / 2)

  return [
    // 5 structural panels
    { id: 'shell-left',   name: 'Lateral Izq',  type: 'estructura', x: 0,     y: 0, z: 0, w: t,     h, d },
    { id: 'shell-right',  name: 'Lateral Der',  type: 'estructura', x: w - t, y: 0, z: 0, w: t,     h, d },
    { id: 'shell-top',    name: 'Tapa Superior', type: 'estructura', x: t,     y: h - t, z: 0, w: innerW, h: t, d },
    { id: 'shell-bottom', name: 'Base Inferior', type: 'estructura', x: t,     y: 0, z: 0, w: innerW, h: t, d },
    { id: 'shell-back',   name: 'Trasera',       type: 'trasera',    x: t,     y: t, z: -BACK_THICKNESS, w: innerW, h: innerH, d: BACK_THICKNESS },
    // 2 doors (split in half)
    { id: 'door-left',  name: 'Puerta Izq',  type: 'frontal', x: t,          y: t, z: d, w: halfW, h: innerH, d: 16 },
    { id: 'door-right', name: 'Puerta Der',  type: 'frontal', x: t + halfW,  y: t, z: d, w: innerW - halfW, h: innerH, d: 16 },
  ]
}

// ─── Presets ─────────────────────────────────────────────────────────────────

type Preset = { label: string; icon: string; action: (m: ModuleDimensions, pieces: InteractivePiece[]) => InteractivePiece[] }

const PRESETS: Preset[] = [
  {
    label: 'Balda',
    icon: '━',
    action: (m, pieces) => {
      const t = m.thickness
      const innerW = m.width - t * 2
      const shelves = pieces.filter(p => p.name.startsWith('Balda')).length
      const y = Math.round(m.height * 0.4 + shelves * 80)
      return [...pieces, {
        id: `shelf-${Date.now()}`, name: `Balda ${shelves + 1}`, type: 'estructura' as const,
        x: t, y, z: 0, w: innerW, h: t, d: m.depth,
      }]
    },
  },
  {
    label: 'Divisor vertical',
    icon: '┃',
    action: (m, pieces) => {
      const t = m.thickness
      const innerH = m.height - t * 2
      const divs = pieces.filter(p => p.name.startsWith('Divisor')).length
      const x = Math.round(m.width * 0.5 + divs * 60)
      return [...pieces, {
        id: `divider-${Date.now()}`, name: `Divisor ${divs + 1}`, type: 'estructura' as const,
        x, y: t, z: 0, w: t, h: innerH, d: m.depth,
      }]
    },
  },
  {
    label: 'Cajón',
    icon: '🗂️',
    action: (m, pieces) => {
      const t = m.thickness
      const innerW = m.width - t * 2
      const drawers = pieces.filter(p => p.name.startsWith('Frente Cajón')).length
      const drawerH = 150
      const y = t + drawers * (drawerH + 10)
      return [
        ...pieces,
        // Drawer front
        { id: `drawer-front-${Date.now()}`, name: `Frente Cajón ${drawers + 1}`, type: 'frontal' as const,
          x: t, y, z: m.depth, w: innerW, h: drawerH, d: 16 },
        // Drawer bottom
        { id: `drawer-bottom-${Date.now()}`, name: `Fondo Cajón ${drawers + 1}`, type: 'estructura' as const,
          x: t + 16, y, z: 16, w: innerW - 32, h: t, d: m.depth - 32 },
      ]
    },
  },
  {
    label: 'Puerta',
    icon: '🚪',
    action: (m, pieces) => {
      const t = m.thickness
      const innerW = m.width - t * 2
      const innerH = m.height - t * 2
      return [...pieces, {
        id: `door-${Date.now()}`, name: 'Puerta', type: 'frontal' as const,
        x: t, y: t, z: m.depth, w: innerW, h: innerH, d: 16,
      }]
    },
  },
]

// ═════════════════════════════════════════════════════════════════════════════

export function FurniturePieceEditor({
  itemName, itemSku, savedDesign, projectInfo, onSave, onClose,
}: FurniturePieceEditorProps) {
  const [tab, setTab]               = useState<Tab>('diseno')
  const [saving, setSaving]         = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [module, setModule] = useState<ModuleDimensions>(() =>
    savedDesign?.module ?? {
      name:           itemName,
      type:           'armario' as ModuleType,
      width:          800,
      height:         700,
      depth:          450,
      thickness:      DEFAULT_THICKNESS,
      materialPrice:  MATERIALS[0].price,
    }
  )

  const [pieces, setPieces] = useState<InteractivePiece[]>(() =>
    savedDesign?.pieces ?? buildInitialPieces(module)
  )

  // ─── Material catalog ───────────────────────────────────────────────────────

  const [catalogMaterials, setCatalogMaterials] = useState<CatalogMaterial[]>(DEFAULT_CATALOG_MATERIALS)

  useEffect(() => {
    MaterialCatalogService.getAll().then(setCatalogMaterials).catch(() => {})
  }, [])

  const getMaterial = useCallback(
    (id?: string) => catalogMaterials.find(m => m.id === id) ?? null,
    [catalogMaterials]
  )

  // ─── Module dimension change ────────────────────────────────────────────────

  const handleModuleChange = useCallback(
    (field: keyof ModuleDimensions, value: string | number) => {
      setModule(prev => ({ ...prev, [field]: typeof value === 'string' ? value : Number(value) }))
    }, []
  )

  const resetModule = useCallback(() => {
    setPieces(buildInitialPieces(module))
    setSelectedId(null)
    toast.success('Estructura reiniciada')
  }, [module])

  // ─── Piece operations ───────────────────────────────────────────────────────

  const addPiece = (type: 'frontal' | 'estructura') => {
    const id = `${type}-${Date.now()}`
    setPieces(prev => [
      ...prev,
      {
        id, name: type === 'frontal' ? 'Nuevo Frontal' : 'Nuevo Tablero', type,
        x: module.thickness + 20, y: module.thickness + 20,
        z: type === 'frontal' ? module.depth : 0,
        w: 200, h: 200, d: type === 'frontal' ? 16 : module.thickness,
      },
    ])
    setSelectedId(id)
  }

  const deletePiece = () => {
    if (!selectedId) return
    setPieces(prev => prev.filter(p => p.id !== selectedId))
    setSelectedId(null)
  }

  const duplicatePiece = () => {
    if (!selectedPiece) return
    const newId = `${selectedPiece.type}-${Date.now()}`
    const clone = { ...selectedPiece, id: newId, name: `${selectedPiece.name} (copia)`, x: selectedPiece.x + 20, y: selectedPiece.y + 20 }
    setPieces(prev => [...prev, clone])
    setSelectedId(newId)
    toast.success('Pieza duplicada')
  }

  const mirrorPiece = () => {
    if (!selectedPiece) return
    const mirrored = module.width - selectedPiece.x - selectedPiece.w
    updatePiece(selectedPiece.id, { x: mirrored, name: `${selectedPiece.name} (espejo)` })
    toast.success('Pieza espejada')
  }

  const updatePiece = (id: string, updates: Partial<InteractivePiece>) =>
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

  const selectedPiece = useMemo(
    () => pieces.find(p => p.id === selectedId) ?? null,
    [selectedId, pieces]
  )

  const applyPreset = (preset: Preset) => {
    setPieces(prev => preset.action(module, prev))
    toast.success(`${preset.label} añadido`)
  }

  // ─── Cut-list ───────────────────────────────────────────────────────────────

  const cutListPieces = useMemo((): Piece[] =>
    pieces
      .filter(p => p.type !== 'trasera')
      .map(p => ({
        ref:  p.name,
        w:    p.type === 'estructura' && p.w < p.d ? p.d : p.w,
        h:    p.h,
        type: p.type,
        id:   p.id,
      })),
    [pieces]
  )

  const optimized = useMemo(() => optimizeCutList(cutListPieces), [cutListPieces])

  const handleSave = async () => {
    if (pieces.length < 2) { toast.error('Diseña al menos 2 piezas antes de guardar'); return }
    setSaving(true)
    try {
      await onSave(module, pieces, optimized)
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const structural = pieces.filter(p => p.type === 'estructura').length
    const frontal    = pieces.filter(p => p.type === 'frontal').length
    let totalArea = 0
    let cost = 0
    for (const p of pieces) {
      const area = (p.w / 1000) * (p.h / 1000) // m²
      totalArea += area
      const mat = getMaterial(p.materialId)
      cost += area * (mat ? mat.price_per_m2 : module.materialPrice)
    }
    return { structural, frontal, totalArea: totalArea.toFixed(2), cost: cost.toFixed(2) }
  }, [pieces, module.materialPrice, getMaterial])

  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center">
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900">{itemName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {itemSku && <span className="text-[10px] font-mono text-slate-400">{itemSku}</span>}
              {projectInfo && <span className="text-[10px] text-slate-400">· {projectInfo}</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { key: 'diseno' as Tab, label: '✏️ Diseño' },
            { key: 'optimizado' as Tab, label: '📋 Despiece' },
            { key: 'pegatinas' as Tab, label: '🏷️ Etiquetas' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                tab === t.key ? 'bg-white shadow text-gray-900' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase rounded-xl shadow hover:bg-blue-700 disabled:opacity-50 transition-all">
          {saving ? 'Guardando…' : '💾 Guardar'}
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* ══ DESIGN TAB ══════════════════════════════════════════ */}
        {tab === 'diseno' && (
          <div className="flex h-full">

            {/* ── LEFT SIDEBAR ──────────────────────────────────── */}
            <aside className="w-72 min-w-[280px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">

              {/* Module panel */}
              <div className="p-4 border-b border-slate-100">
              <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-3">📐 Módulo</h3>

                <div className="space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre</label>
                    <input className="w-full mt-0.5 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={module.name} onChange={e => handleModuleChange('name', e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Tipo</label>
                      <select className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        value={module.type} onChange={e => handleModuleChange('type', e.target.value)}>
                        {MODULE_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Material</label>
                      <select className="w-full mt-0.5 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        value={module.materialPrice} onChange={e => handleModuleChange('materialPrice', e.target.value)}>
                        {MATERIALS.map(m => <option key={m.name} value={m.price}>{m.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Ancho', key: 'width' },
                      { label: 'Alto',  key: 'height' },
                      { label: 'Fondo', key: 'depth' },
                      { label: 'Grosor', key: 'thickness' },
                    ].map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-[8px] font-bold text-slate-400 uppercase block">{label}</label>
                        <input type="number" min={10}
                          className="w-full mt-0.5 px-1.5 py-1 border border-slate-200 rounded-md text-xs font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                          value={(module as any)[key]}
                          onChange={e => handleModuleChange(key as keyof ModuleDimensions, e.target.value)} />
                      </div>
                    ))}
                  </div>

                  <button onClick={resetModule}
                    className="w-full py-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-black uppercase rounded-lg hover:bg-slate-100 transition-all">
                    ↺ Reiniciar módulo
                  </button>
                </div>
              </div>

              {/* Quick-add presets */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-3">⚡ Añadir rápido</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)}
                      className="py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                      {p.icon} {p.label}
                    </button>
                  ))}
                  <button onClick={() => addPiece('estructura')}
                    className="py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                    + Tablero
                  </button>
                  <button onClick={() => addPiece('frontal')}
                    className="py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all">
                    + Frontal
                  </button>
                </div>
              </div>

              {/* Selected piece editor */}
              {selectedPiece && (
                <div className="p-4 border-b border-slate-100 bg-blue-50/50">
                  <h3 className="text-[11px] font-bold uppercase text-blue-600 tracking-wide mb-3">
                    ✏️ {selectedPiece.name}
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre</label>
                      <input className="w-full mt-0.5 px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedPiece.name}
                        onChange={e => updatePiece(selectedPiece.id, { name: e.target.value })} />
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'X', key: 'x' }, { label: 'Y', key: 'y' }, { label: 'Z', key: 'z' },
                        { label: 'Ancho', key: 'w' }, { label: 'Alto', key: 'h' }, { label: 'Fondo', key: 'd' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <label className="text-[8px] font-bold text-slate-400 uppercase block">{label}</label>
                          <input type="number"
                            className="w-full mt-0.5 px-1.5 py-1 border border-blue-200 rounded-md text-[11px] font-mono text-center bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                            value={(selectedPiece as any)[key]}
                            onChange={e => updatePiece(selectedPiece.id, { [key]: Number(e.target.value) })} />
                        </div>
                      ))}
                    </div>

                    {/* Material assignment */}
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Material</label>
                      <select
                        className="w-full mt-0.5 px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={selectedPiece.materialId ?? ''}
                        onChange={e => updatePiece(selectedPiece.id, { materialId: e.target.value || undefined })}
                      >
                        <option value="">— Sin asignar —</option>
                        {catalogMaterials.filter(m => m.in_stock).map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.price_per_m2}€/m²)</option>
                        ))}
                      </select>
                      {selectedPiece.materialId && (() => {
                        const mat = getMaterial(selectedPiece.materialId)
                        if (!mat) return null
                        return (
                          <div className="flex items-center gap-2 mt-1.5 px-2 py-1.5 bg-white/80 rounded-lg border border-blue-100">
                            <div className="w-5 h-5 rounded border border-slate-200" style={{ backgroundColor: mat.color_hex }} />
                            <span className="text-[9px] font-bold text-slate-600">{mat.texture_label}</span>
                            <span className="text-[8px] text-slate-400">{mat.thickness}mm</span>
                            <span className="text-[8px] font-bold text-amber-600 ml-auto">{mat.price_per_m2}€/m²</span>
                          </div>
                        )
                      })()}
                    </div>

                    <div className="flex gap-1.5">
                      <button onClick={duplicatePiece}
                        className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-[9px] font-bold rounded-lg hover:bg-blue-50 transition-all">
                        📋 Duplicar
                      </button>
                      <button onClick={mirrorPiece}
                        className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 text-[9px] font-bold rounded-lg hover:bg-blue-50 transition-all">
                        🪞 Espejar
                      </button>
                      <button onClick={deletePiece}
                        className="py-1.5 px-3 bg-red-50 border border-red-200 text-red-500 text-[9px] font-bold rounded-lg hover:bg-red-100 transition-all">
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pieces list */}
              <div className="p-4">
                <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">
                  🧩 Piezas ({pieces.length})
                </h3>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {pieces.map(p => {
                    const typeColors = PIECE_COLORS[p.type]
                    const mat = getMaterial(p.materialId)
                    const dotColor = mat ? mat.color_hex : (selectedId === p.id ? typeColors.selected : typeColors.fill)
                    return (
                      <button key={p.id}
                        onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                          selectedId === p.id
                            ? 'bg-blue-100 border border-blue-300'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}>
                        <span className="w-3 h-3 rounded flex-shrink-0 border border-slate-200"
                          style={{ backgroundColor: dotColor }} />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-slate-700 truncate block">{p.name}</span>
                          {mat && <span className="text-[8px] text-slate-400 truncate block">{mat.texture_label}</span>}
                        </div>
                        <span className="text-[8px] font-mono text-slate-400 flex-shrink-0">{p.w}×{p.h}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <div className="text-lg font-black text-slate-800">{stats.structural}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Estructura</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-black text-blue-600">{stats.frontal}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Frontales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black text-slate-700">{stats.totalArea} m²</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Superficie</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-black text-amber-600">{stats.cost} €</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Material</div>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── CANVAS AREA ───────────────────────────────────── */}
            <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto min-w-0">
              <div className="grid lg:grid-cols-2 gap-4 flex-1">
                <FurnitureFrontView
                  pieces={pieces}
                  onUpdatePieces={setPieces}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  catalogMaterials={catalogMaterials}
                />
                <FurnitureIsoView
                  module={module}
                  pieces={pieces}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  catalogMaterials={catalogMaterials}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══ OPTIMIZATION TAB ════════════════════════════════════ */}
        {tab === 'optimizado' && (
          <div className="p-6 max-w-4xl mx-auto">
            <FurnitureOptimizerView placements={optimized} />
          </div>
        )}

        {/* ══ STICKERS TAB ════════════════════════════════════════ */}
        {tab === 'pegatinas' && (
          <div className="p-6 max-w-5xl mx-auto">
            <FurnitureStickersView
              pieces={cutListPieces}
              moduleName={module.name}
              projectInfo={projectInfo}
            />
          </div>
        )}
      </div>
    </div>
  )
}
