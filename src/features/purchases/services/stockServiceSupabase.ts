import * as XLSX from 'xlsx'
import { StockItem } from '../types/purchase.types'
import { uploadExcel, downloadExcel } from '@/lib/supabase'

export class StockServiceSupabase {
  private static stock: StockItem[] = []
  private static EXCEL_PATH = 'stock_inventario.xlsx'

  static async uploadStockToStorage(file: File): Promise<void> {
    await uploadExcel(file, this.EXCEL_PATH)
  }

  static async importFromStorage(): Promise<StockItem[]> {
    try {
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
      
      this.stock = items
      localStorage.setItem('stock_items', JSON.stringify(items))
      localStorage.setItem('stock_last_sync', new Date().toISOString())
      
      return items
    } catch (error) {
      console.error('Error importando stock:', error)
      return this.loadFromLocalStorage()
    }
  }

  static async importFromFile(file: File): Promise<StockItem[]> {
    await this.uploadStockToStorage(file)
    return await this.importFromStorage()
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
      UBICACION: row['Ubicación'] || row['UBICACION'] || row['Ubicacion'],
    }
  }

  static loadFromLocalStorage(): StockItem[] {
    const stored = localStorage.getItem('stock_items')
    if (stored) {
      try {
        return JSON.parse(stored)
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

  // ... resto de métodos igual que StockService
}
