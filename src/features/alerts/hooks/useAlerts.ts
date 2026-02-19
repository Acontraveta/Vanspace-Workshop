import { useState, useEffect, useCallback } from 'react'
import { AlertsService, LiveAlertsEngine, dismissLiveAlert } from '../services/alertsService'
import type { CRMAlertInstance, CRMAlertConfig, LiveAlert, UnifiedAlert, AlertModule } from '../types/alerts.types'
import { useAuth } from '@/app/providers/AuthProvider'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 min

export interface UseAlertsReturn {
  all: UnifiedAlert[]
  configs: CRMAlertConfig[]
  pending: UnifiedAlert[]
  pendingCount: number
  countByModule: Record<AlertModule | 'total', number>
  loading: boolean
  engineRunning: boolean
  refresh: () => Promise<void>
  runCRMEngine: () => Promise<{ created: number; removed: number }>
  // CRM-persisted actions
  markVista: (id: string) => Promise<void>
  resolve: (id: string) => Promise<void>
  dismissCRM: (id: string) => Promise<void>
  // Live alert actions
  dismissLive: (id: string) => void
}

export function useAlerts(): UseAlertsReturn {
  const { user } = useAuth()
  const [crmInstances, setCrmInstances] = useState<CRMAlertInstance[]>([])
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([])
  const [configs, setConfigs] = useState<CRMAlertConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [engineRunning, setEngineRunning] = useState(false)

  const role = (user as any)?.role ?? 'admin'

  const refresh = useCallback(async () => {
    try {
      const [fetchedCRM, fetchedConfigs] = await Promise.all([
        AlertsService.getInstancesWithLeads(),
        AlertsService.getConfigs(),
      ])
      setCrmInstances(fetchedCRM)
      setConfigs(fetchedConfigs)

      // Compute live alerts now that we have configs
      const live = await LiveAlertsEngine.getLiveAlerts(fetchedConfigs)
      setLiveAlerts(live)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  const runCRMEngine = useCallback(async () => {
    setEngineRunning(true)
    try {
      const result = await AlertsService.runEngine()
      await refresh()
      return result
    } finally {
      setEngineRunning(false)
    }
  }, [refresh])

  const markVista = useCallback(async (id: string) => {
    await AlertsService.markVista(id)
    setCrmInstances(prev => prev.map(i => i.id === id ? { ...i, estado: 'vista' } : i))
  }, [])

  const resolve = useCallback(async (id: string) => {
    const name = (user as any)?.name ?? (user as any)?.email
    await AlertsService.resolve(id, name)
    setCrmInstances(prev => prev.filter(i => i.id !== id))
  }, [user])

  const dismissCRM = useCallback(async (id: string) => {
    await AlertsService.dismiss(id)
    setCrmInstances(prev => prev.filter(i => i.id !== id))
  }, [])

  const dismissLive = useCallback((id: string) => {
    dismissLiveAlert(id)
    setLiveAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  // Build unified list, filtered by current role
  const canSee = (roles: string[]) =>
    !roles?.length || roles.includes(role) || role === 'admin'

  const crmUnified: UnifiedAlert[] = crmInstances
    .filter(i => i.estado !== 'descartada' && canSee(i.roles_destino ?? []))
    .map(i => ({ ...i, _kind: 'crm' as const, modulo: 'crm' as const }))

  const liveUnified: UnifiedAlert[] = liveAlerts
    .filter(a => canSee(a.roles_destino ?? []))
    .map(a => ({ ...a, _kind: 'live' as const, estado: 'pendiente' as const }))

  const all: UnifiedAlert[] = [...crmUnified, ...liveUnified]
  const pending = all.filter(a => a.estado === 'pendiente')

  const modules: AlertModule[] = ['crm', 'produccion', 'pedidos', 'stock', 'presupuestos']
  const countByModule = {
    total: pending.length,
    ...Object.fromEntries(
      modules.map(m => [
        m,
        pending.filter(a => a.modulo === m).length,
      ])
    ),
  } as Record<AlertModule | 'total', number>

  return {
    all,
    configs,
    pending,
    pendingCount: pending.length,
    countByModule,
    loading,
    engineRunning,
    refresh,
    runCRMEngine,
    markVista,
    resolve,
    dismissCRM,
    dismissLive,
  }
}
