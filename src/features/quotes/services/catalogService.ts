import * as XLSX from 'xlsx'
import { CatalogProduct } from '../types/quote.types'
import { downloadExcel, uploadExcel, supabase } from '@/lib/supabase'

export class CatalogService {
  private static products: CatalogProduct[] = []
  private static EXCEL_PATH = 'catalogoproductos.xlsx'

  // Cargar catálogo desde Supabase Storage + DB (fusiona ambos)
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
      
      const excelProducts = jsonData.map((row: any) => this.parseProduct(row))
        .filter(p => p.SKU && p.NOMBRE)
      
      // También cargar productos de la tabla catalog_products (añadidos vía formulario)
      let dbProducts: CatalogProduct[] = []
      try {
        const { data: dbRows } = await supabase
          .from('catalog_products')
          .select('*')
          .order('sku')
        dbProducts = (dbRows || []).map((p: any) => this.dbRowToProduct(p))
      } catch { /* DB table may not exist yet */ }

      // Fusionar: DB products tienen prioridad (son los más recientes)
      const dbSKUs = new Set(dbProducts.map(p => p.SKU))
      const merged = [
        ...excelProducts.filter(p => !dbSKUs.has(p.SKU)),
        ...dbProducts,
      ]
      
      console.log('✅ Productos finales:', merged.length, `(${excelProducts.length} Excel + ${dbProducts.length} DB, ${merged.length} tras fusión)`)
      
      // Guardar en memoria y caché
      this.products = merged
      localStorage.setItem('catalog_products', JSON.stringify(merged))
      localStorage.setItem('catalog_loaded', 'true')
      localStorage.setItem('catalog_last_sync', new Date().toISOString())
      
      return merged
      
    } catch (error) {
      console.error('❌ Error cargando catálogo:', error)
      
      // Intentar cargar desde caché local
      console.log('⚠️ Cargando desde caché local...')
      return this.loadFromLocalStorage()
    }
  }

  /** Convierte una fila de la tabla catalog_products (snake_case) a CatalogProduct */
  private static dbRowToProduct(p: any): CatalogProduct {
    const product: any = {
      SKU: p.sku,
      FAMILIA: p.familia,
      CATEGORIA: p.categoria,
      NOMBRE: p.nombre,
      DESCRIPCION: p.descripcion,
      PRECIO_COMPRA: p.precio_compra,
      'PRECIO DE VENTA': p.precio_venta,
      PROVEEDOR: p.proveedor,
      DIAS_ENTREGA_PROVEEDOR: p.dias_entrega_proveedor,
      TIEMPO_TOTAL_MIN: p.tiempo_total_min,
      REQUIERE_DISEÑO: p.requiere_diseno,
      TIPO_DISEÑO: p.tipo_diseno,
      INSTRUCCIONES_DISEÑO: p.instrucciones_diseno,
    }
    const materiales = p.materiales || []
    for (let i = 0; i < 5; i++) {
      const mat = materiales[i] || {}
      product[`MATERIAL_${i + 1}`]        = mat.nombre || ''
      product[`MATERIAL_${i + 1}_CANT`]   = mat.cantidad || 0
      product[`MATERIAL_${i + 1}_UNIDAD`] = mat.unidad || ''
    }
    const consumibles = p.consumibles || []
    for (let i = 0; i < 10; i++) {
      const cons = consumibles[i] || {}
      product[`CONSUMIBLE_${i + 1}`]        = cons.nombre || ''
      product[`CONSUMIBLE_${i + 1}_CANT`]   = cons.cantidad || 0
      product[`CONSUMIBLE_${i + 1}_UNIDAD`] = cons.unidad || ''
    }
    const tareas = p.tareas || []
    for (let i = 0; i < 12; i++) {
      const t = tareas[i] || {}
      product[`TAREA_${i + 1}_NOMBRE`]            = t.nombre || ''
      product[`TAREA_${i + 1}_DURACION`]           = t.duracion || 0
      product[`TAREA_${i + 1}_REQUIERE_MATERIAL`]  = t.requiere_material || ''
      product[`TAREA_${i + 1}_REQUIERE_DISEÑO`]    = t.requiere_diseno || ''
    }
    return product as CatalogProduct
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

  /**
   * Añadir un producto nuevo al catálogo:
   *  1. Inserta en la tabla `catalog_products` de Supabase
   *  2. Actualiza la memoria local y el localStorage
   *  3. Re-exporta el Excel de catálogo a Storage para mantenerlo sincronizado
   */
  static async addProduct(product: CatalogProduct): Promise<void> {
    // Preparar fila para la BD (formato snake_case, materiales/consumibles/tareas compactos)
    const materiales: { nombre: string; cantidad: number; unidad: string }[] = []
    for (let i = 1; i <= 5; i++) {
      const nombre = (product as any)[`MATERIAL_${i}`]
      if (nombre) {
        materiales.push({
          nombre,
          cantidad: (product as any)[`MATERIAL_${i}_CANT`] || 0,
          unidad:   (product as any)[`MATERIAL_${i}_UNIDAD`] || '',
        })
      }
    }
    const consumibles: { nombre: string; cantidad: number; unidad: string }[] = []
    for (let i = 1; i <= 10; i++) {
      const nombre = (product as any)[`CONSUMIBLE_${i}`]
      if (nombre) {
        consumibles.push({
          nombre,
          cantidad: (product as any)[`CONSUMIBLE_${i}_CANT`] || 0,
          unidad:   (product as any)[`CONSUMIBLE_${i}_UNIDAD`] || '',
        })
      }
    }
    const tareas: { nombre: string; duracion: number; requiere_material: string; requiere_diseno: string }[] = []
    for (let i = 1; i <= 12; i++) {
      const nombre = (product as any)[`TAREA_${i}_NOMBRE`]
      if (nombre) {
        tareas.push({
          nombre,
          duracion:          (product as any)[`TAREA_${i}_DURACION`] || 0,
          requiere_material: (product as any)[`TAREA_${i}_REQUIERE_MATERIAL`] || '',
          requiere_diseno:   (product as any)[`TAREA_${i}_REQUIERE_DISEÑO`] || '',
        })
      }
    }

    const row = {
      sku:                     product.SKU,
      familia:                 product.FAMILIA,
      categoria:               product.CATEGORIA,
      nombre:                  product.NOMBRE,
      descripcion:             product.DESCRIPCION || null,
      precio_compra:           product.PRECIO_COMPRA || 0,
      precio_venta:            product['PRECIO DE VENTA'] ?? null,
      proveedor:               product.PROVEEDOR || null,
      dias_entrega_proveedor:  product.DIAS_ENTREGA_PROVEEDOR ?? null,
      tiempo_total_min:        product.TIEMPO_TOTAL_MIN || 0,
      requiere_diseno:         product.REQUIERE_DISEÑO || 'NO',
      tipo_diseno:             product.TIPO_DISEÑO || null,
      instrucciones_diseno:    product.INSTRUCCIONES_DISEÑO || null,
      materiales,
      consumibles,
      tareas,
    }

    const { error } = await supabase.from('catalog_products').upsert(row, { onConflict: 'sku' })
    if (error) throw new Error('Error guardando producto en catálogo: ' + error.message)

    // Añadir a memoria local e invalidar caché
    this.products = this.products.filter(p => p.SKU !== product.SKU)
    this.products.push(product)
    localStorage.setItem('catalog_products', JSON.stringify(this.products))
    localStorage.setItem('catalog_last_sync', new Date().toISOString())

    // Re-exportar el Excel a Storage en background
    this.reExportExcel().catch(err => console.warn('Re-export Excel failed:', err))
  }

  /**
   * Eliminar un producto del catálogo por SKU.
   * 1. Borra de Supabase catalog_products
   * 2. Elimina de memoria local y localStorage
   * 3. Re-exporta el Excel sin ese producto (await para evitar race conditions)
   */
  static async deleteProduct(sku: string): Promise<void> {
    // Borrar de Supabase
    const { error } = await supabase.from('catalog_products').delete().eq('sku', sku)
    if (error) {
      console.warn('⚠️ Error borrando de catalog_products:', error.message)
      // Puede que el producto solo existiera en el Excel, continuar igualmente
    }

    // Eliminar de memoria local
    this.products = this.products.filter(p => p.SKU !== sku)
    localStorage.setItem('catalog_products', JSON.stringify(this.products))
    localStorage.setItem('catalog_last_sync', new Date().toISOString())

    // Re-exportar el Excel sin ese producto — AWAIT para que loadCatalog() lea el Excel actualizado
    try {
      await this.reExportExcel()
    } catch (err) {
      console.warn('Re-export Excel failed:', err)
    }
  }

  /**
   * Re-genera el Excel de catálogo usando this.products (fuente de verdad in-memory).
   * NO re-descarga el Excel existente para evitar que productos eliminados reaparezcan.
   */
  private static async reExportExcel(): Promise<void> {
    // Use in-memory products as the single source of truth.
    // This ensures deleted products don't creep back from an old Excel file.
    const merged = [...this.products]

    if (merged.length === 0) return

    // 4. Build Excel from merged products
    const rows = merged.map((p: any) => {
      const row: any = {
        SKU: p.SKU,
        FAMILIA: p.FAMILIA,
        CATEGORIA: p.CATEGORIA,
        NOMBRE: p.NOMBRE,
        DESCRIPCION: p.DESCRIPCION,
        PRECIO_COMPRA: p.PRECIO_COMPRA,
        'PRECIO DE VENTA': p['PRECIO DE VENTA'],
        PROVEEDOR: p.PROVEEDOR,
        DIAS_ENTREGA_PROVEEDOR: p.DIAS_ENTREGA_PROVEEDOR,
        TIEMPO_TOTAL_MIN: p.TIEMPO_TOTAL_MIN,
        'REQUIERE_DISEÑO': p.REQUIERE_DISEÑO,
        'TIPO_DISEÑO': p.TIPO_DISEÑO,
        'INSTRUCCIONES_DISEÑO': p.INSTRUCCIONES_DISEÑO,
      }
      for (let i = 1; i <= 5; i++) {
        row[`MATERIAL_${i}`]        = p[`MATERIAL_${i}`] || ''
        row[`MATERIAL_${i}_CANT`]   = p[`MATERIAL_${i}_CANT`] || 0
        row[`MATERIAL_${i}_UNIDAD`] = p[`MATERIAL_${i}_UNIDAD`] || ''
      }
      for (let i = 1; i <= 10; i++) {
        row[`CONSUMIBLE_${i}`]        = p[`CONSUMIBLE_${i}`] || ''
        row[`CONSUMIBLE_${i}_CANT`]   = p[`CONSUMIBLE_${i}_CANT`] || 0
        row[`CONSUMIBLE_${i}_UNIDAD`] = p[`CONSUMIBLE_${i}_UNIDAD`] || ''
      }
      for (let i = 1; i <= 12; i++) {
        row[`TAREA_${i}_NOMBRE`]            = p[`TAREA_${i}_NOMBRE`] || ''
        row[`TAREA_${i}_DURACION`]           = p[`TAREA_${i}_DURACION`] || 0
        row[`TAREA_${i}_REQUIERE_MATERIAL`]  = p[`TAREA_${i}_REQUIERE_MATERIAL`] || ''
        row[`TAREA_${i}_REQUIERE_DISEÑO`]    = p[`TAREA_${i}_REQUIERE_DISEÑO`] || ''
      }
      return row
    })

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const file = new File([blob], 'catalogoproductos.xlsx')
    await uploadExcel(file, 'catalogoproductos.xlsx')

    console.log('✅ Excel de catálogo re-exportado:', merged.length, 'productos')
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