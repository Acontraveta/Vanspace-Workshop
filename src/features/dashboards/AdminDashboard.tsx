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
import { ConfigService } from '@/features/config/services/configService'
import { useAuth } from '@/app/providers/AuthProvider'
import { fmtEurK, fmtNum } from '@/shared/utils/formatters'
import { differenceInDays, parseISO } from 'date-fns'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    // Presupuestos
    totalQuotes: 0,
    activeQuotes: 0,
    approvedQuotes: 0,
    totalQuotesValue: 0,
    approvedValue: 0,
    
    // Producción
    totalProjects: 0,
    inProgressProjects: 0,
    completedProjects: 0,
    totalHoursPlanned: 0,
    totalHoursWorked: 0,
    
    // Compras y Stock
    totalPurchases: 0,
    pendingPurchases: 0,
    totalStockItems: 0,
    lowStockItems: 0,
    totalInventoryValue: 0,
    
    // Personal
    totalEmployees: 0,
    activeEmployees: 0,
    
    // Alertas
    delayedProjects: 0,
    blockedTasks: 0
  })
  const [stock, setStock] = useState([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dataErrors, setDataErrors] = useState<string[]>([])


  useEffect(() => {
    loadAllStats()
  }, [])

  const loadAllStats = async () => {
    try {
      // Cargar todo en paralelo para máxima velocidad
      const [quotesResult, projectsResult, purchasesResult, stockResult, employeesResult] = await Promise.allSettled([
        // 1. Presupuestos
        (async () => {
          await QuoteService.syncFromSupabase()
          return QuoteService.getQuotesByCategory()
        })(),
        // 2. Producción (proyectos + tareas)
        (async () => {
          const allProjects = await ProductionService.getProjects()
          const tasksArrays = await Promise.all(
            allProjects.map(p => ProductionService.getProjectTasks(p.id))
          )
          return { projects: allProjects, tasks: tasksArrays.flat() }
        })(),
        // 3. Compras
        PurchaseService.getAllPurchases(),
        // 4. Stock — cargar desde Supabase Storage (Excel)
        StockService.loadFromSupabase(),
        // 5. Personal
        ConfigService.getEmployees(),
      ])

      // Extraer resultados (con fallback a vacío si falló)
      const errors: string[] = []
      if (quotesResult.status === 'rejected') { console.warn('⚠️ Dashboard: quotes failed:', quotesResult.reason); errors.push('Presupuestos') }
      if (projectsResult.status === 'rejected') { console.warn('⚠️ Dashboard: projects failed:', projectsResult.reason); errors.push('Producción') }
      if (purchasesResult.status === 'rejected') { console.warn('⚠️ Dashboard: purchases failed:', purchasesResult.reason); errors.push('Compras') }
      if (stockResult.status === 'rejected') { console.warn('⚠️ Dashboard: stock failed:', stockResult.reason); errors.push('Stock') }
      if (employeesResult.status === 'rejected') { console.warn('⚠️ Dashboard: employees failed:', employeesResult.reason); errors.push('Personal') }
      setDataErrors(errors)

      const quotes = quotesResult.status === 'fulfilled' ? quotesResult.value : { active: [], approved: [], cancelled: [], expired: [] }
      const { projects: allProjects, tasks: allTasks } = projectsResult.status === 'fulfilled' ? projectsResult.value : { projects: [], tasks: [] }
      const purchases = purchasesResult.status === 'fulfilled' ? purchasesResult.value : []
      const stockItems = stockResult.status === 'fulfilled' ? stockResult.value : StockService.getStock()
      const employees = employeesResult.status === 'fulfilled' ? employeesResult.value : []

      setStock(stockItems as any)
      setStockLoaded(stockItems.length > 0)

      // Cálculos
      const allQuotes = [...quotes.active, ...quotes.approved, ...quotes.cancelled, ...quotes.expired]
      const totalQuotesValue = allQuotes.reduce((sum, q) => sum + q.total, 0)
      const approvedValue = quotes.approved.reduce((sum, q) => sum + q.total, 0)
      const totalHoursPlanned = allProjects.reduce((sum, p) => sum + p.total_hours, 0)
      const totalHoursWorked = allTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0)
      const delayed = allProjects.filter(p => {
        if (!p.end_date || p.status === 'COMPLETED') return false
        return differenceInDays(parseISO(p.end_date), new Date()) < 0
      }).length
      const blocked = allTasks.filter(t => t.status === 'BLOCKED').length
      const lowStock = stockItems.filter(item =>
        item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
      )
      const totalValue = stockItems.reduce((sum, item) => {
        return sum + ((item.COSTE_IVA_INCLUIDO || 0) * item.CANTIDAD)
      }, 0)

      setStats({
        totalQuotes: allQuotes.length,
        activeQuotes: quotes.active.length,
        approvedQuotes: quotes.approved.length,
        totalQuotesValue,
        approvedValue,
        totalProjects: allProjects.length,
        inProgressProjects: allProjects.filter(p => p.status === 'IN_PROGRESS').length,
        completedProjects: allProjects.filter(p => p.status === 'COMPLETED').length,
        totalHoursPlanned,
        totalHoursWorked,
        totalPurchases: purchases.length,
        pendingPurchases: purchases.filter(p => p.status === 'PENDING').length,
        totalStockItems: stockItems.length,
        lowStockItems: lowStock.length,
        totalInventoryValue: totalValue,
        totalEmployees: employees.length,
        activeEmployees: employees.filter(e => e.activo).length,
        delayedProjects: delayed,
        blockedTasks: blocked
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

  const efficiency = stats.totalHoursPlanned > 0 
    ? Math.round((stats.totalHoursWorked / stats.totalHoursPlanned) * 100)
    : 0

  return (
    <PageLayout>
      <Header
        title={`⚡ Hola, ${user?.name || 'Administrador'}`}
        description="Panel de control completo"
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
        {/* KPIs Financieros */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <>
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-1">Valor Total Presupuestos</p>
                <p className="text-4xl font-bold">{fmtEurK(stats.totalQuotesValue)}€</p>
                <p className="text-xs opacity-75 mt-2">{stats.totalQuotes} presupuestos</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-1">Presupuestos Aprobados</p>
                <p className="text-4xl font-bold">{fmtEurK(stats.approvedValue)}€</p>
                <p className="text-xs opacity-75 mt-2">{stats.approvedQuotes} proyectos</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-1">Valor Inventario</p>
                <p className="text-4xl font-bold">{fmtEurK(stats.totalInventoryValue)}€</p>
                <p className="text-xs opacity-75 mt-2">{stats.totalStockItems} productos</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <p className="text-sm opacity-90 mb-1">Eficiencia</p>
                <p className="text-4xl font-bold">{efficiency}%</p>
                <p className="text-xs opacity-75 mt-2">
                  {fmtNum(stats.totalHoursWorked, 0)}h / {fmtNum(stats.totalHoursPlanned, 0)}h
                </p>
              </CardContent>
            </Card>
          </>
        </div>

        {/* Alertas críticas */}
        {(stats.delayedProjects > 0 || stats.blockedTasks > 0 || stats.lowStockItems > 0) && (
          <Card className="border-2 border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800 flex items-center gap-2">
                🚨 Alertas Críticas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.delayedProjects > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-red-600">
                    <p className="text-sm text-gray-600">Proyectos Atrasados</p>
                    <p className="text-3xl font-bold text-red-600">{stats.delayedProjects}</p>
                    <Button 
                      variant="link" 
                      size="sm"
                      className="text-red-600 p-0 h-auto mt-2"
                      onClick={() => navigate('/production')}
                    >
                      Revisar →
                    </Button>
                  </div>
                )}
                {stats.blockedTasks > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-orange-600">
                    <p className="text-sm text-gray-600">Tareas Bloqueadas</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.blockedTasks}</p>
                    <Button 
                      variant="link" 
                      size="sm"
                      className="text-orange-600 p-0 h-auto mt-2"
                      onClick={() => navigate('/production?tab=tasks')}
                    >
                      Resolver →
                    </Button>
                  </div>
                )}
                {stats.lowStockItems > 0 && (
                  <div className="bg-white rounded p-4 border-l-4 border-yellow-600">
                    <p className="text-sm text-gray-600">Stock Bajo</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.lowStockItems}</p>
                    <Button 
                      variant="link" 
                      size="sm"
                      className="text-yellow-600 p-0 h-auto mt-2"
                      onClick={() => navigate('/purchases?tab=stock')}
                    >
                      Revisar →
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumen por módulos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ventas */}
          <Card>
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="flex items-center justify-between">
                <span>💰 Ventas</span>
                <Button size="sm" onClick={() => navigate('/quotes')}>
                  Ver →
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total presupuestos</span>
                <Badge>{stats.totalQuotes}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Activos</span>
                <Badge className="bg-blue-600">{stats.activeQuotes}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Aprobados</span>
                <Badge className="bg-green-600">{stats.approvedQuotes}</Badge>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-bold">Conversión</span>
                <span className="font-bold text-green-600">
                  {stats.totalQuotes > 0 
                    ? Math.round((stats.approvedQuotes / stats.totalQuotes) * 100)
                    : 0
                  }%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Producción */}
          <Card>
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="flex items-center justify-between">
                <span>🏭 Producción</span>
                <Button size="sm" onClick={() => navigate('/production')}>
                  Ver →
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total proyectos</span>
                <Badge>{stats.totalProjects}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">En progreso</span>
                <Badge className="bg-green-600">{stats.inProgressProjects}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completados</span>
                <Badge className="bg-blue-600">{stats.completedProjects}</Badge>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-bold">Eficiencia</span>
                <span className={`font-bold ${efficiency >= 90 ? 'text-green-600' : efficiency >= 70 ? 'text-orange-600' : 'text-red-600'}`}>
                  {efficiency}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Operaciones */}
          <Card>
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="flex items-center justify-between">
                <span>📦 Operaciones</span>
                <Button size="sm" onClick={() => navigate('/purchases')}>
                  Ver →
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pedidos pendientes</span>
                <Badge className="bg-orange-600">{stats.pendingPurchases}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Productos en stock</span>
                <Badge>{stats.totalStockItems}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Stock bajo</span>
                <Badge className="bg-yellow-600">{stats.lowStockItems}</Badge>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-bold">Personal activo</span>
                <span className="font-bold text-purple-600">
                  {stats.activeEmployees}/{stats.totalEmployees}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Acceso a todas las secciones */}
        <Card>
          <CardHeader>
            <CardTitle>🎛️ Panel de Control Completo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Button 
                onClick={() => navigate('/quotes')}
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:bg-blue-50"
              >
                <span className="text-3xl">💰</span>
                <span className="text-sm font-medium">Presupuestos</span>
              </Button>

              <Button 
                onClick={() => navigate('/production')}
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:bg-green-50"
              >
                <span className="text-3xl">🏭</span>
                <span className="text-sm font-medium">Producción</span>
              </Button>

              <Button 
                onClick={() => navigate('/calendar')}
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:bg-purple-50"
              >
                <span className="text-3xl">📅</span>
                <span className="text-sm font-medium">Calendario</span>
              </Button>

              <Button 
                onClick={() => navigate('/purchases')}
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:bg-orange-50"
              >
                <span className="text-3xl">📦</span>
                <span className="text-sm font-medium">Compras</span>
              </Button>

              <Button 
                onClick={() => navigate('/config')}
                variant="outline"
                className="h-24 flex flex-col gap-2 hover:bg-gray-50"
              >
                <span className="text-3xl">⚙️</span>
                <span className="text-sm font-medium">Configuración</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}