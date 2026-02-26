import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionProject } from '../types/production.types'

interface WaitingListProps {
  projects: ProductionProject[]
  onSchedule: (project: ProductionProject) => void
  onDelete: (project: ProductionProject) => void
  onRefresh: () => void
}

export default function WaitingList({ projects, onSchedule, onDelete }: WaitingListProps) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'destructive'
    if (priority >= 5) return 'warning'
    return 'default'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return '🔴 Urgente'
    if (priority >= 5) return '🟡 Media'
    return '🟢 Baja'
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold mb-2">No hay proyectos en espera</h3>
          <p className="text-gray-600">
            Todos los proyectos aprobados están planificados en el calendario
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Proyectos Pendientes de Planificación</h2>
          <p className="text-gray-600">
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''} esperando asignación
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="hover:shadow-lg transition">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">
                    {project.quote_number}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{project.client_name}</p>
                  {project.vehicle_model && (
                    <p className="text-xs text-gray-500 mt-1">
                      🚐 {project.vehicle_model}
                    </p>
                  )}
                </div>
                <Badge variant={getPriorityColor(project.priority)}>
                  {getPriorityLabel(project.priority)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {/* Tiempos */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Tiempo estimado</p>
                  <p className="font-bold text-lg text-blue-700">
                    {project.total_hours}h
                  </p>
                  <p className="text-xs text-gray-600">
                    ≈ {project.total_days} días
                  </p>
                </div>

                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-1">Estado</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      {project.requires_materials ? (
                        project.materials_ready ? (
                          <span className="text-green-600">✅ Materiales listos</span>
                        ) : (
                          <span className="text-orange-600">⏳ Esperando materiales</span>
                        )
                      ) : (
                        <span className="text-gray-400">— Sin materiales</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {project.requires_design ? (
                        project.design_ready ? (
                          <span className="text-green-600">✅ Diseño listo</span>
                        ) : (
                          <span className="text-orange-600">⏳ Esperando diseño</span>
                        )
                      ) : (
                        <span className="text-gray-400">— Sin diseño</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Advertencias */}
              {(project.requires_materials && !project.materials_ready) ||
               (project.requires_design && !project.design_ready) ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                  <p className="text-xs font-medium text-yellow-800">
                    ⚠️ Revisar dependencias antes de planificar
                  </p>
                </div>
              ) : null}

              {/* Notas */}
              {project.notes && (
                <div className="bg-gray-50 rounded p-3 mb-4">
                  <p className="text-xs text-gray-600 mb-1">Notas:</p>
                  <p className="text-sm">{project.notes}</p>
                </div>
              )}

              {/* Botón de planificar */}
              <div className="flex gap-2">
                <Button
                  onClick={() => onSchedule(project)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  📅 Planificar en Calendario
                </Button>
                <Button
                  onClick={() => onDelete(project)}
                  variant="outline"
                  className="text-red-500 hover:bg-red-50 hover:text-red-700 border-red-200"
                >
                  🗑️
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}