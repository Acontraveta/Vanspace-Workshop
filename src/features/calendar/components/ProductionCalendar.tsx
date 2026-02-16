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
import toast from 'react-hot-toast'

export default function ProductionCalendar() {
  const [waitingProjects, setWaitingProjects] = useState<ProductionProject[]>([])
  const [scheduledProjects, setScheduledProjects] = useState<ProductionProject[]>([])
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'waiting' | 'calendar'>('waiting')

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const waiting = await ProductionService.getWaitingProjects()
      const all = await ProductionService.getProjects()
      const scheduled = all.filter(p => p.status === 'SCHEDULED' || p.status === 'IN_PROGRESS')
      
      setWaitingProjects(waiting)
      setScheduledProjects(scheduled)
    } catch (error) {
      toast.error('Error cargando proyectos')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = (project: ProductionProject) => {
    setSelectedProject(project)
    setShowScheduleModal(true)
  }

  const handleProjectScheduled = async () => {
    await loadProjects()
    setShowScheduleModal(false)
    setSelectedProject(null)
    setActiveView('calendar')
    toast.success('Proyecto planificado correctamente')
  }

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
      <Header
        title="📅 Planificación de Producción"
        description="Gestión de proyectos y calendario de taller"
      />

      <div className="p-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
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
          <Button
            onClick={() => setActiveView('calendar')}
            variant={activeView === 'calendar' ? 'default' : 'outline'}
            className="gap-2"
          >
            📅 Calendario
            {scheduledProjects.length > 0 && (
              <Badge>{scheduledProjects.length}</Badge>
            )}
          </Button>
        </div>

        {/* Content */}
        {activeView === 'waiting' ? (
          <WaitingList
            projects={waitingProjects}
            onSchedule={handleSchedule}
            onRefresh={loadProjects}
          />
        ) : (
          <CalendarView
            projects={scheduledProjects}
            onRefresh={loadProjects}
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