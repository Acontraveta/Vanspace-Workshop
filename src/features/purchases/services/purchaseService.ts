import { PurchaseItem } from '../types/purchase.types'
import { StockService } from './stockService'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

export class PurchaseService {
  private static STORAGE_KEY = 'purchase_items'

  // Generar código QR para un producto
  static async generateProductQR(item: PurchaseItem): Promise<string> {
    try {
      const qrData = JSON.stringify({
        type: 'warehouse_product',
        referencia: item.referencia,
        nombre: item.materialName,
        timestamp: Date.now()
      })
      const qrDataURL = await QRCode.toDataURL(qrData, { 
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      return qrDataURL
    } catch (error) {
      console.error('Error generando QR:', error)
      return ''
    }
  }

  // Obtener todos los pedidos
  static getAllPurchases(): PurchaseItem[] {
    const stored = localStorage.getItem(this.STORAGE_KEY)
    if (stored) {
      try {
        const items = JSON.parse(stored)
        return items.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          orderedAt: item.orderedAt ? new Date(item.orderedAt) : undefined,
          receivedAt: item.receivedAt ? new Date(item.receivedAt) : undefined,
        }))
      } catch (e) {
        return []
      }
    }
    return []
  }

  // Guardar pedido
  static savePurchase(item: PurchaseItem): void {
    const items = this.getAllPurchases()
    const existingIndex = items.findIndex(i => i.id === item.id)
    
    if (existingIndex >= 0) {
      items[existingIndex] = item
    } else {
      items.push(item)
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items))
  }

  // Marcar como pedido
  static markAsOrdered(itemId: string): void {
    const items = this.getAllPurchases()
    const item = items.find(i => i.id === itemId)
    
    if (item) {
      item.status = 'ORDERED'
      item.orderedAt = new Date()
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items))
      toast.success('Marcado como pedido')
    }
  }

  // Marcar como recibido y generar QR
  static async markAsReceived(itemId: string): Promise<string> {
    const items = this.getAllPurchases()
    const item = items.find(i => i.id === itemId)
    
    if (!item) return ''

    item.status = 'RECEIVED'
    item.receivedAt = new Date()
    
    // Actualizar stock si existe referencia
    if (item.referencia) {
      const stockItem = StockService.getItemByReference(item.referencia)
      if (stockItem) {
        const newQuantity = stockItem.CANTIDAD + item.quantity
        StockService.updateStock(item.referencia, newQuantity)
      }
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items))
    
    // Generar QR
    const qrDataURL = await this.generateProductQR(item)
    
    // Desbloquear tareas
    this.unlockTasksRequiringMaterial(item)
    
    return qrDataURL
  }

  // Desbloquear tareas que requieren este material
  private static unlockTasksRequiringMaterial(purchaseItem: PurchaseItem): void {
    if (!purchaseItem.projectId) return
    
    const allTasks = JSON.parse(localStorage.getItem('production_tasks') || '[]')
    let unlockedCount = 0
    
    const updatedTasks = allTasks.map((task: any) => {
      if (
        task.projectId === purchaseItem.projectId &&
        task.requiresMaterial &&
        task.blocked &&
        task.productSKU === purchaseItem.productSKU
      ) {
        if (task.requiresDesign) {
          const designs = JSON.parse(localStorage.getItem('design_instructions') || '[]')
          const designComplete = designs.some((d: any) => 
            d.projectId === purchaseItem.projectId &&
            d.productSKU === purchaseItem.productSKU &&
            d.status === 'COMPLETED'
          )
          
          if (!designComplete) {
            return task
          }
        }
        
        task.blocked = false
        task.status = 'READY'
        unlockedCount++
      }
      
      return task
    })
    
    if (unlockedCount > 0) {
      localStorage.setItem('production_tasks', JSON.stringify(updatedTasks))
      console.log(`✅ ${unlockedCount} tareas desbloqueadas`)
    }
  }

  // Obtener por estado
  static getByStatus(status: PurchaseItem['status']): PurchaseItem[] {
    return this.getAllPurchases().filter(i => i.status === status)
  }

  // Obtener por proyecto
  static getByProject(projectId: string): PurchaseItem[] {
    return this.getAllPurchases().filter(i => i.projectId === projectId)
  }

  // Agrupar por proveedor
  static groupByProvider(): Record<string, PurchaseItem[]> {
    const items = this.getAllPurchases()
    return items.reduce((acc, item) => {
      const provider = item.provider || 'Sin proveedor'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(item)
      return acc
    }, {} as Record<string, PurchaseItem[]>)
  }

  // Obtener pedidos pendientes ordenados por prioridad
  static getPendingByPriority(): PurchaseItem[] {
    return this.getByStatus('PENDING').sort((a, b) => b.priority - a.priority)
  }

  // Guardar QR generado
  static saveQR(itemId: string, qrDataURL: string): void {
    const qrs = this.getAllQRs()
    qrs[itemId] = qrDataURL
    localStorage.setItem('product_qrs', JSON.stringify(qrs))
  }

  // Obtener todos los QRs
  static getAllQRs(): Record<string, string> {
    const stored = localStorage.getItem('product_qrs')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        return {}
      }
    }
    return {}
  }

  // Obtener QR de un item
  static getQR(itemId: string): string | undefined {
    const qrs = this.getAllQRs()
    return qrs[itemId]
  }
}