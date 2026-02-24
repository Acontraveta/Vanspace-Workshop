import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { InteractivePiece, ModuleDimensions, Piece, PlacedPiece, ModuleType, CatalogMaterial } from '../types/furniture.types'
import { DEFAULT_THICKNESS, BACK_THICKNESS, MATERIALS, MODULE_TYPES, PIECE_COLORS, DEFAULT_CATALOG_MATERIALS } from '../constants/furniture.constants'
import { optimizeCutList, BoardDimsMap } from '../utils/geometry'
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
  isProduction?: boolean      // true = deduct stock on save; false = library only
  onSave: (module: ModuleDimensions, pieces: InteractivePiece[], cuts: PlacedPiece[]) => Promise<void>
  onClose: () => void
}

// ─── Type-specific piece builders ───────────────────────────────────────────

/** Generic shell: laterals + top + bottom + back */
function shellPieces(w: number, h: number, d: number, t: number): InteractivePiece[] {
  const innerW = w - t * 2
  const innerH = h - t * 2
  return [
    { id: 'shell-left',   name: 'Lateral Izq',   type: 'estructura', x: 0,     y: 0,     z: 0, w: t,      h,    d },
    { id: 'shell-right',  name: 'Lateral Der',   type: 'estructura', x: w - t, y: 0,     z: 0, w: t,      h,    d },
    { id: 'shell-top',    name: 'Tapa Superior',  type: 'estructura', x: t,     y: h - t, z: 0, w: innerW, h: t, d },
    { id: 'shell-bottom', name: 'Base Inferior',  type: 'estructura', x: t,     y: 0,     z: 0, w: innerW, h: t, d },
    { id: 'shell-back',   name: 'Trasera',        type: 'trasera',    x: t,     y: t,     z: -BACK_THICKNESS, w: innerW, h: innerH, d: BACK_THICKNESS },
  ]
}

/**
 * Armario (800×2100×550): wardrobe with shelf + hanging space + 2 doors
 * — Laterals full height, top + bottom, back
 * — 1 balda at ~60% height separating hanging zone / upper storage
 * — 2 equal doors
 */
function buildArmario(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerH = h - t * 2
  const halfW  = Math.floor(innerW / 2)
  const shelfY = Math.round(h * 0.6) // shelf at 60% height

  return [
    ...shellPieces(w, h, d, t),
    // Balda intermedia (divides hanging zone below / storage above)
    { id: 'shelf-1', name: 'Balda intermedia', type: 'estructura',
      x: t, y: shelfY, z: 0, w: innerW, h: t, d },
    // 2 doors
    { id: 'door-left',  name: 'Puerta Izq',  type: 'frontal',
      x: t, y: t, z: d, w: halfW, h: innerH, d: 16 },
    { id: 'door-right', name: 'Puerta Der',  type: 'frontal',
      x: t + halfW, y: t, z: d, w: innerW - halfW, h: innerH, d: 16 },
  ]
}

/**
 * Cajonera (600×750×450): drawer unit with 4 drawer fronts + bottoms
 * — Laterals, top, bottom, back
 * — 3 horizontal rails between drawers
 * — 4 drawer fronts with matching drawer bottoms
 */
function buildCajonera(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerH = h - t * 2
  const numDrawers = 4
  const gap = 3 // mm gap between drawers
  const drawerH = Math.floor((innerH - gap * (numDrawers - 1)) / numDrawers)
  const drawerInnerW = innerW - 32 // 16mm side clearance each side for guides
  const drawerDepthInner = d - 32  // 16mm front + 16mm back clearance

  const pieces: InteractivePiece[] = [...shellPieces(w, h, d, t)]

  for (let i = 0; i < numDrawers; i++) {
    const y = t + i * (drawerH + gap)
    pieces.push(
      // Drawer front
      { id: `drawer-front-${i}`, name: `Frente Cajón ${i + 1}`, type: 'frontal',
        x: t, y, z: d, w: innerW, h: drawerH, d: 16 },
      // Drawer bottom
      { id: `drawer-bottom-${i}`, name: `Fondo Cajón ${i + 1}`, type: 'estructura',
        x: t + 16, y, z: 16, w: drawerInnerW, h: t, d: drawerDepthInner },
    )
  }

  return pieces
}

/**
 * Módulo cocina (600×720×580): kitchen base unit
 * — Laterals full height, bottom panel, back panel (top uncovered for worktop)
 * — Zócalo (kickboard) cutback: bottom raised 100mm, no top panel
 * — 1 internal shelf at ~45% height
 * — 1 door (full width)
 */
function buildCocina(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const kickH = 100 // kickboard height
  const innerH = h - t - kickH // no top panel, bottom at kickH

  return [
    // Laterals (full height)
    { id: 'shell-left',   name: 'Lateral Izq',   type: 'estructura', x: 0,     y: 0, z: 0, w: t, h, d },
    { id: 'shell-right',  name: 'Lateral Der',   type: 'estructura', x: w - t, y: 0, z: 0, w: t, h, d },
    // Bottom raised for kickboard
    { id: 'shell-bottom', name: 'Base (sobre zócalo)', type: 'estructura',
      x: t, y: kickH, z: 0, w: innerW, h: t, d },
    // Back panel (from bottom to top)
    { id: 'shell-back',   name: 'Trasera', type: 'trasera',
      x: t, y: kickH + t, z: -BACK_THICKNESS, w: innerW, h: innerH, d: BACK_THICKNESS },
    // Kickboard (zócalo) — narrow front strip
    { id: 'kickboard', name: 'Zócalo frontal', type: 'estructura',
      x: t + 30, y: 0, z: d - t, w: innerW - 60, h: kickH, d: t },
    // Internal shelf at ~45% usable height
    { id: 'shelf-1', name: 'Balda interna', type: 'estructura',
      x: t, y: kickH + Math.round(innerH * 0.45), z: 0, w: innerW, h: t, d: d - 20 },
    // Single door
    { id: 'door-1', name: 'Puerta', type: 'frontal',
      x: t, y: kickH + t, z: d, w: innerW, h: innerH, d: 16 },
  ]
}

/**
 * Arcón (1000×500×450): storage chest / bench with lift-up lid
 * — 4 structural panels (front, back, 2 laterals) + bottom
 * — Tapa (lid) as frontal type (opens upward)
 * — Internal divider in the middle
 */
function buildArcon(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerD = d - t * 2
  const innerH = h - t * 2

  return [
    // 2 laterals
    { id: 'shell-left',   name: 'Lateral Izq',   type: 'estructura', x: 0,     y: 0, z: 0, w: t, h, d },
    { id: 'shell-right',  name: 'Lateral Der',   type: 'estructura', x: w - t, y: 0, z: 0, w: t, h, d },
    // Front & back panels (between laterals)
    { id: 'shell-front',  name: 'Frontal',        type: 'estructura',
      x: t, y: 0, z: d - t, w: innerW, h, d: t },
    { id: 'shell-back',   name: 'Trasero',        type: 'estructura',
      x: t, y: 0, z: 0, w: innerW, h, d: t },
    // Bottom
    { id: 'shell-bottom', name: 'Base Inferior',  type: 'estructura',
      x: t, y: 0, z: t, w: innerW, h: t, d: innerD },
    // Lid (frontal — opens upward)
    { id: 'lid', name: 'Tapa / Asiento', type: 'frontal',
      x: 0, y: h, z: 0, w, h: t, d },
    // Central divider
    { id: 'divider-1', name: 'Divisor central', type: 'estructura',
      x: Math.round(w / 2) - Math.round(t / 2), y: t, z: t, w: t, h: innerH, d: innerD },
  ]
}

/**
 * Altillo (1000×400×350): overhead cabinet
 * — Laterals, top, bottom, back
 * — 1 lift-up door (full width frontal)
 * — Narrower depth (350mm), compact height
 */
function buildAltillo(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerH = h - t * 2

  return [
    ...shellPieces(w, h, d, t),
    // Single lift-up door (full width)
    { id: 'door-1', name: 'Puerta abatible', type: 'frontal',
      x: t, y: t, z: d, w: innerW, h: innerH, d: 16 },
  ]
}

/**
 * Personalizado: generic box with laterals, top, bottom, back + 2 doors
 */
function buildPersonalizado(m: ModuleDimensions): InteractivePiece[] {
  const { width: w, height: h, depth: d, thickness: t } = m
  const innerW = w - t * 2
  const innerH = h - t * 2
  const halfW  = Math.floor(innerW / 2)

  return [
    ...shellPieces(w, h, d, t),
    { id: 'door-left',  name: 'Puerta Izq', type: 'frontal',
      x: t, y: t, z: d, w: halfW, h: innerH, d: 16 },
    { id: 'door-right', name: 'Puerta Der', type: 'frontal',
      x: t + halfW, y: t, z: d, w: innerW - halfW, h: innerH, d: 16 },
  ]
}

/** Dispatch to the correct builder based on module type */
function buildInitialPieces(m: ModuleDimensions): InteractivePiece[] {
  switch (m.type) {
    case 'armario':       return buildArmario(m)
    case 'cajonera':      return buildCajonera(m)
    case 'cocina':        return buildCocina(m)
    case 'arcon':         return buildArcon(m)
    case 'altillo':       return buildAltillo(m)
    case 'personalizado': return buildPersonalizado(m)
    default:              return buildPersonalizado(m)
  }
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
  itemName, itemSku, savedDesign, projectInfo, isProduction, onSave, onClose,
}: FurniturePieceEditorProps) {
  const [tab, setTab]               = useState<Tab>('diseno')
  const [saving, setSaving]         = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [setupDone, setSetupDone]   = useState(!!savedDesign)
  const [wizardMaterialId, setWizardMaterialId] = useState<string | null>(null)

  const [module, setModule] = useState<ModuleDimensions>(() =>
    savedDesign?.module ?? {
      name:           itemName,
      type:           'armario' as ModuleType,
      width:          MODULE_TYPES[0].width,
      height:         MODULE_TYPES[0].height,
      depth:          MODULE_TYPES[0].depth,
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
  // ─── Undo history ────────────────────────────────────────────────────────────────────

  const historyRef = useRef<InteractivePiece[][]>([])
  const skipNextHistory = useRef(false)
  const prevPiecesJson = useRef(JSON.stringify(pieces))

  useEffect(() => {
    const json = JSON.stringify(pieces)
    if (json === prevPiecesJson.current) return
    if (skipNextHistory.current) {
      skipNextHistory.current = false
      prevPiecesJson.current = json
      return
    }
    historyRef.current.push(JSON.parse(prevPiecesJson.current))
    if (historyRef.current.length > 40) historyRef.current.shift()
    prevPiecesJson.current = json
  }, [pieces])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    skipNextHistory.current = true
    setPieces(prev)
    setSelectedId(null)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])
  // ─── Module dimension change ────────────────────────────────────────────────

  const handleModuleChange = useCallback(
    (field: keyof ModuleDimensions, value: string | number) => {
      setModule(prev => {
        const updated = { ...prev, [field]: typeof value === 'string' ? value : Number(value) }
        // When type changes, auto-fill dimensions from preset
        if (field === 'type') {
          const preset = MODULE_TYPES.find(t => t.value === value)
          if (preset && value !== 'personalizado') {
            updated.width  = preset.width
            updated.height = preset.height
            updated.depth  = preset.depth
          }
        }
        return updated
      })
    }, []
  )

  const handleSetupConfirm = useCallback(() => {
    const newPieces = buildInitialPieces(module)
    // Apply the wizard-selected catalog material to all pieces
    if (wizardMaterialId) {
      const mat = catalogMaterials.find(m => m.id === wizardMaterialId)
      for (const p of newPieces) p.materialId = wizardMaterialId
      if (mat) {
        setModule(prev => ({
          ...prev,
          materialPrice: mat.price_per_m2,
          catalogMaterialId: mat.id,
        }))
      }
    }
    setPieces(newPieces)
    setSetupDone(true)
    toast.success('Mueble generado — edita los tableros')
  }, [module, wizardMaterialId, catalogMaterials])

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

  const applyMaterialToAll = useCallback((materialId: string | undefined) => {
    setPieces(prev => prev.map(p => ({ ...p, materialId })))
    if (materialId) {
      const mat = catalogMaterials.find(m => m.id === materialId)
      toast.success(`"${mat?.name}" aplicado a todas las piezas`)
    } else {
      toast.success('Material retirado de todas las piezas')
    }
  }, [catalogMaterials])

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
      .map(p => {
        const mat = getMaterial(p.materialId) ?? getMaterial(module.catalogMaterialId)
        // Cut face = two largest dims (the third is board thickness)
        const [d1, d2] = [p.w, p.h, p.d].sort((a, b) => b - a)
        return {
          ref:  p.name,
          w:    d1,
          h:    d2,
          type: p.type,
          id:   p.id,
          materialId:   p.materialId ?? module.catalogMaterialId,
          materialName: mat?.name,
        }
      }),
    [pieces, getMaterial, module.catalogMaterialId]
  )

  const optimized = useMemo(() => {
    const dims: BoardDimsMap = new Map()
    for (const mat of catalogMaterials) {
      dims.set(mat.id, { w: mat.board_width ?? 2440, h: mat.board_height ?? 1220 })
    }
    return optimizeCutList(cutListPieces, dims)
  }, [cutListPieces, catalogMaterials])

  const handleSave = async () => {
    if (pieces.length < 2) { toast.error('Diseña al menos 2 piezas antes de guardar'); return }
    setSaving(true)
    try {
      await onSave(module, pieces, optimized)
      // Stock deduction is handled at approval time (FurnitureWorkOrderPage.approveItem)
      // when all designs are approved and the combined optimizer result is final
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

  /* ── SETUP WIZARD (before first generation) ────────────────────────────── */
  if (!setupDone) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 bg-white shadow-sm">
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-200 transition-all flex items-center justify-center">
            ←
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900">Nuevo mueble</h2>
            <span className="text-[10px] text-slate-400">{itemName} {projectInfo && `· ${projectInfo}`}</span>
          </div>
        </div>

        {/* Wizard body */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6 my-auto" style={{ maxHeight: 'fit-content' }}>
            <div className="text-center">
              <span className="text-3xl">🪵</span>
              <h3 className="text-lg font-bold text-gray-900 mt-2">Configurar mueble</h3>
              <p className="text-xs text-slate-500 mt-1">Define el tipo y las dimensiones antes de diseñar</p>
            </div>

            {/* Nombre */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Nombre</label>
              <input className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={module.name} onChange={e => handleModuleChange('name', e.target.value)} />
            </div>

            {/* Tipo */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de mueble</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {MODULE_TYPES.map(t => (
                  <button key={t.value} onClick={() => handleModuleChange('type', t.value)}
                    className={`py-3 rounded-xl text-center text-xs font-bold border-2 transition-all ${
                      module.type === t.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}>
                    <span className="text-lg block">{t.label.split(' ')[0]}</span>
                    <span className="mt-0.5 block">{t.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Material base (from catalog, only in-stock) */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Material base</label>
              {catalogMaterials.filter(m => m.in_stock).length === 0 ? (
                <p className="text-xs text-slate-400 mt-1 italic">Sin materiales disponibles en catálogo</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-48 overflow-y-auto">
                  {catalogMaterials.filter(m => m.in_stock).map(m => (
                    <button key={m.id} onClick={() => {
                      setWizardMaterialId(m.id)
                      handleModuleChange('materialPrice', m.price_per_m2)
                      if (m.thickness) handleModuleChange('thickness', m.thickness)
                    }}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left border-2 transition-all ${
                        wizardMaterialId === m.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                      <div className="w-7 h-7 rounded-lg border border-slate-200 flex-shrink-0"
                        style={{ backgroundColor: m.color_hex }} />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-slate-700 block truncate">{m.name}</span>
                        <span className="text-[8px] text-slate-400">{m.thickness}mm · {m.price_per_m2}€/m²</span>
                        {m.stock_quantity != null && (
                          <span className={`text-[8px] font-bold ml-1 ${
                            (m.stock_min && m.stock_quantity <= m.stock_min) ? 'text-red-500' : 'text-green-600'
                          }`}>
                            · {m.stock_quantity} uds
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dimensiones */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Dimensiones (mm)</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {[
                  { label: 'Ancho', key: 'width' },
                  { label: 'Alto',  key: 'height' },
                  { label: 'Fondo', key: 'depth' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">{label}</label>
                    <input type="number" min={50}
                      className="w-full mt-0.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                      value={(module as any)[key]}
                      onChange={e => handleModuleChange(key as keyof ModuleDimensions, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="text-[9px] font-bold text-slate-400 uppercase block">Grosor tablero</label>
                <input type="number" min={4}
                  className="w-24 mt-0.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  value={module.thickness}
                  onChange={e => handleModuleChange('thickness', e.target.value)} />
              </div>
            </div>

            {/* Confirm */}
            <button onClick={handleSetupConfirm}
              className="w-full py-3 bg-blue-600 text-white text-sm font-bold uppercase rounded-xl shadow hover:bg-blue-700 transition-all">
              🚀 Generar mueble
            </button>
          </div>
        </div>
      </div>
    )
  }

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

        <div className="flex items-center gap-2">
          <button onClick={undo} title="Deshacer (Ctrl+Z)"
            className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-sm hover:bg-slate-200 transition-all flex items-center justify-center">
            ↩
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold uppercase rounded-xl shadow hover:bg-blue-700 disabled:opacity-50 transition-all">
            {saving ? 'Guardando…' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* ══ DESIGN TAB ══════════════════════════════════════════ */}
        {tab === 'diseno' && (
          <div className="flex h-full">

            {/* ── LEFT SIDEBAR ──────────────────────────────────── */}
            <aside className="w-72 min-w-[280px] bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">

              {/* Module panel — compact info after setup */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-2">📐 Módulo</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-gray-800">{module.name}</span>
                    <span className="ml-2 text-[10px] text-slate-400">
                      {MODULE_TYPES.find(t => t.value === module.type)?.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {module.width}×{module.height}×{module.depth}
                  </span>
                </div>
              </div>

              {/* Material global */}
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-[11px] font-bold uppercase text-slate-500 tracking-wide mb-3">🎨 Material global</h3>
                <div className="space-y-1.5">
                  <select
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    value=""
                    onChange={e => { if (e.target.value) applyMaterialToAll(e.target.value) }}
                  >
                    <option value="">Aplicar a todas las piezas…</option>
                    {catalogMaterials.filter(m => m.in_stock).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.price_per_m2}€/m²)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => applyMaterialToAll(undefined)}
                    className="w-full py-1.5 bg-slate-50 border border-slate-200 text-slate-500 text-[9px] font-bold rounded-lg hover:bg-slate-100 transition-all"
                  >
                    ✕ Quitar material de todas
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
                    const dotColor = selectedId === p.id ? typeColors.selected : typeColors.fill
                    const pMat = getMaterial(p.materialId)
                    return (
                      <div key={p.id} className={`flex items-center gap-1 px-1 py-0.5 rounded-lg transition-all ${
                          selectedId === p.id
                            ? 'bg-blue-100 border border-blue-300'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); updatePiece(p.id, { hidden: !p.hidden }) }}
                          className={`w-5 h-5 flex items-center justify-center rounded text-[10px] flex-shrink-0 transition-all ${
                            p.hidden ? 'text-slate-300 hover:text-slate-500' : 'text-slate-500 hover:text-blue-600'
                          }`}
                          title={p.hidden ? 'Mostrar pieza' : 'Ocultar pieza'}
                        >
                          {p.hidden ? '👁‍🗨' : '👁'}
                        </button>
                        <button
                          onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                          className={`flex-1 flex items-center gap-2 px-1.5 py-1 rounded text-left ${p.hidden ? 'opacity-40' : ''}`}>
                          <span className="w-3 h-3 rounded flex-shrink-0 border border-slate-200"
                            style={{ backgroundColor: dotColor }} />
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-slate-700 truncate block">{p.name}</span>
                            {pMat && <span className="text-[8px] text-slate-400 truncate block">{pMat.texture_label}</span>}
                          </div>
                          <span className="text-[8px] font-mono text-slate-400 flex-shrink-0">{p.w}×{p.h}</span>
                        </button>
                      </div>
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
                  onUpdatePiece={(id, updates) => updatePiece(id, updates)}
                  catalogMaterials={catalogMaterials}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══ OPTIMIZATION TAB ════════════════════════════════════ */}
        {tab === 'optimizado' && (
          <div className="p-6 max-w-4xl mx-auto">
            <FurnitureOptimizerView placements={optimized} catalogMaterials={catalogMaterials} />
          </div>
        )}

        {/* ══ STICKERS TAB ════════════════════════════════════════ */}
        {tab === 'pegatinas' && (
          <div className="p-6 max-w-5xl mx-auto">
            <FurnitureStickersView
              pieces={optimized}
              moduleName={module.name}
              projectInfo={projectInfo}
              defaultMaterial={
                getMaterial(module.catalogMaterialId)?.name
                ?? MATERIALS.find(m => m.price === module.materialPrice)?.name
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
