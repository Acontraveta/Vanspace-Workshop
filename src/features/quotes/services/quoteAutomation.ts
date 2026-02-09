import { Quote, QuoteItem } from '../types/quote.types'
import { PurchaseItem } from '@/features/purchases/types/purchase.types'
import { StockService } from '@/features/purchases/services/stockService'

interface AutomationResult {
  success: boolean
  details: {
    totalPurchaseItems: number
    totalTasks: number
    totalDesignInstructions: number
  }
  errors: string[]
}

export class QuoteAutomation {
  
  static async executeAutomation(quote: Quote): Promise<AutomationResult> {
    console.log('🤖 Ejecutando automatización para:', quote.quoteNumber)
    
    const errors: string[] = []
    let totalPurchaseItems = 0
    let totalTasks = 0
    let totalDesignInstructions = 0
    
    try {
      // 1. Generar pedidos de materiales (considerando stock)
      const purchaseItems = this.generatePurchaseList(quote)
      totalPurchaseItems = purchaseItems.length
      
      // Guardar pedidos
      const existingPurchases = JSON.parse(localStorage.getItem('purchase_items') || '[]')
      const allPurchases = [...existingPurchases, ...purchaseItems]
      localStorage.setItem('purchase_items', JSON.stringify(allPurchases))
      
      console.log(`📦 ${totalPurchaseItems} pedidos de compra generados`)
      
      // 2. Generar tareas de producción
      const tasks = this.generateProductionTasks(quote)
      totalTasks = tasks.length
      
      // Guardar tareas
      const existingTasks = JSON.parse(localStorage.getItem('production_tasks') || '[]')
      const allTasks = [...existingTasks, ...tasks]
      localStorage.setItem('production_tasks', JSON.stringify(allTasks))
      
      console.log(`⚙️ ${totalTasks} tareas de producción generadas`)
      
      // 3. Generar instrucciones de diseño
      const designInstructions = this.generateDesignInstructions(quote)
      totalDesignInstructions = designInstructions.length
      
      // Guardar instrucciones
      const existingDesigns = JSON.parse(localStorage.getItem('design_instructions') || '[]')
      const allDesigns = [...existingDesigns, ...designInstructions]
      localStorage.setItem('design_instructions', JSON.stringify(allDesigns))
      
      console.log(`📐 ${totalDesignInstructions} instrucciones de diseño generadas`)
      
      // 4. Añadir pedidos para stock bajo
      const lowStockPurchases = this.generateLowStockPurchases()
      if (lowStockPurchases.length > 0) {
        const allPurchasesWithLowStock = [...allPurchases, ...lowStockPurchases]
        localStorage.setItem('purchase_items', JSON.stringify(allPurchasesWithLowStock))
        totalPurchaseItems += lowStockPurchases.length
        console.log(`⚠️ ${lowStockPurchases.length} pedidos adicionales por stock bajo`)
      }
      
      return {
        success: true,
        details: {
          totalPurchaseItems,
          totalTasks,
          totalDesignInstructions
        },
        errors
      }
      
    } catch (error: any) {
      console.error('❌ Error en automatización:', error)
      return {
        success: false,
        details: {
          totalPurchaseItems: 0,
          totalTasks: 0,
          totalDesignInstructions: 0
        },
        errors: [error.message]
      }
    }
  }
  
  private static generatePurchaseList(quote: Quote): PurchaseItem[] {
    const purchases: PurchaseItem[] = []
    const projectId = quote.id.slice(-5)
    
    console.log('🔍 GENERANDO PEDIDOS PARA:', quote.quoteNumber)
    console.log('📋 Total items en presupuesto:', quote.items.length)
    
    quote.items.forEach((item: QuoteItem, idx) => {
      console.log(`\n--- ITEM ${idx + 1}: ${item.productName} ---`)
      console.log('Catalog data:', item.catalogData)
      
      // Obtener materiales del producto
      const materials = this.extractMaterials(item)
      console.log(`📦 Materiales extraídos:`, materials.length)
      
      materials.forEach((material, matIdx) => {
        console.log(`\n  Material ${matIdx + 1}:`, material.name, '-', material.quantity, material.unit)
        
        // VERIFICAR STOCK DISPONIBLE
        const stockItem = StockService.findItemByName(material.name)
        console.log(`  Stock encontrado:`, stockItem ? `${stockItem.ARTICULO} (${stockItem.CANTIDAD} ${stockItem.UNIDAD})` : '❌ NO ENCONTRADO')
        
        const stockDisponible = stockItem?.CANTIDAD || 0
        const cantidadNecesaria = material.quantity
        
        console.log(`  Necesario: ${cantidadNecesaria} | Disponible: ${stockDisponible}`)
        
        // Solo crear pedido si NO hay suficiente stock
        if (stockDisponible < cantidadNecesaria) {
          const cantidadAPedir = cantidadNecesaria - stockDisponible
          console.log(`  ✅ CREAR PEDIDO: ${cantidadAPedir} ${material.unit}`)
          
          // Calcular prioridad basada en días de entrega
          const deliveryDays = material.deliveryDays || 7
          let priority = 5
          
          if (deliveryDays >= 14) {
            priority = 9
          } else if (deliveryDays >= 7) {
            priority = 7
          } else if (deliveryDays >= 3) {
            priority = 5
          } else {
            priority = 3
          }
          
          const purchase: PurchaseItem = {
            id: `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            projectId,
            projectNumber: quote.quoteNumber,
            referencia: stockItem?.REFERENCIA,
            materialName: material.name,
            quantity: cantidadAPedir,
            unit: material.unit,
            provider: material.provider,
            deliveryDays: deliveryDays,
            priority: priority,
            productSKU: item.catalogSKU,
            productName: item.productName,
            status: 'PENDING',
            createdAt: new Date()
          }
          
          purchases.push(purchase)
        } else {
          console.log(`  ⏭️ OMITIR: Hay suficiente stock`)
        }
      })
    })
    
    console.log(`\n✅ TOTAL PEDIDOS GENERADOS: ${purchases.length}`)
    
    // ORDENAR POR PRIORIDAD (mayor primero)
    return purchases.sort((a, b) => b.priority - a.priority)
  }

  private static generateLowStockPurchases(): PurchaseItem[] {
    const lowStockItems = StockService.getLowStockItems()
    const purchases: PurchaseItem[] = []
    
    lowStockItems.forEach(item => {
      const cantidadAPedir = (item.STOCK_MINIMO || 0) - item.CANTIDAD + (item.STOCK_MINIMO || 0) // Pedir para reponer + margen
      
      if (cantidadAPedir > 0) {
        const purchase: PurchaseItem = {
          id: `lowstock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          referencia: item.REFERENCIA,
          materialName: item.ARTICULO,
          quantity: cantidadAPedir,
          unit: item.UNIDAD,
          priority: 8, // Alta prioridad para reposición
          status: 'PENDING',
          createdAt: new Date(),
          notes: `⚠️ REPOSICIÓN AUTOMÁTICA - Stock bajo (${item.CANTIDAD} < ${item.STOCK_MINIMO})`
        }
        
        purchases.push(purchase)
      }
    })
    
    return purchases
  }
  
  private static extractMaterials(item: QuoteItem): Array<{
    name: string
    quantity: number
    unit: string
    provider?: string
    deliveryDays?: number
  }> {
    const materials: Array<{
      name: string
      quantity: number
      unit: string
      provider?: string
      deliveryDays?: number
    }> = []
    
    console.log('  🔍 Extrayendo materiales de catalogData...')

    // Extraer de MATERIAL_X
    for (let i = 1; i <= 5; i++) {
      const matKey = `MATERIAL_${i}` as keyof typeof item.catalogData
      const cantKey = `MATERIAL_${i}_CANT` as keyof typeof item.catalogData
      const unidadKey = `MATERIAL_${i}_UNIDAD` as keyof typeof item.catalogData
      
      const materialName = item.catalogData[matKey]
      const cantidad = parseFloat(String(item.catalogData[cantKey] || 0))
      const unidad = item.catalogData[unidadKey] as string || 'ud'
      
      if (materialName && cantidad > 0) {
        console.log(`    MATERIAL_${i}:`, materialName, cantidad, unidad)
        materials.push({
          name: String(materialName),
          quantity: cantidad * item.quantity,
          unit: unidad,
          provider: item.catalogData.PROVEEDOR as string,
          deliveryDays: parseInt(String(item.catalogData.DIAS_ENTREGA_PROVEEDOR || 7))
        })
      }
    }
    
    // Extraer de CONSUMIBLE_X
    for (let i = 1; i <= 10; i++) {
      const consKey = `CONSUMIBLE_${i}` as keyof typeof item.catalogData
      const cantKey = `CONSUMIBLE_${i}_CANT` as keyof typeof item.catalogData
      const unidadKey = `CONSUMIBLE_${i}_UNIDAD` as keyof typeof item.catalogData
      
      const consumibleName = item.catalogData[consKey]
      const cantidad = parseFloat(String(item.catalogData[cantKey] || 0))
      const unidad = item.catalogData[unidadKey] as string || 'ud'
      
      if (consumibleName && cantidad > 0) {
        console.log(`    CONSUMIBLE_${i}:`, consumibleName, cantidad, unidad)
        materials.push({
          name: String(consumibleName),
          quantity: cantidad * item.quantity,
          unit: unidad,
          provider: item.catalogData.PROVEEDOR as string,
          deliveryDays: parseInt(String(item.catalogData.DIAS_ENTREGA_PROVEEDOR || 7))
        })
      }
    }
    
    console.log(`  Total materiales encontrados: ${materials.length}`)
    
    return materials
  }
  
  private static generateProductionTasks(quote: Quote): any[] {
    const tasks: any[] = []
    const projectId = quote.id.slice(-5)
    
    quote.items.forEach((item: QuoteItem) => {
      // Extraer tareas del producto
      for (let i = 1; i <= 12; i++) {
        const tareaKey = `TAREA_${i}_NOMBRE` as keyof typeof item.catalogData
        const duracionKey = `TAREA_${i}_DURACION` as keyof typeof item.catalogData
        const requiereMaterialKey = `TAREA_${i}_REQUIERE_MATERIAL` as keyof typeof item.catalogData
        const requiereDiseñoKey = `TAREA_${i}_REQUIERE_DISEÑO` as keyof typeof item.catalogData
        
        const tareaNombre = item.catalogData[tareaKey]
        const duracion = parseFloat(String(item.catalogData[duracionKey] || 0))
        const requiereMaterial = item.catalogData[requiereMaterialKey] === 'SI' || item.catalogData[requiereMaterialKey] === true
        const requiereDiseño = item.catalogData[requiereDiseñoKey] === 'SI' || item.catalogData[requiereDiseñoKey] === true
        
        if (tareaNombre && duracion > 0) {
          const task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            projectId,
            projectNumber: quote.quoteNumber,
            productSKU: item.catalogSKU,
            productName: item.productName,
            taskName: String(tareaNombre),
            duration: duracion,
            requiresMaterial: requiereMaterial,
            requiresDesign: requiereDiseño,
            blocked: requiereMaterial || requiereDiseño,
            status: (requiereMaterial || requiereDiseño) ? 'BLOCKED' : 'READY',
            assignedTo: null,
            createdAt: new Date()
          }
          
          tasks.push(task)
        }
      }
    })
    
    return tasks
  }
  
  private static generateDesignInstructions(quote: Quote): any[] {
    const designs: any[] = []
    const projectId = quote.id.slice(-5)
    
    quote.items.forEach((item: QuoteItem) => {
      const requiereDiseno = item.catalogData.REQUIERE_DISEÑO === 'SI' || item.catalogData.REQUIERE_DISEÑO === true
      
      if (requiereDiseno) {
        const design = {
          id: `design-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          projectId,
          projectNumber: quote.quoteNumber,
          productSKU: item.catalogSKU,
          productName: item.productName,
          designType: item.catalogData.TIPO_DISEÑO || 'GENERAL',
          instructions: item.catalogData.INSTRUCCIONES_DISEÑO || 'Sin instrucciones específicas',
          status: 'PENDING',
          createdAt: new Date()
        }
        
        designs.push(design)
      }
    })
    
    return designs
  }
}