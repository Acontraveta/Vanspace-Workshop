// Item de stock del Excel
export interface StockItem {
  REFERENCIA: string
  FAMILIA: string
  CATEGORIA: string
  ARTICULO: string
  DESCRIPCION?: string
  CANTIDAD: number
  STOCK_MINIMO?: number
  UNIDAD: string
  COSTE_IVA_INCLUIDO?: number
  UBICACION?: string  // NUEVO: formato "123" = estantería 1, nivel 2, hueco 3
}

// Item de pedido generado automáticamente
export interface PurchaseItem {
  id: string
  projectId?: string
  projectNumber?: string
  
  // Del catálogo/stock
  referencia?: string
  materialName: string
  quantity: number
  unit: string
  
  // Info del proveedor (del catálogo de productos)
  provider?: string
  deliveryDays?: number
  priority: number  // 1-10 (más alto = más urgente)
  
  // Para qué producto del presupuesto
  productSKU?: string
  productName?: string
  
  // Estado
  status: 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  orderedAt?: Date
  receivedAt?: Date
  
  // Notas
  notes?: string
  createdAt: Date
}

// Agrupación de pedidos por proveedor
export interface PurchaseOrder {
  id: string
  provider: string
  items: PurchaseItem[]
  totalItems: number
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'COMPLETED'
  createdAt: Date
  sentAt?: Date
}