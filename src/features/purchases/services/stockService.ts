import * as XLSX from 'xlsx'
import { StockItem } from '../types/purchase.types'
import { downloadExcel, supabase } from '@/lib/supabase'

export function parseUbicacion(ubicacion?: string): { estanteria: number, nivel: number, hueco: number } | null {
  if (!ubicacion || ubicacion.length < 3) return null
  
  const estanteria = parseInt(ubicacion[0])
  const nivel = parseInt(ubicacion[1])
  const hueco = parseInt(ubicacion[2])
  
  if (isNaN(estanteria) || isNaN(nivel) || isNaN(hueco)) return null
  
  return { estanteria, nivel, hueco }
}

export class StockService {
  private static stock: StockItem[] = []
  private static EXCEL_PATH = 'stock.xlsx'

  static async loadFromSupabase(): Promise<StockItem[]> {
    try {
      console.log('📥 Cargando stock desde Supabase Storage...')
      
      const blob = await downloadExcel(this.EXCEL_PATH)
      const arrayBuffer = await blob.arrayBuffer()
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null })
      
      const headers = aoa[1] as string[]
      const items: StockItem[] = []
      
      for (let i = 2; i < aoa.length; i++) {
        const row = aoa[i] as any[]
        const rowObj: any = {}
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx]
        })
        
        if (rowObj['Referencia'] || rowObj['Artículo']) {
          items.push(this.parseStockItem(rowObj))
        }
      }
      
      console.log('✅ Stock cargado:', items.length, 'items')
      
      this.stock = items
      localStorage.setItem('stock_items', JSON.stringify(items))
      localStorage.setItem('stock_last_sync', new Date().toISOString())
      
      return items
      
    } catch (error) {
      console.error('❌ Error cargando stock:', error)
      return this.loadFromLocalStorage()
    }
  }

  private static parseStockItem(row: any): StockItem {
    return {
      REFERENCIA: String(row['Referencia'] || ''),
      FAMILIA: String(row['Familia'] || ''),
      CATEGORIA: String(row['Categoría'] || ''),
      ARTICULO: String(row['Artículo'] || ''),
      DESCRIPCION: row['Descripción'] ? String(row['Descripción']) : undefined,
      CANTIDAD: parseFloat(row['Cantidad']) || 0,
      STOCK_MINIMO: parseFloat(row['Stock mínimo']) || undefined,
      UNIDAD: String(row['Unidad'] || 'ud'),
      COSTE_IVA_INCLUIDO: parseFloat(row['Coste IVA incluido']) || 0,
      UBICACION: row['Ubicación'] || row['UBICACION'] || row['Ubicacion'],  // NUEVO
    }
  }

  static loadFromLocalStorage(): StockItem[] {
    const stored = localStorage.getItem('stock_items')
    if (stored) {
      try {
        this.stock = JSON.parse(stored)
        return this.stock
      } catch (e) {
        return []
      }
    }
    return []
  }

  static getStock(): StockItem[] {
    if (this.stock.length === 0) {
      this.stock = this.loadFromLocalStorage()
    }
    return this.stock
  }

  static getItemByReference(ref: string): StockItem | undefined {
    return this.getStock().find(item => item.REFERENCIA === ref)
  }

  static findItemByName(name: string): StockItem | undefined {
    const normalized = name.toLowerCase().trim()
    return this.getStock().find(item => 
      item.ARTICULO?.toLowerCase().includes(normalized) ||
      item.DESCRIPCION?.toLowerCase().includes(normalized)
    )
  }

  static getFamilies(): string[] {
    const families = this.getStock().map(item => item.FAMILIA).filter(Boolean)
    return [...new Set(families)].sort()
  }

  static getCategoriesByFamily(family: string): string[] {
    const categories = this.getStock()
      .filter(item => item.FAMILIA === family)
      .map(item => item.CATEGORIA)
      .filter(Boolean)
    return [...new Set(categories)].sort()
  }

  static getLowStockItems(): StockItem[] {
    return this.getStock().filter(item => 
      item.STOCK_MINIMO && item.CANTIDAD < item.STOCK_MINIMO
    )
  }

  static updateStock(referencia: string, newQuantity: number): void {
    const items = this.getStock()
    const item = items.find(i => i.REFERENCIA === referencia)
    if (item) {
      item.CANTIDAD = newQuantity
      localStorage.setItem('stock_items', JSON.stringify(items))
      this.stock = items
    }
  }

  /**
   * Actualiza la cantidad en Supabase y re-exporta el Excel en Storage.
   * Úsalo para ediciones manuales desde la UI.
   */
  static async updateQuantity(referencia: string, newQuantity: number): Promise<void> {
    // 1. Supabase
    const { error } = await supabase
      .from('stock_items')
      .update({ cantidad: newQuantity })
      .eq('referencia', referencia)
    if (error) throw error

    // 2. Memoria + localStorage
    this.updateStock(referencia, newQuantity)

    // 3. Excel en Storage (no-blocking – fallo aquí no es crítico)
    import('@/lib/excelSync')
      .then(({ exportStockToExcel }) => exportStockToExcel())
      .catch(e => console.warn('⚠️ No se pudo actualizar stock.xlsx:', e))
  }

  /**
   * Añade un nuevo item al stock (desde compras recibidas).
   * Si ya existe un item con la misma referencia, suma la cantidad.
   */
  static addStockItem(newItem: StockItem): void {
    const items = this.getStock()
    const existing = items.find(i => i.REFERENCIA === newItem.REFERENCIA)

    if (existing) {
      // Si ya existe, sumar cantidad
      existing.CANTIDAD += newItem.CANTIDAD
      // Actualizar campos que puedan estar vacíos
      if (!existing.UBICACION && newItem.UBICACION) existing.UBICACION = newItem.UBICACION
      if (!existing.FAMILIA && newItem.FAMILIA) existing.FAMILIA = newItem.FAMILIA
      if (!existing.CATEGORIA && newItem.CATEGORIA) existing.CATEGORIA = newItem.CATEGORIA
      if (!existing.DESCRIPCION && newItem.DESCRIPCION) existing.DESCRIPCION = newItem.DESCRIPCION
    } else {
      items.push(newItem)
    }

    localStorage.setItem('stock_items', JSON.stringify(items))
    this.stock = items
  }

  static async updateLocation(referencia: string, ubicacion: string): Promise<void> {
    // Actualizar en Supabase
    const { error } = await supabase
      .from('stock_items')
      .update({ ubicacion })
      .eq('referencia', referencia)

    if (error) throw error

    // Actualizar en memoria y localStorage
    const items = this.getStock()
    const item = items.find(i => i.REFERENCIA === referencia)
    if (item) {
      item.UBICACION = ubicacion
      localStorage.setItem('stock_items', JSON.stringify(items))
      this.stock = items
    }

    // Re-exportar stock.xlsx en Storage (no-blocking)
    import('@/lib/excelSync')
      .then(({ exportStockToExcel }) => exportStockToExcel())
      .catch(e => console.warn('⚠️ No se pudo actualizar stock.xlsx tras ubicación:', e))
  }
}