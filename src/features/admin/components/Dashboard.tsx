
import { useEffect, useState } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { ProductionService } from '@/features/production/services/productionService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()

  // Estados para datos reales
  const [leadCount, setLeadCount] = useState<number>(0)
  const [activeProjects, setActiveProjects] = useState<number>(0)
  const [pendingPurchases, setPendingPurchases] = useState<number>(0)
  const [urgentPurchases, setUrgentPurchases] = useState<number>(0)
  const [pipeline, setPipeline] = useState<number>(0)
  const [quotesCount, setQuotesCount] = useState<number>(0)

  useEffect(() => {
    // Leads: contar usuarios de la tabla leads (si existe)
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .then(({ count }) => setLeadCount(count || 0))

    // Proyectos activos: producción
    ProductionService.getProjects().then(projects => {
      setActiveProjects(projects.filter(p => p.status === 'SCHEDULED' || p.status === 'IN_PROGRESS').length)
    })

    // Compras pendientes y urgentes
    supabase.from('purchase_items').select('*').then(({ data }) => {
      const pending = (data || []).filter((p: any) => p.status === 'PENDING').length
      const urgent = (data || []).filter((p: any) => p.status === 'PENDING' && p.priority >= 8).length
      setPendingPurchases(pending)
      setUrgentPurchases(urgent)
    })

    // Pipeline y presupuestos
    supabase.from('quotes').select('*').then(({ data }) => {
      setQuotesCount((data || []).length)
      // Sumar total de presupuestos en negociación
      const pipelineTotal = (data || []).filter((q: any) => q.status === 'SENT' || q.status === 'DRAFT').reduce((acc: number, q: any) => acc + (q.total || 0), 0)
      setPipeline(pipelineTotal)
    })
  }, [])

  const stats = [
    {
      title: 'Leads Totales',
      value: leadCount,
      icon: '📊',
      change: '',
      changeType: 'positive' as const,
      description: '',
      color: 'blue',
    },
    {
      title: 'Proyectos Activos',
      value: activeProjects,
      icon: '✅',
      change: '',
      changeType: 'neutral' as const,
      description: '',
      color: 'green',
    },
    {
      title: 'Compras Pendientes',
      value: pendingPurchases,
      icon: '🛒',
      change: urgentPurchases > 0 ? `${urgentPurchases} urgentes` : '',
      changeType: urgentPurchases > 0 ? 'warning' as const : 'neutral' as const,
      description: '',
      color: 'yellow',
    },
    {
      title: 'Pipeline',
      value: pipeline ? `${pipeline.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : '0€',
      icon: '💰',
      change: `${quotesCount} presupuestos`,
      changeType: 'positive' as const,
      description: '',
      color: 'purple',
    },
  ]

  const urgentActions = [
    {
      id: 1,
      type: 'purchase',
      title: 'Compra urgente - Calefactor Truma',
      description: 'Proyecto PRJ-2024-045 empieza pasado mañana',
      priority: 'high',
      action: 'Comprar Ya',
    },
    {
      id: 2,
      type: 'call',
      title: 'Llamar a Antonio Gómez-Pimpollo',
      description: 'Presupuesto aceptado, pendiente cerrar fecha',
      priority: 'medium',
      action: 'Llamar',
    },
    {
      id: 3,
      type: 'design',
      title: 'Subir planos - Proyecto Sprinter',
      description: 'Diseño debe completar plano ubicación claraboya',
      priority: 'medium',
      action: 'Ver',
    },
  ]

  const recentActivity = [
    {
      id: 1,
      type: 'task_completed',
      title: 'Tarea completada',
      description: 'Luis finalizó "Fijar claraboya" en PRJ-2024-045',
      time: 'Hace 15 minutos',
      icon: '✓',
      color: 'green',
    },
    {
      id: 2,
      type: 'material_received',
      title: 'Material recibido',
      description: 'Batería AGM 100Ah recepcionada',
      time: 'Hace 1 hora',
      icon: '📦',
      color: 'blue',
    },
    {
      id: 3,
      type: 'quote_sent',
      title: 'Presupuesto enviado',
      description: 'QUO-2024-092 enviado a María García (15,000€)',
      time: 'Hace 2 horas',
      icon: '💰',
      color: 'yellow',
    },
    {
      id: 4,
      type: 'new_lead',
      title: 'Nuevo lead',
      description: 'Carlos Ruiz - Instagram - Volkswagen T6',
      time: 'Hace 3 horas',
      icon: '👤',
      color: 'purple',
    },
  ]

  return (
    <PageLayout>
      <Header
        title="Dashboard"
        description={`Bienvenido a VanSpace Workshop`}
      />

      <div className="p-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-4xl">{stat.icon}</span>
                  <Badge
                    variant={
                      stat.changeType === 'positive'
                        ? 'success'
                        : stat.changeType === 'warning'
                        ? 'warning'
                        : 'secondary'
                    }
                  >
                    {stat.change}
                  </Badge>
                </div>
                <h3 className="text-sm font-medium text-gray-600">{stat.title}</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Urgent Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🔔</span>
                Acciones Urgentes
                <Badge variant="destructive" className="ml-auto">
                  {urgentActions.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {urgentActions.map((action) => (
                <div
                  key={action.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    action.priority === 'high'
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{action.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={action.priority === 'high' ? 'destructive' : 'default'}
                    >
                      {action.action}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-${activity.color}-100 text-${activity.color}-600`}
                  >
                    <span>{activity.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{activity.title}</p>
                    <p className="text-sm text-gray-600">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                size="lg"
                className="h-auto py-6 flex-col gap-2"
                onClick={() => navigate('/crm')}
              >
                <span className="text-3xl">👥</span>
                <span>Nuevo Lead</span>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="h-auto py-6 flex-col gap-2"
                onClick={() => navigate('/quotes')}
              >
                <span className="text-3xl">💰</span>
                <span>Crear Presupuesto</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-auto py-6 flex-col gap-2"
                onClick={() => navigate('/calendar')}
              >
                <span className="text-3xl">📅</span>
                <span>Ver Calendario</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
