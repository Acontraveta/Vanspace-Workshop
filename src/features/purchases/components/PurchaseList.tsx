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
import { CatalogProduct } from '@/features/quotes/types/quote.types'
import { CatalogService } from '@/features/quotes/services/catalogService'
import { supabase } from '@/lib/supabase'
import { CONFIG } from '@/shared/utils/constants'
import { useConfirm } from '@/shared/hooks/useConfirm'
import toast from 'react-hot-toast'

export default function PurchaseList() {
  const location = useLocation()
  const navigate = useNavigate()
  const [ConfirmDialog, confirm] = useConfirm()

  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [stockLoaded, setStockLoaded] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'pending' | 'ordered' | 'received' | 'stock' | 'warehouse' | 'scanner'>('pending')
  const [mainTab, setMainTab] = useState<'pedidos' | 'stock' | 'catalogo'>('pedidos')
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [expandedCatalogFamily, setExpandedCatalogFamily] = useState<string | null>(null)
  const [expandedCatalogCategory, setExpandedCatalogCategory] = useState<string | null>(null)
  const [showQR, setShowQR] = useState<string | null>(null)
  const [showQRItem, setShowQRItem] = useState<PurchaseItem | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedEstanteria, setSelectedEstanteria] = useState<string>('all')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [newLocation, setNewLocation] = useState('')
  const [editingQty, setEditingQty] = useState<{ ref: string; value: string } | null>(null)
  const [warehouseShelves, setWarehouseShelves] = useState<{code: string, niveles: number, huecos: number}[]>([])
  const [showNewPurchaseModal, setShowNewPurchaseModal] = useState(false)
  const [newPurchaseForm, setNewPurchaseForm] = useState({
    materialName: '',
    quantity: 1,
    unit: 'ud',
    provider: '',
    priority: 5,
    referencia: '',
    projectNumber: '',
    notes: '',
  })
  const [groupByProvider, setGroupByProvider] = useState(false)
  const [expandedStockFamily, setExpandedStockFamily] = useState<string | null>(null)
  const [expandedStockCategory, setExpandedStockCategory] = useState<string | null>(null)
  const [showNewProductModal, setShowNewProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null)
  const [newProductForm, setNewProductForm] = useState({
    articulo: '',
    referencia: '',
    familia: '',
    categoria: '',
    descripcion: '',
    cantidad: 0,
    stockMinimo: 0,
    unidad: 'ud',
    costeIva: 0,
    precioVenta: 0,
    ubicacion: '',
    proveedor: '',
    diasEntrega: 0,
    tiempoTotalMin: 0,
    requiereDiseno: false,
    tipoDiseno: '',
    instruccionesDiseno: '',

  })
  const [newProductMaterials, setNewProductMaterials] = useState<Array<{ nombre: string; cantidad: number; unidad: string }>>([])
  const [newProductConsumables, setNewProductConsumables] = useState<Array<{ nombre: string; cantidad: number; unidad: string }>>([])
  const [newProductTasks, setNewProductTasks] = useState<Array<{ nombre: string; duracion: number; requiereMaterial: boolean; requiereDiseno: boolean }>>([])

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
    setPurchases(await PurchaseService.getAllPurchases())
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

  const loadCatalog = async () => {
    // Mostrar caché inmediatamente para UX rápida
    const cached = CatalogService.getProducts()
    if (cached.length > 0) setCatalogProducts(cached)
    // Siempre descargar fresco desde Supabase para sincronizar entre dispositivos
    try {
      const fresh = await CatalogService.loadFromSupabase()
      setCatalogProducts(fresh)
    } catch { /* mantener caché */ }
  }

  useEffect(() => {
    refreshData()
    loadCatalog()
    // Cargar estanterías para validar ubicaciones
    supabase.from('warehouse_shelves').select('code, niveles, huecos').eq('activa', true)
      .then(({ data }) => { if (data) setWarehouseShelves(data) })
  }, [])

  // Cambiar tab si viene por navegación
  useEffect(() => {
    if (location.state?.tab) {
      if (['warehouse', 'stock', 'scanner'].includes(location.state.tab)) {
        setMainTab('stock')
        setSelectedTab(location.state.tab)
      } else {
        setMainTab('pedidos')
        setSelectedTab(location.state.tab)
      }
    }
  }, [location])

  // Función para ir a la ubicación en el almacén
  const handleGoToLocation = (ubicacion: string) => {
    const shelfCode = ubicacion.charAt(0)
    setMainTab('stock')
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

  // Función para editar cantidad manualmente
  const handleUpdateQty = async (referencia: string, newQty: number) => {
    if (newQty < 0) return
    try {
      await StockService.updateQuantity(referencia, newQty)
      toast.success('Cantidad actualizada ✅')
      setEditingQty(null)
      refreshData()
    } catch (err: any) {
      toast.error('Error actualizando cantidad: ' + err.message)
    }
  }

  // Note: stock import now handled via /setup page (sync from Supabase)

  const handleMarkAsOrdered = async (itemId: string) => {
    await PurchaseService.markAsOrdered(itemId)
    refreshData()
  }

  const handleCreateManualPurchase = async () => {
    const { materialName, quantity, unit, provider, priority, referencia, projectNumber, notes } = newPurchaseForm
    if (!materialName.trim()) {
      toast.error('El nombre del material es obligatorio')
      return
    }
    const item: PurchaseItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      materialName: materialName.trim(),
      quantity,
      unit: unit || 'ud',
      provider: provider.trim() || undefined,
      priority,
      referencia: referencia.trim() || undefined,
      projectNumber: projectNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      status: 'PENDING',
      createdAt: new Date(),
    }
    await PurchaseService.savePurchase(item)
    toast.success('Pedido creado correctamente')
    setNewPurchaseForm({ materialName: '', quantity: 1, unit: 'ud', provider: '', priority: 5, referencia: '', projectNumber: '', notes: '' })
    setShowNewPurchaseModal(false)
    refreshData()
  }

  // Crear pedido desde item de stock (click en fila)
  const handleOrderFromStock = (item: StockItem) => {
    setNewPurchaseForm({
      materialName: item.ARTICULO,
      quantity: 1,
      unit: item.UNIDAD || 'ud',
      provider: item.PROVEEDOR || '',
      priority: item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO ? 7 : 5,
      referencia: item.REFERENCIA,
      projectNumber: '',
      notes: '',
    })
    setShowNewPurchaseModal(true)
  }

  // Abrir modal para editar un producto existente del catálogo
  const handleEditProduct = (product: CatalogProduct) => {
    setEditingProduct(product)
    // Poblar el formulario con los datos del producto
    setNewProductForm({
      articulo: product.NOMBRE || '',
      referencia: product.SKU || '',
      familia: product.FAMILIA || '',
      categoria: product.CATEGORIA || '',
      descripcion: product.DESCRIPCION || '',
      cantidad: 0,
      stockMinimo: 0,
      unidad: 'ud',
      costeIva: product.PRECIO_COMPRA ? Math.round((product.PRECIO_COMPRA / (1 + CONFIG.IVA / 100)) * 100) / 100 : 0,
      precioVenta: product['PRECIO DE VENTA'] ? Number(product['PRECIO DE VENTA']) : 0,
      ubicacion: '',
      proveedor: product.PROVEEDOR || '',
      diasEntrega: product.DIAS_ENTREGA_PROVEEDOR || 0,
      tiempoTotalMin: product.TIEMPO_TOTAL_MIN || 0,
      requiereDiseno: product.REQUIERE_DISEÑO === 'SÍ',
      tipoDiseno: product.TIPO_DISEÑO || '',
      instruccionesDiseno: product.INSTRUCCIONES_DISEÑO || '',
    })
    // Poblar materiales
    const mats: Array<{ nombre: string; cantidad: number; unidad: string }> = []
    for (let i = 1; i <= 5; i++) {
      const nombre = (product as any)[`MATERIAL_${i}`]
      if (nombre) mats.push({ nombre, cantidad: (product as any)[`MATERIAL_${i}_CANT`] || 0, unidad: (product as any)[`MATERIAL_${i}_UNIDAD`] || 'ud' })
    }
    setNewProductMaterials(mats)
    // Poblar consumibles
    const cons: Array<{ nombre: string; cantidad: number; unidad: string }> = []
    for (let i = 1; i <= 10; i++) {
      const nombre = (product as any)[`CONSUMIBLE_${i}`]
      if (nombre) cons.push({ nombre, cantidad: (product as any)[`CONSUMIBLE_${i}_CANT`] || 0, unidad: (product as any)[`CONSUMIBLE_${i}_UNIDAD`] || 'ud' })
    }
    setNewProductConsumables(cons)
    // Poblar tareas
    const tasks: Array<{ nombre: string; duracion: number; requiereMaterial: boolean; requiereDiseno: boolean }> = []
    for (let i = 1; i <= 12; i++) {
      const nombre = (product as any)[`TAREA_${i}_NOMBRE`]
      if (nombre) tasks.push({
        nombre,
        duracion: (product as any)[`TAREA_${i}_DURACION`] || 0,
        requiereMaterial: (product as any)[`TAREA_${i}_REQUIERE_MATERIAL`] === 'SÍ',
        requiereDiseno: (product as any)[`TAREA_${i}_REQUIERE_DISEÑO`] === 'SÍ',
      })
    }
    setNewProductTasks(tasks)
    // Si existe en stock, cargar cantidad y ubicación
    const stockItem = stock.find(s => s.REFERENCIA?.toUpperCase() === product.SKU?.toUpperCase())
    if (stockItem) {
      setNewProductForm(f => ({
        ...f,
        cantidad: stockItem.CANTIDAD || 0,
        stockMinimo: stockItem.STOCK_MINIMO || 0,
        unidad: stockItem.UNIDAD || 'ud',
        ubicacion: stockItem.UBICACION || '',
      }))
    }
    setShowNewProductModal(true)
  }

  // Crear o actualizar producto en el catálogo (y opcionalmente en stock)
  const handleCreateNewProduct = async () => {
    if (!newProductForm.articulo.trim()) {
      toast.error('El nombre del artículo es obligatorio')
      return
    }
    if (!newProductForm.referencia.trim()) {
      toast.error('La referencia es obligatoria')
      return
    }
    // Comprobar si ya existe en catálogo (solo en modo creación)
    if (!editingProduct) {
      const existingCatalog = CatalogService.getProducts().find(p => p.SKU?.toUpperCase() === newProductForm.referencia.trim().toUpperCase())
      if (existingCatalog) {
        toast.error('Ya existe un producto con esa referencia en el catálogo')
        return
      }
    }

    try {
      // 1. Siempre guardar en catálogo
      const catalogData: any = {}
      // Materiales
      newProductMaterials.forEach((mat, idx) => {
        if (mat.nombre) {
          catalogData[`MATERIAL_${idx + 1}`] = mat.nombre
          catalogData[`MATERIAL_${idx + 1}_CANT`] = mat.cantidad
          catalogData[`MATERIAL_${idx + 1}_UNIDAD`] = mat.unidad
        }
      })
      // Consumibles
      newProductConsumables.forEach((cons, idx) => {
        if (cons.nombre) {
          catalogData[`CONSUMIBLE_${idx + 1}`] = cons.nombre
          catalogData[`CONSUMIBLE_${idx + 1}_CANT`] = cons.cantidad
          catalogData[`CONSUMIBLE_${idx + 1}_UNIDAD`] = cons.unidad
        }
      })
      // Tareas
      newProductTasks.forEach((task, idx) => {
        if (task.nombre) {
          catalogData[`TAREA_${idx + 1}_NOMBRE`] = task.nombre
          catalogData[`TAREA_${idx + 1}_DURACION`] = task.duracion
          catalogData[`TAREA_${idx + 1}_REQUIERE_MATERIAL`] = task.requiereMaterial ? 'SÍ' : 'NO'
          catalogData[`TAREA_${idx + 1}_REQUIERE_DISEÑO`] = task.requiereDiseno ? 'SÍ' : 'NO'
        }
      })

      const product: CatalogProduct = {
        SKU: newProductForm.referencia.trim(),
        NOMBRE: newProductForm.articulo.trim(),
        FAMILIA: newProductForm.familia.trim() || 'GENERAL',
        CATEGORIA: newProductForm.categoria.trim() || 'SIN CATEGORÍA',
        DESCRIPCION: newProductForm.descripcion.trim() || undefined,
        PRECIO_COMPRA: newProductForm.costeIva ? Math.round(newProductForm.costeIva * (1 + CONFIG.IVA / 100) * 100) / 100 : 0,
        'PRECIO DE VENTA': newProductForm.precioVenta || undefined,
        PROVEEDOR: newProductForm.proveedor.trim() || undefined,
        DIAS_ENTREGA_PROVEEDOR: newProductForm.diasEntrega || undefined,
        TIEMPO_TOTAL_MIN: newProductForm.tiempoTotalMin || 0,
        REQUIERE_DISEÑO: newProductForm.requiereDiseno ? 'SÍ' : 'NO',
        TIPO_DISEÑO: newProductForm.requiereDiseno ? newProductForm.tipoDiseno : undefined,
        INSTRUCCIONES_DISEÑO: newProductForm.requiereDiseno ? newProductForm.instruccionesDiseno : undefined,
        ...catalogData,
      }
      await CatalogService.addProduct(product)

      // 2. Gestionar stock_items
      const stockRow = {
        referencia: newProductForm.referencia.trim(),
        familia: newProductForm.familia.trim() || 'GENERAL',
        categoria: newProductForm.categoria.trim() || 'SIN CATEGORÍA',
        articulo: newProductForm.articulo.trim(),
        descripcion: newProductForm.descripcion.trim() || null,
        cantidad: newProductForm.cantidad,
        stock_minimo: newProductForm.stockMinimo || null,
        unidad: newProductForm.unidad || 'ud',
        coste_iva_incluido: newProductForm.costeIva ? Math.round(newProductForm.costeIva * (1 + CONFIG.IVA / 100) * 100) / 100 : null,
        ubicacion: newProductForm.ubicacion.trim() || null,
        proveedor: newProductForm.proveedor.trim() || null,
      }
      const existsInStock = stock.some(s => s.REFERENCIA?.toUpperCase() === newProductForm.referencia.trim().toUpperCase())
      if (existsInStock) {
        // Actualizar stock existente
        const { error } = await supabase.from('stock_items').update(stockRow).eq('referencia', newProductForm.referencia.trim())
        if (error) console.warn('Error actualizando stock:', error.message)
      } else if (newProductForm.cantidad > 0) {
        // Crear nueva entrada de stock solo si hay cantidad
        const { error } = await supabase.from('stock_items').insert(stockRow)
        if (error) {
          toast.error('Error añadiendo al inventario: ' + error.message)
          return
        }
      }
      toast.success(editingProduct ? 'Producto actualizado ✅' : 'Producto creado ✅')

      setEditingProduct(null)
      setNewProductForm({ articulo: '', referencia: '', familia: '', categoria: '', descripcion: '', cantidad: 0, stockMinimo: 0, unidad: 'ud', costeIva: 0, precioVenta: 0, ubicacion: '', proveedor: '', diasEntrega: 0, tiempoTotalMin: 0, requiereDiseno: false, tipoDiseno: '', instruccionesDiseno: '' })
      setNewProductMaterials([])
      setNewProductConsumables([])
      setNewProductTasks([])
      setShowNewProductModal(false)
      refreshData()
      loadCatalog()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    }
  }

  // Desbloquear tareas de producción relacionadas al recibir material
  const unblockRelatedTasks = async (item: PurchaseItem) => {
    try {
      if (!item.projectId) {
        // Sin projectId → buscar tareas bloqueadas que mencionen este material en
        // requires_material, product_name O blocked_reason (que contiene los nombres
        // de los materiales pendientes como texto)
        const needle = (item.productName || item.materialName).toLowerCase()
        const { data: allBlocked } = await supabase
          .from('production_tasks')
          .select('id, requires_material, product_name, blocked_reason')
          .eq('status', 'BLOCKED')

        const matches = (allBlocked || []).filter(t =>
          t.requires_material?.toLowerCase().includes(needle) ||
          t.product_name?.toLowerCase().includes(needle) ||
          t.blocked_reason?.toLowerCase().includes(needle)
        )

        if (matches.length > 0) {
          const ids = matches.map(t => t.id)
          const { data: unblocked } = await supabase
            .from('production_tasks')
            .update({ status: 'PENDING', blocked_reason: null, material_ready: true })
            .in('id', ids)
            .select('id')
          const count = unblocked?.length || 0
          if (count > 0) {
            toast.success(`🔓 ${count} tarea(s) desbloqueadas al recibir material`, { duration: 4000 })
          }
        }
        return
      }

      // ► Verificar pedidos pendientes en este proyecto desde Supabase
      const stillPending = (await PurchaseService.getAllPurchases()).filter(
        p =>
          p.projectId === item.projectId &&
          (p.status === 'PENDING' || p.status === 'ORDERED') &&
          p.id !== item.id
      )

      if (stillPending.length > 0) {
        // Aún faltan materiales → actualizar blocked_reason con los que quedan
        const pendingNames = stillPending.map(p => `• ${p.materialName}`).join('\n')

        await supabase
          .from('production_tasks')
          .update({ blocked_reason: `Esperando materiales:\n${pendingNames}` })
          .eq('project_id', item.projectId)
          .eq('status', 'BLOCKED')

        toast(`📦 Recibido. Faltan ${stillPending.length} material(es):\n${pendingNames}`, {
          duration: 4000,
          icon: '⏳',
        })
      } else {
        // Todos los materiales recibidos → desbloquear tareas + actualizar proyecto
        const { data: unblocked, error: unlockErr } = await supabase
          .from('production_tasks')
          .update({ status: 'PENDING', blocked_reason: null, material_ready: true })
          .eq('project_id', item.projectId)
          .eq('status', 'BLOCKED')
          .select('id')

        if (unlockErr) {
          console.error('Error desbloqueando tareas:', unlockErr)
        }

        // Marcar el proyecto como materiales listos
        await supabase
          .from('production_projects')
          .update({ materials_ready: true })
          .eq('id', item.projectId)

        const count = unblocked?.length || 0
        if (count > 0) {
          toast.success(
            `🔓 ¡${count} tarea(s) desbloqueadas! Todos los materiales del proyecto han llegado.`,
            { duration: 5000 }
          )
        } else {
          // No había tareas BLOCKED pero sí completamos todos los materiales
          toast.success('✅ Todos los materiales recibidos. El proyecto puede continuar.', { duration: 4000 })
        }
      }
    } catch (error) {
      console.error('Error desbloqueando tareas:', error)
    }
  }

  const handleMarkAsReceived = async (itemId: string) => {
    const item = purchases.find(p => p.id === itemId)
    const existedInStock = item?.referencia
      ? !!StockService.getItemByReference(item.referencia)
      : false

    const qrDataURL = await PurchaseService.markAsReceived(itemId)

    if (qrDataURL) {
      setShowQR(qrDataURL)
      setShowQRItem(item || null)

      if (existedInStock) {
        toast.success('✅ Recibido y cantidad actualizada en stock.', { duration: 5000 })
      } else {
        toast.success('✅ Recibido y añadido al inventario.', { duration: 5000 })
      }
    }

    // ← NUEVO: Desbloquear tareas de producción relacionadas
    if (item) {
      await unblockRelatedTasks(item)
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

  // Agrupación por proveedor (automática para pendientes)
  const shouldGroupByProvider = groupByProvider || selectedTab === 'pending'
  const purchaseGroups: [string, PurchaseItem[]][] | null = shouldGroupByProvider
    ? (() => {
        const groups: Record<string, PurchaseItem[]> = {}
        const sinProveedor: PurchaseItem[] = []
        filteredPurchases.forEach(item => {
          if (item.provider) {
            if (!groups[item.provider]) groups[item.provider] = []
            groups[item.provider].push(item)
          } else {
            sinProveedor.push(item)
          }
        })
        return [
          ...Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)),
          ...(sinProveedor.length > 0 ? [['Sin proveedor', sinProveedor] as [string, PurchaseItem[]]] : [])
        ]
      })()
    : null

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

  // Group filtered stock by FAMILIA → CATEGORIA for accordion view
  const stockFamilies = [...new Set(filteredStock.map(s => s.FAMILIA || 'Sin familia'))].sort()
  const stockByFamily: Record<string, Record<string, StockItem[]>> = {}
  for (const family of stockFamilies) {
    const familyItems = filteredStock.filter(s => (s.FAMILIA || 'Sin familia') === family)
    const categories = [...new Set(familyItems.map(s => s.CATEGORIA || 'Sin categoría'))].sort()
    stockByFamily[family] = {}
    for (const cat of categories) {
      stockByFamily[family][cat] = familyItems.filter(s => (s.CATEGORIA || 'Sin categoría') === cat)
    }
  }

  const lowStockItems = StockService.getLowStockItems()

  const pendingCount = purchases.filter(p => p.status === 'PENDING').length
  const orderedCount = purchases.filter(p => p.status === 'ORDERED').length
  const receivedCount = purchases.filter(p => p.status === 'RECEIVED').length

  // Catalog filtering
  const filteredCatalog = catalogProducts.filter(p => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      p.NOMBRE?.toLowerCase().includes(q) ||
      p.SKU?.toLowerCase().includes(q) ||
      p.FAMILIA?.toLowerCase().includes(q) ||
      p.CATEGORIA?.toLowerCase().includes(q) ||
      p.PROVEEDOR?.toLowerCase().includes(q) ||
      p.DESCRIPCION?.toLowerCase().includes(q)
    )
  })
  const catalogFamilies = [...new Set(filteredCatalog.map(p => p.FAMILIA || 'Sin familia'))].sort()
  const catalogByFamily: Record<string, Record<string, CatalogProduct[]>> = {}
  for (const family of catalogFamilies) {
    const familyItems = filteredCatalog.filter(p => (p.FAMILIA || 'Sin familia') === family)
    const categories = [...new Set(familyItems.map(p => p.CATEGORIA || 'Sin categoría'))].sort()
    catalogByFamily[family] = {}
    for (const cat of categories) {
      catalogByFamily[family][cat] = familyItems.filter(p => (p.CATEGORIA || 'Sin categoría') === cat)
    }
  }

  // Provider color helper for visual grouping
  const providerColors = [
    { bg: 'bg-blue-600', bgLight: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
    { bg: 'bg-purple-600', bgLight: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
    { bg: 'bg-teal-600', bgLight: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-300' },
    { bg: 'bg-rose-600', bgLight: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-300' },
    { bg: 'bg-indigo-600', bgLight: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-300' },
    { bg: 'bg-orange-500', bgLight: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
    { bg: 'bg-cyan-600', bgLight: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-300' },
    { bg: 'bg-emerald-600', bgLight: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  ]
  const getProviderColor = (provider: string) => {
    let hash = 0
    for (let i = 0; i < provider.length; i++) hash = provider.charCodeAt(i) + ((hash << 5) - hash)
    return providerColors[Math.abs(hash) % providerColors.length]
  }

  const PurchaseCard = ({ item }: { item: PurchaseItem }) => {
    const borderColor = item.priority >= 8 ? 'border-l-red-500' : item.priority >= 6 ? 'border-l-amber-400' : item.priority >= 4 ? 'border-l-green-400' : 'border-l-gray-300'
    const priorityLabel = item.priority >= 8 ? '🔴 Urgente' : item.priority >= 6 ? '🟡 Alta' : item.priority >= 4 ? '🟢 Media' : '⚪ Baja'
    const priorityBadge = item.priority >= 8 ? 'bg-red-100 text-red-700' : item.priority >= 6 ? 'bg-amber-100 text-amber-700' : item.priority >= 4 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    const isLowStockReplenishment = item.id.startsWith('lowstock-')
    const daysSinceOrdered = item.orderedAt
      ? Math.floor((Date.now() - new Date(item.orderedAt).getTime()) / 86400000)
      : null

    // Delivery calculations
    const deliveryDays = item.deliveryDays || 0
    const daysRemaining = daysSinceOrdered !== null && deliveryDays > 0 ? deliveryDays - daysSinceOrdered : null
    const progress = daysSinceOrdered !== null && deliveryDays > 0 ? (daysSinceOrdered / deliveryDays) * 100 : 0
    const expectedArrival = item.orderedAt && deliveryDays > 0
      ? new Date(new Date(item.orderedAt).getTime() + deliveryDays * 86400000)
      : null
    const orderedDate = item.orderedAt ? new Date(item.orderedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null
    const arrivalDate = expectedArrival ? expectedArrival.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : null
    const providerColor = item.provider ? getProviderColor(item.provider) : null

    // ── PENDING: prominent supplier banner ──
    if (item.status === 'PENDING') {
      return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
          {/* Supplier banner */}
          {item.provider ? (
            <div className={`px-4 py-2.5 ${providerColor!.bg} flex items-center gap-2`}>
              <span className="text-white/80">🏭</span>
              <span className="text-white font-semibold text-sm truncate">{item.provider}</span>
              {item.deliveryDays ? (
                <span className="ml-auto text-white/70 text-xs whitespace-nowrap">~{item.deliveryDays}d entrega</span>
              ) : null}
            </div>
          ) : (
            <div className="px-4 py-2.5 bg-gray-300 flex items-center gap-2">
              <span className="text-gray-600">⚠️</span>
              <span className="text-gray-700 font-medium text-sm">Sin proveedor asignado</span>
            </div>
          )}
          <div className={`p-4 flex flex-col flex-1 border-l-4 ${borderColor}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 leading-tight truncate" title={item.materialName}>
                  {item.materialName}
                </h3>
                {item.productName && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">Para: {item.productName}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge}`}>
                {priorityLabel}
              </span>
            </div>

            {/* Tags (no provider - it's in the banner) */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {item.projectNumber ? (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  📋 {item.projectNumber}
                </span>
              ) : isLowStockReplenishment ? (
                <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                  ⚠️ Reposición stock
                </span>
              ) : null}
            </div>

            {/* Info */}
            <div className="flex items-center gap-3 text-sm mb-3">
              <span className="font-semibold text-gray-900">{item.quantity} {item.unit}</span>
            </div>

            {item.notes && (
              <p className="text-xs bg-amber-50 text-amber-800 border border-amber-100 rounded px-2 py-1.5 mb-3 line-clamp-2">
                {item.notes}
              </p>
            )}

            {/* Action */}
            <div className="mt-auto">
              <button
                onClick={() => handleMarkAsOrdered(item.id)}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
              >
                📦 Marcar como pedido
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── ORDERED: delivery timeline ──
    if (item.status === 'ORDERED') {
      return (
        <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
          <div className="p-4 flex flex-col flex-1">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-gray-900 leading-tight truncate" title={item.materialName}>
                  {item.materialName}
                </h3>
                {item.productName && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">Para: {item.productName}</p>
                )}
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge}`}>
                {priorityLabel}
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {item.projectNumber && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  📋 {item.projectNumber}
                </span>
              )}
              {item.provider && (
                <span className={`inline-flex items-center gap-1 text-xs ${providerColor!.bgLight} ${providerColor!.text} px-2 py-0.5 rounded-full border ${providerColor!.border}`}>
                  🏭 {item.provider}
                </span>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3 text-sm mb-3">
              <span className="font-semibold text-gray-900">{item.quantity} {item.unit}</span>
            </div>

            {/* Delivery timeline */}
            {orderedDate && (
              <div className={`rounded-lg p-3 mb-3 space-y-2 border ${
                daysRemaining !== null && daysRemaining < 0 ? 'bg-red-50 border-red-200' :
                daysRemaining !== null && daysRemaining <= 2 ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                {/* Dates row */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">📅 {orderedDate}</span>
                  <span className="text-gray-400">→</span>
                  {arrivalDate ? (
                    <span className={`font-medium ${
                      daysRemaining !== null && daysRemaining < 0 ? 'text-red-700' :
                      daysRemaining !== null && daysRemaining <= 2 ? 'text-amber-700' :
                      'text-blue-700'
                    }`}>
                      📦 {arrivalDate}
                    </span>
                  ) : (
                    <span className="text-gray-400">Sin fecha estimada</span>
                  )}
                </div>

                {/* Progress bar */}
                {deliveryDays > 0 && (
                  <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all ${
                        progress > 100 ? 'bg-red-500' : progress > 75 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                )}

                {/* Status text */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">{daysSinceOrdered}d transcurridos</span>
                  {daysRemaining !== null ? (
                    <span className={`font-bold ${
                      daysRemaining < 0 ? 'text-red-600' :
                      daysRemaining <= 2 ? 'text-amber-600' :
                      'text-blue-600'
                    }`}>
                      {daysRemaining > 0 ? `⏳ ${daysRemaining}d restantes` :
                       daysRemaining === 0 ? '📦 Llega hoy' :
                       `⚠️ ${Math.abs(daysRemaining)}d de retraso`}
                    </span>
                  ) : (
                    <span className="text-gray-400">Plazo no definido</span>
                  )}
                </div>
              </div>
            )}

            {!orderedDate && (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-center text-xs text-gray-500 border border-gray-200">
                Sin información de fecha de pedido
              </div>
            )}

            {item.notes && (
              <p className="text-xs bg-amber-50 text-amber-800 border border-amber-100 rounded px-2 py-1.5 mb-3 line-clamp-2">
                {item.notes}
              </p>
            )}

            {/* Action */}
            <div className="mt-auto">
              <button
                onClick={() => handleMarkAsReceived(item.id)}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
              >
                ✅ Marcar como recibido
              </button>
            </div>
          </div>
        </div>
      )
    }

    // ── RECEIVED — rendered as list row, not card ──
    return null // Received items use ReceivedRow instead
  }

  // Row component for received items (list view grouped by date)
  const ReceivedRow = ({ item }: { item: PurchaseItem }) => {
    const fileInputId = `attach-${item.id}`
    const hasAttachments = item.attachments && item.attachments.length > 0

    const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        toast.loading('Subiendo documento...', { id: 'upload' })
        await PurchaseService.uploadAttachment(item.id, file)
        toast.success('📎 Documento adjuntado', { id: 'upload' })
        refreshData()
      } catch (err) {
        console.error(err)
        toast.error('Error al subir documento', { id: 'upload' })
      }
      e.target.value = ''
    }

    const handleRemoveAttach = async (url: string) => {
      confirm('¿Eliminar este documento?', async () => {
        try {
          await PurchaseService.removeAttachment(item.id, url)
          toast.success('Documento eliminado')
          refreshData()
        } catch { toast.error('Error eliminando') }
      })
    }

    return (
      <div className="bg-white border border-gray-100 rounded-lg px-4 py-3 hover:bg-gray-50 transition">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Material name */}
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-900 truncate block" title={item.materialName}>
              {item.materialName}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
              {item.productName && <span>Para: {item.productName}</span>}
              {item.provider && <span className="bg-gray-100 px-1.5 py-0.5 rounded">🏭 {item.provider}</span>}
              {item.projectNumber && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">📋 {item.projectNumber}</span>}
            </div>
          </div>

          {/* Quantity */}
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{item.quantity} {item.unit}</span>

          {/* Attachments indicator */}
          {hasAttachments && (
            <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
              📎 {item.attachments!.length}
            </span>
          )}

          {/* Attach button */}
          <label htmlFor={fileInputId} className="cursor-pointer px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm text-gray-600 hover:text-blue-600 transition flex items-center gap-1" title="Adjuntar albarán o documento">
            📷 Adjuntar
          </label>
          <input id={fileInputId} type="file" accept="image/*,application/pdf,.jpg,.jpeg,.png,.heic" capture="environment" className="hidden" onChange={handleAttach} />
        </div>

        {/* Attached documents */}
        {hasAttachments && (
          <div className="mt-2 flex flex-wrap gap-2">
            {item.attachments!.map((url, i) => {
              const isImage = /\.(jpg|jpeg|png|gif|webp|heic)/i.test(url)
              const fileName = url.split('/').pop()?.split('?')[0] || `doc_${i + 1}`
              return (
                <div key={i} className="group relative">
                  {isImage ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition">
                      <img src={url} alt={fileName} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-400 text-xs text-gray-700 hover:text-blue-600 transition">
                      📄 {fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName}
                    </a>
                  )}
                  <button
                    onClick={() => handleRemoveAttach(url)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
      {ConfirmDialog}
      <Header
        title="Pedidos y Stock"
        description="Gestión de compras, inventario y catálogo de productos"
        action={mainTab === 'pedidos' ? { label: '➕ Nuevo pedido', onClick: () => setShowNewPurchaseModal(true) } : undefined}
      >
        {mainTab === 'catalogo' && (
          <Button variant="outline" size="sm" onClick={() => setShowNewProductModal(true)}>
            � Nuevo producto
          </Button>
        )}
      </Header>

      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {showQR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowQR(null); setShowQRItem(null) }}>
            <Card className="max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">✅ Material Recibido — Etiqueta QR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Label preview */}
                <div className="bg-white p-3 rounded-lg border-2 border-gray-200 flex items-center gap-3">
                  <img src={showQR} alt="QR Code" className="w-28 h-28 shrink-0" />
                  {showQRItem && (
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{showQRItem.referencia || showQRItem.materialName}</div>
                      <div className="text-xs text-gray-600 line-clamp-2">{showQRItem.materialName}</div>
                      <div className="text-xs text-gray-500 mt-1">{showQRItem.quantity} {showQRItem.unit}</div>
                      {showQRItem.provider && <div className="text-xs text-gray-400">{showQRItem.provider}</div>}
                    </div>
                  )}
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <p className="font-bold text-blue-800 mb-1">📋 Instrucciones:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                    <li>Imprime la etiqueta y pégala en el material</li>
                    <li>Escanea el QR desde la pestaña "Escanear QR" para ubicarlo</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const printWindow = window.open('', '', 'width=400,height=500')
                      if (!printWindow) return
                      const ref = showQRItem?.referencia || showQRItem?.materialName || ''
                      const name = showQRItem?.materialName || ''
                      const qty = showQRItem ? `${showQRItem.quantity} ${showQRItem.unit}` : ''
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Etiqueta QR</title>
                            <style>
                              @page { size: 62mm 40mm; margin: 0; }
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              body { font-family: Arial, sans-serif; width: 62mm; height: 40mm; display: flex; align-items: center; padding: 2mm; }
                              .label { display: flex; gap: 2mm; width: 100%; align-items: center; }
                              .qr { width: 30mm; height: 30mm; flex-shrink: 0; }
                              .qr img { width: 100%; height: 100%; }
                              .info { flex: 1; overflow: hidden; }
                              .ref { font-size: 9pt; font-weight: bold; margin-bottom: 1mm; }
                              .name { font-size: 7pt; line-height: 1.2; margin-bottom: 1mm; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
                              .qty { font-size: 8pt; color: #555; }
                            </style>
                          </head>
                          <body>
                            <div class="label">
                              <div class="qr"><img src="${showQR}" /></div>
                              <div class="info">
                                <div class="ref">${ref}</div>
                                <div class="name">${name}</div>
                                <div class="qty">${qty}</div>
                              </div>
                            </div>
                          </body>
                        </html>
                      `)
                      printWindow.document.close()
                      setTimeout(() => printWindow.print(), 300)
                    }}
                  >
                    🖨️ Imprimir etiqueta
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.download = `qr-${showQRItem?.referencia || Date.now()}.png`
                      link.href = showQR
                      link.click()
                      toast.success('QR descargado')
                    }}
                  >
                    💾
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowQR(null); setShowQRItem(null) }}
                  >
                    ✕
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

        {/* Alertas de stock bajo — banner compacto */}
        {lowStockItems.length > 0 && (
          <button
            onClick={() => { setMainTab('stock'); setSelectedTab('stock') }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition text-left"
          >
            <span className="text-xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-orange-800">
                {lowStockItems.length} artículo{lowStockItems.length > 1 ? 's' : ''} con stock bajo
              </span>
              <span className="text-xs text-orange-600 ml-2 hidden sm:inline">
                {lowStockItems.slice(0, 3).map(i => i.ARTICULO).join(' · ')}{lowStockItems.length > 3 ? ` · +${lowStockItems.length - 3} más` : ''}
              </span>
            </div>
            <span className="text-orange-400 text-xs">Ver inventario →</span>
          </button>
        )}

        {/* ═══ TABS PRINCIPALES (3 secciones) ═══ */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {([
            { id: 'pedidos' as const, icon: '📋', label: 'Pedidos', count: pendingCount + orderedCount },
            { id: 'stock' as const, icon: '📦', label: 'Stock', count: stock.length },
            { id: 'catalogo' as const, icon: '🛒', label: 'Catálogo', count: catalogProducts.length },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setMainTab(tab.id)
                setSearchTerm('')
                if (tab.id === 'pedidos') setSelectedTab('pending')
                if (tab.id === 'stock') setSelectedTab('stock')
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                mainTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`min-w-[1.5rem] text-center text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                mainTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ═══ SECCIÓN PEDIDOS ═══ */}
        {mainTab === 'pedidos' && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Pendientes', value: pendingCount, icon: '⏳', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', tab: 'pending' as const },
                { label: 'En camino', value: orderedCount, icon: '🚚', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', tab: 'ordered' as const },
                { label: 'Recibidos', value: receivedCount, icon: '✅', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', tab: 'received' as const },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => setSelectedTab(s.tab)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:opacity-80 transition ${s.bg} ${selectedTab === s.tab ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                >
                  <span className="text-2xl">{s.icon}</span>
                  <div className="text-left">
                    <div className={`text-2xl font-bold leading-none ${s.text}`}>{s.value}</div>
                    <div className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Filtros pedidos */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="🔍 Buscar material, proyecto, proveedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              {providers.length > 0 && (
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="all">Todos los proveedores</option>
                  {providers.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setGroupByProvider(g => !g)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  groupByProvider || selectedTab === 'pending'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                title={selectedTab === 'pending' ? 'Agrupación automática en pendientes' : 'Agrupar por proveedor'}
              >
                🏭 Por proveedor
              </button>
            </div>
          </>
        )}

        {/* ═══ SECCIÓN STOCK ═══ */}
        {mainTab === 'stock' && (
          <>
            {/* Sub-tabs stock */}
            <div className="flex gap-1 p-1 bg-gray-50 rounded-lg overflow-x-auto">
              {([
                { id: 'stock' as const, icon: '📦', label: 'Inventario', count: stock.length },
                { id: 'warehouse' as const, icon: '🏭', label: 'Almacén', count: stockLoaded ? stock.filter(s => isValidLocation(s.UBICACION)).length : undefined },
                { id: 'scanner' as const, icon: '📷', label: 'Escanear QR', count: undefined },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    selectedTab === tab.id
                      ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`min-w-[1.25rem] text-center text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      selectedTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filtros stock */}
            {selectedTab === 'stock' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="🔍 Buscar por artículo, referencia, familia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                {estanterias.length > 0 && (
                  <select
                    value={selectedEstanteria}
                    onChange={(e) => setSelectedEstanteria(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="all">Todas las estanterías</option>
                    {estanterias.map(est => (
                      <option key={est} value={est}>Estantería {est}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══ SECCIÓN CATÁLOGO ═══ */}
        {mainTab === 'catalogo' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="🔍 Buscar producto por nombre, SKU, familia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        )}

        {/* Contenido según tab */}
        {mainTab === 'stock' && selectedTab === 'warehouse' ? (
          <WarehouseView
            stock={stock}
            onRefresh={refreshData}
            initialSelectedShelf={location.state?.selectedShelf}
            highlightLocation={location.state?.highlightLocation}
          />
        ) : mainTab === 'stock' && selectedTab === 'scanner' ? (
          <QRScanner stock={stock} onRefresh={refreshData} />
        ) : mainTab === 'stock' && selectedTab === 'stock' ? (
          // Vista de inventario agrupada por familias
          <div>
            {stockLoaded ? (
              filteredStock.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500">No se encontraron items</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {stockFamilies.map(family => {
                    const familyCategories = stockByFamily[family] || {}
                    const familyItemCount = Object.values(familyCategories).reduce((s, arr) => s + arr.length, 0)
                    const familyExpanded = expandedStockFamily === family
                    const familyIcon =
                      family.toLowerCase().includes('electric') ? '⚡' :
                      family.toLowerCase().includes('fontan') ? '🚰' :
                      family.toLowerCase().includes('mueble') ? '🪑' :
                      family.toLowerCase().includes('ventana') ? '🪟' :
                      family.toLowerCase().includes('tornill') || family.toLowerCase().includes('ferret') ? '🔩' :
                      family.toLowerCase().includes('pintu') ? '🎨' :
                      family.toLowerCase().includes('aisla') ? '🧊' : '📦'

                    return (
                      <Card key={family}>
                        <button
                          onClick={() => {
                            setExpandedStockFamily(familyExpanded ? null : family)
                            setExpandedStockCategory(null)
                          }}
                          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition rounded-t-lg ${
                            familyExpanded ? 'bg-gray-50 border-b' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{familyIcon}</span>
                            <span className="font-medium capitalize text-gray-800">{family}</span>
                            <Badge variant="secondary" className="text-xs">{familyItemCount}</Badge>
                          </div>
                          <span className="text-gray-400">{familyExpanded ? '▼' : '▶'}</span>
                        </button>

                        {familyExpanded && (
                          <CardContent className="p-2 space-y-2">
                            {Object.entries(familyCategories).map(([categoryName, categoryItems]) => {
                              const catExpanded = expandedStockCategory === `${family}::${categoryName}`
                              return (
                                <div key={categoryName} className="border rounded">
                                  <button
                                    onClick={() => setExpandedStockCategory(catExpanded ? null : `${family}::${categoryName}`)}
                                    className={`w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition text-left ${
                                      catExpanded ? 'bg-gray-50 border-b' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-700">{categoryName}</span>
                                      <Badge variant="outline" className="text-xs">{categoryItems.length}</Badge>
                                    </div>
                                    <span className="text-gray-400 text-sm">{catExpanded ? '▼' : '▶'}</span>
                                  </button>

                                  {catExpanded && (
                                    <div className="overflow-x-auto">
                                      <table className="w-full divide-y divide-gray-200 table-fixed">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th className="w-[35%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Artículo</th>
                                            <th className="w-[15%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                                            <th className="w-[15%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cantidad ✏️</th>
                                            <th className="w-[17%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">📍 Ubicación</th>
                                            <th className="w-[18%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coste</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {categoryItems.map((item, index) => {
                                            const isLowStock = item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
                                            return (
                                              <tr key={`${item.REFERENCIA}-${index}`} 
                                                className={`hover:bg-blue-50 cursor-pointer transition ${isLowStock ? 'bg-orange-50' : ''}`}
                                                onClick={() => handleOrderFromStock(item)}
                                                title="Clic para crear pedido de este producto"
                                              >
                                                <td className="px-4 py-3 max-w-0 overflow-hidden">
                                                  <div className="text-sm font-medium text-gray-900 truncate" title={item.ARTICULO}>{item.ARTICULO}</div>
                                                </td>
                                                <td className="px-4 py-3 max-w-0 overflow-hidden text-sm text-gray-500">
                                                  <span className="truncate block" title={item.REFERENCIA}>{item.REFERENCIA}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                  {editingQty?.ref === item.REFERENCIA ? (
                                                    <div className="flex items-center gap-1">
                                                      <input
                                                        type="number" min="0" step="0.01" autoFocus
                                                        className="w-20 border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        value={editingQty.value}
                                                        onChange={e => setEditingQty({ ref: item.REFERENCIA, value: e.target.value })}
                                                        onKeyDown={e => {
                                                          if (e.key === 'Enter') handleUpdateQty(item.REFERENCIA, parseFloat(editingQty.value) || 0)
                                                          if (e.key === 'Escape') setEditingQty(null)
                                                        }}
                                                      />
                                                      <span className="text-xs text-gray-500">{item.UNIDAD}</span>
                                                      <button onClick={() => handleUpdateQty(item.REFERENCIA, parseFloat(editingQty.value) || 0)}
                                                        className="text-green-600 hover:text-green-800 text-base leading-none" title="Guardar">✓</button>
                                                      <button onClick={() => setEditingQty(null)}
                                                        className="text-gray-400 hover:text-gray-600 text-base leading-none" title="Cancelar">✕</button>
                                                    </div>
                                                  ) : (
                                                    <button
                                                      onClick={() => setEditingQty({ ref: item.REFERENCIA, value: String(item.CANTIDAD) })}
                                                      className={`group flex items-center gap-1 text-sm font-bold hover:underline ${isLowStock ? 'text-orange-600' : 'text-gray-900'}`}
                                                      title="Clic para editar cantidad"
                                                    >
                                                      {item.CANTIDAD} {item.UNIDAD}
                                                      <span className="opacity-0 group-hover:opacity-60 text-xs">✏️</span>
                                                    </button>
                                                  )}
                                                  {item.STOCK_MINIMO && <div className="text-xs text-gray-500">Min: {item.STOCK_MINIMO}</div>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                  <div className="flex items-center gap-1">
                                                    {isValidLocation(item.UBICACION) ? (
                                                      <button onClick={() => handleGoToLocation(item.UBICACION!)}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition text-sm font-medium"
                                                        title="Ir a esta ubicación en el almacén">
                                                        📍 {item.UBICACION}
                                                      </button>
                                                    ) : (
                                                      <button onClick={() => handleAssignLocation(item)}
                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full hover:bg-orange-200 transition text-sm font-medium"
                                                        title="Asignar ubicación">
                                                        ⚠️ Sin ubicar
                                                      </button>
                                                    )}
                                                    <button
                                                      onClick={async () => {
                                                        const QR = (await import('qrcode')).default
                                                        const dataUrl = await QR.toDataURL(
                                                          JSON.stringify({ type: 'warehouse_product', referencia: item.REFERENCIA, nombre: item.ARTICULO }),
                                                          { width: 400, margin: 2 }
                                                        )
                                                        setShowQR(dataUrl)
                                                        setShowQRItem({ materialName: item.ARTICULO, referencia: item.REFERENCIA, quantity: item.CANTIDAD, unit: item.UNIDAD, provider: item.PROVEEDOR } as any)
                                                      }}
                                                      className="p-1 text-gray-400 hover:text-gray-700 transition"
                                                      title="Generar etiqueta QR"
                                                    >
                                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17 14h3v3h-3zM14 17h3v3h-3zM17 20h3v0h-3z" />
                                                      </svg>
                                                    </button>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                  {item.COSTE_IVA_INCLUIDO && item.COSTE_IVA_INCLUIDO > 0 ? (
                                                    <div>
                                                      <div className="font-medium">{item.COSTE_IVA_INCLUIDO.toFixed(2)}€</div>
                                                      <div className="text-xs text-blue-600">Total: {(item.COSTE_IVA_INCLUIDO * item.CANTIDAD).toFixed(2)}€</div>
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
                                  )}
                                </div>
                              )
                            })}
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </div>
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
        ) : mainTab === 'catalogo' ? (
          // Vista de catálogo de productos
          <div>
            {filteredCatalog.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 text-lg mb-2">
                    {searchTerm ? 'No se encontraron productos' : 'El catálogo está vacío'}
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    {searchTerm ? 'Prueba con otro término de búsqueda' : 'Añade productos para que aparezcan en presupuestos'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setShowNewProductModal(true)} className="gap-2">
                      📋 Nuevo producto
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : searchTerm ? (
              // Flat search results
              <div className="space-y-2">
                {filteredCatalog.map((product, idx) => {
                  const familyIcon =
                    product.FAMILIA?.toLowerCase().includes('electric') ? '⚡' :
                    product.FAMILIA?.toLowerCase().includes('fontan') ? '🚰' :
                    product.FAMILIA?.toLowerCase().includes('mueble') ? '🪑' :
                    product.FAMILIA?.toLowerCase().includes('ventana') ? '🪟' :
                    product.FAMILIA?.toLowerCase().includes('tornill') || product.FAMILIA?.toLowerCase().includes('ferret') ? '🔩' :
                    product.FAMILIA?.toLowerCase().includes('pintu') ? '🎨' :
                    product.FAMILIA?.toLowerCase().includes('aisla') ? '🧊' : '📦'
                  const hasRecipe = Array.from({length: 5}, (_, i) => product[`MATERIAL_${i+1}` as keyof CatalogProduct]).some(Boolean) ||
                    Array.from({length: 10}, (_, i) => product[`CONSUMIBLE_${i+1}` as keyof CatalogProduct]).some(Boolean)
                  const hasTasks = Array.from({length: 12}, (_, i) => product[`TAREA_${i+1}_NOMBRE` as keyof CatalogProduct]).some(Boolean)
                  return (
                    <div key={`${product.SKU}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border hover:border-blue-300 transition cursor-pointer" onClick={() => handleEditProduct(product)} title="Clic para editar">
                      <span className="text-xl">{familyIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{product.NOMBRE}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                          <span className="font-mono">{product.SKU}</span>
                          <span>·</span>
                          <span className="capitalize">{product.FAMILIA}</span>
                          {product.CATEGORIA && <><span>·</span><span>{product.CATEGORIA}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-sm">
                        {product['PRECIO DE VENTA'] ? (
                          <span className="font-semibold text-emerald-700">{Number(product['PRECIO DE VENTA']).toFixed(2)}€</span>
                        ) : product.PRECIO_COMPRA ? (
                          <span className="text-gray-500">{product.PRECIO_COMPRA.toFixed(2)}€ coste</span>
                        ) : null}
                        {hasRecipe && <span title="Tiene materiales/consumibles">🔩</span>}
                        {hasTasks && <span title="Tiene tareas de producción">⚙️</span>}
                        {product.REQUIERE_DISEÑO === 'SÍ' && <span title={`Diseño: ${(product.TIPO_DISEÑO || '').split(',').filter(Boolean).map(d => d === 'furniture' ? '🪑 Muebles' : d === 'exterior' ? '🚐 Exterior' : d === 'interior' ? '🏠 Interior' : d).join(', ') || 'Sin asignar'}`}>📐</span>}
                        {product.TIEMPO_TOTAL_MIN > 0 && (
                          <span className="text-xs text-gray-400">{product.TIEMPO_TOTAL_MIN}min</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Grouped by family → category
              <div className="space-y-2">
                {catalogFamilies.map(family => {
                  const familyCategories = catalogByFamily[family] || {}
                  const familyItemCount = Object.values(familyCategories).reduce((s, arr) => s + arr.length, 0)
                  const familyExpanded = expandedCatalogFamily === family
                  const familyIcon =
                    family.toLowerCase().includes('electric') ? '⚡' :
                    family.toLowerCase().includes('fontan') ? '🚰' :
                    family.toLowerCase().includes('mueble') ? '🪑' :
                    family.toLowerCase().includes('ventana') ? '🪟' :
                    family.toLowerCase().includes('tornill') || family.toLowerCase().includes('ferret') ? '🔩' :
                    family.toLowerCase().includes('pintu') ? '🎨' :
                    family.toLowerCase().includes('aisla') ? '🧊' : '📦'

                  return (
                    <Card key={family}>
                      <button
                        onClick={() => {
                          setExpandedCatalogFamily(familyExpanded ? null : family)
                          setExpandedCatalogCategory(null)
                        }}
                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition rounded-t-lg ${
                          familyExpanded ? 'bg-gray-50 border-b' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{familyIcon}</span>
                          <span className="font-medium capitalize text-gray-800">{family}</span>
                          <Badge variant="secondary" className="text-xs">{familyItemCount}</Badge>
                        </div>
                        <span className="text-gray-400">{familyExpanded ? '▼' : '▶'}</span>
                      </button>

                      {familyExpanded && (
                        <CardContent className="p-2 space-y-2">
                          {Object.entries(familyCategories).map(([categoryName, categoryItems]) => {
                            const catExpanded = expandedCatalogCategory === `${family}::${categoryName}`
                            return (
                              <div key={categoryName} className="border rounded">
                                <button
                                  onClick={() => setExpandedCatalogCategory(catExpanded ? null : `${family}::${categoryName}`)}
                                  className={`w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition text-left ${
                                    catExpanded ? 'bg-gray-50 border-b' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">{categoryName}</span>
                                    <Badge variant="outline" className="text-xs">{categoryItems.length}</Badge>
                                  </div>
                                  <span className="text-gray-400 text-sm">{catExpanded ? '▼' : '▶'}</span>
                                </button>

                                {catExpanded && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full divide-y divide-gray-200 table-fixed">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="w-[30%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                          <th className="w-[12%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                          <th className="w-[12%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PVP</th>
                                          <th className="w-[12%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Coste</th>
                                          <th className="w-[10%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tiempo</th>
                                          <th className="w-[12%] px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                                          <th className="w-[12%] px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Info</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {categoryItems.map((product, index) => {
                                          const hasRecipe = Array.from({length: 5}, (_, i) => product[`MATERIAL_${i+1}` as keyof CatalogProduct]).some(Boolean) ||
                                            Array.from({length: 10}, (_, i) => product[`CONSUMIBLE_${i+1}` as keyof CatalogProduct]).some(Boolean)
                                          const hasTasks = Array.from({length: 12}, (_, i) => product[`TAREA_${i+1}_NOMBRE` as keyof CatalogProduct]).some(Boolean)
                                          return (
                                            <tr key={`${product.SKU}-${index}`} className="hover:bg-blue-50 transition cursor-pointer" onClick={() => handleEditProduct(product)} title="Clic para editar">
                                              <td className="px-4 py-3 max-w-0 overflow-hidden">
                                                <div className="text-sm font-medium text-gray-900 truncate" title={product.NOMBRE}>{product.NOMBRE}</div>
                                                {product.DESCRIPCION && <div className="text-xs text-gray-400 truncate">{product.DESCRIPCION}</div>}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-500 font-mono">{product.SKU}</td>
                                              <td className="px-4 py-3 text-sm">
                                                {product['PRECIO DE VENTA'] ? (
                                                  <span className="font-semibold text-emerald-700">{Number(product['PRECIO DE VENTA']).toFixed(2)}€</span>
                                                ) : <span className="text-gray-300">-</span>}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-500">
                                                {product.PRECIO_COMPRA ? `${product.PRECIO_COMPRA.toFixed(2)}€` : '-'}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-500">
                                                {product.TIEMPO_TOTAL_MIN > 0 ? `${product.TIEMPO_TOTAL_MIN}min` : '-'}
                                              </td>
                                              <td className="px-4 py-3 text-sm text-gray-500 max-w-0 overflow-hidden">
                                                <span className="truncate block">{product.PROVEEDOR || '-'}</span>
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                  {hasRecipe && <span title="Materiales/consumibles">🔩</span>}
                                                  {hasTasks && <span title="Tareas producción">⚙️</span>}
                                                  {product.REQUIERE_DISEÑO === 'SÍ' && <span title={`Diseño: ${(product.TIPO_DISEÑO || '').split(',').filter(Boolean).map(d => d === 'furniture' ? '🪑 Muebles' : d === 'exterior' ? '🚐 Exterior' : d === 'interior' ? '🏠 Interior' : d).join(', ') || 'Sin asignar'}`}>📐</span>}
                                                </div>
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </CardContent>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        ) : mainTab === 'pedidos' ? (
          // Vista de pedidos
          <div>
            {filteredPurchases.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 text-lg mb-2">
                    No hay pedidos {selectedTab === 'pending' ? 'pendientes' : selectedTab === 'ordered' ? 'en curso' : 'recibidos'}
                  </p>
                  {selectedTab === 'pending' && (
                    <>
                      <p className="text-sm text-gray-400 mb-4">
                        Los pedidos se generan automáticamente al aprobar presupuestos, o puedes crear uno manualmente
                      </p>
                      <Button onClick={() => setShowNewPurchaseModal(true)} className="gap-2">
                        ➕ Nuevo pedido manual
                      </Button>
                    </>
                  )}
                  {selectedTab !== 'pending' && (
                    <p className="text-sm text-gray-400">
                      Los pedidos se generan automáticamente al aprobar presupuestos
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : purchaseGroups ? (
              <div className="space-y-6">
                {purchaseGroups.map(([prov, items]) => {
                  const provColor = prov !== 'Sin proveedor' ? getProviderColor(prov) : null
                  const urgentCount = items.filter(i => i.priority >= 8).length
                  return (
                    <div key={prov}>
                      <div className={`flex items-center gap-3 mb-3 px-4 py-2.5 rounded-lg ${
                        provColor ? `${provColor.bgLight} border ${provColor.border}` : 'bg-gray-100 border border-gray-200'
                      }`}>
                        <span className={`text-base font-bold ${provColor ? provColor.text : 'text-gray-600'}`}>
                          🏭 {prov}
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                          provColor ? `bg-white/80 ${provColor.text}` : 'bg-gray-200 text-gray-600'
                        }`}>
                          {items.length} {items.length === 1 ? 'pedido' : 'pedidos'}
                        </span>
                        <div className="flex-1" />
                        {urgentCount > 0 && (
                          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            🔴 {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {items.map(item => <PurchaseCard key={item.id} item={item} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : selectedTab === 'received' ? (
              // ── RECEIVED: date-grouped list view ──
              (() => {
                const dateGroups: Record<string, PurchaseItem[]> = {}
                filteredPurchases.forEach(item => {
                  const dateKey = item.receivedAt
                    ? new Date(item.receivedAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Sin fecha'
                  if (!dateGroups[dateKey]) dateGroups[dateKey] = []
                  dateGroups[dateKey].push(item)
                })
                // Sort by date descending (most recent first) — already sorted by createdAt desc from filter
                const sortedDates = Object.entries(dateGroups).sort(([, a], [, b]) => {
                  const da = a[0]?.receivedAt ? new Date(a[0].receivedAt).getTime() : 0
                  const db = b[0]?.receivedAt ? new Date(b[0].receivedAt).getTime() : 0
                  return db - da
                })
                return (
                  <div className="space-y-6">
                    {sortedDates.map(([dateLabel, items]) => {
                      const totalDocs = items.reduce((s, i) => s + (i.attachments?.length || 0), 0)
                      return (
                        <div key={dateLabel}>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-bold text-gray-800 capitalize">📅 {dateLabel}</span>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                              {items.length} {items.length === 1 ? 'recepción' : 'recepciones'}
                            </span>
                            {totalDocs > 0 && (
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                📎 {totalDocs} doc{totalDocs > 1 ? 's' : ''}
                              </span>
                            )}
                            <div className="flex-1 h-px bg-gray-200" />
                          </div>
                          <div className="space-y-2">
                            {items.map(item => <ReceivedRow key={item.id} item={item} />)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPurchases.map(item => (
                  <PurchaseCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Nuevo Pedido Manual */}
        {showNewPurchaseModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewPurchaseModal(false)}>
            <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span>➕ Nuevo pedido manual</span>
                  <button onClick={() => setShowNewPurchaseModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
                </CardTitle>
                <p className="text-sm text-gray-500">Crea un pedido personalizado independiente de un presupuesto</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Material */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="Nombre del material o producto"
                    value={newPurchaseForm.materialName}
                    onChange={e => setNewPurchaseForm(f => ({ ...f, materialName: e.target.value }))}
                    autoFocus
                  />
                </div>

                {/* Cantidad + Unidad */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                    <Input
                      type="number" min={0.01} step="0.01"
                      value={newPurchaseForm.quantity}
                      onChange={e => setNewPurchaseForm(f => ({ ...f, quantity: parseFloat(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                    <select
                      value={newPurchaseForm.unit}
                      onChange={e => setNewPurchaseForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {['ud','uds','m','m²','m³','kg','g','l','ml','caja','rollo','paquete'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prioridad */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                  <div className="flex gap-2">
                    {[
                      { value: 3, label: '⚪ Baja',    cls: 'border-gray-300 text-gray-600 hover:bg-gray-50' },
                      { value: 5, label: '🟢 Media',   cls: 'border-green-300 text-green-700 hover:bg-green-50' },
                      { value: 7, label: '🟡 Alta',    cls: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50' },
                      { value: 9, label: '🔴 Urgente', cls: 'border-red-300 text-red-700 hover:bg-red-50' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewPurchaseForm(f => ({ ...f, priority: opt.value }))}
                        className={`flex-1 text-xs px-2 py-2 rounded-lg border font-medium transition ${
                          newPurchaseForm.priority === opt.value
                            ? opt.cls + ' ring-2 ring-offset-1'
                            : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proveedor + Referencia */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <Input
                      placeholder="Nombre del proveedor"
                      value={newPurchaseForm.provider}
                      onChange={e => setNewPurchaseForm(f => ({ ...f, provider: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                    <Input
                      placeholder="Código / SKU"
                      value={newPurchaseForm.referencia}
                      onChange={e => setNewPurchaseForm(f => ({ ...f, referencia: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Nº Proyecto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Proyecto <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <Input
                    placeholder="Asociar a un proyecto existente"
                    value={newPurchaseForm.projectNumber}
                    onChange={e => setNewPurchaseForm(f => ({ ...f, projectNumber: e.target.value }))}
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <textarea
                    rows={2}
                    placeholder="Especificaciones, dimensiones, color..."
                    value={newPurchaseForm.notes}
                    onChange={e => setNewPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button onClick={handleCreateManualPurchase} className="flex-1">
                    ✅ Crear pedido
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewPurchaseModal(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal Nuevo Producto Completo */}
        {showNewProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewProductModal(false)}>
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <CardHeader className="pb-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shrink-0">
                <CardTitle className="flex items-center justify-between">
                  <span>{editingProduct ? '✏️ Editar producto' : '📋 Nuevo producto'}</span>
                  <button onClick={() => { setShowNewProductModal(false); setEditingProduct(null) }} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                </CardTitle>
                <p className="text-sm text-emerald-100">{editingProduct ? 'Modifica los datos del producto. Los cambios se aplicarán al catálogo y al stock si corresponde.' : 'Crea un producto para el catálogo de presupuestos. Si indicas cantidad, también se añadirá al stock.'}</p>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto p-5">
                {/* ─── Datos básicos ─── */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Artículo <span className="text-red-500">*</span></label>
                  <Input placeholder="Nombre del producto" value={newProductForm.articulo}
                    onChange={e => setNewProductForm(f => ({ ...f, articulo: e.target.value }))} autoFocus />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia / SKU <span className="text-red-500">*</span></label>
                    <Input placeholder="Código único" value={newProductForm.referencia}
                      readOnly={!!editingProduct}
                      onChange={e => setNewProductForm(f => ({ ...f, referencia: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                    <select value={newProductForm.unidad} onChange={e => setNewProductForm(f => ({ ...f, unidad: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500">
                      {['ud','uds','m','m²','m³','kg','g','l','ml','caja','rollo','paquete'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Familia</label>
                    <Input list="np-familias" placeholder="Ej: Electricidad" value={newProductForm.familia}
                      onChange={e => setNewProductForm(f => ({ ...f, familia: e.target.value }))} />
                    <datalist id="np-familias">{[...new Set(stock.map(s => s.FAMILIA).filter(Boolean))].sort().map(f => <option key={f} value={f} />)}</datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <Input list="np-categorias" placeholder="Ej: Cables" value={newProductForm.categoria}
                      onChange={e => setNewProductForm(f => ({ ...f, categoria: e.target.value }))} />
                    <datalist id="np-categorias">{[...new Set(stock.filter(s => !newProductForm.familia || s.FAMILIA === newProductForm.familia).map(s => s.CATEGORIA).filter(Boolean))].sort().map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea rows={2} placeholder="Detalles adicionales..." value={newProductForm.descripcion}
                    onChange={e => setNewProductForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 resize-none" />
                </div>

                {/* ─── Stock (opcional) ─── */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">📊 Stock <span className="font-normal text-gray-500">(opcional — solo si es un item físico)</span></h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad inicial</label>
                      <Input type="number" min={0} step="0.01" value={newProductForm.cantidad}
                        onChange={e => setNewProductForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Stock mínimo</label>
                      <Input type="number" min={0} step="0.01" placeholder="0" value={newProductForm.stockMinimo}
                        onChange={e => setNewProductForm(f => ({ ...f, stockMinimo: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ubicación</label>
                      <Input placeholder="Ej: 123" value={newProductForm.ubicacion} className="font-mono"
                        onChange={e => setNewProductForm(f => ({ ...f, ubicacion: e.target.value.toUpperCase() }))} />
                    </div>
                  </div>
                </div>

                {/* ─── Precios y proveedor ─── */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">💰 Precios y proveedor</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Coste compra (sin IVA) €</label>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={newProductForm.costeIva}
                        onChange={e => setNewProductForm(f => ({ ...f, costeIva: parseFloat(e.target.value) || 0 }))} />
                      {newProductForm.costeIva > 0 && (
                        <p className="text-xs text-emerald-600 mt-1 font-medium">
                          Con IVA ({CONFIG.IVA}%): {(newProductForm.costeIva * (1 + CONFIG.IVA / 100)).toFixed(2)}€
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio venta €</label>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={newProductForm.precioVenta}
                        onChange={e => setNewProductForm(f => ({ ...f, precioVenta: parseFloat(e.target.value) || 0 }))} />
                      {newProductForm.costeIva > 0 && newProductForm.precioVenta > 0 && (
                        <p className="text-xs text-blue-500 mt-1">
                          Margen: {((newProductForm.precioVenta / (newProductForm.costeIva * (1 + CONFIG.IVA / 100)) - 1) * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                      <Input list="np-proveedores" placeholder="Nombre" value={newProductForm.proveedor}
                        onChange={e => setNewProductForm(f => ({ ...f, proveedor: e.target.value }))} />
                      <datalist id="np-proveedores">{[...new Set(stock.map(s => s.PROVEEDOR).filter(Boolean))].sort().map(p => <option key={p} value={p} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Días entrega</label>
                      <Input type="number" min={0} value={newProductForm.diasEntrega}
                        onChange={e => setNewProductForm(f => ({ ...f, diasEntrega: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>

                {/* ─── Tiempo de mano de obra ─── */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">⏱️ Mano de obra</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tiempo total (minutos)</label>
                      <Input type="number" min={0} value={newProductForm.tiempoTotalMin}
                        onChange={e => setNewProductForm(f => ({ ...f, tiempoTotalMin: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex items-end pb-1">
                      <span className="text-sm text-gray-500">= {(newProductForm.tiempoTotalMin / 60).toFixed(1)} horas</span>
                    </div>
                  </div>
                </div>

                {/* ─── Materiales ─── */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">🔩 Materiales <span className="font-normal text-gray-500">(máx 5)</span></h4>
                    {newProductMaterials.length < 5 && (
                      <button onClick={() => setNewProductMaterials([...newProductMaterials, { nombre: '', cantidad: 1, unidad: 'ud' }])}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">+ Añadir</button>
                    )}
                  </div>
                  {newProductMaterials.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin materiales</p>
                  ) : (
                    <div className="space-y-2">
                      {newProductMaterials.map((mat, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Input placeholder="Nombre" value={mat.nombre} className="flex-1 text-sm"
                            onChange={e => { const u = [...newProductMaterials]; u[idx] = {...u[idx], nombre: e.target.value}; setNewProductMaterials(u) }} />
                          <Input type="number" min={0} step="0.01" value={mat.cantidad} className="w-16 text-sm"
                            onChange={e => { const u = [...newProductMaterials]; u[idx] = {...u[idx], cantidad: parseFloat(e.target.value) || 0}; setNewProductMaterials(u) }} />
                          <select value={mat.unidad} className="px-2 py-1.5 border rounded text-xs"
                            onChange={e => { const u = [...newProductMaterials]; u[idx] = {...u[idx], unidad: e.target.value}; setNewProductMaterials(u) }}>
                            {['ud','m','m²','m³','kg','g','l','ml','rollo'].map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button onClick={() => setNewProductMaterials(newProductMaterials.filter((_,i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-lg leading-none">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Consumibles ─── */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">🧰 Consumibles <span className="font-normal text-gray-500">(máx 10)</span></h4>
                    {newProductConsumables.length < 10 && (
                      <button onClick={() => setNewProductConsumables([...newProductConsumables, { nombre: '', cantidad: 1, unidad: 'ud' }])}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">+ Añadir</button>
                    )}
                  </div>
                  {newProductConsumables.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin consumibles</p>
                  ) : (
                    <div className="space-y-2">
                      {newProductConsumables.map((cons, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <Input placeholder="Nombre" value={cons.nombre} className="flex-1 text-sm"
                            onChange={e => { const u = [...newProductConsumables]; u[idx] = {...u[idx], nombre: e.target.value}; setNewProductConsumables(u) }} />
                          <Input type="number" min={0} step="0.01" value={cons.cantidad} className="w-16 text-sm"
                            onChange={e => { const u = [...newProductConsumables]; u[idx] = {...u[idx], cantidad: parseFloat(e.target.value) || 0}; setNewProductConsumables(u) }} />
                          <select value={cons.unidad} className="px-2 py-1.5 border rounded text-xs"
                            onChange={e => { const u = [...newProductConsumables]; u[idx] = {...u[idx], unidad: e.target.value}; setNewProductConsumables(u) }}>
                            {['ud','m','kg','g','l','ml'].map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <button onClick={() => setNewProductConsumables(newProductConsumables.filter((_,i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-lg leading-none">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Tareas ─── */}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">⚙️ Tareas de producción <span className="font-normal text-gray-500">(máx 12)</span></h4>
                    {newProductTasks.length < 12 && (
                      <button onClick={() => setNewProductTasks([...newProductTasks, { nombre: '', duracion: 30, requiereMaterial: false, requiereDiseno: false }])}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">+ Añadir</button>
                    )}
                  </div>
                  {newProductTasks.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Sin tareas definidas</p>
                  ) : (
                    <div className="space-y-2">
                      {newProductTasks.map((task, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded space-y-1">
                          <div className="flex items-center gap-2">
                            <Input placeholder="Nombre de la tarea" value={task.nombre} className="flex-1 text-sm"
                              onChange={e => { const u = [...newProductTasks]; u[idx] = {...u[idx], nombre: e.target.value}; setNewProductTasks(u) }} />
                            <div className="flex items-center gap-1">
                              <Input type="number" min={0} value={task.duracion} className="w-16 text-sm"
                                onChange={e => { const u = [...newProductTasks]; u[idx] = {...u[idx], duracion: parseInt(e.target.value) || 0}; setNewProductTasks(u) }} />
                              <span className="text-xs text-gray-500 whitespace-nowrap">min</span>
                            </div>
                            <button onClick={() => setNewProductTasks(newProductTasks.filter((_,i) => i !== idx))}
                              className="text-red-400 hover:text-red-600 text-lg leading-none">✕</button>
                          </div>
                          <div className="flex gap-4 ml-1">
                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={task.requiereMaterial} className="w-3.5 h-3.5"
                                onChange={e => { const u = [...newProductTasks]; u[idx] = {...u[idx], requiereMaterial: e.target.checked}; setNewProductTasks(u) }} />
                              Requiere material
                            </label>
                            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                              <input type="checkbox" checked={task.requiereDiseno} className="w-3.5 h-3.5"
                                onChange={e => { const u = [...newProductTasks]; u[idx] = {...u[idx], requiereDiseno: e.target.checked}; setNewProductTasks(u) }} />
                              Requiere diseño
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ─── Diseño ─── */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" id="np-requiereDiseno" checked={newProductForm.requiereDiseno} className="w-4 h-4"
                      onChange={e => setNewProductForm(f => ({ ...f, requiereDiseno: e.target.checked }))} />
                    <label htmlFor="np-requiereDiseno" className="text-sm font-semibold text-gray-800 cursor-pointer">📐 Requiere diseño</label>
                  </div>
                  {newProductForm.requiereDiseno && (
                    <div className="space-y-2 ml-6">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Departamentos de diseño</label>
                        <p className="text-xs text-gray-400 mb-2">Selecciona a qué departamentos debe ir este producto</p>
                        <div className="space-y-1.5">
                          {[
                            { key: 'furniture', icon: '🪑', label: 'Muebles', desc: 'Planos, despiece y corte' },
                            { key: 'exterior', icon: '🚐', label: 'Exterior', desc: 'Ventanas, claraboyas, exteriores' },
                            { key: 'interior', icon: '🏠', label: 'Interior', desc: 'Distribución en plano interior' },
                          ].map(dept => {
                            const selected = newProductForm.tipoDiseno.split(',').filter(Boolean)
                            const isChecked = selected.includes(dept.key)
                            return (
                              <label key={dept.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                isChecked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}>
                                <input type="checkbox" checked={isChecked} className="w-3.5 h-3.5 accent-emerald-600"
                                  onChange={() => {
                                    const newSelected = isChecked
                                      ? selected.filter(k => k !== dept.key)
                                      : [...selected, dept.key]
                                    setNewProductForm(f => ({ ...f, tipoDiseno: newSelected.join(',') }))
                                  }} />
                                <span className="text-base">{dept.icon}</span>
                                <div>
                                  <div className="text-xs font-medium">{dept.label}</div>
                                  <div className="text-[10px] text-gray-500">{dept.desc}</div>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Instrucciones de diseño</label>
                        <textarea rows={2} placeholder="Especificaciones del diseño..."
                          value={newProductForm.instruccionesDiseno}
                          onChange={e => setNewProductForm(f => ({ ...f, instruccionesDiseno: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500 resize-none" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleCreateNewProduct} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    {editingProduct ? '💾 Guardar cambios' : '✅ Crear producto'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowNewProductModal(false); setEditingProduct(null) }} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                      setMainTab('stock')
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