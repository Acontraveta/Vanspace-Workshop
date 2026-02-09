import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { /* Badge */ } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { StockItem } from '../types/purchase.types'
import { parseUbicacion } from '../services/stockService'
import toast from 'react-hot-toast'

interface WarehouseViewProps {
  stock: StockItem[]
  onRefresh: () => void
}

interface HuecoInfo {
  ubicacion: string
  item?: StockItem
  estanteria: number
  nivel: number
  hueco: number
}

export default function WarehouseView({ stock, onRefresh }: WarehouseViewProps) {
  const [selectedEstanteria, setSelectedEstanteria] = useState<number>(1)
  const [movingItem, setMovingItem] = useState<StockItem | null>(null)
  const [newUbicacion, setNewUbicacion] = useState('')
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configEstanteria, setConfigEstanteria] = useState<number | null>(null)
  const [configNiveles, setConfigNiveles] = useState<number>(5)
  const [configHuecos, setConfigHuecos] = useState<number>(10)
  const [configEstanteriaNumber, setConfigEstanteriaNumber] = useState<number | null>(null)

  // Cargar configuración de estanterías desde localStorage
  const [warehouseConfig, setWarehouseConfig] = useState<Record<number, { niveles: number; huecos: number }>>(() => {
    try {
      const raw = localStorage.getItem('warehouse_config')
      if (raw) return JSON.parse(raw)
    } catch (e) {}
    return {}
  })

  // Obtener configuración del almacén por estantería
  const cfgForSelected = warehouseConfig[selectedEstanteria] || { niveles: 5, huecos: 10 }
  const MAX_NIVELES = cfgForSelected.niveles
  const MAX_HUECOS = cfgForSelected.huecos

  // Obtener todas las ubicaciones ocupadas de la estantería seleccionada
  const itemsByUbicacion = stock.reduce((acc, item) => {
    if (item.UBICACION) {
      const ub = parseUbicacion(item.UBICACION)
      if (ub && ub.estanteria === selectedEstanteria) {
        acc[item.UBICACION] = item
      }
    }
    return acc
  }, {} as Record<string, StockItem>)

  // Generar matriz de huecos
  const huecos: HuecoInfo[][] = []
  for (let nivel = MAX_NIVELES; nivel >= 1; nivel--) {
    const nivelHuecos: HuecoInfo[] = []
    for (let hueco = 1; hueco <= MAX_HUECOS; hueco++) {
      const ubicacion = `${selectedEstanteria}${nivel}${hueco}`
      nivelHuecos.push({
        ubicacion,
        item: itemsByUbicacion[ubicacion],
        estanteria: selectedEstanteria,
        nivel,
        hueco,
      })
    }
    huecos.push(nivelHuecos)
  }

  // Obtener estanterías disponibles
  const estanteriasFromStock = [...new Set(
    stock
      .map(s => parseUbicacion(s.UBICACION || ''))
      .filter(Boolean)
      .map(u => u!.estanteria)
  )]

  const estanteriasFromConfig = Object.keys(warehouseConfig).map(k => parseInt(k, 10))

  const estanterias = [...new Set([...estanteriasFromStock, ...estanteriasFromConfig])].sort((a, b) => a - b)

  const handleMoveItem = (item: StockItem) => {
    setMovingItem(item)
    setNewUbicacion('')
  }

  const openConfigFor = (est: number | null) => {
    if (est !== null) {
      const cfg = warehouseConfig[est]
      setConfigEstanteria(est)
      setConfigEstanteriaNumber(est)
      setConfigNiveles(cfg?.niveles || 5)
      setConfigHuecos(cfg?.huecos || 10)
    } else {
      setConfigEstanteria(null)
      setConfigEstanteriaNumber(null)
      setConfigNiveles(5)
      setConfigHuecos(10)
    }
    setConfigModalOpen(true)
  }

  const saveConfig = () => {
    const est = configEstanteria !== null ? configEstanteria : configEstanteriaNumber
    if (est === null || isNaN(est)) {
      toast.error('Introduce un número de estantería válido')
      return
    }
    const newCfg = { ...warehouseConfig, [est]: { niveles: configNiveles, huecos: configHuecos } }
    setWarehouseConfig(newCfg)
    localStorage.setItem('warehouse_config', JSON.stringify(newCfg))
    setConfigModalOpen(false)
    // if configuring currently selected, refresh layout
    setSelectedEstanteria(est)
    onRefresh()
  }

  const deleteConfig = (est: number) => {
    const copy = { ...warehouseConfig }
    delete copy[est]
    setWarehouseConfig(copy)
    localStorage.setItem('warehouse_config', JSON.stringify(copy))
    // if deleted selected, reset to first available
    if (est === selectedEstanteria) {
      setSelectedEstanteria(estanterias[0] || 1)
    }
    setConfigModalOpen(false)
  }

  const confirmMove = () => {
    if (!movingItem || !newUbicacion) return

    // Validar formato
    if (newUbicacion.length !== 3 || !/^\d{3}$/.test(newUbicacion)) {
      toast.error('Formato inválido. Use 3 dígitos (ej: 123)')
      return
    }

    // Verificar si el destino está ocupado
    const destinoOcupado = stock.find(s => s.UBICACION === newUbicacion)
    if (destinoOcupado) {
      toast.error(`El hueco ${newUbicacion} ya está ocupado por: ${destinoOcupado.ARTICULO}`)
      return
    }

    // Actualizar ubicación
    const updatedStock = stock.map(item => {
      if (item.REFERENCIA === movingItem.REFERENCIA) {
        return { ...item, UBICACION: newUbicacion }
      }
      return item
    })

    // Guardar
    localStorage.setItem('stock_items', JSON.stringify(updatedStock))
    
    const ub = parseUbicacion(newUbicacion)
    
    toast.success(
      `⚠️ MOVER EN ALMACÉN FÍSICO:\n` +
      `${movingItem.ARTICULO}\n` +
      `De: ${movingItem.UBICACION || 'Sin ubicación'}\n` +
      `A: ${newUbicacion} (E${ub?.estanteria}-N${ub?.nivel}-H${ub?.hueco})`,
      { duration: 8000 }
    )

    setMovingItem(null)
    setNewUbicacion('')
    onRefresh()
  }

  const cancelMove = () => {
    setMovingItem(null)
    setNewUbicacion('')
  }

  return (
    <div className="space-y-6">
      {/* Modal de movimiento */}
      {movingItem && (
        <Card className="border-2 border-orange-400 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">
              🔄 Moviendo: {movingItem.ARTICULO}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-2">
                  <strong>Ubicación actual:</strong> {movingItem.UBICACION || 'Sin ubicación'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Referencia:</strong> {movingItem.REFERENCIA}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nueva ubicación (formato: 123):
                </label>
                <Input
                  value={newUbicacion}
                  onChange={(e) => setNewUbicacion(e.target.value)}
                  placeholder="Ej: 253 (Estantería 2, Nivel 5, Hueco 3)"
                  maxLength={3}
                  className="font-mono text-lg"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={confirmMove}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  ✅ Confirmar Movimiento
                </Button>
                <Button
                  onClick={cancelMove}
                  variant="outline"
                  className="flex-1"
                >
                  ❌ Cancelar
                </Button>
              </div>

              <div className="bg-yellow-100 border border-yellow-300 rounded p-3 text-sm">
                <p className="font-bold text-yellow-800">⚠️ IMPORTANTE:</p>
                <p className="text-yellow-700">
                  Recuerda mover físicamente el artículo en el almacén después de confirmar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de configuración de estantería */}
      {configModalOpen && (
        <Card className="border-2 border-blue-400 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">
              ⚙️ {configEstanteria !== null ? `Configurar Estantería ${configEstanteria}` : 'Crear nueva Estantería'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Estantería (número)</label>
                <Input
                  type="number"
                  value={configEstanteriaNumber ?? ''}
                  onChange={(e) => setConfigEstanteriaNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
                  disabled={configEstanteria !== null}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Niveles</label>
                  <Input type="number" value={configNiveles} onChange={(e) => setConfigNiveles(parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Huecos por nivel</label>
                  <Input type="number" value={configHuecos} onChange={(e) => setConfigHuecos(parseInt(e.target.value) || 1)} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={saveConfig}>Guardar</Button>
                <Button variant="outline" className="flex-1" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
                {configEstanteria !== null && (
                  <Button variant="destructive" className="flex-1" onClick={() => deleteConfig(configEstanteria)}>Eliminar</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selector de estantería */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="font-medium">Estantería:</span>
            <div className="flex gap-2 items-center">
              {estanterias.map(est => (
                <div key={est} className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEstanteria(est)}
                    className={`px-6 py-2 rounded-lg font-bold transition ${
                      selectedEstanteria === est
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {est}
                  </button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openConfigFor(est)}>
                    ⚙️
                  </Button>
                </div>
              ))}

              <Button size="sm" onClick={() => openConfigFor(null)} className="ml-2">➕ Nueva</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista de estantería */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Estantería {selectedEstanteria}</CardTitle>
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                Ocupado
              </span>
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                Libre
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Indicador de niveles */}
              <div className="flex mb-2">
                <div className="w-16 text-xs font-medium text-gray-600"></div>
                {Array.from({ length: MAX_HUECOS }, (_, i) => (
                  <div key={i} className="w-24 text-center text-xs font-medium text-gray-600">
                    H{i + 1}
                  </div>
                ))}
              </div>

              {/* Filas de niveles (de arriba a abajo) */}
              {huecos.map((nivelHuecos, idx) => {
                const nivel = MAX_NIVELES - idx
                return (
                  <div key={nivel} className="flex mb-2">
                    {/* Indicador de nivel */}
                    <div className="w-16 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-700">N{nivel}</span>
                    </div>

                    {/* Huecos */}
                    {nivelHuecos.map(hueco => (
                      <div
                        key={hueco.ubicacion}
                        className={`w-24 h-20 mx-1 border-2 rounded transition ${
                          hueco.item
                            ? 'bg-green-50 border-green-300 hover:border-green-500'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {hueco.item ? (
                          <div className="p-1 h-full flex flex-col justify-between">
                            <div className="flex-1 overflow-hidden">
                              <p className="text-xs font-semibold truncate" title={hueco.item.ARTICULO}>
                                {hueco.item.ARTICULO}
                              </p>
                              <p className="text-xs text-gray-600 truncate">
                                {hueco.item.REFERENCIA}
                              </p>
                              <p className="text-xs font-bold text-green-700">
                                {hueco.item.CANTIDAD} {hueco.item.UNIDAD}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs"
                              onClick={() => handleMoveItem(hueco.item!)}
                            >
                              Mover
                            </Button>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <span className="text-xs text-gray-400">{hueco.ubicacion}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Huecos ocupados</p>
            <p className="text-2xl font-bold text-green-600">
              {Object.keys(itemsByUbicacion).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Huecos libres</p>
            <p className="text-2xl font-bold text-blue-600">
              {(MAX_NIVELES * MAX_HUECOS) - Object.keys(itemsByUbicacion).length}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 mb-1">Capacidad total</p>
            <p className="text-2xl font-bold text-gray-700">
              {MAX_NIVELES * MAX_HUECOS}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}