import { useState } from 'react'
import { PageLayout } from '@/shared/components/layout/PageLayout'
import { Header } from '@/shared/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { useCatalog } from '../hooks/useCatalog'
import { BusinessLine, QuoteItem, CatalogProduct } from '../types/quote.types'
import { PriceCalculator } from '../utils/priceCalculator'
import toast from 'react-hot-toast'

const BUSINESS_LINES: BusinessLine[] = [
  { id: 'camperizacion_total', name: 'Camperización Total', hourlyRate: 50, profitMargin: 25 },
  { id: 'camperizacion_parcial', name: 'Camperización Parcial', hourlyRate: 50, profitMargin: 25 },
  { id: 'reparacion_normal', name: 'Reparación Normal', hourlyRate: 45, profitMargin: 20 },
  { id: 'reparacion_urgente', name: 'Reparación Urgente', hourlyRate: 65, profitMargin: 15 },
  { id: 'accesorios', name: 'Accesorios', hourlyRate: 50, profitMargin: 30 },
]

export default function QuoteGenerator() {
  const { products, catalogLoaded, importCatalog } = useCatalog()
  const [selectedBusinessLine, setSelectedBusinessLine] = useState<BusinessLine>(BUSINESS_LINES[0])
  const [items, setItems] = useState<QuoteItem[]>([])
  const [clientName, setClientName] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')

    // Catalog is loaded automatically from Supabase via useCatalog

  const addProduct = (product: CatalogProduct, quantity: number = 1) => {
    const item = PriceCalculator.calculateQuoteItem(product, quantity, selectedBusinessLine)
    setItems([...items, item])
    toast.success(`${product.NOMBRE} añadido`)
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId))
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const product = products.find(p => p.SKU === item.catalogSKU)
    if (!product) return

    const updatedItem = PriceCalculator.calculateQuoteItem(product, newQuantity, selectedBusinessLine)
    updatedItem.id = itemId

    setItems(items.map(i => i.id === itemId ? updatedItem : i))
  }

  const totals = PriceCalculator.calculateQuoteTotals(items, selectedBusinessLine)

  return (
    <PageLayout>
      <Header
        title="Generador de Presupuestos"
        description="Crear presupuestos desde el catálogo"
      />

      <div className="p-8 space-y-6">
        {/* Paso 1: Importar Catálogo */}
        {!catalogLoaded && (
          <Card>
            <CardHeader>
              <CardTitle>📦 Paso 1: Importar Catálogo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Primero debes importar el catálogo de productos desde Excel
                </p>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportCatalog}
                  className="max-w-md"
                />
                <p className="text-sm text-gray-500">
                  Archivo: catalogo_productos.xlsx
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {catalogLoaded && products.length > 0 && (
          <>
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle>👤 Información del Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Nombre del Cliente</label>
                    <Input
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Vehículo</label>
                    <Input
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="Mercedes Sprinter L2H2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Línea de Negocio */}
            <Card>
              <CardHeader>
                <CardTitle>💼 Línea de Negocio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {BUSINESS_LINES.map((line) => (
                    <button
                      key={line.id}
                      onClick={() => setSelectedBusinessLine(line)}
                      className={`p-4 border-2 rounded-lg text-left transition ${
                        selectedBusinessLine.id === line.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium">{line.name}</p>
                      <p className="text-sm text-gray-600 mt-1">{line.hourlyRate}€/h</p>
                      <p className="text-xs text-gray-500">Margen: {line.profitMargin}%</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Catálogo de Productos */}
            <Card>
              <CardHeader>
                <CardTitle>🛒 Catálogo de Productos ({products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div
                      key={product.SKU}
                      className="border rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium">{product.NOMBRE}</h3>
                          <p className="text-xs text-gray-500">{product.SKU}</p>
                        </div>
                        <Badge variant="secondary">{product.CATEGORIA}</Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1 mb-3">
                        <p>⏱️ {(product.TIEMPO_TOTAL_MIN / 60).toFixed(1)}h</p>
                        {product.REQUIERE_DISEÑO === 'SÍ' && (
                          <p>📐 Requiere diseño</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => addProduct(product)}
                      >
                        ➕ Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Items del Presupuesto */}
            {items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📋 Items del Presupuesto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <h4 className="font-medium">{item.productName}</h4>
                          <p className="text-sm text-gray-600">
                            {item.laborHours.toFixed(1)}h × {selectedBusinessLine.hourlyRate}€/h
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <span className="text-sm text-gray-500">uds</span>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <p className="font-bold">{item.totalCost.toFixed(2)}€</p>
                          <p className="text-xs text-gray-500">
                            Mat: {item.materialsTotal.toFixed(2)}€
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Resumen del Presupuesto */}
            {items.length > 0 && (
              <Card className="bg-blue-50">
                <CardHeader>
                  <CardTitle>💰 Resumen del Presupuesto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-lg">
                      <span>Materiales:</span>
                      <span className="font-medium">{totals.subtotalMaterials.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>Mano de Obra:</span>
                      <span className="font-medium">{totals.subtotalLabor.toFixed(2)}€</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg">
                      <span>Subtotal:</span>
                      <span className="font-medium">{totals.subtotal.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-lg text-green-600">
                      <span>Margen ({selectedBusinessLine.profitMargin}%):</span>
                      <span className="font-medium">+{totals.profitAmount.toFixed(2)}€</span>
                    </div>
                    <div className="border-t-2 pt-3 flex justify-between text-2xl font-bold text-blue-600">
                      <span>TOTAL:</span>
                      <span>{totals.total.toFixed(2)}€</span>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <Button size="lg" className="flex-1">
                        📄 Generar PDF
                      </Button>
                      <Button size="lg" variant="secondary" className="flex-1">
                        💾 Guardar Borrador
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PageLayout>
  )
}
