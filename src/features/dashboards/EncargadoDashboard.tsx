import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ProductionService } from '@/features/calendar/services/productionService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { StockService } from '@/features/purchases/services/stockService'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { useAuth } from '@/app/providers/AuthProvider'
import { fmtEurK } from '@/shared/utils/formatters'
import { differenceInDays, parseISO } from 'date-fns'
import MyHoursWidget from '@/features/timeclock/components/MyHoursWidget'

export default function EncargadoDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    activeQuotes: 0,
    approvedQuotes: 0,
    inProgressProjects: 0,
    scheduledProjects: 0,
    pendingPurchases: 0,
    lowStock: 0,
    totalInventoryValue: 0,
    blockedTasks: 0,
    delayedProjects: 0
  })
  const [loading, setLoading] = useState(true)
  const [dataErrors, setDataErrors] = useState<string[]>([])

  useEffect(() => {
    loadAllStats()
  }, [])

  const loadAllStats = async () => {
    try {
      // Cargar todo en paralelo — cada uno independiente
      const [quotesResult, projectsResult, purchasesResult, stockResult] = await Promise.allSettled([
        // 1. Presupuestos
        (async () => {
          await QuoteService.syncFromSupabase()
          return QuoteService.getQuotesByCategory()
        })(),
        // 2. Producción (proyectos + tareas)
        (async () => {
          const allProjects = await ProductionService.getProjects()
          const activeProjects = allProjects.filter(p => 
            p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED'
          )
          const tasksArrays = await Promise.all(
            activeProjects.map(p => ProductionService.getProjectTasks(p.id))
          )
          return { projects: allProjects, tasks: tasksArrays.flat() }
        })(),
        // 3. Compras
        PurchaseService.getAllPurchases(),
        // 4. Stock — cargar desde Supabase Storage (Excel)
        StockService.loadFromSupabase(),
      ])

      // Extraer resultados con fallback
      const errors: string[] = []
      if (quotesResult.status === 'rejected') { console.warn('⚠️ Dashboard: quotes failed:', quotesResult.reason); errors.push('Presupuestos') }
      if (projectsResult.status === 'rejected') { console.warn('⚠️ Dashboard: projects failed:', projectsResult.reason); errors.push('Producción') }
      if (purchasesResult.status === 'rejected') { console.warn('⚠️ Dashboard: purchases failed:', purchasesResult.reason); errors.push('Compras') }
      if (stockResult.status === 'rejected') { console.warn('⚠️ Dashboard: stock failed:', stockResult.reason); errors.push('Stock') }
      setDataErrors(errors)

      const quotes = quotesResult.status === 'fulfilled' ? quotesResult.value : { active: [], approved: [] }
      const { projects: allProjects, tasks: allTasks } = projectsResult.status === 'fulfilled' ? projectsResult.value : { projects: [], tasks: [] }
      const purchases = purchasesResult.status === 'fulfilled' ? purchasesResult.value : []
      const stockItems = stockResult.status === 'fulfilled' ? stockResult.value : StockService.getStock()

      // Tareas bloqueadas
      const blocked = allTasks.filter(t => t.status === 'BLOCKED').length

      // Proyectos atrasados
      const delayed = allProjects.filter(p => {
        if (!p.end_date || p.status === 'COMPLETED') return false
        return differenceInDays(parseISO(p.end_date), new Date()) < 0
      }).length

      // Stock
      const lowStock = stockItems.filter(item =>
        item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
      )
      const totalValue = stockItems.reduce((sum, item) => {
        return sum + ((item.COSTE_IVA_INCLUIDO || 0) * item.CANTIDAD)
      }, 0)

      setStats({
        activeQuotes: quotes.active.length,
        approvedQuotes: quotes.approved.length,
        inProgressProjects: allProjects.filter(p => p.status === 'IN_PROGRESS').length,
        scheduledProjects: allProjects.filter(p => p.status === 'SCHEDULED').length,
        pendingPurchases: purchases.filter(p => p.status === 'PENDING').length,
        lowStock: lowStock.length,
        totalInventoryValue: totalValue,
        blockedTasks: blocked,
        delayedProjects: delayed
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <Header
        title={`👔 Hola, ${user?.name || 'Encargado'}`}
        description="Vista general del negocio"
      />

      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {/* Alerta si alguna fuente de datos falló */}
        {dataErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <span className="text-amber-600 text-lg">⚠️</span>
            <div className="text-sm text-amber-800">
              <p className="font-medium">No se pudieron cargar algunos datos</p>
              <p className="text-xs mt-1">Módulos afectados: {dataErrors.join(', ')}. Ejecuta la migración 030 en el SQL Editor de Supabase.</p>
            </div>
          </div>
        )}
        {/* Alertas importantes */}
        {(stats.delayedProjects > 0 || stats.blockedTasks > 0 || stats.lowStock > 0) && (
          <Card className="border-orange-300 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ⚠️ Requiere Atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.delayedProjects > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-red-500">
                    <p className="text-sm text-gray-600">Proyectos Atrasados</p>
                    <p className="text-3xl font-bold text-red-600">{stats.delayedProjects}</p>
                  </div>
                )}
                {stats.blockedTasks > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-orange-500">
                    <p className="text-sm text-gray-600">Tareas Bloqueadas</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.blockedTasks}</p>
                  </div>
                )}
                {stats.lowStock > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-yellow-500">
                    <p className="text-sm text-gray-600">Stock Bajo</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.lowStock}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vista general por módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Presupuestos y Ventas */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/quotes')}>
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-4 border-blue-500">
              <CardTitle className="flex items-center gap-2">
                💰 Presupuestos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Activos</span>
                  <Badge className="bg-blue-600">{stats.activeQuotes}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Aprobados</span>
                  <Badge className="bg-green-600">{stats.approvedQuotes}</Badge>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/quotes')
                }}
              >
                Ver presupuestos →
              </Button>
            </CardContent>
          </Card>

          {/* Producción */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/production')}>
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b-4 border-green-500">
              <CardTitle className="flex items-center gap-2">
                🏭 Producción
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">En progreso</span>
                  <Badge className="bg-green-600">{stats.inProgressProjects}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Planificados</span>
                  <Badge className="bg-blue-600">{stats.scheduledProjects}</Badge>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/production')
                }}
              >
                Ver producción →
              </Button>
            </CardContent>
          </Card>

          {/* Compras y Stock */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/purchases')}>
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-4 border-purple-500">
              <CardTitle className="flex items-center gap-2">
                📦 Compras y Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pedidos pendientes</span>
                  <Badge className="bg-orange-600">{stats.pendingPurchases}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Valor inventario</span>
                  <Badge className="bg-green-600">{fmtEurK(stats.totalInventoryValue)}€</Badge>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate('/purchases')
                }}
              >
                Ver stock →
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* KPIs numéricos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Presupuestos Activos</p>
              <p className="text-4xl font-bold text-blue-600">{stats.activeQuotes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Proyectos Activos</p>
              <p className="text-4xl font-bold text-green-600">
                {stats.inProgressProjects + stats.scheduledProjects}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Pedidos Pendientes</p>
              <p className="text-4xl font-bold text-orange-600">{stats.pendingPurchases}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-gray-600 mb-2">Valor Stock</p>
              <p className="text-4xl font-bold text-purple-600">
                {fmtEurK(stats.totalInventoryValue)}€
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Accesos rápidos a todos los módulos */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Navegación Rápida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Button 
                onClick={() => navigate('/quotes')}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <span className="text-3xl">💰</span>
                <span className="text-sm font-medium">Presupuestos</span>
              </Button>

              <Button 
                onClick={() => navigate('/production')}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <span className="text-3xl">🏭</span>
                <span className="text-sm font-medium">Producción</span>
              </Button>

              <Button 
                onClick={() => navigate('/calendar')}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <span className="text-3xl">📅</span>
                <span className="text-sm font-medium">Calendario</span>
              </Button>

              <Button 
                onClick={() => navigate('/purchases')}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <span className="text-3xl">📦</span>
                <span className="text-sm font-medium">Pedidos</span>
              </Button>

              <Button 
                onClick={() => navigate('/config')}
                variant="outline"
                className="h-24 flex flex-col gap-2"
              >
                <span className="text-3xl">⚙️</span>
                <span className="text-sm font-medium">Configuración</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Nota informativa */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Nota:</strong> Como encargado, puedes visualizar toda la información del sistema. 
              Para realizar cambios importantes, consulta con el administrador.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <h2 className="text-xl font-bold mb-4">⏰ Mis Horas</h2>
        <MyHoursWidget />
      </div>
    </PageLayout>
  )
}