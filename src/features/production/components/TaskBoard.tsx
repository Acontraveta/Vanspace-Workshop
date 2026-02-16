import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionProject, ProductionTask } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ProductionService } from '@/features/calendar/services/productionService'
import toast from 'react-hot-toast'

interface TaskBoardProps {
  projects: ProductionProject[]
  employees: ProductionEmployee[]
  onRefresh: () => void
  compactMode?: boolean
}

export default function TaskBoard({ projects, employees, onRefresh, compactMode = false }: TaskBoardProps) {
  const [allTasks, setAllTasks] = useState<ProductionTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null)
  const [actualHours, setActualHours] = useState('')

  useEffect(() => {
    loadAllTasks()
  }, [projects])

  const loadAllTasks = async () => {
    try {
      const tasksPromises = projects.map(p => ProductionService.getProjectTasks(p.id))
      const tasksArrays = await Promise.all(tasksPromises)
      const tasks = tasksArrays.flat()
      setAllTasks(tasks)
    } catch (error) {
      console.error('Error cargando tareas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = async (task: ProductionTask) => {
    try {
      await ProductionService.updateTask(task.id, {
        status: 'IN_PROGRESS',
        assigned_date: new Date().toISOString().split('T')[0]
      })
      
      toast.success('Tarea iniciada')
      loadAllTasks()
      onRefresh()
    } catch (error) {
      toast.error('Error iniciando tarea')
    }
  }

  const handleCompleteTask = async (task: ProductionTask) => {
    setSelectedTask(task)
    setActualHours(task.estimated_hours.toString())
  }

  const confirmCompleteTask = async () => {
    if (!selectedTask) return

    try {
      await ProductionService.updateTask(selectedTask.id, {
        status: 'COMPLETED',
        actual_hours: parseFloat(actualHours) || selectedTask.estimated_hours,
        completed_at: new Date().toISOString()
      })
      
      toast.success('✅ Tarea completada')
      setSelectedTask(null)
      loadAllTasks()
      onRefresh()
    } catch (error) {
      toast.error('Error completando tarea')
    }
  }

  const handleAssignEmployee = async (taskId: string, employeeId: string) => {
    try {
      await ProductionService.updateTask(taskId, {
        assigned_to: employeeId
      })
      
      toast.success('Empleado asignado')
      loadAllTasks()
    } catch (error) {
      toast.error('Error asignando empleado')
    }
  }

  const pendingTasks = allTasks.filter(t => t.status === 'PENDING')
  const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS')
  const completedTasks = allTasks.filter(t => t.status === 'COMPLETED')
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED')

  const TaskCard = ({ task }: { task: ProductionTask }) => {
    const project = projects.find(p => p.id === task.project_id)
    const assignedEmployee = employees.find(e => e.id === task.assigned_to)

    return (
      <Card className={`
        mb-3 cursor-move hover:shadow-md transition
        ${task.status === 'BLOCKED' ? 'border-orange-300 bg-orange-50' : ''}
      `}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{task.task_name}</h4>
              {task.product_name && (
                <p className="text-xs text-gray-600">{task.product_name}</p>
              )}
              {!compactMode && project && (
                <p className="text-xs text-blue-600 mt-1">{project.quote_number}</p>
              )}
            </div>
            <Badge variant={task.status === 'BLOCKED' ? 'destructive' : 'default'} className="text-xs">
              {task.estimated_hours}h
            </Badge>
          </div>

          {/* Empleado asignado */}
          <div className="mb-2">
            <select
              value={task.assigned_to || ''}
              onChange={(e) => handleAssignEmployee(task.id, e.target.value)}
              className="w-full text-xs px-2 py-1 border rounded"
              disabled={task.status === 'COMPLETED'}
            >
              <option value="">Sin asignar</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre} - {emp.rol}
                </option>
              ))}
            </select>
          </div>

          {/* Bloqueos */}
          {task.status === 'BLOCKED' && task.blocked_reason && (
            <div className="mb-2 text-xs bg-orange-100 border border-orange-200 rounded p-2">
              ⚠️ {task.blocked_reason}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2">
            {task.status === 'PENDING' && (
              <Button
                onClick={() => handleStartTask(task)}
                size="sm"
                className="flex-1 text-xs"
                disabled={!task.assigned_to}
              >
                ▶ Iniciar
              </Button>
            )}

            {task.status === 'IN_PROGRESS' && (
              <Button
                onClick={() => handleCompleteTask(task)}
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
              >
                ✅ Completar
              </Button>
            )}

            {task.status === 'COMPLETED' && task.actual_hours && (
              <div className="text-xs text-green-600 text-center w-full">
                ✅ {task.actual_hours}h trabajadas
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-600">Cargando tareas...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Kanban Board */}
      <div className="flex flex-col md:grid md:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible">
        {/* Pendientes */}
        <div className="min-w-[280px] md:min-w-0 flex-shrink-0">
          <div className="bg-gray-100 rounded-t-lg p-3 border-b-4 border-gray-400">
            <h3 className="font-bold flex items-center justify-between">
              <span>⏳ Pendientes</span>
              <Badge variant="secondary">{pendingTasks.length}</Badge>
            </h3>
          </div>
          <div className="bg-gray-50 rounded-b-lg p-3 min-h-[400px]">
            {pendingTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* En Progreso */}
        <div className="min-w-[280px] md:min-w-0 flex-shrink-0">
          <div className="bg-blue-100 rounded-t-lg p-3 border-b-4 border-blue-500">
            <h3 className="font-bold flex items-center justify-between">
              <span>🔄 En Progreso</span>
              <Badge variant="default">{inProgressTasks.length}</Badge>
            </h3>
          </div>
          <div className="bg-blue-50 rounded-b-lg p-3 min-h-[400px]">
            {inProgressTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Completadas */}
        <div className="min-w-[280px] md:min-w-0 flex-shrink-0">
          <div className="bg-green-100 rounded-t-lg p-3 border-b-4 border-green-500">
            <h3 className="font-bold flex items-center justify-between">
              <span>✅ Completadas</span>
              <Badge variant="success">{completedTasks.length}</Badge>
            </h3>
          </div>
          <div className="bg-green-50 rounded-b-lg p-3 min-h-[400px]">
            {completedTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Bloqueadas */}
        <div className="min-w-[280px] md:min-w-0 flex-shrink-0">
          <div className="bg-orange-100 rounded-t-lg p-3 border-b-4 border-orange-500">
            <h3 className="font-bold flex items-center justify-between">
              <span>🚫 Bloqueadas</span>
              <Badge variant="warning">{blockedTasks.length}</Badge>
            </h3>
          </div>
          <div className="bg-orange-50 rounded-b-lg p-3 min-h-[400px]">
            {blockedTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      </div>

      {/* Modal completar tarea */}
      {selectedTask && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedTask(null)}
        >
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>✅ Completar Tarea</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="font-bold">{selectedTask.task_name}</p>
                <p className="text-sm text-gray-600">{selectedTask.product_name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Horas reales trabajadas:
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  placeholder="Horas"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Estimadas: {selectedTask.estimated_hours}h
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={confirmCompleteTask}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  ✅ Confirmar
                </Button>
                <Button
                  onClick={() => setSelectedTask(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}