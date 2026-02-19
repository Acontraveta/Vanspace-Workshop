import * as XLSX from 'xlsx'
import { CatalogProduct } from '../types/quote.types'
import { downloadExcel } from '@/lib/supabase'

export class CatalogService {
  private static products: CatalogProduct[] = []
  private static EXCEL_PATH = 'catalogoproductos.xlsx'

  // Cargar catálogo desde Supabase Storage (solo lectura)
  static async loadFromSupabase(): Promise<CatalogProduct[]> {
    try {
      console.log('📥 Cargando catálogo desde Supabase Storage...')
      
      const blob = await downloadExcel(this.EXCEL_PATH)
      const arrayBuffer = await blob.arrayBuffer()
      
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      console.log('📊 Procesando Excel:', sheetName)
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: null
      })
      
      console.log('📦 Filas leídas:', jsonData.length)
      
      const products = jsonData.map((row: any) => this.parseProduct(row))
      const validProducts = products.filter(p => p.SKU && p.NOMBRE)
      
      console.log('✅ Productos válidos:', validProducts.length)
      
      // Guardar en memoria y caché
      this.products = validProducts
      localStorage.setItem('catalog_products', JSON.stringify(validProducts))
      localStorage.setItem('catalog_loaded', 'true')
      localStorage.setItem('catalog_last_sync', new Date().toISOString())
      
      return validProducts
      
    } catch (error) {
      console.error('❌ Error cargando catálogo:', error)
      
      // Intentar cargar desde caché local
      console.log('⚠️ Cargando desde caché local...')
      return this.loadFromLocalStorage()
    }
  }

  private static parseProduct(row: any): CatalogProduct {
    const product: any = {
      SKU: String(row['SKU'] || ''),
      FAMILIA: String(row['FAMILIA'] || ''),
      CATEGORIA: String(row['CATEGORIA'] || ''),
      NOMBRE: String(row['NOMBRE'] || ''),
      DESCRIPCION: row['DESCRIPCION'] || '',
      PRECIO_COMPRA: parseFloat(row['PRECIO_COMPRA']) || 0,
      'PRECIO DE VENTA': row['PRECIO DE VENTA'] ? parseFloat(row['PRECIO DE VENTA']) : undefined,
      PROVEEDOR: row['PROVEEDOR'] || '',
      DIAS_ENTREGA_PROVEEDOR: row['DIAS_ENTREGA_PROVEEDOR'] ? parseFloat(row['DIAS_ENTREGA_PROVEEDOR']) : undefined,
      TIEMPO_TOTAL_MIN: parseFloat(row['TIEMPO_TOTAL_MIN']) || 0,
      REQUIERE_DISEÑO: row['REQUIERE_DISEÑO'] || '',
      TIPO_DISEÑO: row['TIPO_DISEÑO'] || '',
      INSTRUCCIONES_DISEÑO: row['INSTRUCCIONES_DISEÑO'] || '',
    }

    // Materiales
    for (let i = 1; i <= 5; i++) {
      product[`MATERIAL_${i}`] = row[`MATERIAL_${i}`] || ''
      product[`MATERIAL_${i}_CANT`] = row[`MATERIAL_${i}_CANT`] ? parseFloat(row[`MATERIAL_${i}_CANT`]) : 0
      product[`MATERIAL_${i}_UNIDAD`] = row[`MATERIAL_${i}_UNIDAD`] || ''
    }

    // Consumibles
    for (let i = 1; i <= 10; i++) {
      product[`CONSUMIBLE_${i}`] = row[`CONSUMIBLE_${i}`] || ''
      product[`CONSUMIBLE_${i}_CANT`] = row[`CONSUMIBLE_${i}_CANT`] ? parseFloat(row[`CONSUMIBLE_${i}_CANT`]) : 0
      product[`CONSUMIBLE_${i}_UNIDAD`] = row[`CONSUMIBLE_${i}_UNIDAD`] || ''
    }

    // Tareas
    for (let i = 1; i <= 12; i++) {
      product[`TAREA_${i}_NOMBRE`] = row[`TAREA_${i}_NOMBRE`] || ''
      product[`TAREA_${i}_DURACION`] = row[`TAREA_${i}_DURACION`] ? parseFloat(row[`TAREA_${i}_DURACION`]) : 0
      product[`TAREA_${i}_REQUIERE_MATERIAL`] = row[`TAREA_${i}_REQUIERE_MATERIAL`] || ''
      product[`TAREA_${i}_REQUIERE_DISEÑO`] = row[`TAREA_${i}_REQUIERE_DISEÑO`] || ''
    }

    return product as CatalogProduct
  }

  static loadFromLocalStorage(): CatalogProduct[] {
    const stored = localStorage.getItem('catalog_products')
    if (stored) {
      try {
        this.products = JSON.parse(stored)
        return this.products
      } catch (e) {
        return []
      }
    }
    return []
  }

  static getProducts(): CatalogProduct[] {
    if (this.products.length === 0) {
      this.products = this.loadFromLocalStorage()
    }
    return this.products
  }

  static getFamilies(): string[] {
    const families = this.getProducts().map(p => p.FAMILIA).filter(Boolean)
    return [...new Set(families)].sort()
  }

  static getCategories(): string[] {
    const categories = this.getProducts().map(p => p.CATEGORIA).filter(Boolean)
    return [...new Set(categories)].sort()
  }

  // Sincronizar desde Storage (llamar al cargar la app)
  static async syncFromStorage(): Promise<void> {
    const lastSync = localStorage.getItem('catalog_last_sync')
    const now = new Date()
    
    // Sincronizar si no hay sync previo o pasaron más de 1 hora
    if (!lastSync || (now.getTime() - new Date(lastSync).getTime() > 3600000)) {
      console.log('🔄 Sincronizando catálogo desde Storage...')
      await this.loadFromSupabase()
    }
  }
}