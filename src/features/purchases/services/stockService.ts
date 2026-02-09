import * as XLSX from 'xlsx'
import { StockItem } from '../types/purchase.types'
import { downloadExcel } from '@/lib/supabase'

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
}