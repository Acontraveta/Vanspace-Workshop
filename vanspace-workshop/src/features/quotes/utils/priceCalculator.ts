import { BusinessLine, CatalogProduct, QuoteItem, Quote } from '../types/quote.types'
import { CatalogService } from '../services/catalogService'

export class PriceCalculator {
  // Calcular item del presupuesto
  static calculateQuoteItem(
    product: CatalogProduct,
    quantity: number,
    businessLine: BusinessLine
  ): QuoteItem {
    // Calcular costo de materiales
    const materialsTotal = CatalogService.calculateMaterialsCost(product, quantity)
    
    // Calcular horas de mano de obra
    const laborHours = CatalogService.calculateLaborHours(product, quantity)
    
    // Calcular costo de mano de obra
    const laborCost = laborHours * businessLine.hourlyRate
    
    // Total del item
    const totalCost = materialsTotal + laborCost
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      catalogSKU: product.SKU,
      productName: product.NOMBRE,
      quantity,
      materialsTotal,
      laborHours,
      laborCost,
      totalCost,
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
    // Sumar todos los materiales
    const subtotalMaterials = items.reduce((sum, item) => sum + item.materialsTotal, 0)
    
    // Sumar toda la mano de obra
    const subtotalLabor = items.reduce((sum, item) => sum + item.laborCost, 0)
    
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
