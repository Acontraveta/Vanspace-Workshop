import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { StockItem } from '../types/purchase.types'
import { StockService } from '../services/stockService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface WarehouseViewProps {
  stock: StockItem[]
  onRefresh: () => void
  initialSelectedShelf?: string
  highlightLocation?: string
}

interface Shelf {
  id: string
  code: string
  name: string
  niveles: number
  huecos: number
  color: string
  activa: boolean
}

export default function WarehouseView({ stock, onRefresh, initialSelectedShelf, highlightLocation }: WarehouseViewProps) {
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [selectedShelf, setSelectedShelf] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [movingItem, setMovingItem] = useState<StockItem | null>(null)
  const [moveToLocation, setMoveToLocation] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(true)
  const [qrCode, setQrCode] = useState('')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [warehouseCameraActive, setWarehouseCameraActive] = useState(false)
  const warehouseScannerRef = useRef<any>(null)
  const warehouseScannerContainerId = 'warehouse-qr-reader'

  const [newShelf, setNewShelf] = useState({
    code: '',
    name: '',
    niveles: 4,
    huecos: 6,
    color: '#3b82f6'
  })

  useEffect(() => {
    loadShelves()
  }, [])

  // Seleccionar estantería y resaltar ubicación si viene de navegación
  useEffect(() => {
    if (initialSelectedShelf && shelves.length > 0) {
      const shelf = shelves.find(s => s.code === initialSelectedShelf)
      if (shelf) {
        setSelectedShelf(shelf.id)

        if (highlightLocation) {
          setTimeout(() => {
            const element = document.getElementById(`location-${highlightLocation}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              element.classList.add('animate-pulse', 'ring-4', 'ring-yellow-400')

              setTimeout(() => {
                element.classList.remove('animate-pulse', 'ring-4', 'ring-yellow-400')
              }, 3000)
            }
          }, 500)
        }
      }
    }
  }, [initialSelectedShelf, highlightLocation, shelves])

  const loadShelves = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse_shelves')
        .select('*')
        .eq('activa', true)
        .order('code')

      if (error) throw error
      setShelves(data || [])
      
      // Seleccionar la primera estantería por defecto
      if (data && data.length > 0 && !selectedShelf) {
        setSelectedShelf(data[0].id)
      }
    } catch (error) {
      console.error('Error cargando estanterías:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignToLocation = (location: string) => {
    setSelectedLocation(location)
    setSearchTerm('')
    setShowOnlyUnassigned(true)
    setQrCode('')
    setShowAssignModal(true)
  }

  const handleMoveItem = (item: StockItem) => {
    setMovingItem(item)
    setMoveToLocation('')
    setShowMoveModal(true)
  }

  const confirmAssign = async (item: StockItem) => {
    if (!selectedLocation) return

    try {
      await StockService.updateLocation(item.REFERENCIA, selectedLocation)
      toast.success(`${item.ARTICULO} asignado a ${selectedLocation}`)
      setShowAssignModal(false)
      setSelectedLocation(null)
      onRefresh()
    } catch (error: any) {
      toast.error('Error asignando producto: ' + error.message)
    }
  }

  const confirmMove = async () => {
    if (!movingItem || !moveToLocation) {
      toast.error('Selecciona una ubicación destino')
      return
    }

    // Validar formato
    if (moveToLocation.length < 2) {
      toast.error('Ubicación inválida')
      return
    }

    // Verificar si destino está ocupado
    const destinoOcupado = stock.find(s => s.UBICACION === moveToLocation)
    if (destinoOcupado) {
      toast.error(`Ubicación ${moveToLocation} ya ocupada por: ${destinoOcupado.ARTICULO}`)
      return
    }

    try {
      await StockService.updateLocation(movingItem.REFERENCIA, moveToLocation)
      
      toast.success(
        `✅ Producto movido\n` +
        `${movingItem.ARTICULO}\n` +
        `De: ${movingItem.UBICACION || 'Sin ubicar'} → A: ${moveToLocation}\n` +
        `⚠️ Recuerda moverlo físicamente en el almacén`,
        { duration: 6000 }
      )
      
      setShowMoveModal(false)
      setMovingItem(null)
      setMoveToLocation('')
      setLocationFilter('all')
      onRefresh()
    } catch (error: any) {
      toast.error('Error moviendo producto: ' + error.message)
    }
  }

  // Validar si una ubicación existe realmente en alguna estantería
  const isValidLocation = (ubicacion?: string) => {
    if (!ubicacion || ubicacion.trim() === '') return false
    for (const shelf of shelves) {
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

  // Función para filtrar productos
  const getFilteredProducts = () => {
    let products = showOnlyUnassigned 
      ? stock.filter(s => !isValidLocation(s.UBICACION))
      : stock

    if (!searchTerm.trim()) return products

    const term = searchTerm.toLowerCase()
    
    return products.filter(item => 
      item.ARTICULO.toLowerCase().includes(term) ||
      item.REFERENCIA.toLowerCase().includes(term) ||
      item.FAMILIA?.toLowerCase().includes(term) ||
      item.CATEGORIA?.toLowerCase().includes(term) ||
      item.DESCRIPCION?.toLowerCase().includes(term)
    )
  }

  const filteredProducts = getFilteredProducts()

  // Función para manejar QR
  const handleQRScan = (code: string) => {
    try {
      const data = JSON.parse(code)
      
      if (data.type === 'warehouse_product' && data.referencia) {
        const item = stock.find(s => s.REFERENCIA === data.referencia)
        
        if (item) {
          confirmAssign(item)
          setQrCode('')
        } else {
          toast.error('Producto no encontrado en stock')
        }
      } else {
        toast.error('Código QR inválido')
      }
    } catch (error) {
      // No es JSON, buscar por referencia directa
      const item = stock.find(s => 
        s.REFERENCIA.toLowerCase() === code.toLowerCase() ||
        s.ARTICULO.toLowerCase().includes(code.toLowerCase())
      )
      
      if (item) {
        confirmAssign(item)
        setQrCode('')
      } else {
        toast.error('Producto no encontrado')
      }
    }
  }

  const startWarehouseCamera = useCallback(async () => {
    setWarehouseCameraActive(true)
    await new Promise(r => setTimeout(r, 100))
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const container = document.getElementById(warehouseScannerContainerId)
      const containerWidth = container?.clientWidth || 300
      const qrboxSize = Math.min(220, Math.floor(containerWidth * 0.65))

      const scanner = new Html5Qrcode(warehouseScannerContainerId)
      warehouseScannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => {
          handleQRScan(decodedText)
          stopWarehouseCamera()
        },
        () => {}
      )
    } catch (err: any) {
      toast.error('No se pudo iniciar la cámara')
      console.error(err)
      setWarehouseCameraActive(false)
    }
  }, [])

  const stopWarehouseCamera = useCallback(() => {
    if (warehouseScannerRef.current) {
      warehouseScannerRef.current.stop().then(() => {
        warehouseScannerRef.current.clear()
      }).catch(() => {})
      warehouseScannerRef.current = null
    }
    setWarehouseCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      if (warehouseScannerRef.current) {
        warehouseScannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const getEmptyLocations = (): string[] => {
    const empty: string[] = []
    
    shelves.forEach(shelf => {
      for (let nivel = shelf.niveles; nivel >= 1; nivel--) {
        for (let hueco = 1; hueco <= shelf.huecos; hueco++) {
          const location = `${shelf.code}${nivel}${hueco}`
          const isOccupied = stock.some(s => s.UBICACION === location)
          
          if (!isOccupied) {
            empty.push(location)
          }
        }
      }
    })
    
    return empty.sort()
  }

  const handleCreateShelf = async () => {
    if (!newShelf.code || !newShelf.name) {
      toast.error('Código y nombre son obligatorios')
      return
    }

    try {
      const { error } = await supabase
        .from('warehouse_shelves')
        .insert({
          code: newShelf.code,
          name: newShelf.name,
          niveles: newShelf.niveles,
          huecos: newShelf.huecos,
          color: newShelf.color,
          activa: true
        })

      if (error) throw error

      toast.success('Estantería creada')
      setShowCreateModal(false)
      setNewShelf({ code: '', name: '', niveles: 4, huecos: 6, color: '#3b82f6' })
      loadShelves()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  const handleEditShelf = async () => {
    if (!editingShelf) return

    try {
      const { error } = await supabase
        .from('warehouse_shelves')
        .update({
          name: editingShelf.name,
          niveles: editingShelf.niveles,
          huecos: editingShelf.huecos,
          color: editingShelf.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingShelf.id)

      if (error) throw error

      toast.success('Estantería actualizada')
      setShowEditModal(false)
      setEditingShelf(null)
      loadShelves()
      onRefresh()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  const handleDeleteShelf = async (shelf: Shelf) => {
    const itemsInShelf = stock.filter(s => s.UBICACION?.startsWith(shelf.code))
    
    const confirmMsg = itemsInShelf.length > 0
      ? `Esta estantería tiene ${itemsInShelf.length} productos. Se moverán a "Sin asignar". ¿Continuar?`
      : `¿Eliminar la estantería "${shelf.name}"?`

    if (!confirm(confirmMsg)) return

    try {
      // Mover productos a sin asignar
      for (const item of itemsInShelf) {
        await StockService.updateLocation(item.REFERENCIA, '')
      }

      // Desactivar estantería
      const { error } = await supabase
        .from('warehouse_shelves')
        .update({ activa: false })
        .eq('id', shelf.id)

      if (error) throw error

      toast.success('Estantería eliminada. Productos movidos a "Sin asignar".')
      
      // Si era la seleccionada, cambiar a otra
      if (selectedShelf === shelf.id) {
        setSelectedShelf(null)
      }
      
      loadShelves()
      onRefresh()
    } catch (error: any) {
      toast.error('Error: ' + error.message)
    }
  }

  const getItemsInLocation = (shelfCode: string, nivel: number, hueco: number) => {
    const location = `${shelfCode}${nivel}${hueco}`
    return stock.filter(s => s.UBICACION === location)
  }

  const getUnassignedItems = () => {
    return stock.filter(s => !isValidLocation(s.UBICACION))
  }

  const renderShelfGrid = (shelf: Shelf) => {
    const itemsCount = stock.filter(s => {
      if (!s.UBICACION || !s.UBICACION.startsWith(shelf.code)) return false
      const rest = s.UBICACION.substring(shelf.code.length)
      if (rest.length < 2) return false
      const nivel = parseInt(rest[0])
      const hueco = parseInt(rest.substring(1))
      return !isNaN(nivel) && !isNaN(hueco) &&
             nivel >= 1 && nivel <= shelf.niveles &&
             hueco >= 1 && hueco <= shelf.huecos
    }).length
    const totalSpaces = shelf.niveles * shelf.huecos
    const occupancy = ((itemsCount / totalSpaces) * 100).toFixed(0)

    return (
      <Card key={shelf.id} className={selectedShelf === shelf.id ? 'ring-2 ring-blue-500' : ''}>
        <CardHeader 
          style={{ 
            background: `linear-gradient(135deg, ${shelf.color}20 0%, ${shelf.color}40 100%)`,
            borderBottom: `4px solid ${shelf.color}`
          }}
          className="cursor-pointer"
          onClick={() => setSelectedShelf(selectedShelf === shelf.id ? null : shelf.id)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <span style={{ color: shelf.color }}>📦</span>
                {shelf.name}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">Código: {shelf.code}</p>
            </div>
            <div className="text-right">
              <Badge 
                variant={parseInt(occupancy) > 80 ? 'destructive' : parseInt(occupancy) > 50 ? 'warning' : 'default'}
                className="mb-2"
              >
                {occupancy}% ocupado
              </Badge>
              <p className="text-xs text-gray-600">
                {itemsCount} / {totalSpaces} espacios
              </p>
            </div>
          </div>
        </CardHeader>

        {selectedShelf === shelf.id && (
          <CardContent className="p-6">
            {/* Grid Visual de Estantería */}
            <div className="mb-6">
              <div className="relative bg-gradient-to-b from-gray-100 to-gray-200 p-8 rounded-lg">
                {/* Bastidor lateral izquierdo */}
                <div className="absolute left-4 top-0 bottom-0 w-3 bg-gradient-to-r from-gray-700 to-gray-600 rounded"></div>
                
                {/* Bastidor lateral derecho */}
                <div className="absolute right-4 top-0 bottom-0 w-3 bg-gradient-to-r from-gray-600 to-gray-700 rounded"></div>

                {/* Niveles (de arriba hacia abajo) */}
                <div className="space-y-6">
                  {Array.from({ length: shelf.niveles }, (_, nivelIdx) => {
                    const nivel = shelf.niveles - nivelIdx // Invertir: nivel alto arriba
                    
                    return (
                      <div key={nivel} className="relative">
                        {/* Balda/estante */}
                        <div 
                          className="absolute inset-x-8 h-4 rounded"
                          style={{
                            background: 'linear-gradient(180deg, #d4a574 0%, #b8956a 50%, #8b7355 100%)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)'
                          }}
                        ></div>

                        {/* Espaciado para la balda */}
                        <div className="h-4"></div>

                        {/* Huecos/productos en este nivel */}
                        <div 
                          className="grid gap-2 px-12 py-3"
                          style={{ gridTemplateColumns: `repeat(${shelf.huecos}, 1fr)` }}
                        >
                          {Array.from({ length: shelf.huecos }, (_, huecoIdx) => {
                            const hueco = huecoIdx + 1
                            const items = getItemsInLocation(shelf.code, nivel, hueco)
                            const hasItems = items.length > 0
                            const location = `${shelf.code}${nivel}${hueco}`

                            return (
                              <div
                                id={`location-${location}`}
                                key={location}
                                className={`
                                  relative rounded p-2 transition-all cursor-pointer
                                  ${hasItems 
                                    ? 'bg-white border-2 border-green-400 hover:border-green-600 shadow-md hover:shadow-xl' 
                                    : 'bg-transparent border-2 border-dashed border-gray-300 hover:border-blue-400'
                                  }
                                `}
                                style={{
                                  minHeight: '100px',
                                  transform: hasItems ? 'translateY(-2px)' : 'none'
                                }}
                                title={items.map(i => `${i.ARTICULO} (${i.CANTIDAD} ${i.UNIDAD})`).join('\n')}
                                onClick={() => {
                                  if (hasItems) {
                                    if (items.length === 1) {
                                      handleMoveItem(items[0])
                                    } else {
                                      setSelectedLocation(location)
                                      setShowAssignModal(true)
                                    }
                                  } else {
                                    handleAssignToLocation(location)
                                  }
                                }}
                              >
                                {/* Código de ubicación */}
                                <div className="absolute top-1 left-1 text-[9px] font-mono font-bold opacity-50">
                                  {location}
                                </div>

                                {/* Label del nivel (solo en primer hueco) */}
                                {huecoIdx === 0 && (
                                  <div 
                                    className="absolute -left-10 top-1/2 -translate-y-1/2 bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded"
                                  >
                                    N{nivel}
                                  </div>
                                )}

                                {/* Contenido del hueco */}
                                <div className="mt-3">
                                  {hasItems ? (
                                    <div className="space-y-1">
                                      {/* Caja/Producto visual */}
                                      <div 
                                        className="w-full h-12 rounded-sm flex items-center justify-center text-white font-bold text-xs"
                                        style={{
                                          background: `linear-gradient(135deg, ${shelf.color} 0%, ${shelf.color}dd 100%)`,
                                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                        }}
                                      >
                                        {items.length}
                                      </div>
                                      
                                      {/* Detalles */}
                                      <div className="text-center">
                                        <div className="text-[10px] font-semibold text-gray-800 truncate">
                                          {items[0].ARTICULO.substring(0, 15)}
                                        </div>
                                        {items.length > 1 && (
                                          <div className="text-[9px] text-blue-600 font-medium">
                                            +{items.length - 1} más
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <div className="text-gray-400 text-xs text-center">
                                        Vacío
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Base de la estantería */}
                <div 
                  className="relative mt-6 h-6 mx-8 rounded"
                  style={{
                    background: 'linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 100%)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                ></div>

                {/* Headers de huecos (arriba) */}
                <div 
                  className="absolute top-0 left-12 right-12 grid gap-2 -translate-y-8"
                  style={{ gridTemplateColumns: `repeat(${shelf.huecos}, 1fr)` }}
                >
                  {Array.from({ length: shelf.huecos }, (_, i) => (
                    <div key={i} className="text-center text-xs font-bold text-gray-600">
                      H{i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-6 text-sm mb-4 pb-4 border-b">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-400 rounded"></div>
                <span className="text-gray-600">Ocupado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-50 border-2 border-gray-300 rounded"></div>
                <span className="text-gray-600">Vacío</span>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingShelf(shelf)
                  setShowEditModal(true)
                }}
                size="sm"
                variant="outline"
              >
                ✏️ Editar Estantería
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteShelf(shelf)
                }}
                size="sm"
                variant="destructive"
              >
                🗑️ Eliminar
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const unassigned = getUnassignedItems()

  if (loading) {
    return <div className="text-center py-8">Cargando almacén...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">🏭 Almacén Visual</h2>
          <p className="text-gray-600">Gestión de estanterías y ubicaciones</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
          ➕ Nueva Estantería
        </Button>
      </div>

      {/* Grid de estanterías */}
      <div className="space-y-4">
        {shelves.map(renderShelfGrid)}
      </div>

      {/* Productos sin asignar */}
      {unassigned.length > 0 && (
        <Card className="border-2 border-orange-400 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              ⚠️ Productos Sin Ubicación Asignada
              <Badge variant="warning" className="ml-2">{unassigned.length}</Badge>
            </CardTitle>
            <p className="text-sm text-orange-700 mt-1">
              {unassigned.filter(s => s.UBICACION && s.UBICACION.trim() !== '').length > 0 && (
                <span>⚠️ Algunos productos tienen ubicación asignada pero no coincide con ninguna estantería existente. </span>
              )}
              Haz clic en un producto para asignarle una ubicación válida.
            </p>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {unassigned.map((item, index) => (
                  <div 
                    key={`unassigned-${item.REFERENCIA || 'item'}-${index}`} 
                    className="bg-white p-3 rounded-lg border border-orange-200 hover:border-orange-400 transition group cursor-pointer"
                    onClick={() => {
                      setMovingItem(item)
                      setShowMoveModal(true)
                    }}
                  >
                    <div className="font-medium text-sm truncate" title={item.ARTICULO}>
                      {item.ARTICULO || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-gray-600">{item.REFERENCIA || '-'}</div>
                    <div className="text-xs font-bold text-orange-700 mt-1">
                      {item.CANTIDAD} {item.UNIDAD}
                    </div>
                    {item.UBICACION && item.UBICACION.trim() !== '' && (
                      <div className="text-[10px] text-red-500 mt-1">
                        ❌ Ubic. inválida: {item.UBICACION}
                      </div>
                    )}
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition">
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-xs">
                        📍 Asignar Ubicación
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Crear */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>➕ Nueva Estantería</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Código *</label>
                <Input
                  value={newShelf.code}
                  onChange={(e) => setNewShelf({ ...newShelf, code: e.target.value })}
                  placeholder="1, 2, 3, A, B..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <Input
                  value={newShelf.name}
                  onChange={(e) => setNewShelf({ ...newShelf, name: e.target.value })}
                  placeholder="Eléctrico, Fontanería, Herramientas..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Niveles</label>
                  <Input
                    type="number"
                    value={newShelf.niveles}
                    onChange={(e) => setNewShelf({ ...newShelf, niveles: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Huecos/Nivel</label>
                  <Input
                    type="number"
                    value={newShelf.huecos}
                    onChange={(e) => setNewShelf({ ...newShelf, huecos: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={20}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={newShelf.color}
                    onChange={(e) => setNewShelf({ ...newShelf, color: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    value={newShelf.color}
                    onChange={(e) => setNewShelf({ ...newShelf, color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateShelf} className="flex-1 bg-green-600 hover:bg-green-700">
                  💾 Crear
                </Button>
                <Button onClick={() => setShowCreateModal(false)} variant="outline" className="flex-1">
                  ❌ Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Asignar Producto a Ubicación */}
      {showAssignModal && selectedLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
          <Card className="max-w-3xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>
                📦 Asignar Producto a Ubicación: {selectedLocation}
              </CardTitle>
              <p className="text-sm text-gray-600">
                Busca y selecciona el producto a colocar en esta ubicación
              </p>
            </CardHeader>
            <CardContent>
              {/* Buscador */}
              <div className="mb-4 space-y-3">
                <Input
                  placeholder="🔍 Buscar por nombre, referencia, familia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-lg"
                  autoFocus
                />

                {/* Tabs: Sin ubicar / Todos */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowOnlyUnassigned(true)}
                    variant={showOnlyUnassigned ? 'default' : 'outline'}
                    size="sm"
                  >
                    ⚠️ Sin ubicar ({unassigned.length})
                  </Button>
                  <Button
                    onClick={() => setShowOnlyUnassigned(false)}
                    variant={!showOnlyUnassigned ? 'default' : 'outline'}
                    size="sm"
                  >
                    📦 Todos los productos ({stock.length})
                  </Button>
                </div>
              </div>

              {/* Lista de productos filtrados */}
              <div className="overflow-y-auto max-h-[50vh] space-y-2">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron productos
                  </div>
                ) : (
                  filteredProducts.map((item, idx) => {
                    const isUnassigned = !isValidLocation(item.UBICACION)
                    
                    return (
                      <div
                        key={`assign-${item.REFERENCIA || 'item'}-${idx}`}
                        className={`
                          flex items-center justify-between p-3 rounded border-2 cursor-pointer transition
                          ${isUnassigned 
                            ? 'border-orange-300 bg-orange-50 hover:border-orange-500' 
                            : 'border-gray-200 bg-white hover:border-blue-400'
                          }
                        `}
                        onClick={() => confirmAssign(item)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.ARTICULO}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-3 mt-1">
                            <span>Ref: {item.REFERENCIA}</span>
                            <span>•</span>
                            <span>{item.CANTIDAD} {item.UNIDAD}</span>
                            <span>•</span>
                            <span className="text-xs text-gray-500">{item.FAMILIA}</span>
                          </div>
                          {!isUnassigned && item.UBICACION && (
                            <div className="text-xs text-blue-600 mt-1">
                              📍 Actualmente en: {item.UBICACION}
                            </div>
                          )}
                          {isUnassigned && item.UBICACION && item.UBICACION.trim() !== '' && (
                            <div className="text-xs text-red-500 mt-1">
                              ❌ Ubic. inválida: {item.UBICACION}
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          className={isUnassigned ? 'bg-green-600 hover:bg-green-700' : ''}
                          variant={isUnassigned ? 'default' : 'outline'}
                        >
                          {isUnassigned ? '✅ Asignar' : '🔄 Mover'} aquí
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">O escanea código QR</span>
                </div>
              </div>

              {/* Camera scanner */}
              <div
                id={warehouseScannerContainerId}
                className={`rounded-lg overflow-hidden mb-3 ${warehouseCameraActive ? 'border-2 border-emerald-400' : ''}`}
                style={{
                  minHeight: warehouseCameraActive ? 260 : 0,
                  height: warehouseCameraActive ? 'auto' : 0,
                  overflow: 'hidden',
                  opacity: warehouseCameraActive ? 1 : 0,
                }}
              />

              {/* QR Scanner */}
              <div className="flex gap-2">
                {!warehouseCameraActive ? (
                  <Button size="sm" onClick={startWarehouseCamera} className="bg-emerald-600 hover:bg-emerald-700 shrink-0">
                    📸
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={stopWarehouseCamera} className="shrink-0">
                    ✕
                  </Button>
                )}
                <Input
                  placeholder="Pega o escanea código QR..."
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qrCode) {
                      handleQRScan(qrCode)
                    }
                  }}
                />
                <Button onClick={() => handleQRScan(qrCode)} disabled={!qrCode}>
                  🔍
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Mover Producto */}
      {showMoveModal && movingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowMoveModal(false)}>
          <Card className="max-w-2xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>🔄 Mover Producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <div className="font-bold text-lg mb-2">{movingItem.ARTICULO}</div>
                <div className="text-sm text-gray-600">
                  <div>Ref: {movingItem.REFERENCIA}</div>
                  <div>Cantidad: {movingItem.CANTIDAD} {movingItem.UNIDAD}</div>
                  <div className="font-medium text-blue-700 mt-2">
                    Ubicación actual: {movingItem.UBICACION || 'Sin asignar'}
                  </div>
                </div>
              </div>

              {/* Entrada manual de ubicación */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Nueva ubicación:
                </label>
                <Input
                  value={moveToLocation}
                  onChange={(e) => setMoveToLocation(e.target.value.toUpperCase())}
                  placeholder="Ej: 123 (Estantería 1, Nivel 2, Hueco 3)"
                  className="font-mono text-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && moveToLocation) {
                      confirmMove()
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formato: Código de estantería + Nivel + Hueco
                </p>
              </div>

              {/* Selector visual de ubicaciones vacías */}
              <div>
                <label className="block text-sm font-medium mb-3">
                  O selecciona una ubicación vacía:
                </label>
                
                {/* Filtrar por estantería */}
                <div className="mb-3 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={locationFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setLocationFilter('all')}
                  >
                    Todas
                  </Button>
                  {shelves.map(shelf => (
                    <Button
                      key={shelf.id}
                      size="sm"
                      variant={locationFilter === shelf.code ? 'default' : 'outline'}
                      onClick={() => setLocationFilter(shelf.code)}
                      style={{ 
                        borderColor: shelf.color,
                        ...(locationFilter === shelf.code && { backgroundColor: shelf.color })
                      }}
                    >
                      {shelf.name}
                    </Button>
                  ))}
                </div>

                {/* Grid de ubicaciones vacías */}
                <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded border">
                  {getEmptyLocations()
                    .filter(loc => locationFilter === 'all' || loc.startsWith(locationFilter))
                    .map(loc => (
                      <Button
                        key={loc}
                        size="sm"
                        variant={moveToLocation === loc ? 'default' : 'outline'}
                        className={`text-xs font-mono ${moveToLocation === loc ? 'ring-2 ring-blue-500' : ''}`}
                        onClick={() => setMoveToLocation(loc)}
                      >
                        {loc}
                      </Button>
                    ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <p className="text-xs font-bold text-yellow-800">⚠️ IMPORTANTE:</p>
                <p className="text-xs text-yellow-700">
                  Recuerda mover físicamente el producto en el almacén después de confirmar.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={confirmMove}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!moveToLocation}
                >
                  ✅ Confirmar Movimiento
                </Button>
                <Button
                  onClick={() => {
                    setShowMoveModal(false)
                    setMoveToLocation('')
                    setLocationFilter('all')
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  ❌ Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Editar */}
      {showEditModal && editingShelf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>✏️ Editar Estantería</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Código</label>
                <Input value={editingShelf.code} disabled className="bg-gray-100" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre *</label>
                <Input
                  value={editingShelf.name}
                  onChange={(e) => setEditingShelf({ ...editingShelf, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Niveles</label>
                  <Input
                    type="number"
                    value={editingShelf.niveles}
                    onChange={(e) => setEditingShelf({ ...editingShelf, niveles: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Huecos/Nivel</label>
                  <Input
                    type="number"
                    value={editingShelf.huecos}
                    onChange={(e) => setEditingShelf({ ...editingShelf, huecos: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={20}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editingShelf.color}
                    onChange={(e) => setEditingShelf({ ...editingShelf, color: e.target.value })}
                    className="w-20"
                  />
                  <Input
                    value={editingShelf.color}
                    onChange={(e) => setEditingShelf({ ...editingShelf, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleEditShelf} className="flex-1 bg-green-600 hover:bg-green-700">
                  💾 Guardar
                </Button>
                <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">
                  ❌ Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}