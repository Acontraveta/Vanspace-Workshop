import { useState, useEffect } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { ProductionService } from '@/features/calendar/services/productionService'
import { ProductionTask, ProductionProject } from '@/features/calendar/types/production.types'
import { useAuth } from '@/app/providers/AuthProvider'
import toast from 'react-hot-toast'

export default function OperarioDashboard() {
  const { user } = useAuth()
  const [myTasks, setMyTasks] = useState<ProductionTask[]>([])
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null)
  const [actualHours, setActualHours] = useState('')

  useEffect(() => {
    loadMyTasks()
  }, [])

  const loadMyTasks = async () => {
    try {
      // Cargar todos los proyectos activos
      const allProjects = await ProductionService.getProjects()
      const activeProjects = allProjects.filter(p => 
        p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED'
      )

      // Cargar tareas de todos los proyectos
      const tasksPromises = activeProjects.map(p => ProductionService.getProjectTasks(p.id))
      const tasksArrays = await Promise.all(tasksPromises)
      const allTasks = tasksArrays.flat()

      // Filtrar solo MIS tareas
      const myFilteredTasks = allTasks.filter(t => t.assigned_to === user?.id)

      setMyTasks(myFilteredTasks)
      setProjects(activeProjects)
    } catch (error) {
      toast.error('Error cargando tareas')
    } finally {
      setLoading(false)
    }
  }

  const handleStartTask = async (task: ProductionTask) => {
    try {
      await ProductionService.updateTask(task.id, {
        status: 'IN_PROGRESS'
      })
      
      toast.success('Tarea iniciada')
      loadMyTasks()
    } catch (error) {
      toast.error('Error iniciando tarea')
    }
  }

  const handlePauseTask = async (task: ProductionTask) => {
    if (!confirm('¿Pausar esta tarea?')) return

    try {
      await ProductionService.updateTask(task.id, {
        status: 'PENDING'
      })
      
      toast.success('Tarea pausada')
      loadMyTasks()
    } catch (error) {
      toast.error('Error pausando tarea')
    }
  }

  const handleCompleteTask = (task: ProductionTask) => {
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
      loadMyTasks()
    } catch (error) {
      toast.error('Error completando tarea')
    }
  }

  const pendingTasks = myTasks.filter(t => t.status === 'PENDING')
  const inProgressTasks = myTasks.filter(t => t.status === 'IN_PROGRESS')
  const completedTodayTasks = myTasks.filter(t => {
    if (t.status !== 'COMPLETED' || !t.completed_at) return false
    const today = new Date().toISOString().split('T')[0]
    const completedDate = t.completed_at.split('T')[0]
    return completedDate === today
  })

  const totalHoursToday = completedTodayTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0)

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <Header
        title={`👷 Hola, ${user?.name || 'Operario'}`}
        description="Tus tareas del día"
      />

      <div className="p-8 space-y-6">
        {/* KPIs del operario */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Tareas Pendientes</p>
              <p className="text-4xl font-bold text-orange-600">{pendingTasks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">En Progreso</p>
              <p className="text-4xl font-bold text-blue-600">{inProgressTasks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Completadas Hoy</p>
              <p className="text-4xl font-bold text-green-600">{completedTodayTasks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Horas Hoy</p>
              <p className="text-4xl font-bold text-purple-600">{totalHoursToday.toFixed(1)}h</p>
            </CardContent>
          </Card>
        </div>

        {/* Tareas en progreso */}
        {inProgressTasks.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              Trabajando Ahora
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inProgressTasks.map(task => {
                const project = projects.find(p => p.id === task.project_id)
                return (
                  <Card key={task.id} className="border-blue-400 bg-blue-50">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg mb-1">{task.task_name}</h3>
                          {task.product_name && (
                            <p className="text-sm text-gray-600">{task.product_name}</p>
                          )}
                          {project && (
                            <p className="text-xs text-blue-600 mt-1">
                              📋 {project.quote_number} - {project.client_name}
                            </p>
                          )}
                        </div>
                        <Badge className="bg-blue-600">{task.estimated_hours}h</Badge>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => handlePauseTask(task)}
                          variant="outline"
                          className="flex-1"
                        >
                          ⏸ Pausar
                        </Button>
                        <Button
                          onClick={() => handleCompleteTask(task)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          ✅ Completar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Tareas pendientes */}
        {pendingTasks.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">📋 Tareas Pendientes</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pendingTasks.map(task => {
                const project = projects.find(p => p.id === task.project_id)
                return (
                  <Card key={task.id} className="hover:shadow-lg transition">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">{task.task_name}</h4>
                          {task.product_name && (
                            <p className="text-xs text-gray-600">{task.product_name}</p>
                          )}
                          {project && (
                            <p className="text-xs text-blue-600 mt-1">
                              {project.quote_number}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {task.estimated_hours}h
                        </Badge>
                      </div>

                      {task.status === 'BLOCKED' && (
                        <div className="mb-3 text-xs bg-orange-100 border border-orange-200 rounded p-2">
                          ⚠️ {task.blocked_reason || 'Tarea bloqueada'}
                        </div>
                      )}

                      <Button
                        onClick={() => handleStartTask(task)}
                        className="w-full"
                        size="sm"
                        disabled={task.status === 'BLOCKED'}
                      >
                        ▶ Iniciar
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Tareas completadas hoy */}
        {completedTodayTasks.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">✅ Completadas Hoy</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {completedTodayTasks.map(task => (
                <Card key={task.id} className="bg-green-50 border-green-200">
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm">{task.task_name}</p>
                    <p className="text-xs text-green-700 mt-1">
                      ✅ {task.actual_hours}h trabajadas
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Sin tareas */}
        {myTasks.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold mb-2">No tienes tareas asignadas</h3>
              <p className="text-gray-600">
                Habla con tu encargado para que te asigne trabajo
              </p>
            </CardContent>
          </Card>
        )}

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
                    ¿Cuántas horas trabajaste?
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
    </PageLayout>
  )
}