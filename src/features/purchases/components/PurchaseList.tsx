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
    guardarEnCatalogo: true,
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

      // Merge catalog products not yet in stock (quantity 0)
      const stockRefs = new Set(formattedStock.map(s => s.REFERENCIA?.toUpperCase()).filter(Boolean))
      let catalogProducts = CatalogService.getProducts()
      // If catalog not cached yet, load fresh
      if (catalogProducts.length === 0) {
        try { catalogProducts = await CatalogService.loadFromSupabase() } catch { /* use empty */ }
      }
      const catalogOnly: StockItem[] = catalogProducts
        .filter(p => p.SKU && !stockRefs.has(p.SKU.toUpperCase()))
        .map(p => ({
          REFERENCIA: p.SKU,
          FAMILIA: p.FAMILIA || '',
          CATEGORIA: p.CATEGORIA || '',
          ARTICULO: p.NOMBRE,
          DESCRIPCION: p.DESCRIPCION || '',
          CANTIDAD: 0,
          STOCK_MINIMO: 0,
          UNIDAD: 'ud',
          COSTE_IVA_INCLUIDO: p.PRECIO_COMPRA || 0,
          UBICACION: '',
          PROVEEDOR: p.PROVEEDOR || '',
        }))

      const mergedStock = [...formattedStock, ...catalogOnly]
      setStock(mergedStock)
      setStockLoaded(mergedStock.length > 0)
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

  // Añadir nuevo producto completo (catálogo + inventario)
  const handleCreateNewProduct = async () => {
    if (!newProductForm.articulo.trim()) {
      toast.error('El nombre del artículo es obligatorio')
      return
    }
    if (!newProductForm.referencia.trim()) {
      toast.error('La referencia es obligatoria')
      return
    }
    // Comprobar si ya existe en stock
    const existing = stock.find(s => s.REFERENCIA === newProductForm.referencia.trim())
    if (existing) {
      toast.error('Ya existe un producto con esa referencia')
      return
    }

    try {
      // 1. Guardar en catálogo si procede
      if (newProductForm.guardarEnCatalogo) {
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
          PRECIO_COMPRA: newProductForm.costeIva || 0,
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
      }

      // 2. Guardar en stock_items
      const { error } = await supabase.from('stock_items').insert({
        referencia: newProductForm.referencia.trim(),
        familia: newProductForm.familia.trim() || 'GENERAL',
        categoria: newProductForm.categoria.trim() || 'SIN CATEGORÍA',
        articulo: newProductForm.articulo.trim(),
        descripcion: newProductForm.descripcion.trim() || null,
        cantidad: newProductForm.cantidad,
        stock_minimo: newProductForm.stockMinimo || null,
        unidad: newProductForm.unidad || 'ud',
        coste_iva_incluido: newProductForm.costeIva || null,
        ubicacion: newProductForm.ubicacion.trim() || null,
        proveedor: newProductForm.proveedor.trim() || null,
      })
      if (error) {
        toast.error('Error añadiendo al inventario: ' + error.message)
        return
      }

      toast.success(newProductForm.guardarEnCatalogo
        ? 'Producto añadido al inventario y catálogo ✅'
        : 'Producto añadido al inventario ✅'
      )
      setNewProductForm({ articulo: '', referencia: '', familia: '', categoria: '', descripcion: '', cantidad: 0, stockMinimo: 0, unidad: 'ud', costeIva: 0, precioVenta: 0, ubicacion: '', proveedor: '', diasEntrega: 0, tiempoTotalMin: 0, requiereDiseno: false, tipoDiseno: '', instruccionesDiseno: '', guardarEnCatalogo: true })
      setNewProductMaterials([])
      setNewProductConsumables([])
      setNewProductTasks([])
      setShowNewProductModal(false)
      refreshData()
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

  // Agrupación por proveedor
  const purchaseGroups: [string, PurchaseItem[]][] | null = groupByProvider
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

  const PurchaseCard = ({ item }: { item: PurchaseItem }) => {
    const borderColor = item.priority >= 8 ? 'border-l-red-500' : item.priority >= 6 ? 'border-l-amber-400' : item.priority >= 4 ? 'border-l-green-400' : 'border-l-gray-300'
    const priorityLabel = item.priority >= 8 ? '🔴 Urgente' : item.priority >= 6 ? '🟡 Alta' : item.priority >= 4 ? '🟢 Media' : '⚪ Baja'
    const priorityBadge = item.priority >= 8 ? 'bg-red-100 text-red-700' : item.priority >= 6 ? 'bg-amber-100 text-amber-700' : item.priority >= 4 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    const isLowStockReplenishment = item.id.startsWith('lowstock-')
    const daysSinceOrdered = item.orderedAt
      ? Math.floor((Date.now() - new Date(item.orderedAt).getTime()) / 86400000)
      : null

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
            {item.projectNumber ? (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                📋 {item.projectNumber}
              </span>
            ) : isLowStockReplenishment ? (
              <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                ⚠️ Reposición stock
              </span>
            ) : null}
            {item.provider && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                🏭 {item.provider}
              </span>
            )}
          </div>

          {/* Info row */}
          <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
            <span className="font-semibold text-gray-900">{item.quantity} {item.unit}</span>
            {item.deliveryDays && (
              <span className="text-gray-400 text-xs">⏱ {item.deliveryDays}d</span>
            )}
            {daysSinceOrdered !== null && (
              <span className={`text-xs font-medium ml-auto ${
                daysSinceOrdered > (item.deliveryDays ?? 7) ? 'text-red-600' : 'text-amber-600'
              }`}>
                {daysSinceOrdered > 0 ? `Esperando ${daysSinceOrdered}d` : 'Pedido hoy'}
              </span>
            )}
          </div>

          {item.notes && (
            <p className="text-xs bg-amber-50 text-amber-800 border border-amber-100 rounded px-2 py-1.5 mb-3 line-clamp-2">
              {item.notes}
            </p>
          )}

          {/* Action */}
          <div className="mt-auto">
            {item.status === 'PENDING' && (
              <button
                onClick={() => handleMarkAsOrdered(item.id)}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
              >
                📦 Marcar como pedido
              </button>
            )}
            {item.status === 'ORDERED' && (
              <button
                onClick={() => handleMarkAsReceived(item.id)}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
              >
                ✅ Marcar como recibido
              </button>
            )}
            {item.status === 'RECEIVED' && (
              <div className="w-full py-2 rounded-lg bg-gray-50 text-gray-500 text-sm font-medium text-center border border-gray-200">
                ✅ Recibido · {item.receivedAt ? new Date(item.receivedAt).toLocaleDateString('es-ES') : ''}
              </div>
            )}
          </div>
        </div>
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
      <Header
        title="Pedidos y Stock"
        description="Gestión de compras y control de inventario"
        action={{ label: '➕ Nuevo pedido', onClick: () => setShowNewPurchaseModal(true) }}
      >
        {selectedTab === 'stock' && (
          <Button variant="outline" size="sm" onClick={() => setShowNewProductModal(true)}>
            📦 Añadir producto
          </Button>
        )}
      </Header>

      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
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

        {/* Alertas de stock bajo — banner compacto */}
        {lowStockItems.length > 0 && (
          <button
            onClick={() => setSelectedTab('stock')}
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

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Pendientes', value: pendingCount, icon: '⏳', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', tab: 'pending' as const },
            { label: 'En camino', value: orderedCount, icon: '🚚', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', tab: 'ordered' as const },
            { label: 'Recibidos', value: receivedCount, icon: '✅', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', tab: 'received' as const },
            { label: 'Stock bajo', value: lowStockItems.length, icon: '⚠️', bg: 'bg-red-50 border-red-200', text: 'text-red-700', tab: 'stock' as const },
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

        {/* Tabs principales */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
          {([
            { id: 'pending', icon: '⏳', label: 'Pendientes', count: pendingCount },
            { id: 'ordered', icon: '🚚', label: 'En camino', count: orderedCount },
            { id: 'received', icon: '✅', label: 'Recibidos', count: receivedCount },
            { id: 'stock', icon: '📦', label: 'Inventario', count: stock.length },
            { id: 'warehouse', icon: '🏭', label: 'Almacén', count: stockLoaded ? stock.filter(s => isValidLocation(s.UBICACION)).length : undefined },
            { id: 'scanner', icon: '📷', label: 'Escanear QR', count: undefined },
          ] as { id: typeof selectedTab; icon: string; label: string; count: number | undefined }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                selectedTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="🔍 Buscar material, proyecto, proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          {selectedTab === 'stock' && estanterias.length > 0 && (
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
          {['pending','ordered','received'].includes(selectedTab) && providers.length > 0 && (
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
          {['pending','ordered','received'].includes(selectedTab) && (
            <button
              onClick={() => setGroupByProvider(g => !g)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                groupByProvider
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              🏭 Por proveedor
            </button>
          )}
        </div>

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
        ) : (
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
                {purchaseGroups.map(([prov, items]) => (
                  <div key={prov}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-semibold text-gray-700 text-sm">🏭 {prov}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{items.length}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map(item => <PurchaseCard key={item.id} item={item} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPurchases.map(item => (
                  <PurchaseCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

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
                  <span>📦 Añadir producto al inventario</span>
                  <button onClick={() => setShowNewProductModal(false)} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
                </CardTitle>
                <p className="text-sm text-emerald-100">Añade un nuevo producto con toda la información necesaria</p>
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

                {/* ─── Inventario ─── */}
                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">📊 Inventario</h4>
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
                      <label className="block text-xs font-medium text-gray-600 mb-1">Coste compra (IVA incl.) €</label>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={newProductForm.costeIva}
                        onChange={e => setNewProductForm(f => ({ ...f, costeIva: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio venta €</label>
                      <Input type="number" min={0} step="0.01" placeholder="0.00" value={newProductForm.precioVenta}
                        onChange={e => setNewProductForm(f => ({ ...f, precioVenta: parseFloat(e.target.value) || 0 }))} />
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de diseño</label>
                        <select value={newProductForm.tipoDiseno} onChange={e => setNewProductForm(f => ({ ...f, tipoDiseno: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-emerald-500">
                          <option value="">Selecciona...</option>
                          <option value="PLANO">PLANO</option>
                          <option value="DESPIECE">DESPIECE</option>
                          <option value="3D">3D</option>
                          <option value="ESQUEMA">ESQUEMA</option>
                          <option value="OTRO">OTRO</option>
                        </select>
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

                {/* ─── Guardar en catálogo ─── */}
                <div className="border-t pt-3 bg-blue-50 rounded-lg p-3 -mx-1">
                  <div className="flex items-start gap-2">
                    <input type="checkbox" id="np-guardarCatalogo" checked={newProductForm.guardarEnCatalogo} className="w-4 h-4 mt-0.5"
                      onChange={e => setNewProductForm(f => ({ ...f, guardarEnCatalogo: e.target.checked }))} />
                    <div>
                      <label htmlFor="np-guardarCatalogo" className="font-medium text-sm text-blue-800 cursor-pointer">
                        📋 Guardar también en catálogo de productos
                      </label>
                      <p className="text-xs text-blue-600 mt-0.5">
                        El producto quedará disponible para presupuestos con materiales, consumibles y tareas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button onClick={handleCreateNewProduct} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    ✅ Añadir producto
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewProductModal(false)} className="flex-1">
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