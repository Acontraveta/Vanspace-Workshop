import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionProject, ScheduleSuggestion } from '../types/production.types'
import { ProductionService } from '../services/productionService'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

interface ProjectDetailsProps {
  project: ProductionProject
  onClose: () => void
  onScheduled: () => void
}

export default function ProjectDetails({ project, onClose, onScheduled }: ProjectDetailsProps) {
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSuggestion, setSelectedSuggestion] = useState<ScheduleSuggestion | null>(null)
  const [manualStartDate, setManualStartDate] = useState('')
  const [manualEndDate, setManualEndDate] = useState('')
  const [useManualDates, setUseManualDates] = useState(false)

  useEffect(() => {
    loadSuggestions()
  }, [project.id])

  const loadSuggestions = async () => {
    try {
      const data = await ProductionService.getSuggestions(project.id)
      setSuggestions(data)
      
      if (data.length > 0) {
        setSelectedSuggestion(data[0])
      }
    } catch (error) {
      toast.error('Error cargando sugerencias')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async () => {
    if (useManualDates) {
      if (!manualStartDate || !manualEndDate) {
        toast.error('Introduce fechas de inicio y fin')
        return
      }

      try {
        await ProductionService.scheduleProject(project.id, manualStartDate, manualEndDate)
        toast.success('Proyecto planificado')
        onScheduled()
      } catch (error) {
        toast.error('Error planificando proyecto')
      }
    } else {
      if (!selectedSuggestion) {
        toast.error('Selecciona una fecha sugerida')
        return
      }

      try {
        await ProductionService.scheduleProject(
          project.id,
          selectedSuggestion.start_date,
          selectedSuggestion.end_date
        )
        toast.success('Proyecto planificado')
        onScheduled()
      } catch (error) {
        toast.error('Error planificando proyecto')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="border-b">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{project.quote_number}</CardTitle>
              <p className="text-gray-600 mt-1">{project.client_name}</p>
              {project.vehicle_model && (
                <p className="text-sm text-gray-500">🚐 {project.vehicle_model}</p>
              )}
            </div>
            <Button onClick={onClose} variant="outline" size="sm">
              ✕ Cerrar
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Información del proyecto */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Tiempo Total</p>
              <p className="text-2xl font-bold text-blue-700">{project.total_hours}h</p>
              <p className="text-sm text-gray-600">≈ {project.total_days} días laborables</p>
            </div>

            <div className="bg-green-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Prioridad</p>
              <p className="text-2xl font-bold text-green-700">{project.priority}/10</p>
            </div>

            <div className="bg-purple-50 rounded p-4">
              <p className="text-sm text-gray-600 mb-1">Estado</p>
              <div className="space-y-1 mt-2">
                <div className="text-xs">
                  {project.requires_materials && (
                    <span className={project.materials_ready ? 'text-green-600' : 'text-orange-600'}>
                      {project.materials_ready ? '✅' : '⏳'} Materiales
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  {project.requires_design && (
                    <span className={project.design_ready ? 'text-green-600' : 'text-orange-600'}>
                      {project.design_ready ? '✅' : '⏳'} Diseño
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            <Button
              onClick={() => setUseManualDates(false)}
              variant={!useManualDates ? 'default' : 'outline'}
              size="sm"
            >
              🤖 Sugerencias Automáticas
            </Button>
            <Button
              onClick={() => setUseManualDates(true)}
              variant={useManualDates ? 'default' : 'outline'}
              size="sm"
            >
              📝 Fechas Manuales
            </Button>
          </div>

          {/* Sugerencias Automáticas */}
          {!useManualDates && (
            <div>
              <h3 className="font-bold mb-3">Fechas Sugeridas</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Calculando sugerencias...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedSuggestion(suggestion)}
                      className={`
                        border-2 rounded-lg p-4 cursor-pointer transition
                        ${selectedSuggestion === suggestion 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-blue-300'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <p className="font-bold text-lg">
                              {format(parseISO(suggestion.start_date), 'dd MMM', { locale: es })} 
                              {' → '}
                              {format(parseISO(suggestion.end_date), 'dd MMM yyyy', { locale: es })}
                            </p>
                            <Badge variant={
                              suggestion.score >= 80 ? 'success' :
                              suggestion.score >= 60 ? 'default' :
                              'warning'
                            }>
                              {suggestion.score}% compatibilidad
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-600 mb-2">
                            {suggestion.reason}
                          </p>

                          {/* Capacity bar */}
                          {suggestion.capacity && (
                            <div className="mt-2 mb-2">
                              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                <span>
                                  👷 {suggestion.capacity.employeeCount} operario{suggestion.capacity.employeeCount !== 1 ? 's' : ''}
                                  &nbsp;·&nbsp;{suggestion.capacity.dailyCapacity}h/día disponibles
                                </span>
                                <span className={suggestion.capacity.canFit ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {Math.round(suggestion.capacity.avgUtilization)}% carga media
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    suggestion.capacity.avgUtilization > 90 ? 'bg-red-500' :
                                    suggestion.capacity.avgUtilization > 70 ? 'bg-orange-400' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(100, suggestion.capacity.avgUtilization)}%` }}
                                />
                              </div>
                              {!suggestion.capacity.canFit && (
                                <p className="text-xs text-red-600 mt-1">⚠️ Capacidad insuficiente en uno o más días</p>
                              )}
                            </div>
                          )}

                          {suggestion.conflicts && suggestion.conflictingProjects.length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded p-2 mt-2">
                              <p className="text-xs font-medium text-orange-800 mb-1">
                                ⚠️ Conflictos detectados:
                              </p>
                              {suggestion.conflictingProjects.map((cp) => (
                                <p key={cp.id} className="text-xs text-orange-700">
                                  • {cp.quote_number} - {cp.client_name}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedSuggestion === suggestion && (
                          <div className="ml-4">
                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fechas Manuales */}
          {useManualDates && (
            <div className="space-y-4">
              <h3 className="font-bold">Selección Manual de Fechas</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Fecha de inicio
                  </label>
                  <Input
                    type="date"
                    value={manualStartDate}
                    onChange={(e) => setManualStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Fecha de fin
                  </label>
                  <Input
                    type="date"
                    value={manualEndDate}
                    onChange={(e) => setManualEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Al usar fechas manuales, asegúrate de verificar conflictos con otros proyectos planificados.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t p-4 flex gap-2 justify-end">
          <Button onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button
            onClick={handleSchedule}
            className="bg-green-600 hover:bg-green-700"
            disabled={!useManualDates && !selectedSuggestion}
          >
            ✅ Confirmar Planificación
          </Button>
        </div>
      </Card>
    </div>
  )
}