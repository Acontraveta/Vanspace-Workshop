import { useState, useEffect } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionService } from '../services/productionService'
import { ProductionProject } from '../types/production.types'
import WaitingList from './WaitingList'
import CalendarView from './CalendarView'
import ProjectDetails from './ProjectDetails'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useConfirm } from '@/shared/hooks/useConfirm'
import toast from 'react-hot-toast'

export default function ProductionCalendar() {
  const [waitingProjects, setWaitingProjects] = useState<ProductionProject[]>([])
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [ConfirmDialog, confirm] = useConfirm()

  // Unified calendar events hook
  const {
    filteredEvents,
    loading: eventsLoading,
    loadEvents,
    createEvent,
    deleteEvent,
    countByBranch,
    userRole,
  } = useCalendarEvents()

  // Operario only sees calendar (not waiting list)
  const isOperario = userRole === 'operario'
  const [activeView, setActiveView] = useState<'waiting' | 'calendar'>('waiting')

  // Force calendar view for operario on mount & role change
  useEffect(() => {
    if (isOperario) setActiveView('calendar')
  }, [isOperario])

  useEffect(() => {
    if (!isOperario) loadProjects()
    else setLoadingProjects(false)
  }, [isOperario])

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const waiting = await ProductionService.getWaitingProjects()
      setWaitingProjects(waiting)
    } catch (error) {
      toast.error('Error cargando proyectos')
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([loadProjects(), loadEvents()])
  }

  const handleSchedule = (project: ProductionProject) => {
    setSelectedProject(project)
    setShowScheduleModal(true)
  }

  const handleDeleteProject = (project: ProductionProject) => {
    confirm('¿Eliminar este proyecto de la lista de espera? Se borrarán todas sus tareas y datos asociados.', async () => {
      try {
        await ProductionService.deleteProject(project.id)
        toast.success('Proyecto eliminado')
        handleRefresh()
      } catch (error) {
        toast.error('Error eliminando proyecto')
      }
    })
  }

  const handleProjectScheduled = async () => {
    await handleRefresh()
    setShowScheduleModal(false)
    setSelectedProject(null)
    setActiveView('calendar')
    toast.success('Proyecto planificado correctamente')
  }

  const loading = loadingProjects && eventsLoading

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando calendario...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      {ConfirmDialog}
      <Header
        title="📅 Calendario"
        description="Planificación, recepciones, pedidos y eventos del taller"
      />

      <div className="p-4 md:p-8">
        {/* Tabs — operario solo ve calendario */}
        <div className="mb-6 flex gap-2">
          {!isOperario && (
            <Button
              onClick={() => setActiveView('waiting')}
              variant={activeView === 'waiting' ? 'default' : 'outline'}
              className="gap-2"
            >
              ⏳ Lista de Espera
              {waitingProjects.length > 0 && (
                <Badge variant="destructive">{waitingProjects.length}</Badge>
              )}
            </Button>
          )}
          <Button
            onClick={() => setActiveView('calendar')}
            variant={activeView === 'calendar' ? 'default' : 'outline'}
            className="gap-2"
          >
            📅 Calendario
            {countByBranch.total > 0 && (
              <Badge>{countByBranch.total}</Badge>
            )}
          </Button>
        </div>

        {/* Content */}
        {activeView === 'waiting' ? (
          <WaitingList
            projects={waitingProjects}
            onSchedule={handleSchedule}
            onDelete={handleDeleteProject}
            onRefresh={loadProjects}
          />
        ) : (
          <CalendarView
            events={filteredEvents}
            onRefresh={handleRefresh}
            onCreate={createEvent}
            onDelete={deleteEvent}
            userRole={userRole}
          />
        )}

        {/* Modal de planificación */}
        {showScheduleModal && selectedProject && (
          <ProjectDetails
            project={selectedProject}
            onClose={() => {
              setShowScheduleModal(false)
              setSelectedProject(null)
            }}
            onScheduled={handleProjectScheduled}
          />
        )}
      </div>
    </PageLayout>
  )
}