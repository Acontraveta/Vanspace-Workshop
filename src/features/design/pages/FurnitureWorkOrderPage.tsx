import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  FurnitureWorkOrderService,
  FurnitureDesignService,
} from '../services/furnitureDesignService'
import {
  FurnitureWorkOrder,
  FurnitureWorkOrderItem,
  FurnitureDesign,
  InteractivePiece,
  ModuleDimensions,
  PlacedPiece,
  Piece,
} from '../types/furniture.types'
import type { CatalogMaterial } from '../types/furniture.types'
import { FurniturePieceEditor } from '../components/FurniturePieceEditor'
import { FurnitureOptimizerView } from '../components/FurnitureOptimizerView'
import { FurnitureStickersView } from '../components/FurnitureStickersView'
import { MaterialCatalogService } from '../services/materialCatalogService'
import { optimizeCutList } from '../utils/geometry'
import { generateBlueprintSVG } from '../utils/blueprintGenerator'
import { generateCutlistSVG, generateBoardCutlistSVG, enumerateBoards } from '../utils/cutlistGenerator'
import { processStockConsumption } from '@/features/production/services/stockConsumption'
import toast from 'react-hot-toast'

type PageView = 'list' | 'editor' | 'cutlist' | 'stickers' | 'pick-source' | 'blueprint'

export default function FurnitureWorkOrderPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const navigate = useNavigate()

  const [wo, setWo]               = useState<FurnitureWorkOrder | null>(null)
  const [designs, setDesigns]     = useState<FurnitureDesign[]>([])
  const [library, setLibrary]     = useState<FurnitureDesign[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [pageView, setPageView]   = useState<PageView>('list')
  const [activeItem, setActiveItem] = useState<FurnitureWorkOrderItem | null>(null)
  const [savedDesignForItem, setSavedDesignForItem] = useState<FurnitureDesign | null>(null)
  const [catalogMaterials, setCatalogMaterials] = useState<CatalogMaterial[]>([])
  const [blueprintItem, setBlueprintItem] = useState<string | null>(null)
  // ─── Load ────────────────────────────────────────────────────────────────────

  const refresh = async () => {
    if (!workOrderId) return
    try {
      setLoading(true)
      const [woData, designsData] = await Promise.all([
        FurnitureWorkOrderService.getById(workOrderId),
        FurnitureDesignService.getByWorkOrder(workOrderId),
      ])
      setWo(woData)
      setDesigns(designsData)
      // Load library + material catalog
      try {
        const [lib, mats] = await Promise.all([
          FurnitureDesignService.getAllStandalone(),
          MaterialCatalogService.getAll(),
        ])
        setLibrary(lib)
        setCatalogMaterials(mats)
      } catch { /* non-critical */ }
    } catch (err: any) {
      toast.error('Error cargando orden de trabajo: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [workOrderId])

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const designByItem = useMemo(() => {
    const map: Record<string, FurnitureDesign> = {}
    designs.forEach(d => { map[d.quote_item_name] = d })
    return map
  }, [designs])

  /** All optimised cuts merged from all designed pieces (for combined cut list) */
  const allCuts = useMemo((): PlacedPiece[] => {
    const matNameMap = new Map(catalogMaterials.map(m => [m.id, m.name]))
    const allPieces: Piece[] = designs.flatMap(d =>
      (d.pieces as InteractivePiece[])
        .filter(p => p.type !== 'trasera')
        .map(p => {
          const matId = p.materialId ?? d.module.catalogMaterialId
          // Cut face = two largest dims (the third is board thickness)
          const [d1, d2] = [p.w, p.h, p.d].sort((a, b) => b - a)
          return {
            ref:  `${d.quote_item_name} · ${p.name}`,
            w:    d1,
            h:    d2,
            type: p.type,
            id:   p.id,
            materialId:   matId,
            materialName: matId ? matNameMap.get(matId) : undefined,
          }
        })
    )
    return optimizeCutList(allPieces)
  }, [designs, catalogMaterials])

  const allDesigned = wo?.items.every(i => i.designStatus !== 'pending') ?? false

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const openEditor = async (item: FurnitureWorkOrderItem) => {
    setActiveItem(item)
    const existing = designByItem[item.quoteItemName]
    if (existing) {
      // Already has a design — open editor directly
      setSavedDesignForItem(existing)
      setPageView('editor')
    } else if (library.length > 0) {
      // No design yet and library has items — let user choose source
      setPageView('pick-source')
    } else {
      // No library — go straight to blank editor
      setSavedDesignForItem(null)
      setPageView('editor')
    }
  }

  const startFromScratch = () => {
    setSavedDesignForItem(null)
    setPageView('editor')
  }

  const startFromLibrary = (libraryDesign: FurnitureDesign) => {
    // Clone library design as initial state (don't link IDs)
    setSavedDesignForItem({ ...libraryDesign, id: '' } as FurnitureDesign)
    setPageView('editor')
  }

  const handleSaveDesign = async (
    module: ModuleDimensions,
    pieces: InteractivePiece[],
    cuts: PlacedPiece[]
  ) => {
    if (!wo || !activeItem) return
    setSaving(true)
    try {
      const existing = designByItem[activeItem.quoteItemName]
      const saved = await FurnitureDesignService.save({
        workOrderId:     wo.id,
        leadId:          wo.lead_id,
        projectTaskId:   wo.project_task_id,
        quoteItemName:   activeItem.quoteItemName,
        quoteItemSku:    activeItem.quoteItemSku,
        module,
        pieces,
        optimizedCuts:   cuts,
        existingId:      existing?.id,
      })

      // Update work-order item status → 'designed'
      const newItems = wo.items.map(i =>
        i.quoteItemName === activeItem.quoteItemName
          ? { ...i, designId: saved.id, designStatus: 'designed' as const }
          : i
      )
      await FurnitureWorkOrderService.updateItems(wo.id, newItems)
      toast.success('Diseño guardado')
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  const approveItem = async (itemName: string) => {
    if (!wo) return
    try {
      // 1. Generate and store the blueprint SVG for this design
      const design = designByItem[itemName]
      if (design) {
        try {
          console.log('📐 Generando plano técnico para:', itemName)
          const blueprintSvg = generateBlueprintSVG({
            pieces: design.pieces as InteractivePiece[],
            module: design.module,
            itemName,
            projectInfo: `${wo.quote_number} · ${wo.client_name}`,
            catalogMaterials,
          })
          console.log('📐 Plano generado:', blueprintSvg.length, 'bytes')
          await FurnitureDesignService.updateBlueprint(design.id, blueprintSvg)
          console.log('💾 Plano guardado para:', design.id)
        } catch (bpErr) {
          console.error('Error generando/guardando plano técnico:', bpErr)
          // Don't block approval if blueprint generation fails
        }
      }

      // 2. Update WO item status → 'approved'
      const newItems = wo.items.map(i =>
        i.quoteItemName === itemName ? { ...i, designStatus: 'approved' as const } : i
      )
      await FurnitureWorkOrderService.updateItems(wo.id, newItems)

      // 3. When ALL items are approved → generate cutlist + rebuild operator tasks
      const allNowApproved = newItems.every(i => i.designStatus === 'approved')
      if (allNowApproved) {
        console.log('✅ Todos los diseños aprobados — generando despiece y tareas...')

        // Fetch latest designs to compute combined cut list
        const latestDesigns = await FurnitureDesignService.getByWorkOrder(wo.id)
        console.log('📦 Diseños cargados:', latestDesigns.length)

        const matNameMap = new Map(catalogMaterials.map(m => [m.id, m.name]))
        const allPieces: Piece[] = latestDesigns.flatMap(d =>
          (d.pieces as InteractivePiece[])
            .filter(p => p.type !== 'trasera')
            .map(p => {
              const matId = p.materialId ?? d.module.catalogMaterialId
              const [d1, d2] = [p.w, p.h, p.d].sort((a, b) => b - a)
              return {
                ref: `${d.quote_item_name} · ${p.name}`,
                w: d1, h: d2, type: p.type, id: p.id,
                materialId: matId,
                materialName: matId ? matNameMap.get(matId) : undefined,
              }
            })
        )
        console.log('🧩 Piezas totales:', allPieces.length)

        const optimized = optimizeCutList(allPieces)
        const boardInfos = enumerateBoards(optimized)
        const totalBoardCount = boardInfos.length
        console.log('📋 Tableros optimizados:', totalBoardCount, 'piezas colocadas:', optimized.length)

        // Generate and store combined cutlist SVG + per-board SVGs
        try {
          const cutlistSvg = generateCutlistSVG(
            optimized,
            `${wo.quote_number} · ${wo.client_name}`
          )
          // Generate individual SVG for each board
          const boardCutlistSvgs = boardInfos.map((bi, idx) =>
            generateBoardCutlistSVG(
              optimized,
              bi.boardIndex,
              `Tablero ${idx + 1} — ${bi.materialName}`,
              `${wo.quote_number} · ${wo.client_name}`,
            )
          )
          console.log('📋 Cutlist SVGs generados:', cutlistSvg.length, 'bytes total,', boardCutlistSvgs.length, 'tableros')
          await FurnitureWorkOrderService.updateCutlistSvg(wo.id, cutlistSvg, boardCutlistSvgs)
          console.log('💾 Cutlists guardados en WO:', wo.id)
        } catch (cutErr) {
          console.error('Error generando/guardando cutlist SVG:', cutErr)
        }

        // Rebuild operator tasks: 1 cutting task per board + N assembly
        const boardTasks = boardInfos.map((bi, idx) => {
          const boardPieces = optimized.filter(p => (p.board ?? 0) === bi.boardIndex)
          return {
            boardLabel: `Tablero ${idx + 1} — ${bi.materialName}`,
            materialName: bi.materialName,
            pieceCount: bi.pieceCount,
            estimatedHours: Math.max(0.5, Math.round(0.5 * 10) / 10),
            pieceRefs: boardPieces.map(p => p.ref),
          }
        })
        const assemblyItems = latestDesigns.map(d => {
          const pieces = d.pieces as InteractivePiece[]
          return {
            quoteItemName: d.quote_item_name,
            estimatedHours: Math.max(0.5, Math.round(pieces.length * 0.3 * 10) / 10),
            pieceCount: pieces.length,
            pieceNames: pieces.map(p => p.name),
          }
        })

        try {
          await FurnitureWorkOrderService.rebuildFurnitureTasks(
            wo.project_id,
            boardTasks,
            assemblyItems,
          )
          console.log('🔨 Tareas de producción reconstruidas:', boardTasks.length, 'corte +', assemblyItems.length, 'montaje')
        } catch (e) {
          console.warn('rebuildFurnitureTasks failed (non-critical):', e)
        }

        // 4. Deduct board stock based on the optimized cut list
        try {
          console.log('📦 Descontando tableros del stock...')
          const allDesignPieces = latestDesigns.flatMap(d => d.pieces as InteractivePiece[])
          const firstModule = latestDesigns[0]?.module
          if (firstModule) {
            const report = await processStockConsumption(
              allDesignPieces,
              firstModule,
              catalogMaterials,
              `${wo.quote_number} · ${wo.client_name}`,
              optimized,
            )
            if (report.items.length > 0) {
              const sheetsTotal = report.items.reduce((s, i) => s + i.sheetsNeeded, 0)
              console.log(`📦 ${sheetsTotal} tablero(s) descontados del stock`)
            }
            if (report.purchaseItemsCreated > 0) {
              toast(`🛒 ${report.purchaseItemsCreated} material(es) añadidos a compras (stock mínimo)`, { icon: '⚠️' })
            }
            // Refresh catalog materials cache
            MaterialCatalogService.invalidateCache()
            MaterialCatalogService.getAll().then(setCatalogMaterials).catch(() => {})
          }
        } catch (stockErr) {
          console.error('Error descontando stock:', stockErr)
        }

        toast.success(
          `✅ Todos los diseños aprobados · ${totalBoardCount} tablero${totalBoardCount !== 1 ? 's' : ''} · ${allPieces.length} piezas\nTareas de producción actualizadas`,
          { duration: 5000 }
        )
      } else {
        toast.success('Diseño aprobado · Plano técnico generado')
      }

      await refresh()
    } catch (err: any) {
      console.error('Error en approveItem:', err)
      toast.error('Error aprobando diseño: ' + err.message)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Cargando orden de diseño…
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500">Orden de trabajo no encontrada</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 underline">Volver</button>
      </div>
    )
  }

  // ── Source picker ──────────────────────────────────────────────────────────
  if (pageView === 'pick-source' && activeItem) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <button onClick={() => { setPageView('list'); setActiveItem(null) }}
            className="text-sm text-blue-600 underline">← Volver</button>
          <h2 className="text-lg font-black text-slate-900 mt-2">
            ¿Cómo quieres diseñar &ldquo;{activeItem.quoteItemName}&rdquo;?
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Empieza desde cero o usa un diseño de la biblioteca como base.
          </p>
        </div>

        <button onClick={startFromScratch}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-amber-400 hover:bg-amber-50/30 transition-all">
          <div className="text-3xl mb-2">✨</div>
          <p className="font-bold text-slate-800">Diseño nuevo desde cero</p>
          <p className="text-xs text-slate-400 mt-1">Estructura vacía con dimensiones por defecto</p>
        </button>

        {library.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">📚 Desde biblioteca</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {library.map(d => {
                const m = d.module as { name?: string; type?: string; width?: number; height?: number; depth?: number }
                const pCount = Array.isArray(d.pieces) ? d.pieces.length : 0
                return (
                  <button key={d.id} onClick={() => startFromLibrary(d)}
                    className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-amber-300 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">🪑</div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{d.quote_item_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {m.width}×{m.height}×{m.depth}mm · {pCount} pieza{pCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Full-page editor ──────────────────────────────────────────────────────────
  if (pageView === 'editor' && activeItem) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col">
        <FurniturePieceEditor
          itemName={activeItem.quoteItemName}
          itemSku={activeItem.quoteItemSku}
          savedDesign={savedDesignForItem}
          projectInfo={`${wo.quote_number} · ${wo.client_name}`}
          isProduction
          onSave={handleSaveDesign}
          onClose={() => { setPageView('list'); setActiveItem(null) }}
        />
      </div>
    )
  }

  if (pageView === 'blueprint' && blueprintItem) {
    const design = designByItem[blueprintItem]
    const svgContent = design?.blueprint_svg || generateBlueprintSVG({
      pieces: (design?.pieces ?? []) as InteractivePiece[],
      module: design?.module ?? {} as ModuleDimensions,
      itemName: blueprintItem,
      projectInfo: `${wo.quote_number} · ${wo.client_name}`,
      catalogMaterials,
    })
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => { setPageView('list'); setBlueprintItem(null) }} className="text-sm text-blue-600 underline">← Volver</button>
            <h2 className="text-lg font-black text-slate-900">Plano técnico — {blueprintItem}</h2>
          </div>
          <button
            onClick={() => {
              const blob = new Blob([svgContent], { type: 'image/svg+xml' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `plano-${blueprintItem.replace(/\s+/g, '-')}.svg`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="px-3 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
          >
            📥 Descargar SVG
          </button>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: svgContent }} />
        </div>
      </div>
    )
  }

  if (pageView === 'cutlist') {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setPageView('list')} className="text-sm text-blue-600 underline">← Volver</button>
          <h2 className="text-lg font-black text-slate-900">Despiece conjunto — {wo.quote_number}</h2>
        </div>
        <FurnitureOptimizerView placements={allCuts} />
      </div>
    )
  }

  if (pageView === 'stickers') {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3 mb-2 no-print">
          <button onClick={() => setPageView('list')} className="text-sm text-blue-600 underline">← Volver</button>
          <h2 className="text-lg font-black text-slate-900">Etiquetas — {wo.quote_number}</h2>
        </div>
        <FurnitureStickersView
          pieces={allCuts}
          moduleName={wo.quote_number}
          projectInfo={`${wo.quote_number} · ${wo.client_name}`}
          defaultMaterial={catalogMaterials[0]?.name}
        />
      </div>
    )
  }

  // ── Work order list ───────────────────────────────────────────────────────────
  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700' },
    designed: { label: 'Diseñado',   color: 'bg-blue-100 text-blue-700'    },
    approved: { label: 'Aprobado',   color: 'bg-green-100 text-green-700'  },
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-slate-600 mb-1">
            ← Volver a producción
          </button>
          <h1 className="text-xl font-black text-slate-900">Orden de Diseño de Muebles</h1>
          <p className="text-sm text-slate-500 mt-0.5">{wo.quote_number} · {wo.client_name}</p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={!allDesigned}
            onClick={() => setPageView('cutlist')}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-black uppercase rounded-xl disabled:opacity-40 hover:bg-slate-900 transition-all"
          >
            📋 Ver despiece
          </button>
          <button
            disabled={!allDesigned}
            onClick={() => setPageView('stickers')}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase rounded-xl disabled:opacity-40 hover:bg-blue-700 transition-all"
          >
            🏷️ Pegatinas
          </button>
        </div>
      </div>

      {!allDesigned && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Diseña todos los muebles para habilitar el despiece y las etiquetas.
        </div>
      )}

      {/* Furniture items list */}
      <div className="space-y-3">
        {wo.items.map(item => {
          const s      = STATUS_LABELS[item.designStatus] ?? STATUS_LABELS.pending
          const design = designByItem[item.quoteItemName]
          return (
            <div key={item.quoteItemName}
              className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-2xl">
                  🪑
                </div>
                <div>
                  <p className="font-bold text-slate-800">{item.quoteItemName}</p>
                  {item.quoteItemSku && (
                    <p className="text-[10px] font-mono text-slate-400">{item.quoteItemSku}</p>
                  )}
                  {design && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {(design.pieces as InteractivePiece[]).length} piezas · {design.module.width}×{design.module.height}×{design.module.depth} mm
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${s.color}`}>{s.label}</span>

                <button
                  onClick={() => openEditor(item)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-black uppercase rounded-lg hover:bg-blue-700 transition-all"
                >
                  {item.designStatus === 'pending' ? '✏️ Diseñar' : '✏️ Editar'}
                </button>

                {item.designStatus === 'designed' && (
                  <button
                    onClick={() => approveItem(item.quoteItemName)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-black uppercase rounded-lg hover:bg-green-700 transition-all"
                  >
                    ✓ Aprobar
                  </button>
                )}

                {item.designStatus === 'approved' && design?.blueprint_svg && (
                  <button
                    onClick={() => { setBlueprintItem(item.quoteItemName); setPageView('blueprint') }}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-black uppercase rounded-lg hover:bg-emerald-700 transition-all"
                  >
                    📐 Plano
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {allDesigned && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          ✅ Todos los muebles están diseñados. Puedes generar el despiece y las etiquetas.
        </div>
      )}
    </div>
  )
}
