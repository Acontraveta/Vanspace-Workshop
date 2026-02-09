import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { StockItem } from '../types/purchase.types'
import { StockService } from '../services/stockService'
import toast from 'react-hot-toast'

interface QRScannerProps {
  stock: StockItem[]
  onRefresh: () => void
}

export default function QRScanner({ stock, onRefresh }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('')
  const [foundItem, setFoundItem] = useState<StockItem | null>(null)
  const [assigningLocation, setAssigningLocation] = useState(false)
  const [newLocation, setNewLocation] = useState('')

  const handleScan = (code: string) => {
    try {
      const data = JSON.parse(code)
      
      if (data.type === 'warehouse_product' && data.referencia) {
        const item = StockService.getItemByReference(data.referencia)
        if (item) {
          setFoundItem(item)
          toast.success(`Producto encontrado: ${item.ARTICULO}`)
        } else {
          toast.error('Producto no encontrado en stock')
        }
      }
    } catch (error) {
      toast.error('Código QR inválido')
    }
  }

  const assignLocation = () => {
    if (!foundItem || !newLocation) return

    if (newLocation.length !== 3 || !/^\d{3}$/.test(newLocation)) {
      toast.error('Formato inválido. Use 3 dígitos (ej: 123)')
      return
    }

    const stockItems = StockService.getStock()
    const updated = stockItems.map(item => {
      if (item.REFERENCIA === foundItem.REFERENCIA) {
        return { ...item, UBICACION: newLocation }
      }
      return item
    })

    localStorage.setItem('stock_items', JSON.stringify(updated))
    
    toast.success(`✅ ${foundItem.ARTICULO} ubicado en ${newLocation}`)
    
    setFoundItem(null)
    setNewLocation('')
    setAssigningLocation(false)
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>📷 Escanear Código QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">
              Escanea el código QR del material recibido
            </p>
            <p className="text-sm text-gray-500">
              (Funcionalidad de cámara se agregará con librería específica)
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">O introduce manualmente</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Pega el código aquí..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <Button onClick={() => handleScan(manualCode)}>
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {foundItem && (
        <Card className="border-2 border-green-400 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">
              ✅ Producto Encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded p-4 border">
              <h3 className="font-bold text-lg mb-2">{foundItem.ARTICULO}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Referencia:</p>
                  <p className="font-medium">{foundItem.REFERENCIA}</p>
                </div>
                <div>
                  <p className="text-gray-600">Stock actual:</p>
                  <p className="text-bold text-green-600">
                    {foundItem.CANTIDAD} {foundItem.UNIDAD}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Ubicación actual:</p>
                  <p className="font-medium">
                    {foundItem.UBICACION || '❌ Sin ubicar'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Familia:</p>
                  <p className="font-medium">{foundItem.FAMILIA}</p>
                </div>
              </div>
            </div>

            {!assigningLocation ? (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => setAssigningLocation(true)}
              >
                📍 Asignar Ubicación
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Nueva ubicación (formato: 123):
                  </label>
                  <Input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ej: 253 (Estantería 2, Nivel 5, Hueco 3)"
                    maxLength={3}
                    className="font-mono text-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={assignLocation}
                  >
                    ✅ Confirmar
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      setAssigningLocation(false)
                      setNewLocation('')
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}