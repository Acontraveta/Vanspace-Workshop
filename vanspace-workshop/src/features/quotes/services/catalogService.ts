import * as XLSX from 'xlsx'
import { CatalogProduct } from '../types/quote.types'

export class CatalogService {
  private static products: CatalogProduct[] = []

  // Importar catálogo desde archivo Excel
  static async importFromFile(file: File): Promise<CatalogProduct[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          
          // Leer la primera hoja
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          
          // Convertir a JSON (empezar desde fila 2, fila 1 son headers)
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            range: 1,
            raw: false,
            defval: null
          })
          
          // Parsear productos
          const products = jsonData.map((row: any) => this.parseProduct(row))
          
          // Guardar en memoria y localStorage
          this.products = products
          localStorage.setItem('catalog_products', JSON.stringify(products))
          
          resolve(products)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = (error) => reject(error)
      reader.readAsBinaryString(file)
    })
  }

  // Parsear un producto del Excel (estructura REAL)
  private static parseProduct(row: any): CatalogProduct {
    const product: CatalogProduct = {
      SKU: row['SKU'] || '',
      CATEGORIA: row['CATEGORIA'] || '',
      NOMBRE: row['NOMBRE'] || '',
      DESCRIPCION: row['DESCRIPCION'],
      PRECIO_COMPRA: parseFloat(row['PRECIO_COMPRA']) || 0,
      PROVEEDOR: row['PROVEEDOR'],
      DIAS_ENTREGA_PROVEEDOR: parseInt(row['DIAS_ENTREGA_PROVEEDOR']) || 0,
      TIEMPO_TOTAL_MIN: parseFloat(row['TIEMPO_TOTAL_MIN']) || 0,
      REQUIERE_DISEÑO: row['REQUIERE_DISEÑO'] || 'NO',
      TIPO_DISEÑO: row['TIPO_DISEÑO'],
      INSTRUCCIONES_DISEÑO: row['INSTRUCCIONES_DISEÑO'],
    } as CatalogProduct
    
    // Materiales (1-5)
    for (let i = 1; i <= 5; i++) {
      const prefix = `MATERIAL_${i}`
      Object.assign(product, {
        [`${prefix}`]: row[prefix],
        [`${prefix}_CANT`]: parseFloat(row[`${prefix}_CANT`]) || 0,
        [`${prefix}_UNIDAD`]: row[`${prefix}_UNIDAD`],
      })
    }
    
    // Consumibles (1-10)
    for (let i = 1; i <= 10; i++) {
      const prefix = `CONSUMIBLE_${i}`
      Object.assign(product, {
        [`${prefix}`]: row[prefix],
        [`${prefix}_CANT`]: parseFloat(row[`${prefix}_CANT`]) || 0,
        [`${prefix}_UNIDAD`]: row[`${prefix}_UNIDAD`],
      })
    }
    
    // Tareas (1-12)
    for (let i = 1; i <= 12; i++) {
      const prefix = `TAREA_${i}`
      Object.assign(product, {
        [`${prefix}_NOMBRE`]: row[`${prefix}_NOMBRE`],
        [`${prefix}_DURACION`]: parseFloat(row[`${prefix}_DURACION`]) || 0,
        [`${prefix}_REQUIERE_MATERIAL`]: row[`${prefix}_REQUIERE_MATERIAL`],
        [`${prefix}_REQUIERE_DISEÑO`]: row[`${prefix}_REQUIERE_DISEÑO`],
      })
    }
    
    return product
  }

  // Cargar productos de localStorage
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

  // Obtener todos los productos
  static getProducts(): CatalogProduct[] {
    if (this.products.length === 0) {
      this.products = this.loadFromLocalStorage()
    }
    return this.products
  }

  // Buscar producto por SKU
  static getProductBySKU(sku: string): CatalogProduct | undefined {
    return this.getProducts().find(p => p.SKU === sku)
  }

  // Obtener categorías únicas
  static getCategories(): string[] {
    const categories = this.getProducts().map(p => p.CATEGORIA)
    return [...new Set(categories)].filter(Boolean)
  }

  // Calcular costo de materiales de un producto (usar PRECIO_COMPRA del catálogo)
  static calculateMaterialsCost(product: CatalogProduct, quantity: number = 1): number {
    // Usamos el PRECIO_COMPRA del producto que ya incluye todos los materiales
    return (product.PRECIO_COMPRA || 0) * quantity
  }

  // Calcular horas de trabajo
  static calculateLaborHours(product: CatalogProduct, quantity: number = 1): number {
    return (product.TIEMPO_TOTAL_MIN * quantity) / 60
  }
  
  // Obtener lista de materiales de un producto (para generar lista de compra)
  static getProductMaterials(product: CatalogProduct): Array<{name: string, quantity: number, unit: string}> {
    const materials: Array<{name: string, quantity: number, unit: string}> = []
    
    // Materiales
    for (let i = 1; i <= 5; i++) {
      const name = product[`MATERIAL_${i}` as keyof CatalogProduct] as string
      const qty = product[`MATERIAL_${i}_CANT` as keyof CatalogProduct] as number
      const unit = product[`MATERIAL_${i}_UNIDAD` as keyof CatalogProduct] as string
      
      if (name && qty) {
        materials.push({ name, quantity: qty, unit: unit || 'ud' })
      }
    }
    
    // Consumibles
    for (let i = 1; i <= 10; i++) {
      const name = product[`CONSUMIBLE_${i}` as keyof CatalogProduct] as string
      const qty = product[`CONSUMIBLE_${i}_CANT` as keyof CatalogProduct] as number
      const unit = product[`CONSUMIBLE_${i}_UNIDAD` as keyof CatalogProduct] as string
      
      if (name && qty) {
        materials.push({ name, quantity: qty, unit: unit || 'ud' })
      }
    }
    
    return materials
  }
  
  // Obtener tareas de un producto (para generar tareas de producción)
  static getProductTasks(product: CatalogProduct): Array<{
    name: string
    duration: number
    requiresMaterial: boolean
    requiresDesign: boolean
  }> {
    const tasks: Array<{name: string, duration: number, requiresMaterial: boolean, requiresDesign: boolean}> = []
    
    for (let i = 1; i <= 12; i++) {
      const name = product[`TAREA_${i}_NOMBRE` as keyof CatalogProduct] as string
      const duration = product[`TAREA_${i}_DURACION` as keyof CatalogProduct] as number
      const reqMat = product[`TAREA_${i}_REQUIERE_MATERIAL` as keyof CatalogProduct] as string
      const reqDes = product[`TAREA_${i}_REQUIERE_DISEÑO` as keyof CatalogProduct] as string
      
      if (name && duration) {
        tasks.push({
          name,
          duration,
          requiresMaterial: reqMat === 'SÍ',
          requiresDesign: reqDes === 'SÍ',
        })
      }
    }
    
    return tasks
  }
}
