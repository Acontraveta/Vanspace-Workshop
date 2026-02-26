import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { ProductionTask } from '@/features/calendar/types/production.types'
import { useEffect, useState } from 'react'
import { DesignFilesService, DesignFile } from '../services/designFilesService'
import { supabase } from '@/lib/supabase'

/* ── SVG generation helpers ─────────────────────────────────────────── */

const EXT_VISUALS: Record<string, { short: string; fill: string; stroke: string }> = {
  ventana:     { short: 'V',  fill: '#dbeafe', stroke: '#2563eb' },
  claraboya:   { short: 'CL', fill: '#ede9fe', stroke: '#7c3aed' },
  aireador:    { short: 'A',  fill: '#d1fae5', stroke: '#059669' },
  rejilla:     { short: 'R',  fill: '#fef3c7', stroke: '#d97706' },
  placa_solar: { short: 'PS', fill: '#1e3a5f20', stroke: '#1e3a5f' },
  toldo:       { short: 'T',  fill: '#fce7f3', stroke: '#be185d' },
  portabicis:  { short: 'PB', fill: '#f1f5f9', stroke: '#475569' },
  custom:      { short: '?',  fill: '#f1f5f9', stroke: '#64748b' },
}

const VIEW_LABELS: Record<string, string> = {
  'side-left': 'Lateral izquierdo',
  'side-right': 'Lateral derecho',
  top: 'Techo',
  rear: 'Trasera',
}

function generateExteriorSvg(elements: any[]): string {
  // Group elements by view
  const byView: Record<string, any[]> = {}
  for (const el of elements) {
    const v = el.view || 'side-left'
    ;(byView[v] ??= []).push(el)
  }
  const views = Object.keys(byView)
  if (!views.length) return ''

  const viewW = 500
  const viewH = 200
  const pad = 20
  const headerH = 30
  const sectionH = headerH + viewH + pad
  const totalH = views.length * sectionH + pad
  const totalW = viewW + pad * 2

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" style="font-family:system-ui,sans-serif">`
  svg += `<rect width="${totalW}" height="${totalH}" fill="#f8fafc" rx="8"/>`

  views.forEach((view, vi) => {
    const yOff = pad + vi * sectionH
    // View label
    svg += `<text x="${pad}" y="${yOff + 18}" font-size="14" font-weight="bold" fill="#334155">${VIEW_LABELS[view] || view}</text>`
    // View background (van silhouette area)
    svg += `<rect x="${pad}" y="${yOff + headerH}" width="${viewW}" height="${viewH}" fill="#e2e8f0" rx="6" stroke="#94a3b8" stroke-width="1"/>`

    // Scale elements: find bounding box, then fit into viewW x viewH
    const elems = byView[view]
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const el of elems) {
      const ex = el.x ?? 0, ey = el.y ?? 0, ew = el.w ?? 50, eh = el.h ?? 50
      minX = Math.min(minX, ex); minY = Math.min(minY, ey)
      maxX = Math.max(maxX, ex + ew); maxY = Math.max(maxY, ey + eh)
    }
    const bw = maxX - minX || 1, bh = maxY - minY || 1
    const scale = Math.min((viewW - 40) / bw, (viewH - 40) / bh, 1)
    const offX = pad + 20 + ((viewW - 40) - bw * scale) / 2
    const offY = yOff + headerH + 20 + ((viewH - 40) - bh * scale) / 2

    for (const el of elems) {
      const vis = EXT_VISUALS[el.type] || EXT_VISUALS.custom
      const rx = offX + (el.x - minX) * scale
      const ry = offY + (el.y - minY) * scale
      const rw = (el.w ?? 50) * scale
      const rh = (el.h ?? 50) * scale
      svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${vis.fill}" stroke="${vis.stroke}" stroke-width="2" rx="3"/>`
      // Label
      const label = el.label || vis.short
      const fontSize = Math.min(12, rw / label.length * 1.4, rh * 0.5)
      if (fontSize > 5) {
        svg += `<text x="${rx + rw / 2}" y="${ry + rh / 2 + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize.toFixed(1)}" fill="${vis.stroke}" font-weight="600">${label}</text>`
      }
      // Dimensions
      const dimMM = `${Math.round(el.w ?? 0)}×${Math.round(el.h ?? 0)}`
      if (rh > 18) {
        svg += `<text x="${rx + rw / 2}" y="${ry + rh - 4}" text-anchor="middle" font-size="8" fill="#64748b">${dimMM}mm</text>`
      }
    }
  })

  svg += '</svg>'
  return svg
}

const INT_LAYER_COLORS: Record<string, { fill: string; stroke: string }> = {
  furniture:  { fill: '#fef3c7', stroke: '#d97706' },
  electrical: { fill: '#dbeafe', stroke: '#2563eb' },
  plumbing:   { fill: '#d1fae5', stroke: '#059669' },
}

function generateInteriorSvg(items: any[]): string {
  if (!items?.length) return ''

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const it of items) {
    const ix = it.x ?? 0, iy = it.y ?? 0, iw = it.w ?? 50, ih = it.h ?? 50
    minX = Math.min(minX, ix); minY = Math.min(minY, iy)
    maxX = Math.max(maxX, ix + iw); maxY = Math.max(maxY, iy + ih)
  }
  const bw = maxX - minX || 1, bh = maxY - minY || 1
  const pad = 40
  const maxW = 600
  const scale = Math.min((maxW - pad * 2) / bw, 400 / bh, 1)
  const svgW = bw * scale + pad * 2
  const svgH = bh * scale + pad * 2 + 30

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" style="font-family:system-ui,sans-serif">`
  svg += `<rect width="${svgW}" height="${svgH}" fill="#f8fafc" rx="8"/>`
  svg += `<text x="${svgW / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#334155">Planta interior</text>`

  for (const it of items) {
    const lc = INT_LAYER_COLORS[it.layer] || INT_LAYER_COLORS.furniture
    const rx = pad + (it.x - minX) * scale
    const ry = 30 + pad + (it.y - minY) * scale
    const rw = (it.w ?? 50) * scale
    const rh = (it.h ?? 50) * scale
    svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${lc.fill}" stroke="${lc.stroke}" stroke-width="2" rx="3"/>`
    const label = it.label || it.type || ''
    const fontSize = Math.min(11, rw / Math.max(label.length, 1) * 1.4, rh * 0.4)
    if (fontSize > 5 && label) {
      svg += `<text x="${rx + rw / 2}" y="${ry + rh / 2 + fontSize * 0.35}" text-anchor="middle" font-size="${fontSize.toFixed(1)}" fill="${lc.stroke}" font-weight="600">${label}</text>`
    }
  }

  // Legend
  const legendY = svgH - 16
  let lx = pad
  for (const [key, colors] of Object.entries(INT_LAYER_COLORS)) {
    svg += `<rect x="${lx}" y="${legendY - 8}" width="10" height="10" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1" rx="2"/>`
    const lbl = key === 'furniture' ? 'Mobiliario' : key === 'electrical' ? 'Eléctrico' : 'Fontanería'
    svg += `<text x="${lx + 14}" y="${legendY}" font-size="9" fill="#475569">${lbl}</text>`
    lx += 14 + lbl.length * 5.5 + 16
  }

  svg += '</svg>'
  return svg
}

interface BlueprintInfo {
  itemName: string
  svg: string
  type: 'cutlist' | 'assembly' | 'exterior' | 'interior'
}

interface TaskInstructionsModalProps {
  task: ProductionTask
  onConfirm: () => void
  onCancel: () => void
  /** 'start' = pre-start flow (default), 'view' = view-only during work */
  mode?: 'start' | 'view'
}

export default function TaskInstructionsModal({
  task,
  onConfirm,
  onCancel,
  mode = 'start'
}: TaskInstructionsModalProps) {
  const instructions = task.instructions_design || ''
  const tipoDiseno = (task as any).tipo_diseno || ''
  const hasInstructions = instructions.length > 0
  const [designFiles, setDesignFiles] = useState<DesignFile[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintInfo[]>([])
  const [expandedBlueprint, setExpandedBlueprint] = useState<string | null>(null)
  const [fullscreenSvg, setFullscreenSvg] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)

  const isFurnitureBlock = (task as any).task_block_id === 'MUEBLES_GROUP' ||
    (task as any).catalog_sku === 'MUEBLES_GROUP'
  const isCuttingTask = isFurnitureBlock && /cort|despiece/i.test(task.task_name)
  const isAssemblyTask = isFurnitureBlock && /ensambl/i.test(task.task_name)
  const taskBlockOrder = typeof (task as any).block_order === 'number'
    ? (task as any).block_order as number
    : undefined

  useEffect(() => {
    const loadFiles = async () => {
      // Load attached design files
      try {
        const blockId = (task as any).task_block_id || task.product_name
        if (blockId) {
          const files = await DesignFilesService.getBlockFiles(blockId)
          setDesignFiles(files)
        }
      } catch { /* non-critical */ }

      // Load furniture blueprints if this is a MUEBLES_GROUP task
      // OR any task that has a project with furniture work orders
      if (task.project_id) {
        try {
          console.log('📐 TaskInstructions: loading blueprints for', task.task_name,
            'project:', task.project_id,
            'isFurnitureBlock:', isFurnitureBlock,
            'isCutting:', isCuttingTask,
            'isAssembly:', isAssemblyTask,
            'blockOrder:', taskBlockOrder,
            'task_block_id:', (task as any).task_block_id,
            'catalog_sku:', (task as any).catalog_sku)

          const { FurnitureWorkOrderService, FurnitureDesignService } =
            await import('@/features/design/services/furnitureDesignService')

          // Try primary lookup by project_id
          let wo = await FurnitureWorkOrderService.getByProject(task.project_id)

          // If not found and this is a furniture task, try broader search
          if (!wo && isFurnitureBlock) {
            console.log('📐 WO no encontrada por project_id, buscando en todas las WOs...')
            const allWos = await FurnitureWorkOrderService.getAll()
            console.log('📐 Total WOs disponibles:', allWos.length,
              allWos.map(w => `${w.id} proj:${w.project_id} svg:${!!w.cutlist_svg}`))
            // Find by closest match — same project_id prefix or any WO with cutlist
            wo = allWos.find(w => w.project_id === task.project_id)
              ?? allWos.find(w => w.cutlist_svg && w.project_id?.startsWith(task.project_id?.substring(0, 8)))
              ?? null
          }

          if (!wo) {
            console.log('📐 No WO found for project:', task.project_id)
            setLoadingFiles(false)
            return
          }

          const hasCutlistSvg = !!wo.cutlist_svg
          const boardSvgs = (wo as any).board_cutlist_svgs as string[] | undefined
          console.log('📐 WO encontrada:', wo.id,
            'cutlist_svg:', hasCutlistSvg, hasCutlistSvg ? `(${wo.cutlist_svg!.length} bytes)` : '',
            'board_cutlist_svgs:', Array.isArray(boardSvgs),
            boardSvgs ? `(${boardSvgs.length} entries)` : '(none)')

          const bps: BlueprintInfo[] = []
          const designs = await FurnitureDesignService.getByWorkOrder(wo.id)
          console.log('📐 Diseños cargados:', designs.length,
            'con plano:', designs.filter(d => d.blueprint_svg).length,
            'nombres:', designs.map(d => d.quote_item_name))

          if (isCuttingTask) {
            // Cutting task → show the specific board's cut-list SVG
            const boardSvgs = (wo as any).board_cutlist_svgs as string[] | undefined
            const boardIdx = taskBlockOrder ?? 0
            console.log('📐 Buscando cutlist para boardIdx:', boardIdx,
              'boardSvgs disponibles:', boardSvgs?.length ?? 0)
            if (boardSvgs && boardSvgs[boardIdx]) {
              bps.push({ itemName: task.task_name, svg: boardSvgs[boardIdx], type: 'cutlist' })
            } else if (wo.cutlist_svg) {
              // Fallback: show the combined cutlist
              bps.push({ itemName: 'Despiece total', svg: wo.cutlist_svg, type: 'cutlist' })
            } else {
              console.warn('📐 Cutting task sin SVG: no board_cutlist_svgs ni cutlist_svg en WO')
            }
          } else if (isAssemblyTask && task.product_name) {
            // Assembly task → show the specific item's blueprint
            const match = designs.find(d =>
              d.quote_item_name === task.product_name ||
              task.task_name.includes(d.quote_item_name) ||
              d.quote_item_name.includes(task.product_name) ||
              task.product_name.includes(d.quote_item_name)
            )
            if (match?.blueprint_svg) {
              bps.push({ itemName: match.quote_item_name, svg: match.blueprint_svg, type: 'assembly' })
            } else {
              console.warn('📐 No se encontró plano para:', task.product_name,
                'diseños:', designs.map(d => ({ name: d.quote_item_name, hasBP: !!d.blueprint_svg })))
              // Fallback: show all blueprints if specific match fails
              for (const d of designs) {
                if (d.blueprint_svg) {
                  bps.push({ itemName: d.quote_item_name, svg: d.blueprint_svg, type: 'assembly' })
                }
              }
            }
          } else if (isFurnitureBlock) {
            // Unknown furniture task → show all available blueprints
            if (wo.cutlist_svg) {
              bps.push({ itemName: 'Despiece total', svg: wo.cutlist_svg, type: 'cutlist' })
            }
            for (const d of designs) {
              if (d.blueprint_svg) {
                bps.push({ itemName: d.quote_item_name, svg: d.blueprint_svg, type: 'assembly' })
              }
            }
          } else if (designs.some(d => d.blueprint_svg) || wo.cutlist_svg) {
            // Non-MUEBLES_GROUP task but project has furniture data → show everything
            if (wo.cutlist_svg) {
              bps.push({ itemName: 'Despiece total', svg: wo.cutlist_svg, type: 'cutlist' })
            }
            for (const d of designs) {
              if (d.blueprint_svg) {
                bps.push({ itemName: d.quote_item_name, svg: d.blueprint_svg, type: 'assembly' })
              }
            }
          }

          console.log('📐 Planos encontrados:', bps.length, bps.map(b => `${b.itemName} (${b.type}, ${b.svg.length}b)`))
          setBlueprints(bps)
        } catch (err) {
          console.error('📐 Error cargando planos:', err)
        }
      }

      // ── Cargar diseños exteriores e interiores ──────────────────────────
      if (task.project_id) {
        try {
          const bps = [...blueprints]
          // Exterior designs — query by project_id OR production_project_id
          const { data: extDesigns } = await supabase
            .from('exterior_designs')
            .select('elements')
            .or(`project_id.eq.${task.project_id},production_project_id.eq.${task.project_id}`)

          for (const ed of (extDesigns ?? [])) {
            const elems = ed.elements as any[]
            if (!elems?.length) continue
            const svg = generateExteriorSvg(elems)
            if (svg) {
              setBlueprints(prev => [...prev, { itemName: 'Diseño exterior', svg, type: 'exterior' }])
            }
          }

          // Interior designs — query by project_id OR production_project_id
          const { data: intDesigns } = await supabase
            .from('interior_designs')
            .select('items')
            .or(`project_id.eq.${task.project_id},production_project_id.eq.${task.project_id}`)

          for (const id of (intDesigns ?? [])) {
            const items = id.items as any[]
            if (!items?.length) continue
            const svg = generateInteriorSvg(items)
            if (svg) {
              setBlueprints(prev => [...prev, { itemName: 'Diseño interior', svg, type: 'interior' }])
            }
          }
        } catch (err) {
          console.error('📐 Error cargando diseños ext/int:', err)
        }
      }

      setLoadingFiles(false)
    }
    loadFiles()
  }, [task])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand single blueprint
  useEffect(() => {
    if (blueprints.length === 1 && !expandedBlueprint) {
      setExpandedBlueprint(blueprints[0].itemName)
    }
  }, [blueprints]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="max-w-4xl w-full max-h-[95vh] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="flex items-center gap-3">
            <span className="text-3xl">▶</span>
            <div>
              <h2 className="text-xl font-bold">{task.task_name}</h2>
              <p className="text-sm text-blue-100 mt-1">{task.product_name}</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
          {/* Archivos de diseño adjuntos */}
          {designFiles.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-purple-700 mb-3">
                📎 Archivos de diseño adjuntos
              </p>
              <div className="space-y-2">
                {designFiles.map(file => (
                  <div key={file.id} 
                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:shadow-md transition">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl">
                        {file.file_type?.includes('pdf') ? '📄' : 
                         file.file_type?.includes('image') ? '🖼️' : '📐'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.file_size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => DesignFilesService.downloadFile(file.file_path, file.file_name)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      📥 Descargar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planos técnicos de muebles */}
          {blueprints.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-green-700 mb-3">
                {isCuttingTask ? '📋 Plano de despiece' : isAssemblyTask ? '📐 Plano de montaje' : '📐 Planos técnicos'}
              </p>
              <div className="space-y-3">
                {blueprints.map(bp => {
                  const isExpanded = expandedBlueprint === bp.itemName
                  const styleMap: Record<string, { icon: string; border: string; bg: string; text: string; label: string }> = {
                    cutlist:  { icon: '📋', border: 'border-blue-200',   bg: 'bg-blue-50 hover:bg-blue-100',   text: 'text-blue-800',   label: 'text-blue-600'   },
                    assembly: { icon: '🪑', border: 'border-green-200',  bg: 'bg-green-50 hover:bg-green-100',  text: 'text-green-800',  label: 'text-green-600'  },
                    exterior: { icon: '🚐', border: 'border-indigo-200', bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-800', label: 'text-indigo-600' },
                    interior: { icon: '🏠', border: 'border-amber-200',  bg: 'bg-amber-50 hover:bg-amber-100',  text: 'text-amber-800',  label: 'text-amber-600'  },
                  }
                  const s = styleMap[bp.type] || styleMap.assembly
                  const icon = s.icon
                  const borderColor = s.border
                  const bgColor = s.bg
                  const textColor = s.text
                  const labelColor = s.label
                  return (
                    <div key={bp.itemName} className={`border-2 ${borderColor} rounded-xl overflow-hidden bg-white`}>
                      <button
                        onClick={() => setExpandedBlueprint(isExpanded ? null : bp.itemName)}
                        className={`w-full flex items-center justify-between px-4 py-3 ${bgColor} transition-colors`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <span className={`font-bold text-sm ${textColor}`}>{bp.itemName}</span>
                        </div>
                        <span className={`text-xs ${labelColor} font-medium`}>
                          {isExpanded ? '▲ Ocultar' : '▼ Ver plano'}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className={`p-3 border-t ${borderColor} bg-gray-50`}>
                          <div
                            className="w-full overflow-auto blueprint-svg-container"
                            style={{ maxHeight: '70vh' }}
                            dangerouslySetInnerHTML={{ __html: bp.svg.replace(
                              /^<svg ([^>]*)>/,
                              (_, attrs) => `<svg ${attrs} style="width:100%;height:auto;max-width:100%;display:block;">`
                            ) }}
                          />
                          <div className="mt-2 flex gap-3">
                            <button
                              onClick={() => setFullscreenSvg(bp.svg)}
                              className="text-xs text-green-600 underline hover:text-green-800"
                            >
                              🔍 Ver a pantalla completa
                            </button>
                            <button
                              onClick={() => {
                                const blob = new Blob([bp.svg], { type: 'image/svg+xml' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `plano-${bp.itemName.replace(/\s+/g, '-')}.svg`
                                a.click()
                                URL.revokeObjectURL(url)
                              }}
                              className="text-xs text-blue-600 underline hover:text-blue-800"
                            >
                              📥 Descargar SVG
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tiempo estimado */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Tiempo estimado:</span>
              <span className="text-2xl font-bold text-blue-600">
                {task.estimated_hours}h
              </span>
            </div>
          </div>

          {/* Instrucciones */}
          {hasInstructions ? (
            <div className="space-y-4">
              {tipoDiseno && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tipoDiseno.split(',').filter(Boolean).map((dept: string) => {
                    const deptInfo: Record<string, { icon: string; label: string; color: string }> = {
                      furniture: { icon: '🪑', label: 'Muebles', color: 'bg-amber-100 text-amber-700' },
                      exterior:  { icon: '🚐', label: 'Exterior', color: 'bg-blue-100 text-blue-700' },
                      interior:  { icon: '🏠', label: 'Interior', color: 'bg-green-100 text-green-700' },
                    }
                    const info = deptInfo[dept.trim()] || { icon: '📐', label: dept, color: 'bg-purple-100 text-purple-700' }
                    return (
                      <span key={dept} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${info.color}`}>
                        {info.icon} {info.label}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="bg-amber-50 border-l-4 border-amber-500 p-5 rounded-r-lg">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-3">
                  📋 Instrucciones de trabajo
                </p>
                <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {instructions}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 mb-2">
                  💡 Recuerda
                </p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Lee las instrucciones completamente antes de empezar</li>
                  <li>• Verifica que tienes todas las herramientas necesarias</li>
                  <li>• Si algo no está claro, consulta con el encargado</li>
                </ul>
              </div>
            </div>
          ) : blueprints.length > 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-700 mb-2">💡 Información</p>
              <p className="text-sm text-green-700">
                {isCuttingTask
                  ? 'Sigue el plano de despiece de arriba para cortar las piezas según las medidas indicadas.'
                  : isAssemblyTask
                  ? 'Sigue el plano de montaje de arriba para ensamblar el mueble.'
                  : 'Consulta los planos técnicos de arriba para realizar esta tarea.'}
              </p>
            </div>
          ) : !loadingFiles ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-500 font-medium">No hay instrucciones específicas</p>
              <p className="text-sm text-gray-400 mt-2">
                Procede con el procedimiento estándar para este tipo de tarea
              </p>
            </div>
          ) : null}
        </CardContent>

        <div className="border-t p-4 bg-gray-50 flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            {mode === 'view' ? '← Cerrar' : '← Volver'}
          </Button>
          {mode === 'start' && (
            <Button
              onClick={onConfirm}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
            >
              ▶ Iniciar Tarea
            </Button>
          )}
        </div>
      </Card>

      {/* Fullscreen SVG overlay */}
      {fullscreenSvg && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col"
             onClick={() => setFullscreenSvg(null)}>
          <div className="flex justify-between items-center p-3 bg-gray-900">
            <span className="text-white text-sm font-medium">📐 Plano técnico — toca para cerrar</span>
            <button
              onClick={() => setFullscreenSvg(null)}
              className="text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-bold"
            >
              ✕ Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2" onClick={e => e.stopPropagation()}>
            <div
              className="w-full h-full flex items-start justify-center"
              dangerouslySetInnerHTML={{ __html: fullscreenSvg.replace(
                /^<svg ([^>]*)>/,
                (_, attrs) => `<svg ${attrs} style="width:100%;height:auto;max-width:100%;display:block;">`
              ) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}