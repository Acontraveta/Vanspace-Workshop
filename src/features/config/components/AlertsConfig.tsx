import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { AlertsService } from '@/features/alerts/services/alertsService'
import type { CRMAlertConfig, AlertPriority, AlertModule } from '@/features/alerts/types/alerts.types'
import { PRIORITY_COLORS, MODULE_META, MODULE_COLORS } from '@/features/alerts/types/alerts.types'
import toast from 'react-hot-toast'

const ALL_ROLES = [
  { id: 'admin',            label: ' Admin' },
  { id: 'encargado',        label: ' Encargado' },
  { id: 'compras',          label: ' Compras / Ventas' },
  { id: 'encargado_taller', label: ' Enc. Taller' },
]

const PRIORITIES: { value: AlertPriority; label: string }[] = [
  { value: 'alta',  label: ' Alta' },
  { value: 'media', label: ' Media' },
  { value: 'baja',  label: ' Baja' },
]

interface EditState {
  dias_umbral: number
  prioridad: AlertPriority
  roles_destino: string[]
}

export default function AlertsConfig() {
  const [configs, setConfigs] = useState<CRMAlertConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [engineRunning, setEngineRunning] = useState(false)
  const [engineResult, setEngineResult] = useState<{ created: number; removed: number } | null>(null)
  const [instanceCounts, setInstanceCounts] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditState>({ dias_umbral: 30, prioridad: 'media', roles_destino: ['admin'] })

  const loadConfigs = useCallback(async () => {
    try {
      const data = await AlertsService.getConfigs()
      setConfigs(data)
    } catch {
      toast.error('Error cargando configuracion de alertas')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCounts = useCallback(async () => {
    try {
      const instances = await AlertsService.getInstances()
      const counts: Record<string, number> = {}
      for (const inst of instances) {
        if (inst.estado === 'pendiente') {
          counts[inst.tipo_alerta] = (counts[inst.tipo_alerta] ?? 0) + 1
        }
      }
      setInstanceCounts(counts)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadConfigs()
    loadCounts()
  }, [loadConfigs, loadCounts])

  const handleToggle = async (config: CRMAlertConfig) => {
    try {
      await AlertsService.updateConfig(config.tipo_alerta, { activa: !config.activa })
      toast.success(config.activa ? 'Alerta desactivada' : 'Alerta activada')
      loadConfigs()
    } catch {
      toast.error('Error cambiando estado')
    }
  }

  const startEdit = (config: CRMAlertConfig) => {
    setEditing(config.tipo_alerta)
    setEditForm({
      dias_umbral:   config.dias_umbral ?? 30,
      prioridad:     config.prioridad ?? 'media',
      roles_destino: config.roles_destino ?? ['admin'],
    })
  }

  const saveEdit = async (tipo: string) => {
    try {
      await AlertsService.updateConfig(tipo, editForm)
      toast.success('Configuracion guardada')
      setEditing(null)
      loadConfigs()
    } catch {
      toast.error('Error guardando')
    }
  }

  const toggleRole = (roleId: string) => {
    setEditForm(prev => ({
      ...prev,
      roles_destino: prev.roles_destino.includes(roleId)
        ? prev.roles_destino.filter(r => r !== roleId)
        : [...prev.roles_destino, roleId],
    }))
  }

  const runEngine = async () => {
    setEngineRunning(true)
    setEngineResult(null)
    try {
      const result = await AlertsService.runEngine()
      setEngineResult(result)
      toast.success(`${result.created} alertas nuevas, ${result.removed} eliminadas`)
      loadCounts()
    } catch {
      toast.error('Error ejecutando el motor de alertas')
    } finally {
      setEngineRunning(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Cargando alertas...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alertas del sistema</h2>
          <p className="text-sm text-gray-500 mt-1">Configura que eventos generan notificaciones, prioridades y a que roles se muestran</p>
        </div>
        <div className="flex items-center gap-3">
          {engineResult && (
            <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
              {engineResult.created} nuevas - {engineResult.removed} eliminadas
            </span>
          )}
          <Button onClick={runEngine} disabled={engineRunning} className="flex items-center gap-2">
            {engineRunning ? 'Analizando...' : 'Generar alertas ahora'}
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Las alertas de CRM se persisten en base de datos. Las alertas de produccion, pedidos, stock y presupuestos se generan en tiempo real desde los datos de cada modulo y se pueden ignorar durante 24h.
      </div>

      {((['crm','produccion','pedidos','stock','presupuestos'] as AlertModule[]).map(mod => {
        const modConfigs = configs.filter(c => (c.modulo ?? 'crm') === mod)
        if (modConfigs.length === 0) return null
        const meta = MODULE_META[mod]
        return (
          <div key={mod}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm font-semibold ${MODULE_COLORS[mod]}`}>
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span className="ml-auto text-xs font-normal opacity-70">{modConfigs.filter(c => c.activa).length}/{modConfigs.length} activas</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modConfigs.map(config => {
          const count = instanceCounts[config.tipo_alerta] ?? 0
          const isEditing = editing === config.tipo_alerta
          return (
            <Card key={config.tipo_alerta} className={!config.activa ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{config.icono ?? ''}</span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold truncate">{config.nombre ?? config.tipo_alerta}</CardTitle>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{config.descripcion}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={config.activa ? 'default' : 'secondary'} className="text-xs">
                      {config.activa ? 'Activa' : 'Inactiva'}
                    </Badge>
                    {count > 0 && (
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        {count} pendiente{count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isEditing ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-50 rounded px-2 py-1.5">
                        <p className="text-gray-400 mb-0.5">Umbral</p>
                        <p className="font-semibold text-gray-800">
                          {config.tipo_alerta === 'fecha_accion_vencida' ? 'Fecha pasada' : `${config.dias_umbral ?? 30} dias`}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded px-2 py-1.5">
                        <p className="text-gray-400 mb-0.5">Prioridad</p>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium border ${PRIORITY_COLORS[config.prioridad ?? 'media']}`}>
                          {config.prioridad ?? 'media'}
                        </span>
                      </div>
                      <div className="bg-gray-50 rounded px-2 py-1.5">
                        <p className="text-gray-400 mb-0.5">Roles</p>
                        <p className="font-semibold text-gray-800 truncate">{(config.roles_destino ?? []).length} rol{(config.roles_destino ?? []).length !== 1 ? 'es' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(config.roles_destino ?? []).map(r => (
                        <span key={r} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {ALL_ROLES.find(x => x.id === r)?.label ?? r}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => startEdit(config)} className="flex-1 text-xs">Editar</Button>
                      <Button size="sm" variant={config.activa ? 'outline' : 'default'} onClick={() => handleToggle(config)} className="flex-1 text-xs">
                        {config.activa ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {config.tipo_alerta !== 'fecha_accion_vencida' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Umbral de dias</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min={1} max={365}
                            value={editForm.dias_umbral}
                            onChange={e => setEditForm(f => ({ ...f, dias_umbral: Number(e.target.value) }))}
                            className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-500">dias</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
                      <div className="flex gap-2">
                        {PRIORITIES.map(p => (
                          <button key={p.value} onClick={() => setEditForm(f => ({ ...f, prioridad: p.value }))}
                            className={`text-xs px-2.5 py-1 rounded-full border transition ${editForm.prioridad === p.value ? PRIORITY_COLORS[p.value] + ' font-bold' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Visible para roles</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map(role => (
                          <label key={role.id} className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={editForm.roles_destino.includes(role.id)} onChange={() => toggleRole(role.id)} className="rounded text-blue-600" />
                            <span className="text-xs">{role.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => saveEdit(config.tipo_alerta)} className="flex-1 text-xs">Guardar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)} className="flex-1 text-xs">Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
            </div>
          </div>
        )
      }))}

      {configs.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3"></p>
          <p className="text-sm">No hay configuraciones de alertas.</p>
          <p className="text-xs mt-1">Ejecuta las migraciones SQL 006_crm_alerts.sql y 007_all_module_alerts.sql en Supabase.</p>
        </div>
      )}
    </div>
  )
}
