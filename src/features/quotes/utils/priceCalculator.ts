import { Tarifa, CatalogProduct, QuoteItem } from '../types/quote.types'

export class PriceCalculator {
  // Calcular item del presupuesto
  static calculateQuoteItem(
    product: CatalogProduct,
    quantity: number,
    tarifa: Tarifa
  ): QuoteItem {
    const laborHours = (product.TIEMPO_TOTAL_MIN || 0) / 60
    
    // Usar precio de venta si está definido; si no, precio de compra como fallback
    let unitPrice = 0
    if (product['PRECIO DE VENTA'] !== null && product['PRECIO DE VENTA'] !== undefined && Number(product['PRECIO DE VENTA']) > 0) {
      unitPrice = Number(product['PRECIO DE VENTA'])
    } else if (product.PRECIO_COMPRA !== null && product.PRECIO_COMPRA !== undefined) {
      unitPrice = Number(product.PRECIO_COMPRA)
    }
    
    const materialCost = unitPrice * quantity
    const laborCost = laborHours * tarifa.hourlyRate * quantity
    const subtotal = materialCost + laborCost
    const profitAmount = subtotal * (tarifa.profitMargin / 100)
    const totalCost = subtotal + profitAmount

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      catalogSKU: product.SKU,
      productName: product.NOMBRE,
      quantity,
      laborHours,
      materialsTotal: materialCost,
      laborCost,
      totalCost,
      catalogData: product
    }
  }

  // Calcular totales del presupuesto
  static calculateQuoteTotals(
    items: QuoteItem[],
    tarifa: Tarifa
  ): {
    subtotalMaterials: number
    subtotalLabor: number
    subtotal: number
    profitAmount: number
    total: number
  } {
    // Sumar todos los materiales (usar materialCost si está disponible)
    const subtotalMaterials = items.reduce((sum, item) => sum + (item.materialsTotal ?? 0), 0)
    
    // Sumar toda la mano de obra
    const subtotalLabor = items.reduce((sum, item) => sum + (item.laborCost ?? 0), 0)
    
    // Subtotal
    const subtotal = subtotalMaterials + subtotalLabor
    
    // Calcular margen de beneficio
    const profitAmount = subtotal * (tarifa.profitMargin / 100)
    
    // Total final
    const total = subtotal + profitAmount
    
    return {
      subtotalMaterials,
      subtotalLabor,
      subtotal,
      profitAmount,
      total,
    }
  }

  // Generar número de presupuesto
  static generateQuoteNumber(): string {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `QUO-${year}${month}-${random}`
  }

  // Calcular fecha de validez (30 días por defecto)
  static calculateValidUntil(days: number = 30): Date {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
  }
}
