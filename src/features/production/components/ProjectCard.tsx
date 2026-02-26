import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionProject, ProductionTask } from '@/features/calendar/types/production.types'
import { ProductionEmployee } from '@/features/config/types/config.types'
import { ProductionService } from '@/features/calendar/services/productionService'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

interface ProjectCardProps {
  project: ProductionProject
  employees: ProductionEmployee[]
  onStart: () => void
  onPause: () => void
  onComplete: () => void
  onViewTasks: () => void
  onRefresh: () => void
}

export default function ProjectCard({
  project,
  employees,
  onStart,
  onPause,
  onComplete,
  onViewTasks,
  onRefresh
}: ProjectCardProps) {
  const [tasks, setTasks] = useState<ProductionTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTasks()
  }, [project.id])

  const loadTasks = async () => {
    try {
      const projectTasks = await ProductionService.getProjectTasks(project.id)
      setTasks(projectTasks)
    } catch (error) {
      console.error('Error cargando tareas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcular progreso
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length
  const totalTasks = tasks.length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Calcular horas trabajadas
  const actualHours = tasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0)

  // Días hasta inicio/fin
  const daysUntilStart = project.start_date 
    ? differenceInDays(parseISO(project.start_date), new Date())
    : null

  const daysUntilEnd = project.end_date
    ? differenceInDays(parseISO(project.end_date), new Date())
    : null

  // Verificar bloqueos
  const blockedTasks = tasks.filter(t => t.status === 'BLOCKED').length
  const hasMaterialIssues = project.requires_materials && !project.materials_ready
  const hasDesignIssues = project.requires_design && !project.design_ready

  return (
    <Card className={`
      hover:shadow-lg transition
      ${project.status === 'IN_PROGRESS' ? 'border-green-400 bg-green-50' : ''}
      ${blockedTasks > 0 ? 'border-orange-300' : ''}
    `}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{project.quote_number}</CardTitle>
              <Badge variant={
                project.status === 'IN_PROGRESS' ? 'success' :
                project.status === 'SCHEDULED' ? 'default' :
                project.status === 'ON_HOLD' ? 'warning' :
                'secondary'
              }>
                {{ IN_PROGRESS: '🟢 En Progreso', SCHEDULED: '📅 Planificado', ON_HOLD: '⏸ Pausado', COMPLETED: '✅ Completado' }[project.status] ?? project.status}
              </Badge>
            </div>
            <p className="text-xl font-semibold text-gray-900">{project.client_name}</p>
            {project.vehicle_model && (
              <p className="text-sm text-gray-600">🚐 {project.vehicle_model}</p>
            )}
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-600">Prioridad</p>
            <p className="text-2xl font-bold text-blue-600">{project.priority}/10</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de progreso */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progreso</span>
            <span className="text-sm font-bold text-green-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {completedTasks} de {totalTasks} tareas completadas
          </p>
        </div>

        {/* Alertas de bloqueos */}
        {(hasMaterialIssues || hasDesignIssues || blockedTasks > 0) && (
          <div className="bg-orange-50 border border-orange-300 rounded p-3 space-y-2">
            <p className="text-sm font-bold text-orange-800">⚠️ Atención requerida:</p>
            {hasMaterialIssues && (
              <p className="text-xs text-orange-700">• Materiales pendientes de recepción</p>
            )}
            {hasDesignIssues && (
              <p className="text-xs text-orange-700">• Diseños pendientes de aprobación</p>
            )}
            {blockedTasks > 0 && (
              <p className="text-xs text-orange-700">• {blockedTasks} tareas bloqueadas</p>
            )}
          </div>
        )}

        {/* Fechas y tiempos */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Inicio planificado:</p>
            <p className="font-medium">
              {project.start_date 
                ? format(parseISO(project.start_date), 'dd MMM yyyy', { locale: es })
                : '-'
              }
            </p>
            {daysUntilStart !== null && daysUntilStart > 0 && (
              <p className="text-xs text-blue-600">En {daysUntilStart} días</p>
            )}
            {daysUntilStart !== null && daysUntilStart < 0 && (
              <p className="text-xs text-orange-600">Comenzó hace {Math.abs(daysUntilStart)} días</p>
            )}
          </div>

          <div>
            <p className="text-gray-600">Fin planificado:</p>
            <p className="font-medium">
              {project.end_date 
                ? format(parseISO(project.end_date), 'dd MMM yyyy', { locale: es })
                : '-'
              }
            </p>
            {daysUntilEnd !== null && daysUntilEnd > 0 && (
              <p className="text-xs text-blue-600">Faltan {daysUntilEnd} días</p>
            )}
            {daysUntilEnd !== null && daysUntilEnd < 0 && (
              <p className="text-xs text-red-600">Retrasado {Math.abs(daysUntilEnd)} días</p>
            )}
          </div>

          <div>
            <p className="text-gray-600">Horas estimadas:</p>
            <p className="font-bold text-lg text-blue-700">{project.total_hours}h</p>
            <p className="text-xs text-gray-600">≈ {project.total_days} días</p>
          </div>

          <div>
            <p className="text-gray-600">Horas trabajadas:</p>
            <p className="font-bold text-lg text-green-700">{actualHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-600">
              {project.total_hours > 0 
                ? `${Math.round((actualHours / project.total_hours) * 100)}% del estimado`
                : '-'
              }
            </p>
          </div>
        </div>

        {/* Notas */}
        {project.notes && (
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-600 mb-1">Notas:</p>
            <p className="text-sm whitespace-pre-line">{project.notes}</p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t">
          {project.status === 'SCHEDULED' && (
            <Button
              onClick={onStart}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              ▶ Iniciar Producción
            </Button>
          )}

          {project.status === 'IN_PROGRESS' && (
            <>
              <Button
                onClick={onPause}
                variant="outline"
                size="sm"
              >
                ⏸ Pausar
              </Button>
              <Button
                onClick={onComplete}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="sm"
                disabled={progress < 100}
              >
                ✅ Completar
              </Button>
            </>
          )}

          <Button
            onClick={onViewTasks}
            variant="outline"
            size="sm"
          >
            📋 Ver Tareas ({totalTasks})
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}