import { supabase } from '@/lib/supabase'
import { CatalogMaterial } from '../types/furniture.types'
import { DEFAULT_CATALOG_MATERIALS } from '../constants/furniture.constants'

const TABLE = 'material_catalog'

/** Keywords in stock item names/categories that indicate board materials */
const BOARD_KEYWORDS = [
  'tablero', 'contrachapado', 'melamina', 'mdf', 'dm ', 'dm-',
  'aglomerado', 'fenólico', 'hpl', 'osb', 'okume', 'okoumé',
  'fibra', 'chopo', 'abedul', 'pino macizo', 'roble macizo',
  'madera maciza', 'panel',
]

/** Category keywords that indicate boards */
const BOARD_CATEGORIES = [
  'tableros', 'madera', 'paneles', 'contrachapados', 'melaminas',
]

/** Map a stock item to CatalogMaterial format */
function stockItemToCatalogMaterial(item: any): CatalogMaterial | null {
  const name = (item.articulo || item.referencia || '').toLowerCase()
  const cat  = (item.categoria || '').toLowerCase()
  const fam  = (item.familia || '').toLowerCase()
  const desc = (item.descripcion || '').toLowerCase()

  const isBoard =
    BOARD_KEYWORDS.some(kw => name.includes(kw) || desc.includes(kw) || fam.includes(kw)) ||
    BOARD_CATEGORIES.some(kw => cat.includes(kw) || fam.includes(kw))

  if (!isBoard) return null

  // Try to detect thickness from name (e.g. "16mm", "18 mm")
  const thickMatch = (item.articulo || item.descripcion || '').match(/(\d+)\s*mm/i)
  const thickness = thickMatch ? parseInt(thickMatch[1]) : 16

  // Try to detect board dimensions from name (e.g. "2440x1220")
  const dimMatch = (item.articulo || item.descripcion || '').match(/(\d{3,4})\s*[xX×]\s*(\d{3,4})/)
  const boardW = dimMatch ? parseInt(dimMatch[1]) : 2440
  const boardH = dimMatch ? parseInt(dimMatch[2]) : 1220

  // Determine category
  let category: CatalogMaterial['category'] = 'otro'
  if (name.includes('contrachapado') || name.includes('chopo') || name.includes('abedul') || name.includes('okume')) category = 'contrachapado'
  else if (name.includes('melamina')) category = 'melamina'
  else if (name.includes('mdf') || name.includes('dm ') || name.includes('dm-') || name.includes('hidrófugo')) category = 'dm'
  else if (name.includes('hpl')) category = 'hpl'
  else if (name.includes('pino') || name.includes('roble') || name.includes('maciz')) category = 'madera'

  // Price per m² from purchase cost
  const areaM2 = (boardW / 1000) * (boardH / 1000)
  const pricePerM2 = item.coste_iva_incluido && areaM2 > 0
    ? Math.round((item.coste_iva_incluido / areaM2) * 100) / 100
    : 30

  return {
    id: `stock-${item.referencia}`,
    name: item.articulo || item.referencia,
    thickness,
    price_per_m2: pricePerM2,
    color_hex: '#c4a882',
    texture_label: category === 'melamina' ? 'Melamina' : category === 'contrachapado' ? 'Contrachapado' : 'Tablero',
    category,
    in_stock: (item.cantidad ?? 0) > 0,
    stock_quantity: item.cantidad ?? 0,
    stock_min: item.stock_minimo ?? 0,
    supplier: '',
    board_width: boardW,
    board_height: boardH,
  }
}

/**
 * Service for managing the material catalog.
 * Falls back to hardcoded defaults when the DB table doesn't exist.
 */
export class MaterialCatalogService {
  private static cache: CatalogMaterial[] | null = null

  /** Get all catalog materials, ordered by category + name.
   *  Merges: material_catalog DB → stock_items (board-type) → hardcoded defaults */
  static async getAll(): Promise<CatalogMaterial[]> {
    if (this.cache) return this.cache

    try {
      // 1. Load from material_catalog table
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('category')
        .order('name')

      if (error) throw error
      const rows = (data ?? []) as CatalogMaterial[]

      // 2. Load board-type materials from general stock
      let stockMaterials: CatalogMaterial[] = []
      try {
        const { data: stockData } = await supabase
          .from('stock_items')
          .select('*')
        if (stockData) {
          stockMaterials = stockData
            .map(stockItemToCatalogMaterial)
            .filter((m): m is CatalogMaterial => m !== null)
        }
      } catch { /* stock table may not exist */ }

      // 3. Merge: material_catalog rows first, then stock items, then defaults
      //    Skip any whose id is already present (deduplication)
      const ids = new Set(rows.map(r => r.id))
      const fromStock = stockMaterials.filter(m => !ids.has(m.id))
      fromStock.forEach(m => ids.add(m.id))
      const extras = DEFAULT_CATALOG_MATERIALS.filter(d => !ids.has(d.id))

      if (rows.length === 0 && fromStock.length === 0) {
        console.warn('[MaterialCatalog] Tabla vacía y sin stock — usando catálogo por defecto')
        this.cache = DEFAULT_CATALOG_MATERIALS
      } else {
        this.cache = [...rows, ...fromStock, ...extras]
      }
      return this.cache
    } catch {
      // Table might not exist yet — fall back to defaults
      this.cache = DEFAULT_CATALOG_MATERIALS
      return this.cache
    }
  }

  /** Get only in-stock materials */
  static async getInStock(): Promise<CatalogMaterial[]> {
    const all = await this.getAll()
    return all.filter(m => m.in_stock)
  }

  /** Get a single material by ID */
  static async getById(id: string): Promise<CatalogMaterial | null> {
    const all = await this.getAll()
    return all.find(m => m.id === id) ?? null
  }

  /** Create or update a material */
  static async save(material: CatalogMaterial): Promise<CatalogMaterial> {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert({
        id:              material.id,
        name:            material.name,
        thickness:       material.thickness,
        price_per_m2:    material.price_per_m2,
        color_hex:       material.color_hex,
        texture_label:   material.texture_label,
        category:        material.category,
        in_stock:        material.in_stock,
        stock_quantity:  material.stock_quantity ?? 0,
        stock_min:       material.stock_min ?? 0,
        supplier:        material.supplier ?? null,
        board_width:     material.board_width ?? 2440,
        board_height:    material.board_height ?? 1220,
      })
      .select()
      .single()

    if (error) throw new Error(`Error guardando material: ${error.message}`)
    this.cache = null  // invalidate cache
    return data as CatalogMaterial
  }

  /** Delete a material */
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Error eliminando material: ${error.message}`)
    this.cache = null
  }

  /** Clear cache to force re-fetch */
  static invalidateCache() {
    this.cache = null
  }
}
