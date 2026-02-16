import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ConfigService } from '../services/configService'
import { AlertSetting } from '../types/config.types'
import toast from 'react-hot-toast'

export default function AlertsConfig() {
  const [alerts, setAlerts] = useState<AlertSetting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      const data = await ConfigService.getAlerts()
      setAlerts(data)
    } catch (error) {
      toast.error('Error cargando alertas')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (tipo: string, activa: boolean) => {
    try {
      await ConfigService.updateAlert(tipo, { activa: !activa })
      toast.success(activa ? 'Alerta desactivada' : 'Alerta activada')
      loadAlerts()
    } catch (error) {
      toast.error('Error cambiando estado')
    }
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-4">Alertas y Notificaciones</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {alerts.map((alert) => (
          <Card key={alert.tipo_alerta}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{alert.tipo_alerta}</CardTitle>
                <Badge variant={alert.activa ? 'success' : 'secondary'}>
                  {alert.activa ? '🟢 Activa' : '🔴 Inactiva'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-2 mb-4">
                {alert.destinatario && (
                  <div>
                    <p className="text-xs text-gray-600">Destinatario</p>
                    <p className="text-sm font-medium">{alert.destinatario}</p>
                  </div>
                )}

                {alert.condicion && (
                  <div>
                    <p className="text-xs text-gray-600">Condición</p>
                    <p className="text-sm">{alert.condicion}</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleToggle(alert.tipo_alerta, alert.activa)}
                size="sm"
                variant={alert.activa ? 'outline' : 'default'}
                className="w-full"
              >
                {alert.activa ? '🔴 Desactivar' : '🟢 Activar'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}