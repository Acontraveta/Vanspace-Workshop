import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getPortalRoot } from '@/shared/utils/portalRoot'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { useCatalog } from '../hooks/useCatalog'
import { useTarifas } from '@/features/config/hooks/useTarifas'
import { Tarifa, QuoteItem, CatalogProduct, Quote } from '../types/quote.types'
import { generateUUIDv4 } from '../utils/uuid'
import { PriceCalculator } from '../utils/priceCalculator'
import { QuoteService } from '../services/quoteService'
import { QuoteAutomation } from '../services/quoteAutomation'
import { CatalogService } from '../services/catalogService'
import { QuotePDF, QuoteDocumentData, CustomLine, PaymentInstallment } from './QuotePDF'
import { fmtEur, fmtHours } from '@/shared/utils/formatters'
import { LeadDocumentsService } from '@/features/crm/services/leadDocumentsService'
import { loadCompanyInfo } from '@/shared/utils/companyInfo'
import ClientDataForm from './ClientDataForm'
import toast from 'react-hot-toast'
import ManualProductModal from './ManualProductModal'
import QuotePreview from './QuotePreview'
import QuickDocumentModal, { QuickDocType } from './QuickDocumentModal'
import ConsumableResolverModal, { UnresolvedConsumable } from './ConsumableResolverModal'
import { StockService } from '@/features/purchases/services/stockService'
import { generatePdfBlob } from '../services/pdfGenerator'

const TARIFAS_FALLBACK: Tarifa[] = [
  { id: 'camperizacion_total', name: 'Camperización Total', hourlyRate: 50, profitMargin: 25 },
  { id: 'camperizacion_parcial', name: 'Camperización Parcial', hourlyRate: 50, profitMargin: 25 },
  { id: 'reparacion_normal', name: 'Reparación Normal', hourlyRate: 45, profitMargin: 20 },
  { id: 'reparacion_urgente', name: 'Reparación Urgente', hourlyRate: 65, profitMargin: 15 },
  { id: 'accesorios', name: 'Venta', hourlyRate: 0, profitMargin: 30 },
]

/**
 * Renders QuotePDF off-screen and uploads an HTML snapshot to the lead’s documents.
 */
async function autoAttachQuoteToLead(quote: Quote, leadId: string): Promise<void> {
  const companyData = await loadCompanyInfo()
  const company: QuoteDocumentData['company'] = {
    name: companyData.name,
    nif: companyData.nif,
    address: companyData.address,
    phone: companyData.phone,
    email: companyData.email,
    logoUrl: companyData.logoUrl,
  }

  // Use saved documentData if available (preserves manual edits)
  const docData: QuoteDocumentData = {
    quote,
    customLines: quote.documentData?.customLines,
    company: quote.documentData?.company ?? company,
    type: 'PRESUPUESTO',
    footerNotes: quote.documentData?.footerNotes,
    showBreakdown: quote.documentData?.showBreakdown,
    paymentInstallments: quote.documentData?.paymentInstallments,
  }

  // Render QuotePDF to an off-screen div for PDF generation
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;z-index:-9999;width:210mm'
  document.body.appendChild(container)

  try {
    const root = createRoot(container)
    flushSync(() => { root.render(createElement(QuotePDF, { data: docData })) })

    // Generate real PDF from the rendered HTML
    const pdfEl = container.querySelector('#quote-pdf-content') as HTMLElement
    if (!pdfEl) throw new Error('PDF content element not found')

    const blob = await generatePdfBlob(pdfEl)
    root.unmount()

    const file = new File([blob], `${quote.quoteNumber}.pdf`, { type: 'application/pdf' })
    await LeadDocumentsService.upload(leadId, file, 'presupuesto', 'Generado al guardar presupuesto', '')
  } finally {
    container.remove()
  }
}

interface QuoteGeneratorProps {
  quoteId?: string
  initialLeadData?: {
    lead_id: string
    clientName: string
    clientPhone?: string
    clientEmail?: string
    vehicleModel?: string
  }
  onSaved?: () => void
}

export default function QuoteGenerator({ quoteId, initialLeadData, onSaved }: QuoteGeneratorProps) {
  const { products, catalogLoaded, loading, refreshCatalog } = useCatalog()
  const { tarifas: dbTarifas, loading: tarifasLoading } = useTarifas()

  // Mapear tarifas de config a formato de quote, con fallback si BD vacía
  const TARIFAS: Tarifa[] = dbTarifas.length > 0
    ? dbTarifas.map(t => ({
        id: t.id,
        name: t.nombre_tarifa,
        hourlyRate: t.tarifa_hora_eur,
        profitMargin: t.margen_materiales_pct,
      }))
    : TARIFAS_FALLBACK
  
  
  const [selectedTarifa, setSelectedTarifa] = useState<Tarifa>(TARIFAS_FALLBACK[0])
  const [items, setItems] = useState<QuoteItem[]>([])

  // Actualizar tarifa seleccionada cuando se cargan las tarifas de BD
  useEffect(() => {
    if (TARIFAS.length > 0 && !quoteId) {
      setSelectedTarifa(TARIFAS[0])
    }
  }, [dbTarifas])

  // Recalcular todos los items cuando cambia la tarifa
  useEffect(() => {
    if (items.length === 0) return
    setItems(prev => prev.map(item => {
      const catalogData = item.catalogData
      if (!catalogData) return item
      const recalculated = PriceCalculator.calculateQuoteItem(catalogData, item.quantity, selectedTarifa)
      recalculated.id = item.id
      return recalculated
    }))
  }, [selectedTarifa])
  
  // Estados para datos del cliente
  const [leadId, setLeadId] = useState<string | undefined>(initialLeadData?.lead_id)
  const [clientName, setClientName] = useState(initialLeadData?.clientName ?? '')
  const [clientEmail, setClientEmail] = useState(initialLeadData?.clientEmail ?? '')
  const [clientPhone, setClientPhone] = useState(initialLeadData?.clientPhone ?? '')
  const [vehicleModel, setVehicleModel] = useState(initialLeadData?.vehicleModel ?? '')
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
  const [showManualProductModal, setShowManualProductModal] = useState(false)
  const [showPreview, setShowPreview] = useState<'PRESUPUESTO' | 'FACTURA' | null>(null)
  const [quickDocType, setQuickDocType] = useState<QuickDocType | null>(null)
  const [consumableResolver, setConsumableResolver] = useState<{
    product: CatalogProduct
    unresolved: UnresolvedConsumable[]
  } | null>(null)
  
  // Estado para acordeones
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const families = catalogLoaded ? CatalogService.getFamilies() : []
  
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

  // Cargar presupuesto si hay quoteId
  useEffect(() => {
    if (quoteId) {
      const quote = QuoteService.getQuoteById(quoteId)
      if (quote) {
        setCurrentQuote(quote)
        setLeadId(quote.lead_id)
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
        setSelectedTarifa(quote.tarifa)
        
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

  // Catalog is loaded automatically from Supabase via useCatalog

  const addProduct = (product: CatalogProduct, quantity: number = 1) => {
    // calculateQuoteItem ya incluye catalogData: product para todos los productos
    const item = PriceCalculator.calculateQuoteItem(product, quantity, selectedTarifa)
    setItems([...items, item])
    toast.success(`${product.NOMBRE} añadido`)
  }

  /** Normalize text for matching: lowercase, trim, unify decimal separators */
  const norm = (s: string) => s.toLowerCase().trim().replace(/,/g, '.')

  /** Convert stock items to CatalogProduct shape for unified display in resolver */
  const stockAsCatalog = (): CatalogProduct[] => {
    return StockService.getStock().map(item => ({
      SKU: item.REFERENCIA,
      FAMILIA: item.FAMILIA || '',
      CATEGORIA: item.CATEGORIA || '',
      NOMBRE: item.ARTICULO || '',
      DESCRIPCION: item.DESCRIPCION,
      PRECIO_COMPRA: item.COSTE_IVA_INCLUIDO,
      TIEMPO_TOTAL_MIN: 0,
      REQUIERE_DISEÑO: 'NO' as const,
    }))
  }

  /** Returns consumables AND materials whose name is generic (not in stock) but matches catalog/stock products */
  const findUnresolvedConsumables = (product: CatalogProduct): UnresolvedConsumable[] => {
    const unresolved: UnresolvedConsumable[] = []
    const stockItems = StockService.getStock()
    const stockProducts = stockAsCatalog()

    /** Only consider "resolved" if a stock item name matches EXACTLY (normalized) */
    const hasExactStockMatch = (name: string): boolean => {
      const n = norm(name)
      return stockItems.some(item => norm(item.ARTICULO || '') === n)
    }

    /** Search catalog + stock for matches using normalized text */
    const findAllMatches = (name: string): CatalogProduct[] => {
      const nameLower = norm(name)
      const nameWords = nameLower.split(/\s+/).filter(w => w.length >= 3)
      // "Significant" words (≥4 chars) — brand names, specific terms
      const sigWords = nameWords.filter(w => w.length >= 4)

      const matchFn = (pName: string): boolean => {
        const pNorm = norm(pName)
        // Direct substring match (either direction)
        if (pNorm.includes(nameLower) || nameLower.includes(pNorm)) return true
        // Word-based: ALL short words match (tight match)
        if (nameWords.length > 0 && nameWords.every(w => pNorm.includes(w))) return true
        // Relaxed: at least HALF of significant words match (rounded up)
        if (sigWords.length > 0) {
          const hits = sigWords.filter(w => pNorm.includes(w)).length
          if (hits >= Math.ceil(sigWords.length / 2)) return true
        }
        return false
      }

      // Merge catalog + stock matches, deduplicate by SKU
      const catalogMatches = products.filter(p => matchFn(p.NOMBRE || ''))
      const stockMatches = stockProducts.filter(p => matchFn(p.NOMBRE || ''))
      const seen = new Set<string>()
      const merged: CatalogProduct[] = []
      for (const p of [...catalogMatches, ...stockMatches]) {
        if (!seen.has(p.SKU)) { seen.add(p.SKU); merged.push(p) }
      }
      return merged
    }

    // Check consumables (CONSUMIBLE_1 to CONSUMIBLE_10)
    for (let i = 1; i <= 10; i++) {
      const name = (product as any)[`CONSUMIBLE_${i}`] as string | undefined
      if (!name) continue
      const quantity: number = (product as any)[`CONSUMIBLE_${i}_CANT`] || 1
      const unit: string = (product as any)[`CONSUMIBLE_${i}_UNIDAD`] || 'ud'
      if (hasExactStockMatch(name)) continue
      const matches = findAllMatches(name)
      unresolved.push({ index: i, genericName: name, quantity, unit, matches, selectedSKU: matches[0]?.SKU ?? '', skipped: false })
    }

    // Check materials (MATERIAL_1 to MATERIAL_5) — same logic
    for (let i = 1; i <= 5; i++) {
      const name = (product as any)[`MATERIAL_${i}`] as string | undefined
      if (!name) continue
      const quantity: number = (product as any)[`MATERIAL_${i}_CANT`] || 1
      const unit: string = (product as any)[`MATERIAL_${i}_UNIDAD`] || 'ud'
      if (hasExactStockMatch(name)) continue
      const matches = findAllMatches(name)
      unresolved.push({ index: 100 + i, genericName: name, quantity, unit, matches, selectedSKU: matches[0]?.SKU ?? '', skipped: false })
    }

    return unresolved
  }

  /** Called when user confirms consumable resolution in the modal */
  const handleConsumableResolution = (resolved: UnresolvedConsumable[]) => {
    if (!consumableResolver) return
    const product: CatalogProduct = { ...consumableResolver.product }
    for (const c of resolved) {
      if (!c.skipped) {
        // Search in matches first, then fallback to full catalog
        const selected = c.matches.find(m => m.SKU === c.selectedSKU)
          || products.find(p => p.SKU === c.selectedSKU)
        if (selected) {
          if (c.index >= 100) {
            // Material resolution (index 100+ → MATERIAL_1..5)
            ;(product as any)[`MATERIAL_${c.index - 100}`] = selected.NOMBRE
          } else {
            // Consumable resolution
            ;(product as any)[`CONSUMIBLE_${c.index}`] = selected.NOMBRE
          }
        }
      }
    }
    addProduct(product)
    setConsumableResolver(null)
  }

  /** Tries to add a catalog product; opens resolver modal if generic consumables exist */
  const tryAddProduct = (product: CatalogProduct) => {
    if (currentQuote?.status === 'APPROVED') return
    const unresolved = findUnresolvedConsumables(product)
    if (unresolved.length > 0) {
      setConsumableResolver({ product, unresolved })
    } else {
      addProduct(product)
    }
  }

  const removeItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId))
    toast.success('Producto eliminado')
  }

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return
    
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const product = item.catalogData ?? products.find(p => p.SKU === item.catalogSKU)
    if (!product) return

    const updatedItem = PriceCalculator.calculateQuoteItem(product, newQuantity, selectedTarifa)
    updatedItem.id = itemId
    updatedItem.isManual = item.isManual

    setItems(items.map(i => i.id === itemId ? updatedItem : i))
  }

  /** Update a manual item field inline (name, price, hours) */
  const updateManualField = (itemId: string, field: 'productName' | 'materialsTotal' | 'laborHours', value: string) => {
    setItems(prev => prev.map(item => {
      if (item.id !== itemId || !item.isManual) return item
      const updated = { ...item }
      if (field === 'productName') {
        updated.productName = value
      } else if (field === 'materialsTotal') {
        updated.materialsTotal = parseFloat(value) || 0
      } else if (field === 'laborHours') {
        updated.laborHours = parseFloat(value) || 0
        updated.laborCost = updated.laborHours * selectedTarifa.hourlyRate * updated.quantity
      }
      const sub = updated.materialsTotal + updated.laborCost
      updated.totalCost = sub + sub * (selectedTarifa.profitMargin / 100)
      return updated
    }))
  }

  const totals = PriceCalculator.calculateQuoteTotals(items, selectedTarifa)
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

    // Usar UUID real para el id
    const quote: Quote = {
      id: currentQuote?.id || generateUUIDv4(),
      quoteNumber: currentQuote?.quoteNumber || PriceCalculator.generateQuoteNumber(),
      lead_id: leadId,
      clientName,
      clientEmail,
      clientPhone,
      vehicleModel,
      billingData: billingData.nif ? billingData : undefined,
      tarifa: selectedTarifa,
      items,
      subtotalMaterials: totals.subtotalMaterials,
      subtotalLabor: totals.subtotalLabor,
      subtotal: totals.subtotal,
      profitMargin: selectedTarifa.profitMargin,
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

    // Auto-attach HTML snapshot to lead
    if (leadId) {
      autoAttachQuoteToLead(quote, leadId).catch(err =>
        console.warn('Auto-attach quote to lead failed:', err)
      )
    }
  }

  const handleOpenPreview = (type: 'PRESUPUESTO' | 'FACTURA') => {
    if (!currentQuote) {
      // Guardar primero si no existe
      if (!isBasicDataComplete || items.length === 0) {
        toast.error('Completa los datos básicos y añade productos')
        return
      }
      handleSaveQuote()
    }
    setShowPreview(type)
  }

  /** Persiste las ediciones manuales del documento (líneas, notas, empresa, etc.) */
  const handleSaveDocumentEdits = (data: {
    customLines: CustomLine[]
    footerNotes: string
    showBreakdown: boolean
    paymentInstallments: PaymentInstallment[]
    company: QuoteDocumentData['company']
  }) => {
    if (!currentQuote) return
    const updated: Quote = {
      ...currentQuote,
      documentData: {
        customLines: data.customLines,
        footerNotes: data.footerNotes,
        showBreakdown: data.showBreakdown,
        paymentInstallments: data.paymentInstallments,
        company: data.company,
      },
    }
    QuoteService.saveQuote(updated)
    setCurrentQuote(updated)
  }

  const handleApproveFromPreview = async () => {
    if (!currentQuote) return
    if (!isBillingDataComplete) {
      toast.error('Completa los datos de facturación para aprobar el presupuesto')
      setShowPreview(null)
      setShowBillingForm(true)
      return
    }
    setShowPreview(null)
    try {
      setSaving(true)
      const approvedQuote = await QuoteService.approveQuote(currentQuote.id)
      const result = await QuoteAutomation.executeAutomation(approvedQuote)
      if (!result.success) {
        toast.error('Error en automatización: ' + (result.errors?.[0] ?? 'error desconocido'), { duration: 8000 })
      } else {
        toast.success(
          `✅ Automatización completa!\n` +
          `📦 ${result.details.totalPurchaseItems} compras\n` +
          `⚙️ ${result.details.totalTasks} tareas\n` +
          `📐 ${result.details.totalDesignInstructions} diseños`,
          { duration: 6000 }
        )
        if (result.errors.length > 0) {
          toast.error('⚠️ ' + result.errors.join('\n'), { duration: 8000 })
        }
      }
      setCurrentQuote(approvedQuote)
    } catch (error: any) {
      toast.error('Error en automatización: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Left for compatibility (called from save then approve directly)
  const handleApproveQuote = () => handleOpenPreview('PRESUPUESTO')

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

      {/* Datos del cliente — visible siempre, no espera al catálogo */}
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
        linkedLeadName={leadId ? clientName : undefined}
        onLinkLead={data => {
          setLeadId(data.lead_id)
          setClientName(data.clientName)
          if (data.clientPhone) setClientPhone(data.clientPhone)
          if (data.clientEmail) setClientEmail(data.clientEmail)
          if (data.vehicleModel) setVehicleModel(data.vehicleModel)
        }}
        onUnlinkLead={() => setLeadId(undefined)}
      />

      {/* Botón datos de facturación — visible siempre */}
      {!showBillingForm && (
        <Button
          variant="outline"
          onClick={() => setShowBillingForm(true)}
          className="w-full"
        >
          📋 Añadir Datos de Facturación (necesarios para aprobar)
        </Button>
      )}

      {catalogLoaded && products.length > 0 && (
        <>
          {/* Estado del presupuesto */}
          {currentQuote && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {isEditing ? '✏️ Editando ' : ''}Presupuesto: {currentQuote.quoteNumber}
                    </p>
                    <p className="text-sm text-gray-600">
                      Estado: <Badge variant={currentQuote.status === 'APPROVED' ? 'success' : 'secondary'}>
                        {{ DRAFT: '📝 Borrador', SENT: '📤 Enviado', APPROVED: '✅ Aprobado', EXPIRED: '⏰ Caducado', REJECTED: '❌ Rechazado', CANCELLED: '❌ Cancelado' }[currentQuote.status] ?? currentQuote.status}
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
              {/* Tarifa */}
              <Card>
                <CardHeader>
                  <CardTitle>💲 Tarifa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {TARIFAS.map((line) => (
                      <button
                        key={line.id}
                        onClick={() => {
                          if (currentQuote?.status !== 'APPROVED') {
                            setSelectedTarifa(line)
                          }
                        }}
                        disabled={currentQuote?.status === 'APPROVED'}
                        className={`p-3 border-2 rounded-lg text-left transition ${
                          selectedTarifa.id === line.id
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

              {/* Botón para añadir producto manual */}
              <Button
                onClick={() => {
                  setShowManualProductModal(true)
                }}
                disabled={currentQuote?.status === 'APPROVED'}
                className="w-full bg-purple-600 hover:bg-purple-700 mb-4"
              >
                ✏️ Añadir Producto Manual
              </Button>

              {/* Catálogo de Productos - ACORDEONES */}
              <Card>
                <CardHeader>
                  <CardTitle>🛒 Catálogo de Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Búsqueda */}
                  <div className="mb-4">
                    <Input
                      placeholder="🔍 Buscar producto por nombre o referencia..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* ── Search results (flat list) ── */}
                  {searchTerm.trim() ? (() => {
                    const term = searchTerm.toLowerCase()
                    const filtered = products.filter(p =>
                      p.NOMBRE?.toLowerCase().includes(term) ||
                      p.SKU?.toLowerCase().includes(term) ||
                      p.FAMILIA?.toLowerCase().includes(term) ||
                      p.CATEGORIA?.toLowerCase().includes(term)
                    )
                    return (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500 mb-2">
                          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{searchTerm}"
                        </p>
                        {filtered.length === 0 && (
                          <div className="p-6 text-center text-gray-400">
                            <p className="text-2xl mb-2">🔍</p>
                            <p>No se encontraron productos</p>
                          </div>
                        )}
                        {filtered.map((product) => (
                          <div
                            key={product.SKU}
                            className="bg-white border rounded p-3 hover:shadow-md transition"
                          >
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm">{product.NOMBRE}</h4>
                                <p className="text-xs text-gray-500">{product.SKU}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {product.FAMILIA && <span className="capitalize">{product.FAMILIA}</span>}
                                  {product.CATEGORIA && <span> › {product.CATEGORIA}</span>}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <div className="text-right text-sm">
                                  <p className="text-gray-700 font-semibold">
                                    {fmtEur(product.PRECIO_COMPRA)}€
                                  </p>
                                  <p className="text-gray-500 text-xs">
                                    ⏱️ {fmtHours((product.TIEMPO_TOTAL_MIN || 0) / 60)}h
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => tryAddProduct(product)}
                                  disabled={currentQuote?.status === 'APPROVED'}
                                >
                                  ➕
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })() : (

                  /* ── Accordion view (no search) ── */
                  <div className="space-y-2">
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
                                {{ electricidad: '⚡', fontaneria: '🚰', muebles: '🪑', ventanas: '🪟' }[family] ?? '📦'}
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
                                          {categoryProducts.length}
                                        </Badge>
                                      </div>
                                      <span className="text-gray-400 text-sm">
                                        {isCategoryExpanded ? '▼' : '▶'}
                                      </span>
                                    </button>

                                    {/* Productos (desplegable) */}
                                    {isCategoryExpanded && (
                                      <div className="p-2 space-y-2 bg-gray-50">
                                        {categoryProducts.map((product) => (
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
                                                  💰 <strong>{fmtEur(product.PRECIO_COMPRA)}€</strong>
                                                </p>
                                                <p className="text-gray-600 text-xs">
                                                  ⏱️ {fmtHours((product.TIEMPO_TOTAL_MIN || 0) / 60)}h
                                                </p>
                                              </div>
                                              <Button
                                                size="sm"
                                                onClick={() => tryAddProduct(product)}
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
                  )}
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
                          className={`border rounded p-3 bg-white ${item.isManual ? 'border-amber-200' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              {item.isManual && currentQuote?.status !== 'APPROVED' ? (
                                <>
                                  <input
                                    value={item.productName}
                                    onChange={e => updateManualField(item.id, 'productName', e.target.value)}
                                    className="font-medium text-sm w-full border-b border-amber-200 focus:border-amber-400 outline-none bg-transparent"
                                  />
                                  <div className="flex gap-2 mt-1">
                                    <label className="text-xs text-gray-400">Mat.€</label>
                                    <input
                                      type="number" step="0.01" min="0"
                                      value={item.materialsTotal || ''}
                                      onChange={e => updateManualField(item.id, 'materialsTotal', e.target.value)}
                                      className="w-16 text-xs border-b border-amber-200 outline-none bg-transparent"
                                    />
                                    <label className="text-xs text-gray-400">Horas</label>
                                    <input
                                      type="number" step="0.5" min="0"
                                      value={item.laborHours || ''}
                                      onChange={e => updateManualField(item.id, 'laborHours', e.target.value)}
                                      className="w-14 text-xs border-b border-amber-200 outline-none bg-transparent"
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p className="font-medium text-sm">{item.productName}</p>
                                  <p className="text-xs text-gray-500">
                                    {fmtHours(item.laborHours)}h
                                  </p>
                                </>
                              )}
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
                            <p className="font-bold text-sm">{fmtEur(item.totalCost)}€</p>
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
                        <span>{fmtEur(totals.subtotalMaterials)}€</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Mano de Obra:</span>
                        <span>{fmtEur(totals.subtotalLabor)}€</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Subtotal:</span>
                        <span>{fmtEur(totals.subtotal)}€</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Margen ({selectedTarifa.profitMargin}%):</span>
                        <span>+{fmtEur(totals.profitAmount)}€</span>
                      </div>
                      <div className="flex justify-between border-t-2 pt-2 text-xl font-bold text-blue-900">
                        <span>TOTAL:</span>
                        <span>{fmtEur(totals.total)}€</span>
                      </div>

                      <div className="pt-4 space-y-2">
                        {!currentQuote && (
                          <>
                            <Button 
                              className="w-full"
                              onClick={handleSaveQuote}
                              disabled={saving || !canSave}
                              title={!canSave ? 'Completa los datos básicos y añade productos' : ''}
                            >
                              💾 Guardar
                            </Button>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => setQuickDocType('FACTURA_SIMPLIFICADA')}
                              >
                                🧾 Simplificada
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 text-xs"
                                onClick={() => setQuickDocType('PROFORMA')}
                              >
                                📋 Proforma
                              </Button>
                            </div>
                          </>
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
                              variant="outline"
                              className="w-full"
                              onClick={() => handleOpenPreview('PRESUPUESTO')}
                              disabled={saving || !canSave}
                            >
                              👁️ Vista previa
                            </Button>
                            <Button 
                              variant="default"
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => handleOpenPreview('PRESUPUESTO')}
                              disabled={saving || !canApprove}
                              title={!isBillingDataComplete ? 'Completa los datos de facturación' : ''}
                            >
                              {isBillingDataComplete ? '✅ Aprobar' : '✅ Aprobar ⚠️'}
                            </Button>
                            <p
                              className="text-xs text-center text-orange-600"
                              style={{ display: isBillingDataComplete ? 'none' : undefined }}
                            >
                              ⚠️ Faltan datos de facturación
                            </p>
                          </>
                        )}
                        
                        {currentQuote?.status === 'APPROVED' && (
                          <div className="space-y-2">
                            <div className="text-center p-3 bg-green-50 border-2 border-green-500 rounded">
                              <p className="text-base font-bold text-green-700">✅ Aprobado</p>
                            </div>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => handleOpenPreview('PRESUPUESTO')}
                            >
                              👁️ Ver Presupuesto
                            </Button>
                            <Button
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => handleOpenPreview('FACTURA')}
                            >
                              🧾 Generar Factura
                            </Button>
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
      {/* Preview modal */}
      {showPreview && currentQuote && createPortal(
        <QuotePreview
          quote={currentQuote}
          type={showPreview}
          onApprove={showPreview === 'PRESUPUESTO' && currentQuote.status !== 'APPROVED' ? handleApproveFromPreview : undefined}
          onSaveEdits={handleSaveDocumentEdits}
          onClose={() => setShowPreview(null)}
        />,
        getPortalRoot()
      )}

      {/* Quick document modals */}
      {quickDocType && createPortal(
        <QuickDocumentModal
          type={quickDocType}
          initialData={{
            clientName: clientName || undefined,
            leadId: leadId,
            lines: items.map(item => ({
              id: item.id,
              description: item.productName,
              quantity: item.quantity,
              unitPrice: item.quantity > 0
                ? ((item.materialsTotal ?? 0) + (item.laborCost ?? 0)) / item.quantity
                : 0,
            })),
          }}
          onClose={() => setQuickDocType(null)}
        />,
        getPortalRoot()
      )}

      {/* Consumable resolver modal */}
      {consumableResolver && createPortal(
        <ConsumableResolverModal
          productName={consumableResolver.product.NOMBRE}
          unresolved={consumableResolver.unresolved}
          allProducts={[...products, ...stockAsCatalog()]}
          onConfirm={handleConsumableResolution}
          onSkipAll={() => {
            addProduct(consumableResolver.product)
            setConsumableResolver(null)
          }}
          onCancel={() => setConsumableResolver(null)}
        />,
        getPortalRoot()
      )}

      {/* Modal producto manual */}
      {showManualProductModal && createPortal(
        <ManualProductModal
          onAdd={(product) => {
            const item = PriceCalculator.calculateQuoteItem(product, 1, selectedTarifa)
            item.isManual = true
            setItems([...items, item])
            toast.success(`${product.NOMBRE} añadido (manual)`)
            setShowManualProductModal(false)
          }}
          onCancel={() => setShowManualProductModal(false)}
        />,
        getPortalRoot()
      )}
    </div>
  )
}
