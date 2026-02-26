import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionService } from '@/features/calendar/services/productionService'
import { ProductionProject, ProductionTask } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ConfigService } from '@/features/config/services/configService'
import { useAuth } from '@/app/providers/AuthProvider'
import { differenceInDays, parseISO } from 'date-fns'
import MyHoursWidget from '@/features/timeclock/components/MyHoursWidget'

export default function EncargadoTallerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [allTasks, setAllTasks] = useState<ProductionTask[]>([])
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [projectsResult, employeesResult] = await Promise.allSettled([
        (async () => {
          const allProjects = await ProductionService.getProjects()
          const activeProjects = allProjects.filter(p => 
            p.status === 'SCHEDULED' || p.status === 'IN_PROGRESS' || p.status === 'WAITING'
          )
          const tasksArrays = await Promise.all(
            activeProjects.filter(p => p.status !== 'WAITING').map(p => ProductionService.getProjectTasks(p.id))
          )
          return { projects: activeProjects, tasks: tasksArrays.flat() }
        })(),
        (async () => {
          const employeeData = await ConfigService.getEmployees()
          return employeeData.filter(e => e.activo)
        })(),
      ])

      if (projectsResult.status === 'fulfilled') {
        setProjects(projectsResult.value.projects)
        setAllTasks(projectsResult.value.tasks)
      }
      if (employeesResult.status === 'fulfilled') {
        setEmployees(employeesResult.value)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS')
  const waitingProjects = projects.filter(p => p.status === 'WAITING')
  const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED')
  const unassignedTasks = allTasks.filter(t => !t.assigned_to && t.status === 'PENDING')

  // Proyectos atrasados
  const delayedProjects = projects.filter(p => {
    if (!p.end_date) return false
    const daysUntilEnd = differenceInDays(parseISO(p.end_date), new Date())
    return daysUntilEnd < 0
  })

  // Calcular progreso general
  const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length
  const totalTasks = allTasks.length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

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
        title={`🏭 Hola, ${user?.name || 'Encargado'}`}
        description="Panel de gestión del taller"
      />

      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/production')}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">En Producción</p>
              <p className="text-4xl font-bold text-green-600">{inProgressProjects.length}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/calendar')}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">En Espera</p>
              <p className="text-4xl font-bold text-blue-600">{waitingProjects.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Tareas Bloqueadas</p>
              <p className="text-4xl font-bold text-red-600">{blockedTasks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Sin Asignar</p>
              <p className="text-4xl font-bold text-orange-600">{unassignedTasks.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Progreso General</p>
              <p className="text-4xl font-bold text-purple-600">{overallProgress}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {(delayedProjects.length > 0 || blockedTasks.length > 0 || unassignedTasks.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Proyectos atrasados */}
            {delayedProjects.length > 0 && (
              <Card className="border-red-300 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    🚨 Proyectos Atrasados
                    <Badge variant="destructive">{delayedProjects.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {delayedProjects.slice(0, 3).map(project => {
                      const daysDelayed = Math.abs(differenceInDays(parseISO(project.end_date!), new Date()))
                      return (
                        <div key={project.id} className="bg-white rounded p-2 border border-red-200">
                          <p className="font-bold text-sm">{project.quote_number}</p>
                          <p className="text-xs text-red-600">Retraso: {daysDelayed} días</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tareas bloqueadas */}
            {blockedTasks.length > 0 && (
              <Card className="border-orange-300 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    🚫 Tareas Bloqueadas
                    <Badge variant="warning">{blockedTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {blockedTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="bg-white rounded p-2 border border-orange-200">
                        <p className="font-bold text-sm">{task.task_name}</p>
                        <p className="text-xs text-orange-600">{task.blocked_reason}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tareas sin asignar */}
            {unassignedTasks.length > 0 && (
              <Card className="border-yellow-300 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    👷 Sin Asignar
                    <Badge variant="warning">{unassignedTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {unassignedTasks.slice(0, 3).map(task => (
                      <div key={task.id} className="bg-white rounded p-2 border border-yellow-200">
                        <p className="font-bold text-sm">{task.task_name}</p>
                        <p className="text-xs text-gray-600">{task.estimated_hours}h estimadas</p>
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => navigate('/production?tab=tasks')}
                  >
                    Asignar tareas
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Proyectos activos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>🟢 Proyectos en Producción</span>
              <Button onClick={() => navigate('/production')}>
                Ver todos
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inProgressProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inProgressProjects.slice(0, 4).map(project => {
                  const projectTasks = allTasks.filter(t => t.project_id === project.id)
                  const completedCount = projectTasks.filter(t => t.status === 'COMPLETED').length
                  const progress = projectTasks.length > 0 
                    ? Math.round((completedCount / projectTasks.length) * 100)
                    : 0

                  return (
                    <div key={project.id} className="border rounded-lg p-4 bg-green-50 hover:shadow-md transition cursor-pointer"
                         onClick={() => navigate('/production')}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold">{project.quote_number}</p>
                          <p className="text-sm text-gray-600">{project.client_name}</p>
                        </div>
                        <Badge className="bg-green-600">{progress}%</Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {completedCount}/{projectTasks.length} tareas completadas
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No hay proyectos en producción
              </p>
            )}
          </CardContent>
        </Card>

        {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                onClick={() => navigate('/production')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">🏭</span>
                <span className="text-sm">Producción</span>
              </Button>

              <Button 
                onClick={() => navigate('/production?tab=tasks')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">✅</span>
                <span className="text-sm">Tareas</span>
              </Button>

              <Button 
                onClick={() => navigate('/calendar')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">📅</span>
                <span className="text-sm">Calendario</span>
              </Button>

              <Button 
                onClick={() => navigate('/purchases?tab=stock')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">📦</span>
                <span className="text-sm">Materiales</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-4">⏰ Mis Horas</h2>
        <MyHoursWidget />
      </div>
    </PageLayout>
  )
}