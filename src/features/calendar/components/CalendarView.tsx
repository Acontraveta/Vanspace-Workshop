import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionProject } from '../../production/types/production.types'
import { ProductionService } from '../../production/services/productionService'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
  parseISO,
  startOfWeek,
  endOfWeek
} from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface CalendarViewProps {
  projects: ProductionProject[]
  onRefresh: () => void
}

export default function CalendarView({ projects, onRefresh }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedProject, setSelectedProject] = useState<ProductionProject | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [draggedProject, setDraggedProject] = useState<ProductionProject | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getProjectsForDay = (day: Date) => {
    return projects.filter(project => {
      if (!project.start_date || !project.end_date) return false
      
      const start = parseISO(project.start_date)
      const end = parseISO(project.end_date)
      
      return day >= start && day <= end
    })
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  const handleDragStart = (project: ProductionProject) => {
    setDraggedProject(project)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (day: Date) => {
    if (!draggedProject || !draggedProject.start_date || !draggedProject.end_date) return

    if (isWeekend(day)) {
      toast.error('No se puede planificar en fin de semana')
      setDraggedProject(null)
      return
    }

    const start = parseISO(draggedProject.start_date)
    const end = parseISO(draggedProject.end_date)
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    const newStart = format(day, 'yyyy-MM-dd')
    const newEnd = format(new Date(day.getTime() + duration * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

    try {
      await ProductionService.scheduleProject(draggedProject.id, newStart, newEnd)
      toast.success(`Proyecto movido a ${format(day, 'dd/MM/yyyy', { locale: es })}`)
      onRefresh()
    } catch (error) {
      toast.error('Error moviendo proyecto')
    }

    setDraggedProject(null)
  }

  const handleProjectClick = (project: ProductionProject) => {
    setSelectedProject(project)
    setShowEditModal(true)
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('¿Eliminar este proyecto del calendario?')) return

    try {
      await ProductionService.updateProject(projectId, {
        status: 'WAITING',
        start_date: undefined,
        end_date: undefined
      })
      
      toast.success('Proyecto devuelto a lista de espera')
      onRefresh()
      setShowEditModal(false)
    } catch (error) {
      toast.error('Error eliminando proyecto')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header del calendario */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-2">
                <Button onClick={handlePrevMonth} variant="outline" size="sm">
                  ← Anterior
                </Button>
                <Button onClick={handleToday} variant="outline" size="sm">
                  Hoy
                </Button>
                <Button onClick={handleNextMonth} variant="outline" size="sm">
                  Siguiente →
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {projects.length} proyecto{projects.length !== 1 ? 's' : ''} planificado{projects.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendario */}
      <Card>
        <CardContent className="p-6">
          {/* Headers de días de la semana */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="text-center font-bold text-sm text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const dayProjects = getProjectsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const isWeekendDay = isWeekend(day)

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    min-h-[120px] border-2 rounded-lg p-2 transition
                    ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    ${!isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white'}
                    ${isWeekendDay ? 'bg-gray-100' : ''}
                    ${dayProjects.length > 0 ? 'hover:border-blue-400' : ''}
                  `}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
                >
                  {/* Número del día */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`
                      text-sm font-bold
                      ${isToday ? 'text-blue-600' : ''}
                      ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
                    `}>
                      {format(day, 'd')}
                    </span>
                    {isWeekendDay && (
                      <span className="text-[10px] text-gray-500">FIN</span>
                    )}
                  </div>

                  {/* Proyectos del día */}
                  <div className="space-y-1">
                    {dayProjects.map((project) => {
                      const isStart = project.start_date && isSameDay(parseISO(project.start_date), day)
                      const isEnd = project.end_date && isSameDay(parseISO(project.end_date), day)

                      return (
                        <div
                          key={project.id}
                          draggable
                          onDragStart={() => handleDragStart(project)}
                          onClick={() => handleProjectClick(project)}
                          className={`
                            text-xs p-2 rounded cursor-move hover:shadow-md transition
                            ${project.status === 'IN_PROGRESS' 
                              ? 'bg-green-100 border-green-400 text-green-800' 
                              : 'bg-blue-100 border-blue-400 text-blue-800'
                            }
                            border-l-4
                          `}
                          title={`${project.quote_number} - ${project.client_name}`}
                        >
                          <div className="font-bold truncate">
                            {isStart && '▶ '}
                            {project.quote_number}
                            {isEnd && ' ◀'}
                          </div>
                          <div className="truncate text-[10px] opacity-75">
                            {project.client_name}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-6 pt-4 border-t flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-400 rounded"></div>
              <span className="text-gray-600">Planificado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-l-4 border-green-400 rounded"></div>
              <span className="text-gray-600">En progreso</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-50 border-2 border-blue-500 rounded"></div>
              <span className="text-gray-600">Hoy</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 rounded"></div>
              <span className="text-gray-600">Fin de semana</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edición */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <Card className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedProject.quote_number}</CardTitle>
                  <p className="text-gray-600 mt-1">{selectedProject.client_name}</p>
                </div>
                <Button onClick={() => setShowEditModal(false)} variant="outline" size="sm">
                  ✕
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Información */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Inicio planificado</p>
                  <p className="font-bold">
                    {selectedProject.start_date 
                      ? format(parseISO(selectedProject.start_date), 'dd/MM/yyyy', { locale: es })
                      : '-'
                    }
                  </p>
                </div>

                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Fin planificado</p>
                  <p className="font-bold">
                    {selectedProject.end_date 
                      ? format(parseISO(selectedProject.end_date), 'dd/MM/yyyy', { locale: es })
                      : '-'
                    }
                  </p>
                </div>

                <div className="bg-blue-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Tiempo estimado</p>
                  <p className="font-bold text-blue-700">
                    {selectedProject.total_hours}h ({selectedProject.total_days} días)
                  </p>
                </div>

                <div className="bg-purple-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Estado</p>
                  <Badge variant={
                    selectedProject.status === 'IN_PROGRESS' ? 'success' :
                    selectedProject.status === 'SCHEDULED' ? 'default' :
                    'secondary'
                  }>
                    {selectedProject.status}
                  </Badge>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => {
                    ProductionService.updateProject(selectedProject.id, { 
                      status: selectedProject.status === 'IN_PROGRESS' ? 'SCHEDULED' : 'IN_PROGRESS' 
                    }).then(() => {
                      toast.success('Estado actualizado')
                      onRefresh()
                      setShowEditModal(false)
                    })
                  }}
                  className="flex-1"
                  variant={selectedProject.status === 'IN_PROGRESS' ? 'outline' : 'default'}
                >
                  {selectedProject.status === 'IN_PROGRESS' ? '⏸ Pausar' : '▶ Iniciar Producción'}
                </Button>

                <Button
                  onClick={() => handleDeleteProject(selectedProject.id)}
                  variant="destructive"
                  className="flex-1"
                >
                  🗑️ Quitar del Calendario
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                💡 Arrastra el proyecto en el calendario para reprogramarlo
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}