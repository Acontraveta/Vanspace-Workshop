import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { useCatalog } from '../hooks/useCatalog'
import { BusinessLine, QuoteItem, CatalogProduct, Quote } from '../types/quote.types'
import { PriceCalculator } from '../utils/priceCalculator'
import { QuoteService } from '../services/quoteService'
import { QuoteAutomation } from '../services/quoteAutomation'
import { CatalogService } from '../services/catalogService'
import ClientDataForm from './ClientDataForm'
import toast from 'react-hot-toast'

const BUSINESS_LINES: BusinessLine[] = [
  { id: 'camperizacion_total', name: 'Camperización Total', hourlyRate: 50, profitMargin: 25 },
  { id: 'camperizacion_parcial', name: 'Camperización Parcial', hourlyRate: 50, profitMargin: 25 },
  { id: 'reparacion_normal', name: 'Reparación Normal', hourlyRate: 45, profitMargin: 20 },
  { id: 'reparacion_urgente', name: 'Reparación Urgente', hourlyRate: 65, profitMargin: 15 },
  { id: 'accesorios', name: 'Venta', hourlyRate: 0, profitMargin: 30 },
]

interface QuoteGeneratorProps {
  quoteId?: string
}

export default function QuoteGenerator({ quoteId }: QuoteGeneratorProps) {
  const { products, catalogLoaded, importCatalog, loading } = useCatalog()
  
  useEffect(() => {
    console.log('🔍 QuoteGenerator - Estado del catálogo:')
    console.log('  products.length:', products.length)
    console.log('  catalogLoaded:', catalogLoaded)
    console.log('  loading:', loading)
  }, [products, catalogLoaded, loading])
  const [selectedBusinessLine, setSelectedBusinessLine] = useState<BusinessLine>(BUSINESS_LINES[0])
  const [items, setItems] = useState<QuoteItem[]>([])
  
  // Estados para datos del cliente
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [billingData, setBillingData] = useState({
    nif: '',
    fiscalName: '',
    address: '',
    postalCode: '',
    city: '',
    province: '',
    country: 'España',
  })
  
  const [currentQuote, setCurrentQuote] = useState<Quote | null>(null)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showBillingForm, setShowBillingForm] = useState(false)
  
  // Estado para acordeones
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const families = catalogLoaded ? CatalogService.getFamilies() : []
  console.log('🏷️ Families encontradas:', families)
  console.log('📦 Products disponibles:', products.length)
  console.log('🔍 catalogLoaded:', catalogLoaded)
  
  // Agrupar productos por familia y categoría
  const productsByFamily = families.reduce((acc, family) => {
    const familyProducts = products.filter(p => p.FAMILIA === family)
    const categories = [...new Set(familyProducts.map(p => p.CATEGORIA))].filter(Boolean)
    
    acc[family] = categories.reduce((catAcc, category) => {
      catAcc[category] = familyProducts.filter(p => p.CATEGORIA === category)
      return catAcc
    }, {} as Record<string, CatalogProduct[]>)
    
    return acc
  }, {} as Record<string, Record<string, CatalogProduct[]>>)

  console.log('📊 productsByFamily:', productsByFamily)

  // Cargar presupuesto si hay quoteId
  useEffect(() => {
    if (quoteId) {
      const quote = QuoteService.getQuoteById(quoteId)
      if (quote) {
        setCurrentQuote(quote)
        setClientName(quote.clientName)
        setClientEmail(quote.clientEmail || '')
        setClientPhone(quote.clientPhone || '')
        setVehicleModel(quote.vehicleModel || '')
        setBillingData(quote.billingData || {
          nif: '',
          fiscalName: '',
          address: '',
          postalCode: '',
          city: '',
          province: '',
          country: 'España',
        })
        setItems(quote.items)
        setSelectedBusinessLine(quote.businessLine)
        
        // Mostrar formulario de facturación si ya tiene datos
        if (quote.billingData?.nif) {
          setShowBillingForm(true)
        }
        
        toast.success(`Editando presupuesto ${quote.quoteNumber}`)
      }
    }
  }, [quoteId])

  // Validaciones
  const isBasicDataComplete = !!(clientName && clientEmail && clientPhone)
  const isBillingDataComplete = !!(
    billingData.nif &&
    billingData.address &&
    billingData.postalCode &&
    billingData.city &&
    billingData.province &&
    billingData.country
  )
  const canSave = isBasicDataComplete && items.length > 0
  const canApprove = canSave && isBillingDataComplete

  const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        console.log('🔄 Importando archivo:', file.name)
        const imported = await importCatalog(file)
        console.log('✅ Importados:', imported.length, 'productos')
        
        // FORZAR RECARGA DE LA PÁGINA
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } catch (error) {
        console.error('❌ Error importando catálogo:', error)
      }
    }
  }

  const addProduct = (product: CatalogProduct, quantity: number = 1) => {
    const item = PriceCalculator.calculateQuoteItem(product, quantity, selectedBusinessLine)

    // CRÍTICO: Asegurar que catalogData se guarda
    if (!item.catalogData) {
      item.catalogData = product // Guardar el producto completo
    }

    setItems([...items, item])
    toast.success(`${product.NOMBRE} añadido`)
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId))
    toast.success('Producto eliminado')
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const product = products.find(p => p.SKU === item.catalogSKU)
    if (!product) return

    const updatedItem = PriceCalculator.calculateQuoteItem(product, newQuantity, selectedBusinessLine)
    updatedItem.id = itemId

    setItems(items.map(i => i.id === itemId ? updatedItem : i))
  }

  const totals = PriceCalculator.calculateQuoteTotals(items, selectedBusinessLine)
  const totalHours = items.reduce((sum, item) => sum + item.laborHours, 0)

  const handleSaveQuote = () => {
    if (!isBasicDataComplete) {
      toast.error('Completa los datos básicos del cliente (nombre, email, teléfono)')
      return
    }

    if (items.length === 0) {
      toast.error('Añade al menos un producto')
      return
    }

    setSaving(true)

    const quote: Quote = {
      id: currentQuote?.id || `quote-${Date.now()}`,
      quoteNumber: currentQuote?.quoteNumber || PriceCalculator.generateQuoteNumber(),
      clientName,
      clientEmail,
      clientPhone,
      vehicleModel,
      billingData: billingData.nif ? billingData : undefined,
      businessLine: selectedBusinessLine,
      items,
      subtotalMaterials: totals.subtotalMaterials,
      subtotalLabor: totals.subtotalLabor,
      subtotal: totals.subtotal,
      profitMargin: selectedBusinessLine.profitMargin,
      profitAmount: totals.profitAmount,
      total: totals.total,
      totalHours,
      createdAt: currentQuote?.createdAt || new Date(),
      validUntil: currentQuote?.validUntil || PriceCalculator.calculateValidUntil(),
      status: currentQuote?.status || 'DRAFT',
    }

    QuoteService.saveQuote(quote)
    setCurrentQuote(quote)
    setSaving(false)
  }

  const handleApproveQuote = async () => {
    if (!currentQuote) {
      toast.error('Primero debes guardar el presupuesto')
      return
    }

    if (!isBillingDataComplete) {
      toast.error('Completa los datos de facturación antes de aprobar')
      setShowBillingForm(true)
      return
    }

    if (currentQuote.status === 'APPROVED') {
      toast.error('Este presupuesto ya está aprobado')
      return
    }

    try {
      setSaving(true)
      
      const approvedQuote = QuoteService.approveQuote(currentQuote.id)
      const result = await QuoteAutomation.executeAutomation(approvedQuote)
      
      toast.success(
        `✅ Automatización completa!\n` +
        `📦 ${result.details.totalPurchaseItems} compras\n` +
        `⚙️ ${result.details.totalTasks} tareas\n` +
        `📐 ${result.details.totalDesignInstructions} diseños`,
        { duration: 6000 }
      )
      
      setCurrentQuote(approvedQuote)
      
    } catch (error: any) {
      toast.error('Error en automatización: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleNewQuote = () => {
    setItems([])
    setClientName('')
    setClientEmail('')
    setClientPhone('')
    setVehicleModel('')
    setBillingData({
      nif: '',
      fiscalName: '',
      address: '',
      postalCode: '',
      city: '',
      province: '',
      country: 'España',
    })
    setCurrentQuote(null)
    setShowBillingForm(false)
    toast.success('Nuevo presupuesto iniciado')
  }

  const toggleFamily = (family: string) => {
    if (expandedFamily === family) {
      setExpandedFamily(null)
      setExpandedCategory(null)
    } else {
      setExpandedFamily(family)
      setExpandedCategory(null)
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category)
  }

  const isEditing = !!quoteId

  return (
    <div className="space-y-6">
      {/* Estado del Catálogo */}
      <Card className={catalogLoaded ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {catalogLoaded ? '✅ Catálogo Cargado' : '⏳ Cargando Catálogo...'}
            </span>
            {catalogLoaded && <Badge variant="success">{products.length} productos</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-gray-600">Cargando desde Supabase Storage...</p>
            </div>
          ) : catalogLoaded ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Catálogo sincronizado desde Supabase Storage
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.reload()}
              >
                🔄 Actualizar
              </Button>
            </div>
          ) : (
            <div className="text-center p-4">
              <p className="text-red-600 mb-3">
                ❌ No se pudo cargar el catálogo desde Supabase
              </p>
              <Button onClick={() => window.location.reload()}>
                Reintentar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {catalogLoaded && products.length > 0 && (
        <>
          {/* Estado del presupuesto */}
          {currentQuote && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {isEditing ? '✏️ Editando' : ''} Presupuesto: {currentQuote.quoteNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      Estado: <Badge variant={currentQuote.status === 'APPROVED' ? 'success' : 'secondary'}>
                        {currentQuote.status === 'DRAFT' && '📝 Borrador'}
                        {currentQuote.status === 'SENT' && '📤 Enviado'}
                        {currentQuote.status === 'APPROVED' && '✅ Aprobado'}
                        {currentQuote.status === 'EXPIRED' && '⏰ Caducado'}
                      </Badge>
                    </p>
                  </div>
                  {currentQuote.status === 'APPROVED' && (
                    <Badge variant="success" className="text-lg px-4 py-2">
                      ✅ APROBADO - Sistema activado
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid: Catálogo (izquierda) + Presupuesto (derecha) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMNA IZQUIERDA: Catálogo con acordeones */}
            <div className="lg:col-span-2 space-y-6">
              {/* Formulario de datos del cliente */}
              <ClientDataForm
                clientName={clientName}
                setClientName={setClientName}
                clientEmail={clientEmail}
                setClientEmail={setClientEmail}
                clientPhone={clientPhone}
                setClientPhone={setClientPhone}
                vehicleModel={vehicleModel}
                setVehicleModel={setVehicleModel}
                billingData={billingData}
                setBillingData={setBillingData}
                disabled={currentQuote?.status === 'APPROVED'}
                showBillingData={showBillingForm}
              />

              {/* Botón para mostrar datos de facturación */}
              {!showBillingForm && (
                <Button
                  variant="outline"
                  onClick={() => setShowBillingForm(true)}
                  className="w-full"
                >
                  📋 Añadir Datos de Facturación (necesarios para aprobar)
                </Button>
              )}

              {/* Línea de Negocio */}
              <Card>
                <CardHeader>
                  <CardTitle>💼 Línea de Negocio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {BUSINESS_LINES.map((line) => (
                      <button
                        key={line.id}
                        onClick={() => {
                          if (currentQuote?.status !== 'APPROVED') {
                            setSelectedBusinessLine(line)
                          }
                        }}
                        disabled={currentQuote?.status === 'APPROVED'}
                        className={`p-3 border-2 rounded-lg text-left transition ${
                          selectedBusinessLine.id === line.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${currentQuote?.status === 'APPROVED' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <p className="font-medium text-xs">{line.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{line.hourlyRate}€/h</p>
                        <p className="text-xs text-gray-500">+{line.profitMargin}%</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Catálogo de Productos - ACORDEONES */}
              <Card>
                <CardHeader>
                  <CardTitle>🛒 Catálogo de Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Búsqueda */}
                  <div className="mb-4">
                    <Input
                      placeholder="🔍 Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Acordeones por Familia */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-4">
                      Debug: {families.length} familias | {products.length} productos | Loaded: {catalogLoaded ? 'Sí' : 'No'}
                    </p>

                    {families.length === 0 && catalogLoaded && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-yellow-800">
                          ⚠️ Catálogo importado ({products.length} productos) pero no hay familias detectadas.
                        </p>
                      </div>
                    )}
                    {families.map((family) => {
                      const familyCount = products.filter(p => p.FAMILIA === family).length
                      const isExpanded = expandedFamily === family

                      return (
                        <div key={family} className="border rounded-lg">
                          {/* Botón Familia */}
                          <button
                            onClick={() => toggleFamily(family)}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition ${
                              isExpanded ? 'bg-gray-50 border-b' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">
                                {family === 'electricidad' && '⚡'}
                                {family === 'fontaneria' && '🚰'}
                                {family === 'muebles' && '🪑'}
                                {family === 'ventanas' && '🪟'}
                                {!['electricidad', 'fontaneria', 'muebles', 'ventanas'].includes(family) && '📦'}
                              </span>
                              <span className="font-medium capitalize">{family}</span>
                              <Badge variant="secondary" className="text-xs">
                                {familyCount}
                              </Badge>
                            </div>
                            <span className="text-gray-400">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </button>

                          {/* Categorías (desplegable) */}
                          {isExpanded && (
                            <div className="p-2 space-y-2">
                              {Object.entries(productsByFamily[family] || {}).map(([category, categoryProducts]) => {
                                const isCategoryExpanded = expandedCategory === category
                                const filteredCategoryProducts = searchTerm
                                  ? categoryProducts.filter(p =>
                                      p.NOMBRE?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      p.SKU?.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                  : categoryProducts

                                if (searchTerm && filteredCategoryProducts.length === 0) return null

                                return (
                                  <div key={category} className="border rounded">
                                    {/* Botón Categoría */}
                                    <button
                                      onClick={() => toggleCategory(category)}
                                      className={`w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition text-left ${
                                        isCategoryExpanded ? 'bg-gray-50 border-b' : ''
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{category}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {filteredCategoryProducts.length}
                                        </Badge>
                                      </div>
                                      <span className="text-gray-400 text-sm">
                                        {isCategoryExpanded ? '▼' : '▶'}
                                      </span>
                                    </button>

                                    {/* Productos (desplegable) */}
                                    {isCategoryExpanded && (
                                      <div className="p-2 space-y-2 bg-gray-50">
                                        {filteredCategoryProducts.map((product) => (
                                          <div
                                            key={product.SKU}
                                            className="bg-white border rounded p-3 hover:shadow-md transition"
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex-1">
                                                <h4 className="font-medium text-sm">{product.NOMBRE}</h4>
                                                <p className="text-xs text-gray-500">{product.SKU}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm space-y-1">
                                                <p className="text-gray-700">
                                                  💰 <strong>{product.PRECIO_COMPRA?.toFixed(2) || '0.00'}€</strong>
                                                </p>
                                                <p className="text-gray-600 text-xs">
                                                  ⏱️ {((product.TIEMPO_TOTAL_MIN || 0) / 60).toFixed(1)}h
                                                </p>
                                              </div>
                                              <Button
                                                size="sm"
                                                onClick={() => addProduct(product)}
                                                disabled={currentQuote?.status === 'APPROVED'}
                                              >
                                                ➕
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* COLUMNA DERECHA: Presupuesto */}
            <div className="space-y-6">
              {/* Items del Presupuesto */}
              {items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>📋 Presupuesto ({items.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="border rounded p-3 bg-white"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.productName}</p>
                              <p className="text-xs text-gray-500">
                                {item.laborHours.toFixed(1)}h
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeItem(item.id)}
                              disabled={currentQuote?.status === 'APPROVED'}
                              className="h-6 w-6 p-0"
                            >
                              ✕
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-16 h-8 text-sm"
                              disabled={currentQuote?.status === 'APPROVED'}
                            />
                            <p className="font-bold text-sm">{item.totalCost.toFixed(2)}€</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Resumen */}
              {items.length > 0 && (
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 sticky top-4">
                  <CardHeader>
                    <CardTitle className="text-blue-900">💰 Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Materiales:</span>
                        <span>{totals.subtotalMaterials.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mano de Obra:</span>
                        <span>{totals.subtotalLabor.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Subtotal:</span>
                        <span>{totals.subtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Margen ({selectedBusinessLine.profitMargin}%):</span>
                        <span>+{totals.profitAmount.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between border-t-2 pt-2 text-xl font-bold text-blue-900">
                        <span>TOTAL:</span>
                        <span>{totals.total.toFixed(2)}€</span>
                      </div>

                      <div className="pt-4 space-y-2">
                        {!currentQuote && (
                          <Button 
                            className="w-full"
                            onClick={handleSaveQuote}
                            disabled={saving || !canSave}
                            title={!canSave ? 'Completa los datos básicos y añade productos' : ''}
                          >
                            💾 Guardar
                          </Button>
                        )}
                        
                        {currentQuote && currentQuote.status !== 'APPROVED' && (
                          <>
                            <Button 
                              variant="secondary"
                              className="w-full"
                              onClick={handleSaveQuote}
                              disabled={saving || !canSave}
                            >
                              💾 {isEditing ? 'Guardar Cambios' : 'Actualizar'}
                            </Button>
                            <Button 
                              variant="default"
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={handleApproveQuote}
                              disabled={saving || !canApprove}
                              title={!isBillingDataComplete ? 'Completa los datos de facturación' : ''}
                            >
                              ✅ Aprobar
                              {!isBillingDataComplete && ' ⚠️'}
                            </Button>
                            {!isBillingDataComplete && (
                              <p className="text-xs text-center text-orange-600">
                                ⚠️ Faltan datos de facturación
                              </p>
                            )}
                          </>
                        )}
                        
                        {currentQuote?.status === 'APPROVED' && (
                          <div className="text-center p-4 bg-green-50 border-2 border-green-500 rounded">
                            <p className="text-lg font-bold text-green-700">
                              ✅ Aprobado
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}