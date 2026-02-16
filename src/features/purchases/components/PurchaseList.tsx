import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { PurchaseService } from '../services/purchaseService'
import { StockService, parseUbicacion } from '../services/stockService'
import WarehouseView from './WarehouseView'
import QRScanner from './QRScanner'
import { PurchaseItem, StockItem } from '../types/purchase.types'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function PurchaseList() {
  const location = useLocation()
  const navigate = useNavigate()

  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'pending' | 'ordered' | 'received' | 'stock' | 'warehouse' | 'scanner'>('pending')
  const [showQR, setShowQR] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedEstanteria, setSelectedEstanteria] = useState<string>('all')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [newLocation, setNewLocation] = useState('')
  const [warehouseShelves, setWarehouseShelves] = useState<{code: string, niveles: number, huecos: number}[]>([])

  // Validar si una ubicación existe realmente en alguna estantería
  const isValidLocation = (ubicacion?: string) => {
    if (!ubicacion || ubicacion.trim() === '') return false
    for (const shelf of warehouseShelves) {
      if (ubicacion.startsWith(shelf.code)) {
        const rest = ubicacion.substring(shelf.code.length)
        if (rest.length >= 2) {
          const nivel = parseInt(rest[0])
          const hueco = parseInt(rest.substring(1))
          if (!isNaN(nivel) && !isNaN(hueco) &&
              nivel >= 1 && nivel <= shelf.niveles &&
              hueco >= 1 && hueco <= shelf.huecos) {
            return true
          }
        }
      }
    }
    return false
  }

  const refreshData = async () => {
    setPurchases(PurchaseService.getAllPurchases())
    // Cargar stock desde Supabase
    const { data: stockData, error } = await supabase
      .from('stock_items')
      .select('*')
      .order('articulo')
    if (error) {
      console.error('Error cargando stock:', error)
      toast.error('Error cargando inventario')
    } else {
      // Convertir a formato StockItem
      const formattedStock: StockItem[] = (stockData || []).map(item => ({
        REFERENCIA: item.referencia,
        FAMILIA: item.familia,
        CATEGORIA: item.categoria,
        ARTICULO: item.articulo,
        DESCRIPCION: item.descripcion,
        CANTIDAD: item.cantidad,
        STOCK_MINIMO: item.stock_minimo,
        UNIDAD: item.unidad,
        COSTE_IVA_INCLUIDO: item.coste_iva_incluido,
        UBICACION: item.ubicacion,
        PROVEEDOR: item.proveedor
      }))
      setStock(formattedStock)
      setStockLoaded(formattedStock.length > 0)
    }
  }

  useEffect(() => {
    refreshData()
    // Cargar estanterías para validar ubicaciones
    supabase.from('warehouse_shelves').select('code, niveles, huecos').eq('activa', true)
      .then(({ data }) => { if (data) setWarehouseShelves(data) })
  }, [])

  // Cambiar tab si viene por navegación
  useEffect(() => {
    if (location.state?.tab) {
      setSelectedTab(location.state.tab)
    }
  }, [location])

  // Función para ir a la ubicación en el almacén
  const handleGoToLocation = (ubicacion: string) => {
    const shelfCode = ubicacion.charAt(0)
    setSelectedTab('warehouse')
    // Usar replace para no acumular en history
    navigate('/purchases', {
      state: {
        tab: 'warehouse',
        selectedShelf: shelfCode,
        highlightLocation: ubicacion
      },
      replace: true
    })
    toast.success(`📍 Navegando a ubicación ${ubicacion}`)
  }

  // Función para abrir modal de asignación rápida
  const handleAssignLocation = (item: StockItem) => {
    setSelectedItem(item)
    setNewLocation('')
    setShowAssignModal(true)
  }

  // Función para confirmar asignación
  const confirmAssignLocation = async () => {
    if (!selectedItem || !newLocation) {
      toast.error('Introduce una ubicación válida')
      return
    }

    try {
      await StockService.updateLocation(selectedItem.REFERENCIA, newLocation)
      toast.success(`✅ ${selectedItem.ARTICULO} ubicado en ${newLocation}`)
      setShowAssignModal(false)
      setSelectedItem(null)
      setNewLocation('')
      refreshData()
    } catch (error: any) {
      toast.error('Error asignando ubicación: ' + error.message)
    }
  }

  // Note: stock import now handled via /setup page (sync from Supabase)

  const handleMarkAsOrdered = (itemId: string) => {
    PurchaseService.markAsOrdered(itemId)
    refreshData()
  }

  const handleMarkAsReceived = async (itemId: string) => {
    // Buscar el item antes de marcarlo para saber si ya existía en stock
    const item = purchases.find(p => p.id === itemId)
    const existedInStock = item?.referencia 
      ? !!StockService.getItemByReference(item.referencia) 
      : false

    const qrDataURL = await PurchaseService.markAsReceived(itemId)
    
    if (qrDataURL) {
      // Guardar el QR
      PurchaseService.saveQR(itemId, qrDataURL)
      
      // Mostrar el QR
      setShowQR(qrDataURL)
      
      if (existedInStock) {
        toast.success(`✅ Recibido y cantidad actualizada en stock. Imprime el QR para etiquetar.`, { duration: 5000 })
      } else {
        toast.success(`✅ Recibido y añadido al inventario. Imprime el QR para etiquetar.`, { duration: 5000 })
      }
    }
    
    refreshData()
  }

  const providers = [...new Set(purchases.map(p => p.provider).filter(Boolean))]
  
  const filteredPurchases = purchases
    .filter(p => {
      const matchesStatus = 
        (selectedTab === 'pending' && p.status === 'PENDING') ||
        (selectedTab === 'ordered' && p.status === 'ORDERED') ||
        (selectedTab === 'received' && p.status === 'RECEIVED')
      
      const matchesProvider = selectedProvider === 'all' || p.provider === selectedProvider
      
      const matchesSearch = !searchTerm || 
        p.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.provider?.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesStatus && matchesProvider && matchesSearch
    })
    .sort((a, b) => {
      // Ordenar por prioridad (mayor primero)
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      // Si tienen la misma prioridad, ordenar por días de entrega (menor primero)
      if (a.deliveryDays && b.deliveryDays) {
        return a.deliveryDays - b.deliveryDays
      }
      // Si no tienen días de entrega, ordenar por fecha de creación (más reciente primero)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  // Obtener estanterías únicas
  const estanterias = [...new Set(
    stock
      .map(s => s.UBICACION?.[0])
      .filter(Boolean)
  )].sort()

  const filteredStock = stock.filter(s => {
    const matchesSearch = !searchTerm || 
      s.ARTICULO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.REFERENCIA?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.FAMILIA?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.UBICACION?.includes(searchTerm)
    
    const matchesEstanteria = selectedEstanteria === 'all' || 
      s.UBICACION?.[0] === selectedEstanteria
    
    return matchesSearch && matchesEstanteria
  })

  const lowStockItems = StockService.getLowStockItems()

  const pendingCount = purchases.filter(p => p.status === 'PENDING').length
  const orderedCount = purchases.filter(p => p.status === 'ORDERED').length
  const receivedCount = purchases.filter(p => p.status === 'RECEIVED').length

  const PurchaseCard = ({ item }: { item: PurchaseItem }) => {
    const getPriorityColor = (priority: number) => {
      if (priority >= 8) return 'destructive'
      if (priority >= 6) return 'warning'
      return 'secondary'
    }

    const getPriorityLabel = (priority: number) => {
      if (priority >= 8) return '🔴 Urgente'
      if (priority >= 6) return '🟡 Alta'
      if (priority >= 4) return '🟢 Media'
      return '⚪ Baja'
    }

    const isLowStockReplenishment = item.id.startsWith('lowstock-')

    return (
      <Card className={`hover:shadow-md transition ${isLowStockReplenishment ? 'border-orange-300 bg-orange-50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{item.materialName}</h3>
              {item.productName && (
                <p className="text-sm text-gray-600">Para: {item.productName}</p>
              )}
              {item.projectNumber ? (
                <p className="text-xs text-gray-500">📋 Proyecto: {item.projectNumber}</p>
              ) : (
                <p className="text-xs text-orange-600 font-medium">⚠️ Reposición de stock</p>
              )}
            </div>
            <Badge variant={getPriorityColor(item.priority)}>
              {getPriorityLabel(item.priority)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <p className="text-gray-600">Cantidad:</p>
              <p className="font-medium">{item.quantity} {item.unit}</p>
            </div>
            {item.provider && (
              <div>
                <p className="text-gray-600">Proveedor:</p>
                <p className="font-medium">{item.provider}</p>
              </div>
            )}
            {item.deliveryDays && (
              <div>
                <p className="text-gray-600">Entrega:</p>
                <p className="font-medium">{item.deliveryDays} días</p>
              </div>
            )}
            {item.orderedAt && (
              <div>
                <p className="text-gray-600">Pedido:</p>
                <p className="font-medium text-xs">
                  {new Date(item.orderedAt).toLocaleDateString('es-ES')}
                </p>
              </div>
            )}
          </div>

          {item.notes && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              {item.notes}
            </div>
          )}

          <div className="flex gap-2">
            {item.status === 'PENDING' && (
              <Button
                size="sm"
                className="flex-1"
                onClick={() => handleMarkAsOrdered(item.id)}
              >
                📦 Marcar como Pedido
              </Button>
            )}
            {item.status === 'ORDERED' && (
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => handleMarkAsReceived(item.id)}
              >
                ✅ Marcar como Recibido
              </Button>
            )}
            {item.status === 'RECEIVED' && (
              <Badge variant="success" className="flex-1 justify-center py-2">
                ✅ Recibido
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const StockCard = ({ item }: { item: StockItem }) => {
    const isLowStock = item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
    const ubicacion = item.UBICACION ? parseUbicacion(item.UBICACION) : null

    // Formatear unidad
    const formatUnidad = (unidad: string) => {
      const unidadesCompletas: Record<string, string> = {
        'ud': 'unidades',
        'uds': 'unidades',
        'm': 'metros',
        'cm': 'centímetros',
        'kg': 'kilogramos',
        'g': 'gramos',
        'l': 'litros',
        'ml': 'mililitros',
      }
      return unidadesCompletas[unidad.toLowerCase()] || unidad
    }

    return (
      <Card className={`hover:shadow-md transition ${isLowStock ? 'border-orange-300 bg-orange-50' : ''}`}>
        <CardContent className="p-4">
          {/* Header con nombre y alertas */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-gray-900 mb-1">
                {item.ARTICULO}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {item.REFERENCIA}
                </span>
                {isLowStock && (
                  <Badge variant="warning" className="text-xs">
                    ⚠️ Stock bajo
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Descripción */}
          {item.DESCRIPCION && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
              {item.DESCRIPCION}
            </p>
          )}

          {/* Stock actual (destacado) */}
          <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Stock:</span>
              <span className={`text-xl font-bold ${isLowStock ? 'text-orange-600' : 'text-green-600'}`}>
                {item.CANTIDAD} {formatUnidad(item.UNIDAD)}
              </span>
            </div>
            
            {/* Stock mínimo - solo si está definido */}
            {item.STOCK_MINIMO && item.STOCK_MINIMO > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between">
                <span className="text-xs text-gray-600">Mínimo:</span>
                <span className="text-sm font-medium text-gray-700">
                  {item.STOCK_MINIMO} {formatUnidad(item.UNIDAD)}
                </span>
              </div>
            )}
          </div>

          {/* Ubicación - destacada */}
          {ubicacion && (
            <div className="mb-3 bg-yellow-50 border border-yellow-200 rounded p-2">
              <p className="text-xs text-gray-600 mb-1">📍 Ubicación:</p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-yellow-800 text-lg">
                  {item.UBICACION}
                </span>
                <span className="text-xs text-gray-600">
                  E{ubicacion.estanteria}-N{ubicacion.nivel}-H{ubicacion.hueco}
                </span>
              </div>
            </div>
          )}

          {/* Información en grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Familia:</p>
              <p className="font-medium">{item.FAMILIA}</p>
            </div>
            <div>
              <p className="text-gray-500">Categoría:</p>
              <p className="font-medium">{item.CATEGORIA}</p>
            </div>

            {item.COSTE_IVA_INCLUIDO && item.COSTE_IVA_INCLUIDO > 0 && (
              <>
                <div>
                  <p className="text-gray-500">Coste ud:</p>
                  <p className="font-semibold">{item.COSTE_IVA_INCLUIDO.toFixed(2)}€</p>
                </div>
                <div>
                  <p className="text-gray-500">Valor total:</p>
                  <p className="font-semibold text-blue-600">
                    {(item.COSTE_IVA_INCLUIDO * item.CANTIDAD).toFixed(2)}€
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <PageLayout>
      <Header
        title="Pedidos y Stock"
        description="Gestión de compras y control de inventario"
      />

      <div className="p-8 space-y-6">
        {showQR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowQR(null)}>
            <Card className="max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>✅ Material Recibido - Código QR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-300 flex justify-center">
                  <img src={showQR} alt="QR Code" className="w-full max-w-xs" />
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-bold text-blue-800 mb-2">📋 Instrucciones:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Imprime este código QR</li>
                    <li>Pégalo en el material recibido</li>
                    <li>Escanéalo para ubicarlo en el almacén</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.download = `qr-${Date.now()}.png`
                      link.href = showQR
                      link.click()
                      toast.success('QR descargado')
                    }}
                  >
                    💾 Descargar QR
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      const printWindow = window.open('', '', 'width=600,height=600')
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head><title>Imprimir QR</title></head>
                            <body style="text-align: center; padding: 20px;">
                              <h2>Código QR - Material</h2>
                              <img src="${showQR}" style="width: 300px; height: 300px;" />
                              <p>Pegar en el material recibido</p>
                            </body>
                          </html>
                        `)
                        printWindow.document.close()
                        printWindow.print()
                      }
                    }}
                  >
                    🖨️ Imprimir QR
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowQR(null)}
                  >
                    ✕ Cerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {/* Importar Stock */}
        {!stockLoaded && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle>📊 Importar Inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-700">
                  Importa el archivo Excel de stock para gestionar el inventario
                </p>
                <div className="p-3 bg-white rounded border">
                  <p className="text-sm text-gray-700">La importación de stock ahora se realiza desde la página de configuración inicial.</p>
                  <p className="text-sm text-gray-600 mt-2">Visita <a href="/setup" className="text-blue-600 underline">/setup</a> para importar los archivos desde Supabase.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alertas de stock bajo */}
        {lowStockItems.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚠️ Stock Bajo</span>
                <Badge variant="warning">{lowStockItems.length} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map(item => (
                  <div key={item.REFERENCIA} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.ARTICULO}</span>
                    <span className="text-orange-600">
                      {item.CANTIDAD}/{item.STOCK_MINIMO} {item.UNIDAD}
                    </span>
                  </div>
                ))}
                {lowStockItems.length > 5 && (
                  <p className="text-xs text-gray-600">
                    ... y {lowStockItems.length - 5} más
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs principales */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <button
                onClick={() => setSelectedTab('pending')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Pendientes
                <Badge variant={selectedTab === 'pending' ? 'secondary' : 'outline'} className="ml-2">
                  {pendingCount}
                </Badge>
              </button>
              
              <button
                onClick={() => setSelectedTab('ordered')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'ordered'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Pedidos
                <Badge variant={selectedTab === 'ordered' ? 'secondary' : 'outline'} className="ml-2">
                  {orderedCount}
                </Badge>
              </button>
              
              <button
                onClick={() => setSelectedTab('received')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'received'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Recibidos
                <Badge variant={selectedTab === 'received' ? 'secondary' : 'outline'} className="ml-2">
                  {receivedCount}
                </Badge>
              </button>
              
              <button
                onClick={() => setSelectedTab('stock')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'stock'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Inventario
                <Badge variant={selectedTab === 'stock' ? 'secondary' : 'outline'} className="ml-2">
                  {stock.length}
                </Badge>
              </button>

              <button
                onClick={() => setSelectedTab('warehouse')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'warehouse'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Almacén
                {stockLoaded && (
                  <Badge variant={selectedTab === 'warehouse' ? 'secondary' : 'outline'} className="ml-2">
                    {stock.filter(s => isValidLocation(s.UBICACION)).length}
                  </Badge>
                )}
              </button>

              <button
                onClick={() => setSelectedTab('scanner')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  selectedTab === 'scanner'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                📷 Escanear QR
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="🔍 Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              {selectedTab === 'stock' && estanterias.length > 0 && (
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-gray-600">Estantería:</span>
                  <select
                    value={selectedEstanteria}
                    onChange={(e) => setSelectedEstanteria(e.target.value)}
                    className="px-4 py-2 border rounded-lg text-sm"
                  >
                    <option value="all">Todas</option>
                    {estanterias.map(est => (
                      <option key={est} value={est}>
                        Estantería {est}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {selectedTab !== 'stock' && providers.length > 0 && (
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="all">Todos los proveedores</option>
                  {providers.map(provider => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contenido según tab */}
        {selectedTab === 'warehouse' ? (
          <WarehouseView
            stock={stock}
            onRefresh={refreshData}
            initialSelectedShelf={location.state?.selectedShelf}
            highlightLocation={location.state?.highlightLocation}
          />
        ) : selectedTab === 'scanner' ? (
          <QRScanner stock={stock} onRefresh={refreshData} />
        ) : selectedTab === 'stock' ? (
          // Vista de inventario
          <div>
            {stockLoaded ? (
              filteredStock.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500">No se encontraron items</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full divide-y divide-gray-200 table-fixed">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="w-[35%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Artículo
                            </th>
                            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Referencia
                            </th>
                            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Cantidad
                            </th>
                            <th className="w-[17%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              📍 Ubicación
                            </th>
                            <th className="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Coste
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredStock.map((item, index) => {
                            const isLowStock = item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
                            return (
                              <tr key={`${item.REFERENCIA}-${index}`} className={`hover:bg-gray-50 ${isLowStock ? 'bg-orange-50' : ''}`}>
                                <td className="px-4 py-4 max-w-0 overflow-hidden">
                                  <div className="text-sm font-medium text-gray-900 truncate" title={item.ARTICULO}>
                                    {item.ARTICULO}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">{item.FAMILIA}</div>
                                </td>
                                <td className="px-4 py-4 max-w-0 overflow-hidden text-sm text-gray-500">
                                  <span className="truncate block" title={item.REFERENCIA}>{item.REFERENCIA}</span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className={`text-sm font-bold ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}>
                                    {item.CANTIDAD} {item.UNIDAD}
                                  </div>
                                  {item.STOCK_MINIMO && (
                                    <div className="text-xs text-gray-500">
                                      Min: {item.STOCK_MINIMO}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {isValidLocation(item.UBICACION) ? (
                                    <button
                                      onClick={() => handleGoToLocation(item.UBICACION!)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition text-sm font-medium"
                                      title="Ir a esta ubicación en el almacén"
                                    >
                                      📍 {item.UBICACION}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAssignLocation(item)}
                                      className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition text-sm font-medium"
                                      title="Asignar ubicación"
                                    >
                                      ⚠️ Sin ubicar
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  {item.COSTE_IVA_INCLUIDO && item.COSTE_IVA_INCLUIDO > 0 ? (
                                    <div>
                                      <div className="font-medium">{item.COSTE_IVA_INCLUIDO.toFixed(2)}€</div>
                                      <div className="text-xs text-blue-600">
                                        Total: {(item.COSTE_IVA_INCLUIDO * item.CANTIDAD).toFixed(2)}€
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 mb-4">
                    Importa el archivo de stock para ver el inventario
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          // Vista de pedidos
          <div>
            {filteredPurchases.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 text-lg mb-2">
                    No hay pedidos {selectedTab === 'pending' ? 'pendientes' : selectedTab === 'ordered' ? 'en curso' : 'recibidos'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Los pedidos se generan automáticamente al aprobar presupuestos
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPurchases.map(item => (
                  <PurchaseCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Asignación Rápida */}
        {showAssignModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
            <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>📍 Asignar Ubicación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="font-bold">{selectedItem.ARTICULO}</div>
                  <div className="text-sm text-gray-600">
                    Ref: {selectedItem.REFERENCIA}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Ubicación:
                  </label>
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
                    placeholder="Ej: 123 (Estantería 1, Nivel 2, Hueco 3)"
                    className="font-mono text-lg"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newLocation) {
                        confirmAssignLocation()
                      }
                    }}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={confirmAssignLocation}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!newLocation}
                  >
                    ✅ Asignar
                  </Button>
                  <Button
                    onClick={() => setShowAssignModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    ❌ Cancelar
                  </Button>
                </div>

                <div className="text-xs text-gray-500 text-center">
                  O ve a la sección de{' '}
                  <button
                    onClick={() => {
                      setShowAssignModal(false)
                      setSelectedTab('warehouse')
                    }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Almacén Visual
                  </button>
                  {' '}para seleccionar gráficamente
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageLayout>
  )
}