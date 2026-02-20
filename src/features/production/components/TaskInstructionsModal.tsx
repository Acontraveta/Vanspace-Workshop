import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { ProductionTask } from '@/features/calendar/types/production.types'
import { useEffect, useState } from 'react'
import { DesignFilesService, DesignFile } from '../services/designFilesService'

interface BlueprintInfo {
  itemName: string
  svg: string
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

  useEffect(() => {
    const loadFiles = async () => {
      // Load attached design files
      const blockId = (task as any).task_block_id || task.product_name
      if (blockId) {
        const files = await DesignFilesService.getBlockFiles(blockId)
        setDesignFiles(files)
      }

      // Load furniture blueprints if task requires design
      if (task.requires_design && task.project_id) {
        try {
          const { FurnitureWorkOrderService, FurnitureDesignService } =
            await import('@/features/design/services/furnitureDesignService')
          const wo = await FurnitureWorkOrderService.getByProject(task.project_id)
          if (wo) {
            const designs = await FurnitureDesignService.getByWorkOrder(wo.id)
            const bps: BlueprintInfo[] = designs
              .filter(d => d.blueprint_svg)
              .map(d => ({ itemName: d.quote_item_name, svg: d.blueprint_svg! }))
            setBlueprints(bps)
          }
        } catch {
          // non-critical — blueprints just won't show
        }
      }

      setLoadingFiles(false)
    }
    loadFiles()
  }, [task])

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
                📐 Planos técnicos de muebles
              </p>
              <div className="space-y-3">
                {blueprints.map(bp => {
                  const isExpanded = expandedBlueprint === bp.itemName
                  return (
                    <div key={bp.itemName} className="border-2 border-green-200 rounded-xl overflow-hidden bg-white">
                      <button
                        onClick={() => setExpandedBlueprint(isExpanded ? null : bp.itemName)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-green-50 hover:bg-green-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🪑</span>
                          <span className="font-bold text-sm text-green-800">{bp.itemName}</span>
                        </div>
                        <span className="text-xs text-green-600 font-medium">
                          {isExpanded ? '▲ Ocultar' : '▼ Ver plano'}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="p-3 border-t border-green-200 bg-gray-50">
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