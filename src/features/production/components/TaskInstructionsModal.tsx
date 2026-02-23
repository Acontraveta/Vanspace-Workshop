import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { ProductionTask } from '@/features/calendar/types/production.types'
import { useEffect, useState } from 'react'
import { DesignFilesService, DesignFile } from '../services/designFilesService'

interface BlueprintInfo {
  itemName: string
  svg: string
  type: 'cutlist' | 'assembly'  // cutlist = despiece, assembly = plano de montaje
}

interface TaskInstructionsModalProps {
  task: ProductionTask
  onConfirm: () => void
  onCancel: () => void
}

export default function TaskInstructionsModal({
  task,
  onConfirm,
  onCancel
}: TaskInstructionsModalProps) {
  const instructions = task.instructions_design || ''
  const tipoDiseno = (task as any).tipo_diseno || ''
  const hasInstructions = instructions.length > 0
  const [designFiles, setDesignFiles] = useState<DesignFile[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintInfo[]>([])
  const [expandedBlueprint, setExpandedBlueprint] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)

  const isFurnitureBlock = (task as any).task_block_id === 'MUEBLES_GROUP'
  const isCuttingTask = isFurnitureBlock && /cort|despiece/i.test(task.task_name)
  const isAssemblyTask = isFurnitureBlock && /ensambl/i.test(task.task_name)
  const taskBlockOrder = (task as any).block_order as number | undefined

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
          console.log('📐 TaskInstructions: loading blueprints for', task.task_name, 'project:', task.project_id)
          const { FurnitureWorkOrderService, FurnitureDesignService } =
            await import('@/features/design/services/furnitureDesignService')
          const wo = await FurnitureWorkOrderService.getByProject(task.project_id)
          console.log('📐 WO encontrada:', wo?.id, 'cutlist_svg:', !!wo?.cutlist_svg)
          if (!wo) { setLoadingFiles(false); return }

          const bps: BlueprintInfo[] = []
          const designs = await FurnitureDesignService.getByWorkOrder(wo.id)
          console.log('📐 Diseños cargados:', designs.length, 'con plano:', designs.filter(d => d.blueprint_svg).length)

          if (isCuttingTask) {
            // Cutting task → show the specific board's cut-list SVG
            const boardSvgs = (wo as any).board_cutlist_svgs as string[] | undefined
            const boardIdx = taskBlockOrder ?? 0
            if (boardSvgs && boardSvgs[boardIdx]) {
              bps.push({ itemName: task.task_name, svg: boardSvgs[boardIdx], type: 'cutlist' })
            } else if (wo.cutlist_svg) {
              // Fallback: show the combined cutlist
              bps.push({ itemName: 'Despiece total', svg: wo.cutlist_svg, type: 'cutlist' })
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
              console.warn('📐 No se encontró plano para:', task.product_name, 'diseños:', designs.map(d => d.quote_item_name))
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

          console.log('📐 Planos encontrados:', bps.length, bps.map(b => b.itemName))
          setBlueprints(bps)
        } catch (err) {
          console.error('📐 Error cargando planos:', err)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="flex items-center gap-3">
            <span className="text-3xl">▶</span>
            <div>
              <h2 className="text-xl font-bold">{task.task_name}</h2>
              <p className="text-sm text-blue-100 mt-1">{task.product_name}</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
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
                  const icon = bp.type === 'cutlist' ? '📋' : '🪑'
                  const borderColor = bp.type === 'cutlist' ? 'border-blue-200' : 'border-green-200'
                  const bgColor = bp.type === 'cutlist' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-green-50 hover:bg-green-100'
                  const textColor = bp.type === 'cutlist' ? 'text-blue-800' : 'text-green-800'
                  const labelColor = bp.type === 'cutlist' ? 'text-blue-600' : 'text-green-600'
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
                            className="w-full overflow-auto"
                            dangerouslySetInnerHTML={{ __html: bp.svg }}
                          />
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
                            className="mt-2 text-xs text-blue-600 underline hover:text-blue-800"
                          >
                            📥 Descargar plano SVG
                          </button>
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-purple-100 text-purple-700 mb-2">
                  📐 Tipo: {tipoDiseno}
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
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-gray-500 font-medium">No hay instrucciones específicas</p>
              <p className="text-sm text-gray-400 mt-2">
                Procede con el procedimiento estándar para este tipo de tarea
              </p>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 bg-gray-50 flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            ← Volver
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            ▶ Iniciar Tarea
          </Button>
        </div>
      </Card>
    </div>
  )
}