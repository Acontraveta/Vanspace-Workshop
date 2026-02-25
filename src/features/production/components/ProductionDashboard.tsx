import { useState, useEffect } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionService } from '@/features/calendar/services/productionService'
import { ProductionProject } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ConfigService } from '@/features/config/services/configService'
import ProjectCard from './ProjectCard'
import TaskBoard from './TaskBoard'
import toast from 'react-hot-toast'

export default function ProductionDashboard() {
  const [projects, setProjects] = useState<ProductionProject[]>([])
  const [employees, setEmployees] = useState<ProductionEmployee[]>([])
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'projects' | 'tasks'>('projects')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const allProjects = await ProductionService.getProjects()
      const activeProjects = allProjects.filter(p => 
        p.status === 'SCHEDULED' || p.status === 'IN_PROGRESS'
      )
      
      const employeeData = await ConfigService.getEmployees()
      const activeEmployees = employeeData.filter(e => e.activo)
      
      setProjects(activeProjects)
      setEmployees(activeEmployees)
    } catch (error) {
      toast.error('Error cargando proyectos')
    } finally {
      setLoading(false)
    }
  }

  const handleStartProject = async (projectId: string) => {
    try {
      await ProductionService.updateProject(projectId, {
        status: 'IN_PROGRESS',
        actual_start_date: new Date().toISOString().split('T')[0]
      })
      
      toast.success('Proyecto iniciado')
      loadData()
    } catch (error) {
      toast.error('Error iniciando proyecto')
    }
  }

  const handlePauseProject = async (projectId: string) => {
    try {
      await ProductionService.pauseProject(projectId)
      
      toast.success('Proyecto pausado — vuelve a lista de espera')
      loadData()
    } catch (error) {
      toast.error('Error pausando proyecto')
    }
  }

  const handleCompleteProject = async (projectId: string) => {
    if (!confirm('¿Marcar este proyecto como completado?')) return

    try {
      await ProductionService.updateProject(projectId, {
        status: 'COMPLETED',
        actual_end_date: new Date().toISOString().split('T')[0]
      })
      
      toast.success('🎉 Proyecto completado')
      loadData()
    } catch (error) {
      toast.error('Error completando proyecto')
    }
  }

  const inProgressProjects = projects.filter(p => p.status === 'IN_PROGRESS')
  const scheduledProjects = projects.filter(p => p.status === 'SCHEDULED')

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando proyectos...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <Header
        title="🏭 Producción"
        description="Gestión de proyectos y tareas del taller"
      />

      <div className="p-4 md:p-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <Button
            onClick={() => setActiveView('projects')}
            variant={activeView === 'projects' ? 'default' : 'outline'}
            className="gap-2"
          >
            📋 Proyectos
            {projects.length > 0 && (
              <Badge variant={activeView === 'projects' ? 'secondary' : 'outline'}>
                {projects.length}
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => setActiveView('tasks')}
            variant={activeView === 'tasks' ? 'default' : 'outline'}
            className="gap-2"
          >
            📦 Bloques de Tareas
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">En Progreso</p>
              <p className="text-3xl font-bold text-green-600">
                {inProgressProjects.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Planificados</p>
              <p className="text-3xl font-bold text-blue-600">
                {scheduledProjects.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Empleados Activos</p>
              <p className="text-3xl font-bold text-purple-600">
                {employees.length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 mb-1">Horas Estimadas</p>
              <p className="text-3xl font-bold text-orange-600">
                {projects.reduce((sum, p) => sum + p.total_hours, 0).toFixed(1)}h
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        {activeView === 'projects' ? (
          <div className="space-y-6">
            {/* Proyectos en progreso */}
            {inProgressProjects.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  En Producción
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {inProgressProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      employees={employees}
                      onStart={() => handleStartProject(project.id)}
                      onPause={() => handlePauseProject(project.id)}
                      onComplete={() => handleCompleteProject(project.id)}
                      onViewTasks={() => setSelectedProject(project)}
                      onRefresh={loadData}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Proyectos planificados */}
            {scheduledProjects.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  📅 Planificados (Próximos a Iniciar)
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {scheduledProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      employees={employees}
                      onStart={() => handleStartProject(project.id)}
                      onPause={() => handlePauseProject(project.id)}
                      onComplete={() => handleCompleteProject(project.id)}
                      onViewTasks={() => setSelectedProject(project)}
                      onRefresh={loadData}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sin proyectos */}
            {projects.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-bold mb-2">No hay proyectos activos</h3>
                  <p className="text-gray-600">
                    Los proyectos aparecerán aquí cuando se planifiquen en el calendario
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <TaskBoard
            projects={projects}
            employees={employees}
            onRefresh={loadData}
            viewMode="all_tasks"
            canAssignTasks={true}
          />
        )}

        {/* Modal de tareas del proyecto */}
        {selectedProject && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProject(null)}
          >
            <Card 
              className="max-w-6xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{selectedProject.quote_number}</h2>
                  <p className="text-gray-600 mt-1">{selectedProject.client_name}</p>
                </div>
                <Button onClick={() => setSelectedProject(null)} variant="outline" size="sm">
                  ✕ Cerrar
                </Button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <TaskBoard
                  projects={[selectedProject]}
                  employees={employees}
                  onRefresh={() => {
                    loadData()
                    setSelectedProject(null)
                  }}
                  viewMode="all_tasks"
                  canAssignTasks={true}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </PageLayout>
  )
}