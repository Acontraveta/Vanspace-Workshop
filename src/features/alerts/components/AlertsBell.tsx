import { useState } from 'react'
import { useAlerts } from '../hooks/useAlerts'
import { AlertsPanel } from './AlertsPanel'

export function AlertsBell() {
  const [open, setOpen] = useState(false)
  const alerts = useAlerts()

  const { pendingCount, all, loading, engineRunning } = alerts

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        title={`${pendingCount} alerta${pendingCount !== 1 ? 's' : ''} pendiente${pendingCount !== 1 ? 's' : ''}`}
        className="relative flex items-center gap-3 px-4 py-3 rounded-lg transition text-gray-300 hover:bg-gray-800 w-full"
      >
        <span className="text-xl">🔔</span>
        <span className="font-semibold text-gray-800">Alertas</span>
        {pendingCount > 0 && (
          <span className="absolute left-7 top-2 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <AlertsPanel
          all={all}
          loading={loading}
          onClose={() => setOpen(false)}
          onMarkVista={alerts.markVista}
          onResolve={alerts.resolve}
          onDismissCRM={alerts.dismissCRM}
          onDismissLive={alerts.dismissLive}
          onRunEngine={alerts.runCRMEngine}
          engineRunning={engineRunning}
        />
      )}
    </>
  )
}
