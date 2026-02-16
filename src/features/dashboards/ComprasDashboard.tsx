import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { StockService } from '@/features/purchases/services/stockService'
import { PurchaseItem, StockItem } from '@/features/purchases/types/purchase.types'
import { useAuth } from '@/app/providers/AuthProvider'

export default function ComprasDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setPurchases(PurchaseService.getAllPurchases())
    setStock(StockService.getStock())
    setLoading(false)
  }

  const pendingPurchases = purchases.filter(p => p.status === 'PENDING')
  const orderedPurchases = purchases.filter(p => p.status === 'ORDERED')
  const lowStockItems = StockService.getLowStockItems()
  const unassignedItems = stock.filter(s => !s.UBICACION || s.UBICACION.trim() === '')

  // Pedidos urgentes (prioridad >= 8)
  const urgentPurchases = pendingPurchases.filter(p => p.priority >= 8)

  // Valor total del inventario
  const totalInventoryValue = stock.reduce((sum, item) => {
    return sum + ((item.COSTE_IVA_INCLUIDO || 0) * item.CANTIDAD)
  }, 0)

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
        title={`📦 Hola, ${user?.name || 'Compras'}`}
        description="Panel de gestión de compras y almacén"
      />

      <div className="p-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Pedidos Pendientes</p>
              <p className="text-4xl font-bold text-orange-600">{pendingPurchases.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Pedidos Cursados</p>
              <p className="text-4xl font-bold text-blue-600">{orderedPurchases.length}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/purchases?tab=stock')}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Stock Bajo</p>
              <p className="text-4xl font-bold text-red-600">{lowStockItems.length}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/purchases?tab=warehouse')}>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Sin Ubicar</p>
              <p className="text-4xl font-bold text-yellow-600">{unassignedItems.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Valor Inventario</p>
              <p className="text-3xl font-bold text-green-600">{totalInventoryValue.toFixed(0)}€</p>
            </CardContent>
          </Card>
        </div>

        {/* Pedidos urgentes */}
        {urgentPurchases.length > 0 && (
          <Card className="border-red-300 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                🔴 Pedidos Urgentes
                <Badge variant="destructive">{urgentPurchases.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {urgentPurchases.slice(0, 5).map(purchase => (
                  <div key={purchase.id} className="bg-white rounded p-3 border border-red-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold">{purchase.materialName}</p>
                        <p className="text-sm text-gray-600">
                          {purchase.quantity} {purchase.unit} - {purchase.provider}
                        </p>
                        {purchase.projectNumber && (
                          <p className="text-xs text-blue-600 mt-1">
                            📋 Proyecto: {purchase.projectNumber}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive" className="mb-2">
                          Prioridad {purchase.priority}
                        </Badge>
                        {purchase.deliveryDays && (
                          <p className="text-xs text-gray-600">
                            {purchase.deliveryDays} días entrega
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {urgentPurchases.length > 5 && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/purchases?tab=pending')}
                  >
                    Ver todos los pedidos urgentes ({urgentPurchases.length})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de acciones rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Stock bajo */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/purchases?tab=stock')}>
            <CardHeader className="bg-orange-50">
              <CardTitle className="text-lg flex items-center gap-2">
                ⚠️ Stock Bajo
                <Badge variant="warning">{lowStockItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {lowStockItems.length > 0 ? (
                <div className="space-y-2">
                  {lowStockItems.slice(0, 3).map(item => (
                    <div key={item.REFERENCIA} className="text-sm flex justify-between">
                      <span className="font-medium truncate flex-1">{item.ARTICULO}</span>
                      <span className="text-orange-600 ml-2">
                        {item.CANTIDAD}/{item.STOCK_MINIMO}
                      </span>
                    </div>
                  ))}
                  {lowStockItems.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ... y {lowStockItems.length - 3} más
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600">✅ Todo el stock está bien</p>
              )}
            </CardContent>
          </Card>

          {/* Pedidos por recibir */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/purchases?tab=ordered')}>
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-lg flex items-center gap-2">
                📦 Esperando Recepción
                <Badge>{orderedPurchases.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {orderedPurchases.length > 0 ? (
                <div className="space-y-2">
                  {orderedPurchases.slice(0, 3).map(purchase => (
                    <div key={purchase.id} className="text-sm">
                      <p className="font-medium truncate">{purchase.materialName}</p>
                      <p className="text-xs text-gray-600">
                        {purchase.quantity} {purchase.unit}
                      </p>
                    </div>
                  ))}
                  {orderedPurchases.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ... y {orderedPurchases.length - 3} más
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No hay pedidos pendientes</p>
              )}
            </CardContent>
          </Card>

          {/* Productos sin ubicar */}
          <Card className="hover:shadow-lg transition cursor-pointer" onClick={() => navigate('/purchases?tab=warehouse')}>
            <CardHeader className="bg-yellow-50">
              <CardTitle className="text-lg flex items-center gap-2">
                📍 Sin Ubicar
                <Badge variant="warning">{unassignedItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {unassignedItems.length > 0 ? (
                <div className="space-y-2">
                  {unassignedItems.slice(0, 3).map(item => (
                    <div key={item.REFERENCIA} className="text-sm">
                      <p className="font-medium truncate">{item.ARTICULO}</p>
                      <p className="text-xs text-gray-600">
                        {item.CANTIDAD} {item.UNIDAD}
                      </p>
                    </div>
                  ))}
                  {unassignedItems.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ... y {unassignedItems.length - 3} más
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-green-600">✅ Todo ubicado</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Accesos rápidos */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 Accesos Rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                onClick={() => navigate('/purchases?tab=pending')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">⏳</span>
                <span className="text-sm">Pedidos Pendientes</span>
              </Button>

              <Button 
                onClick={() => navigate('/purchases?tab=stock')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">📊</span>
                <span className="text-sm">Inventario</span>
              </Button>

              <Button 
                onClick={() => navigate('/purchases?tab=warehouse')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">🏭</span>
                <span className="text-sm">Almacén</span>
              </Button>

              <Button 
                onClick={() => navigate('/quotes')}
                variant="outline"
                className="h-20 flex flex-col gap-2"
              >
                <span className="text-2xl">💰</span>
                <span className="text-sm">Presupuestos</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}