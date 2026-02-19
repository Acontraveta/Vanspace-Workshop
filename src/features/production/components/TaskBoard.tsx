import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { ProductionService } from '@/features/calendar/services/productionService'
import { ProductionTask, ProductionProject } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ConfigService } from '@/features/config/services/configService'
import { DesignFilesService } from '../services/designFilesService'
import TaskStartModal from './TaskStartModal'
import TaskInstructionsModal from './TaskInstructionsModal'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TaskBlock {
  blockId: string
  productName: string
  catalogSku: string
  project: ProductionProject | undefined
  tasks: ProductionTask[]
  status: 'pending' | 'in_progress' | 'completed'
  materialsCollected: boolean
  assignedTo?: string
}

interface TaskBoardProps {
  projects: ProductionProject[]
  employees: ProductionEmployee[]
  onRefresh: () => void
  viewMode?: 'my_tasks' | 'all_tasks'
  currentUserId?: string
  canAssignTasks?: boolean
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TaskBoard({
  projects,
  employees,
  onRefresh,
  viewMode = 'all_tasks',
  currentUserId,
  canAssignTasks = false
}: TaskBoardProps) {
  const [blocks, setBlocks] = useState<TaskBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null)
  
  // Modales
  const [taskToStart, setTaskToStart] = useState<ProductionTask | null>(null) // Modal materiales
  const [taskToShowInstructions, setTaskToShowInstructions] = useState<ProductionTask | null>(null) // Modal instrucciones
  const [assignModalBlock, setAssignModalBlock] = useState<TaskBlock | null>(null) // Modal asignar
  
  // Estados
    const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
    const [uploadProgress, setUploadProgress] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [taskStartTime, setTaskStartTime] = useState<Record<string, string>>({})

  useEffect(() => { loadData() }, [projects])

  const loadData = async () => {
    try {
      const tasksArrays = await Promise.all(
        projects.map(p => ProductionService.getProjectTasks(p.id))
      )
      const allTasks = tasksArrays.flat()

      // Auto-desbloquear tareas BLOCKED cuyos materiales ya están en stock
      // (no-op si falla, para no romper la carga de datos)
      try {
        await autoUnblockIfStockAvailable(allTasks)
      } catch (e) {
        console.warn('autoUnblockIfStockAvailable error (ignorado):', e)
      }

      // Volver a cargar para reflejar posibles cambios de estado
      const refreshedArrays = await Promise.all(
        projects.map(p => ProductionService.getProjectTasks(p.id))
      )
      const refreshedTasks = refreshedArrays.flat()

      // Filtrar según modo
      const filteredTasks = viewMode === 'my_tasks'
        ? refreshedTasks.filter(t => t.assigned_to === currentUserId)
        : refreshedTasks

      const rawBlocks = groupIntoBlocks(filteredTasks, projects)

      // En vista del operario, ordenar bloques por fecha de entrega del proyecto (más próxima primero)
      if (viewMode === 'my_tasks') {
        rawBlocks.sort((a, b) => {
          const dateA = a.project?.end_date ? new Date(a.project.end_date).getTime() : Infinity
          const dateB = b.project?.end_date ? new Date(b.project.end_date).getTime() : Infinity
          return dateA - dateB
        })
      }

      setBlocks(rawBlocks)
    } catch {
      toast.error('Error cargando tareas')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Para cada tarea BLOCKED, verifica si todos sus materiales están disponibles en stock.
   * Si sí, la desbloquea automáticamente.
   */
  const autoUnblockIfStockAvailable = async (tasks: ProductionTask[]) => {
    const blockedTasks = tasks.filter(t => t.status === 'BLOCKED')
    if (blockedTasks.length === 0) return

    for (const task of blockedTasks) {
      // Safely resolve materials array: handle parsed array OR JSON string
      const parseSafe = (v: any): any[] => {
        if (!v) return []
        if (Array.isArray(v)) return v
        if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
        return []
      }
      const mats = [
        ...parseSafe((task as any).materials || (task as any).materials_list),
      ].map((m: any) => ({
        name: m.name || m.nombre || '',
        quantity: Number(m.quantity || m.cantidad || 0),
      }))

      if (mats.length === 0) {
        // Sin lista de materiales → desbloquear directamente
        await ProductionService.updateTask(task.id, {
          status: 'PENDING',
          blocked_reason: null,
          material_ready: true,
        })
        continue
      }

      // Consultar stock de cada material
      let allInStock = true
      for (const mat of mats) {
        if (!mat.name) continue
        const { data } = await supabase
          .from('stock_items')
          .select('cantidad')
          .ilike('articulo', `%${mat.name}%`)
          .maybeSingle()
        const available = data?.cantidad ?? 0
        if (available < mat.quantity) {
          allInStock = false
          break
        }
      }

      if (allInStock) {
        await ProductionService.updateTask(task.id, {
          status: 'PENDING',
          blocked_reason: null,
          material_ready: true,
        })
      }
    }
  }

  const groupIntoBlocks = (tasks: ProductionTask[], projs: ProductionProject[]): TaskBlock[] => {
    const blockMap: Record<string, ProductionTask[]> = {}
    tasks.forEach(task => {
      const key = (task as any).task_block_id || task.product_name || 'sin-producto'
      if (!blockMap[key]) blockMap[key] = []
      blockMap[key].push(task)
    })

    return Object.entries(blockMap).map(([blockId, blockTasks]) => {
      const sorted = [...blockTasks].sort((a, b) =>
        ((a as any).block_order ?? a.order_index ?? 0) -
        ((b as any).block_order ?? b.order_index ?? 0)
      )
      const allCompleted = sorted.every(t => t.status === 'COMPLETED')
      const anyInProgress = sorted.some(t => t.status === 'IN_PROGRESS')
      const first = sorted[0]

      return {
        blockId,
        productName: first?.product_name || blockId,
        catalogSku: (first as any)?.catalog_sku || '',
        project: projs.find(p => p.id === first?.project_id),
        tasks: sorted,
        status: allCompleted ? 'completed' : anyInProgress ? 'in_progress' : 'pending',
        materialsCollected: sorted.some(t => (t as any).materials_collected === true),
        assignedTo: first?.assigned_to
      }
    })
  }

  // Iniciar bloque → mostrar modal de materiales SOLO la primera vez
  const handleStartBlock = (block: TaskBlock) => {
    const firstPending = block.tasks.find(t => t.status === 'PENDING')
    if (!firstPending) return

    if (!block.materialsCollected) {
      // Primera vez → modal de materiales
      setTaskToStart(firstPending)
    } else {
      // Bloque ya iniciado → directo a instrucciones
      setTaskToShowInstructions(firstPending)
    }
  }

  // Confirmar modal de materiales → reservar materiales del stock + marcar bloque iniciado
  const confirmMaterialsCollected = async () => {
    if (!taskToStart) return
    
    try {
      const block = blocks.find(b => b.tasks.some(t => t.id === taskToStart.id))
      if (block) {
        await Promise.all(
          block.tasks.map(t =>
            ProductionService.updateTask(t.id, { materials_collected: true } as any)
          )
        )
      }

      // ── Reservar materiales del stock ────────────────────────────────────
      // Soporta tanto 'materials' (quoteAutomation) como 'materials_list' (calendarService)
      const allMaterials = [
        ...((taskToStart as any).materials || (taskToStart as any).materials_list || [])
          .map((m: any) => ({ name: m.name || m.nombre, quantity: m.quantity || m.cantidad || 0, unit: m.unit || m.unidad || 'ud', item_type: 'material' })),
        ...((taskToStart as any).consumables || (taskToStart as any).consumables_list || [])
          .map((c: any) => ({ name: c.name || c.nombre, quantity: c.quantity || c.cantidad || 0, unit: c.unit || c.unidad || 'ud', item_type: 'consumable' })),
      ] as { name: string; quantity: number; unit: string; item_type: string }[]

      for (const mat of allMaterials) {
        if (!mat.name) continue

        // Buscar en stock
        const { data: stockRow } = await supabase
          .from('stock_items')
          .select('referencia, cantidad')
          .ilike('articulo', `%${mat.name}%`)
          .maybeSingle()

        if (stockRow) {
          // Descontar cantidad del stock
          const newQty = Math.max(0, (stockRow.cantidad ?? 0) - (mat.quantity ?? 0))
          await supabase
            .from('stock_items')
            .update({ cantidad: newQty })
            .eq('referencia', stockRow.referencia)
        }

        // Registrar en lista de materiales en uso
        await supabase.from('task_material_usage').insert({
          task_id: taskToStart.id,
          project_id: taskToStart.project_id,
          material_name: mat.name,
          referencia: stockRow?.referencia ?? null,
          quantity: mat.quantity ?? 0,
          unit: mat.unit ?? 'ud',
          item_type: mat.item_type,
          status: 'in_use',
        })
      }

      if (allMaterials.length > 0) {
        toast.success(`📦 ${allMaterials.length} material(es) retirado(s) del almacén`, { duration: 3000 })
      }
      // ────────────────────────────────────────────────────────────────────

      const taskToStartNext = taskToStart
      setTaskToStart(null)
      setTaskToShowInstructions(taskToStartNext)
    } catch (err) {
      console.error('Error iniciando tarea:', err)
      toast.error('Error al retirar materiales del stock')
    }
  }

  // Confirmar inicio de tarea → registrar hora de inicio
  const confirmStartTask = async () => {
    const task = taskToShowInstructions
    if (!task) return
    
    try {
      const startTime = new Date().toISOString()
      
      await ProductionService.updateTask(task.id, {
        status: 'IN_PROGRESS',
        started_at: startTime
      } as any)
      
      setTaskStartTime(prev => ({ ...prev, [task.id]: startTime }))
      toast.success(`▶ Iniciada: ${task.task_name}`)
      setTaskToShowInstructions(null)
      loadData()
      onRefresh()
    } catch {
      toast.error('Error iniciando tarea')
    }
  }

  const handlePauseTask = async (task: ProductionTask) => {
    if (!confirm('¿Pausar esta tarea?')) return
    try {
      await ProductionService.updateTask(task.id, { status: 'PENDING' })
      toast.success('⏸ Tarea pausada')
      loadData()
      onRefresh()
    } catch {
      toast.error('Error pausando tarea')
    }
  }

  const handleCompleteTask = async (task: ProductionTask) => {
    // Verificar que tenga started_at
    const startTime = taskStartTime[task.id] || (task as any).started_at
    if (!startTime) {
      toast.error('Error: esta tarea no tiene hora de inicio registrada')
      return
    }
    // Calcular tiempo transcurrido
    const now = new Date()
    const start = new Date(startTime)
    const diffMs = now.getTime() - start.getTime()
    const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
    if (!confirm(`¿Completar esta tarea?\n\n${task.task_name}\n⏱️ Tiempo trabajado: ${diffHours}h`)) {
      return
    }
    // Completar directamente
    const endTime = new Date().toISOString()
    try {
      await ProductionService.updateTask(task.id, {
        status: 'COMPLETED',
        actual_hours: diffHours,
        completed_at: endTime
      })

      // Marcar los materiales en uso como consumidos
      await supabase
        .from('task_material_usage')
        .update({ status: 'consumed', consumed_at: endTime })
        .eq('task_id', task.id)
        .eq('status', 'in_use')
      // Comparación con tiempo estimado
      const diff = diffHours - task.estimated_hours
      const diffPercent = Math.round((diff / task.estimated_hours) * 100)
      const diffText = diff > 0 
        ? `${diff.toFixed(1)}h más (+${diffPercent}%)` 
        : `${Math.abs(diff).toFixed(1)}h menos (${diffPercent}%)`
      toast.success(
        `✅ ${task.task_name} completada\n⏱️ ${diffHours.toFixed(1)}h (${diffText})`,
        { duration: 5000 }
      )
      // Buscar siguiente tarea del bloque
      const block = blocks.find(b => b.tasks.some(t => t.id === task.id))
      if (block) {
        const nextTask = block.tasks.find(t => t.status === 'PENDING')
        if (nextTask) {
          setTimeout(() => {
            if (confirm(`¿Continuar con la siguiente tarea?\n\n${nextTask.task_name}`)) {
              setTaskToShowInstructions(nextTask)
            }
          }, 500)
        } else {
          toast.success('🎉 ¡Bloque completado!', { duration: 3000 })
        }
      }
      loadData()
      onRefresh()
    } catch {
      toast.error('Error completando tarea')
    }
  }


  const handleAssignBlock = async () => {
    if (!assignModalBlock || !selectedEmployee) return
    try {
      await Promise.all(
        assignModalBlock.tasks.map(t =>
          ProductionService.updateTask(t.id, { assigned_to: selectedEmployee })
        )
      )
      toast.success(`✅ Bloque asignado`)
      setAssignModalBlock(null)
      setSelectedEmployee('')
      loadData()
      onRefresh()
    } catch {
      toast.error('Error asignando bloque')
    }
  }

  // KPIs
  const allTasks = blocks.flatMap(b => b.tasks)
  const completedToday = allTasks.filter(t => {
    if (t.status !== 'COMPLETED' || !t.completed_at) return false
    return t.completed_at.split('T')[0] === new Date().toISOString().split('T')[0]
  })
  const hoursToday = completedToday.reduce((s, t) => s + (t.actual_hours || 0), 0)
  const pendingBlocks = blocks.filter(b => b.status === 'pending')
  const inProgressBlocks = blocks.filter(b => b.status === 'in_progress')
  const unassignedBlocks = blocks.filter(b => !b.assignedTo)

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Bloques pendientes" value={pendingBlocks.length} color="orange" />
        <KpiCard label="En progreso" value={inProgressBlocks.length} color="blue" />
        <KpiCard label="Completadas hoy" value={completedToday.length} color="green" />
        {canAssignTasks ? (
          <KpiCard label="Sin asignar" value={unassignedBlocks.length} color="red" />
        ) : (
          <KpiCard label="Horas hoy" value={`${hoursToday.toFixed(1)}h`} color="purple" />
        )}
      </div>

      {/* Bloques sin asignar */}
      {canAssignTasks && unassignedBlocks.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">⚠️ Sin Asignar</h2>
          <div className="space-y-3">
            {unassignedBlocks.map(block => (
              <BlockCard
                key={block.blockId}
                block={block}
                expanded={expandedBlock === block.blockId}
                onToggle={() => setExpandedBlock(expandedBlock === block.blockId ? null : block.blockId)}
                onStart={() => handleStartBlock(block)}
                onPause={handlePauseTask}
                onComplete={handleCompleteTask}
                canAssign={canAssignTasks}
                onAssign={() => setAssignModalBlock(block)}
                employees={employees}
              />
            ))}
          </div>
        </section>
      )}

      {/* Bloques en progreso */}
      {inProgressBlocks.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            Trabajando Ahora
          </h2>
          <div className="space-y-3">
            {inProgressBlocks.map(block => (
              <BlockCard
                key={block.blockId}
                block={block}
                expanded={expandedBlock === block.blockId}
                onToggle={() => setExpandedBlock(expandedBlock === block.blockId ? null : block.blockId)}
                onStart={() => handleStartBlock(block)}
                onPause={handlePauseTask}
                onComplete={handleCompleteTask}
                canAssign={canAssignTasks}
                onAssign={() => setAssignModalBlock(block)}
                employees={employees}
              />
            ))}
          </div>
        </section>
      )}

      {/* Bloques pendientes */}
      {pendingBlocks.filter(b => canAssignTasks || b.assignedTo).length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">📋 Pendientes</h2>
          <div className="space-y-3">
            {pendingBlocks.filter(b => canAssignTasks || b.assignedTo).map(block => (
              <BlockCard
                key={block.blockId}
                block={block}
                expanded={expandedBlock === block.blockId}
                onToggle={() => setExpandedBlock(expandedBlock === block.blockId ? null : block.blockId)}
                onStart={() => handleStartBlock(block)}
                onPause={handlePauseTask}
                onComplete={handleCompleteTask}
                canAssign={canAssignTasks}
                onAssign={() => setAssignModalBlock(block)}
                employees={employees}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sin bloques */}
      {blocks.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-2">
              {viewMode === 'my_tasks' ? 'No tienes tareas asignadas' : 'No hay bloques disponibles'}
            </h3>
            <p className="text-gray-600">
              {viewMode === 'my_tasks'
                ? 'Habla con tu encargado para que te asigne trabajo'
                : 'Los bloques aparecerán cuando se creen tareas en los proyectos'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal completar tarea */}


      {/* Modal asignar bloque */}
      {assignModalBlock && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setAssignModalBlock(null)}>
          <Card className="max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle>👤 Asignar Bloque</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="font-bold">{assignModalBlock.productName}</p>
                <p className="text-sm text-gray-600">{assignModalBlock.tasks.length} tareas</p>
                {assignModalBlock.tasks.some(t => (t as any).requiere_diseno) && (
                  <Badge className="mt-2 bg-purple-100 text-purple-700">
                    📐 Requiere diseño
                  </Badge>
                )}
              </div>

              {/* Selector de empleado */}
              <div>
                <label className="block text-sm font-medium mb-2">Asignar a:</label>
                <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}
                  className="w-full px-3 py-2 border rounded">
                  <option value="">Selecciona un empleado</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Subida de archivos de diseño */}
              {assignModalBlock.tasks.some(t => (t as any).requiere_diseno) && (
                <div className="border-2 border-dashed border-purple-300 rounded-lg p-4 bg-purple-50">
                  <p className="text-sm font-semibold text-purple-700 mb-2">
                    📎 Archivos de diseño (opcional)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files) {
                        setUploadingFiles(Array.from(e.target.files))
                      }
                    }}
                    className="w-full text-sm"
                  />
                  {uploadingFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadingFiles.map((file, idx) => (
                        <div key={idx} className="text-xs bg-white rounded p-2 flex items-center justify-between">
                          <span className="truncate">{file.name}</span>
                          <span className="text-gray-500">{(file.size / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={async () => {
                    if (!selectedEmployee) {
                      toast.error('Selecciona un empleado')
                      return
                    }
                    setUploadProgress(true)
                    try {
                      // 1. Asignar tareas
                      await Promise.all(
                        assignModalBlock.tasks.map(t =>
                          ProductionService.updateTask(t.id, { assigned_to: selectedEmployee })
                        )
                      )
                      // 2. Subir archivos si hay
                      if (uploadingFiles.length > 0) {
                        const projectId = assignModalBlock.project?.id || ''
                        await Promise.all(
                          uploadingFiles.map(file =>
                            DesignFilesService.uploadFile(
                              file,
                              assignModalBlock.blockId,
                              projectId,
                              selectedEmployee
                            )
                          )
                        )
                        toast.success(`✅ Bloque asignado con ${uploadingFiles.length} archivo(s)`)
                      } else {
                        toast.success(`✅ Bloque asignado`)
                      }
                      setAssignModalBlock(null)
                      setSelectedEmployee('')
                      setUploadingFiles([])
                      loadData()
                      onRefresh()
                    } catch {
                      toast.error('Error asignando bloque')
                    } finally {
                      setUploadProgress(false)
                    }
                  }}
                  className="flex-1" 
                  disabled={!selectedEmployee || uploadProgress}
                >
                  {uploadProgress ? '⏳ Asignando...' : '✅ Asignar'}
                </Button>
                <Button onClick={() => {
                  setAssignModalBlock(null)
                  setUploadingFiles([])
                }} variant="outline" className="flex-1">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal instrucciones (cada tarea) */}
      {taskToShowInstructions && (
        <TaskInstructionsModal
          task={taskToShowInstructions}
          onConfirm={confirmStartTask}
          onCancel={() => setTaskToShowInstructions(null)}
        />
      )}

      {/* Modal materiales (solo primera vez) */}
      {taskToStart && (
        <TaskStartModal
          task={taskToStart}
          onConfirm={confirmMaterialsCollected}
          onCancel={() => setTaskToStart(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    orange: 'text-orange-600', blue: 'text-blue-600',
    green: 'text-green-600', purple: 'text-purple-600', red: 'text-red-600'
  }
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function BlockCard({
  block, expanded, onToggle, onStart, onPause, onComplete, canAssign, onAssign, employees
}: {
  block: TaskBlock
  expanded: boolean
  onToggle: () => void
  onStart: () => void
  onPause: (task: ProductionTask) => void
  onComplete: (task: ProductionTask) => void
  canAssign?: boolean
  onAssign?: () => void
  employees?: ProductionEmployee[]
}) {
  const completedCount = block.tasks.filter(t => t.status === 'COMPLETED').length
  const totalCount = block.tasks.length
  const progress = Math.round((completedCount / totalCount) * 100)
  const currentTask = block.tasks.find(t => t.status === 'IN_PROGRESS')
    || block.tasks.find(t => t.status === 'PENDING')
  const totalHours = block.tasks.reduce((s, t) => s + (t.estimated_hours || 0), 0)
  const assignedEmployee = employees?.find(e => e.id === block.assignedTo)

  const borderColor = block.status === 'in_progress' ? 'border-blue-400'
    : block.status === 'completed' ? 'border-green-400' : 'border-gray-200'
  const bgColor = block.status === 'in_progress' ? 'bg-blue-50' : 'bg-white'

  return (
    <Card className={`border-2 ${borderColor} ${bgColor} transition-all`}>
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4 cursor-pointer select-none" onClick={onToggle}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${
            block.status === 'in_progress' ? 'bg-blue-100' :
            block.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {block.status === 'in_progress' ? '▶' :
             block.status === 'completed' ? '✅' : '📦'}
          </div>
          <div className="flex-1 min-w-0">
            {/* Vehículo destacado */}
            {block.project?.vehicle_model && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🚐</span>
                <p className="text-lg font-bold text-gray-900">
                  {block.project.vehicle_model}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-gray-700">{block.productName}</p>
              {block.catalogSku && <span className="text-xs text-gray-400 font-mono">{block.catalogSku}</span>}
              {assignedEmployee && (
                <Badge variant="secondary" className="text-xs">👤 {assignedEmployee.nombre}</Badge>
              )}
            </div>
            {block.project && (
              <p className="text-xs text-gray-500 mt-0.5">
                📋 {block.project.quote_number} · {block.project.client_name}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                }`} style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {completedCount}/{totalCount} · {totalHours}h
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 flex gap-2" onClick={e => e.stopPropagation()}>
            {canAssign && !block.assignedTo && (
              <Button onClick={onAssign} size="sm" variant="outline">👤 Asignar</Button>
            )}
            {block.status === 'pending' && block.assignedTo && (
              <Button onClick={onStart} size="sm" className="bg-blue-600 hover:bg-blue-700">▶ Iniciar</Button>
            )}
            {block.status === 'in_progress' && currentTask && (
              <>
                <Button onClick={() => onPause(currentTask)} variant="outline" size="sm">⏸</Button>
                <Button onClick={() => onComplete(currentTask)} size="sm"
                  className="bg-green-600 hover:bg-green-700">✅</Button>
              </>
            )}
            {block.status === 'completed' && (
              <Badge className="bg-green-600">✅ Completado</Badge>
            )}
          </div>
          <span className={`text-gray-400 text-sm transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}>▼</span>
        </div>
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Tareas del bloque
            </p>
            {block.tasks.map((task, idx) => (
              <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                task.status === 'COMPLETED' ? 'bg-green-50 border-green-200' :
                task.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-300' :
                task.status === 'BLOCKED' ? 'bg-orange-50 border-orange-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-green-500 text-white' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {task.status === 'COMPLETED' ? '✓' : idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${
                    task.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'
                  }`}>
                    {task.task_name}
                  </span>
                  {task.status === 'BLOCKED' && task.blocked_reason && (
                    <p className="text-xs text-orange-600 mt-0.5 whitespace-pre-line">
                      🔒 {task.blocked_reason}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{task.estimated_hours}h</span>
                <Badge variant="secondary" className={`text-xs flex-shrink-0 ${
                  task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'BLOCKED' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {task.status === 'COMPLETED' ? '✅' :
                   task.status === 'IN_PROGRESS' ? '▶ Activa' :
                   task.status === 'BLOCKED' ? '🔒 Bloqueada' : '⏳ Pendiente'}
                </Badge>
              </div>
            ))}
            <div className={`mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
              block.materialsCollected
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-yellow-50 text-yellow-700 border-yellow-200'
            }`}>
              {block.materialsCollected
                ? '✅ Materiales ya recogidos del almacén'
                : '⚠️ Recuerda recoger los materiales al iniciar'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}