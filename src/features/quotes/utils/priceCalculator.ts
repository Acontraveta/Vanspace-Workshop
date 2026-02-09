import { BusinessLine, CatalogProduct, QuoteItem } from '../types/quote.types'

export class PriceCalculator {
  // Calcular item del presupuesto
  static calculateQuoteItem(
    product: CatalogProduct,
    quantity: number,
    businessLine: BusinessLine
  ): QuoteItem {
    console.group('💰 Calculando QuoteItem')
    console.log('Producto recibido:', product)
    console.log('PRECIO_COMPRA raw:', product.PRECIO_COMPRA)
    console.log('Tipo de PRECIO_COMPRA:', typeof product.PRECIO_COMPRA)
    
    const laborHours = (product.TIEMPO_TOTAL_MIN || 0) / 60
    
    // CONVERTIR SIEMPRE A NÚMERO
    let precioCompra = 0
    if (product.PRECIO_COMPRA !== null && product.PRECIO_COMPRA !== undefined) {
      precioCompra = Number(product.PRECIO_COMPRA)
    }
    
    console.log('Precio compra convertido:', precioCompra)
    console.log('Es NaN?:', isNaN(precioCompra))
    
    const materialCost = precioCompra * quantity
    const laborCost = laborHours * businessLine.hourlyRate * quantity
    const subtotal = materialCost + laborCost
    const profitAmount = subtotal * (businessLine.profitMargin / 100)
    const totalCost = subtotal + profitAmount

    console.log('Cálculos:', {
      precioCompra,
      quantity,
      materialCost,
      laborHours,
      laborCost,
      subtotal,
      profitAmount,
      totalCost
    })
    console.groupEnd()

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      catalogSKU: product.SKU,
      productName: product.NOMBRE,
      quantity,
      laborHours,
      materialCost,
      laborCost,
      subtotal,
      profitMargin: businessLine.profitMargin,
      profitAmount,
      totalCost,
      catalogData: product
    }
  }

  // Calcular totales del presupuesto
  static calculateQuoteTotals(
    items: QuoteItem[],
    businessLine: BusinessLine
  ): {
    subtotalMaterials: number
    subtotalLabor: number
    subtotal: number
    profitAmount: number
    total: number
  } {
    // Sumar todos los materiales (usar materialCost si está disponible)
    const subtotalMaterials = items.reduce((sum, item) => sum + (item.materialCost ?? 0), 0)
    
    // Sumar toda la mano de obra
    const subtotalLabor = items.reduce((sum, item) => sum + (item.laborCost ?? 0), 0)
    
    // Subtotal
    const subtotal = subtotalMaterials + subtotalLabor
    
    // Calcular margen de beneficio
    const profitAmount = subtotal * (businessLine.profitMargin / 100)
    
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
