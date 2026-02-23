import { supabase } from '@/lib/supabase'
import { CatalogMaterial } from '../types/furniture.types'
import { DEFAULT_CATALOG_MATERIALS } from '../constants/furniture.constants'

const TABLE = 'material_catalog'

/**
 * Service for managing the material catalog.
 * Falls back to hardcoded defaults when the DB table doesn't exist.
 */
export class MaterialCatalogService {
  private static cache: CatalogMaterial[] | null = null

  /** Get all catalog materials, ordered by category + name */
  static async getAll(): Promise<CatalogMaterial[]> {
    if (this.cache) return this.cache

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('category')
        .order('name')

      if (error) throw error
      const rows = (data ?? []) as CatalogMaterial[]
      // If the DB table is empty, fall back to defaults so the designer
      // always has materials available.
      if (rows.length === 0) {
        console.warn('[MaterialCatalog] Tabla vacía — usando catálogo por defecto')
        this.cache = DEFAULT_CATALOG_MATERIALS
      } else {
        // Merge: Supabase rows first, then any defaults whose id is not
        // already present (handles mixed-ID situations).
        const ids = new Set(rows.map(r => r.id))
        const extras = DEFAULT_CATALOG_MATERIALS.filter(d => !ids.has(d.id))
        this.cache = [...rows, ...extras]
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
