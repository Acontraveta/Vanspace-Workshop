import { useState, useMemo, useCallback, useEffect } from 'react'
import { InteractivePiece, ModuleDimensions, Piece, PlacedPiece, ModuleType } from '../types/furniture.types'
import { DEFAULT_THICKNESS, MATERIALS, MODULE_TYPES } from '../constants/furniture.constants'
import { optimizeCutList } from '../utils/geometry'
import { FurnitureFrontView } from './FurnitureFrontView'
import { FurnitureIsoView } from './FurnitureIsoView'
import { FurnitureOptimizerView } from './FurnitureOptimizerView'
import { FurnitureStickersView } from './FurnitureStickersView'
import { FurnitureDesign } from '../types/furniture.types'
import toast from 'react-hot-toast'

type Tab = 'diseno' | 'optimizado' | 'pegatinas'

interface FurniturePieceEditorProps {
  /** Name of the furniture item (from quote) */
  itemName: string
  itemSku?: string
  /** Pre-loaded design (if user picks "use saved") */
  savedDesign?: FurnitureDesign | null
  projectInfo?: string  // "PRJ-001 · Mario García"
  onSave: (module: ModuleDimensions, pieces: InteractivePiece[], cuts: PlacedPiece[]) => Promise<void>
  onClose: () => void
}

function buildInitialPieces(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  return [
    { id: 'shell-left',   name: 'Lateral Izq', type: 'estructura', x: 0,     y: 0, z: 0, w: t,         h, d },
    { id: 'shell-right',  name: 'Lateral Der', type: 'estructura', x: w - t, y: 0, z: 0, w: t,         h, d },
    { id: 'shell-top',    name: 'Tapa Sup',    type: 'estructura', x: t,     y: h - t, z: 0, w: w - t * 2, h: t, d },
    { id: 'shell-bottom', name: 'Base Inf',    type: 'estructura', x: t,     y: 0, z: 0, w: w - t * 2, h: t, d },
    { id: 'shell-back',   name: 'Trasera',     type: 'trasera',    x: t,     y: t, z: -4, w: w - t * 2, h: h - t * 2, d: 4 },
    {
      id: `frontal-${Date.now()}`, name: 'Puerta Principal', type: 'frontal',
      x: t, y: t, z: d, w: w - t * 2, h: h - t * 2, d: 16,
    },
  ]
}

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

  // Reset pieces whenever key module dimensions change
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

  const addPiece = (type: 'frontal' | 'estructura') => {
    const id = `${type}-${Date.now()}`
    setPieces(prev => [
      ...prev,
      {
        id, name: type === 'frontal' ? 'Nuevo Frontal' : 'Nuevo Tablero', type,
        x: 50, y: 50, z: type === 'frontal' ? module.depth : 0,
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

  const updatePiece = (id: string, updates: Partial<InteractivePiece>) =>
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

  const selectedPiece = useMemo(
    () => pieces.find(p => p.id === selectedId) ?? null,
    [selectedId, pieces]
  )

  // Cut-list pieces (structural only)
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
      toast.success('Diseño guardado')
    } catch (err: any) {
      toast.error('Error guardando: ' + (err.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-base font-black uppercase tracking-tight text-slate-900">{itemName}</h2>
          {itemSku && <span className="text-[10px] font-mono text-slate-400">{itemSku}</span>}
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          {(['diseno', 'optimizado', 'pegatinas'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                tab === t ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'diseno' ? 'Diseño' : t === 'optimizado' ? 'Optimización' : 'Pegatinas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all">
            {saving ? 'Guardando…' : '💾 Guardar diseño'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black uppercase rounded-xl hover:bg-slate-200 transition-all">
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50">

        {/* ── DESIGN TAB ─────────────────────────────────────────────── */}
        {tab === 'diseno' && (
          <div className="grid lg:grid-cols-12 gap-6">

            {/* Left panel */}
            <aside className="lg:col-span-3 space-y-4">

              {/* Module dimensions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Módulo</h3>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Nombre</label>
                  <input className="w-full mt-0.5 px-2 py-1.5 border rounded text-sm"
                    value={module.name} onChange={e => handleModuleChange('name', e.target.value)} />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Tipo</label>
                  <select className="w-full mt-0.5 px-2 py-1.5 border rounded text-sm"
                    value={module.type} onChange={e => handleModuleChange('type', e.target.value)}>
                    {MODULE_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Material</label>
                  <select className="w-full mt-0.5 px-2 py-1.5 border rounded text-sm"
                    value={module.materialPrice}
                    onChange={e => handleModuleChange('materialPrice', e.target.value)}>
                    {MATERIALS.map(m => <option key={m.name} value={m.price}>{m.name} — {m.price}€/m²</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Ancho (mm)',   key: 'width'     },
                    { label: 'Alto (mm)',    key: 'height'    },
                    { label: 'Fondo (mm)',   key: 'depth'     },
                    { label: 'Grosor (mm)',  key: 'thickness' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[8px] font-bold text-slate-400 uppercase">{label}</label>
                      <input type="number" min={10}
                        className="w-full mt-0.5 px-2 py-1 border rounded text-sm font-mono"
                        value={(module as any)[key]}
                        onChange={e => handleModuleChange(key as keyof ModuleDimensions, e.target.value)} />
                    </div>
                  ))}
                </div>

                <button onClick={resetModule}
                  className="w-full py-2 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-black uppercase rounded-lg hover:bg-slate-100 transition-all">
                  ↺ Reiniciar estructura
                </button>
              </div>

              {/* Tools */}
              <div className="bg-slate-900 rounded-2xl p-5 space-y-3">
                <h3 className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Herramientas</h3>
                <button onClick={() => addPiece('frontal')}
                  className="w-full py-2.5 bg-blue-600 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-900/40 hover:scale-105 transition-transform">
                  + Nuevo Frontal
                </button>
                <button onClick={() => addPiece('estructura')}
                  className="w-full py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all">
                  + Nuevo Tablero
                </button>

                {selectedPiece && (
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">
                      Editando: {selectedPiece.name}
                    </p>
                    <div>
                      <label className="text-[8px] font-bold text-slate-500 uppercase">Nombre</label>
                      <input className="w-full mt-0.5 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        value={selectedPiece.name}
                        onChange={e => updatePiece(selectedPiece.id, { name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {['x','y','z','w','h','d'].map(k => (
                        <div key={k}>
                          <label className="text-[8px] font-bold text-slate-500 uppercase">{k}</label>
                          <input type="number"
                            className="w-full mt-0.5 px-1.5 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-white"
                            value={(selectedPiece as any)[k]}
                            onChange={e => updatePiece(selectedPiece.id, { [k]: Number(e.target.value) })} />
                        </div>
                      ))}
                    </div>
                    <button onClick={deletePiece}
                      className="w-full py-1.5 bg-red-500/10 border border-red-500/30 text-red-500 rounded text-[9px] font-black uppercase hover:bg-red-500/20 transition-all">
                      🗑 Eliminar pieza
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Canvases */}
            <div className="lg:col-span-9 grid md:grid-cols-2 gap-6">
              <FurnitureFrontView
                pieces={pieces}
                onUpdatePieces={setPieces}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <FurnitureIsoView
                module={module}
                pieces={pieces}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          </div>
        )}

        {tab === 'optimizado' && <FurnitureOptimizerView placements={optimized} />}

        {tab === 'pegatinas' && (
          <FurnitureStickersView
            pieces={cutListPieces}
            moduleName={module.name}
            projectInfo={projectInfo}
          />
        )}
      </div>
    </div>
  )
}
