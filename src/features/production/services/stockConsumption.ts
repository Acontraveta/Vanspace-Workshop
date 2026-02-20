/**
 * Stock consumption service for furniture manufacturing.
 *
 * When a furniture design is finalized (work order generated / saved),
 * this service:
 *  1. Calculates board/sheet consumption per material
 *  2. Deducts from the material_catalog stock_quantity
 *  3. Checks against stock_min thresholds
 *  4. Auto-creates purchase_items for materials below minimum stock
 */

import { InteractivePiece, CatalogMaterial, ModuleDimensions } from '@/features/design/types/furniture.types'
import { MaterialCatalogService } from '@/features/design/services/materialCatalogService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaterialConsumption {
  materialId: string
  material: CatalogMaterial
  totalAreaM2: number        // total area used by all pieces with this material
  sheetsNeeded: number       // number of standard sheets consumed
  sheetAreaM2: number        // area of one standard sheet
  previousStock: number      // stock before deduction
  newStock: number           // stock after deduction
  belowMin: boolean          // true if newStock < stock_min
}

export interface ConsumptionReport {
  items: MaterialConsumption[]
  purchaseItemsCreated: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BOARD_W = 2440  // mm
const DEFAULT_BOARD_H = 1220  // mm

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * Calculate how many sheets of each material a set of pieces will consume.
 * Groups pieces by materialId, computes total area, and translates to sheets.
 */
export function calculateConsumption(
  pieces: InteractivePiece[],
  module: ModuleDimensions,
  catalogMaterials: CatalogMaterial[],
): MaterialConsumption[] {
  // Group pieces by material
  const grouped = new Map<string, InteractivePiece[]>()

  for (const p of pieces) {
    const matId = p.materialId ?? module.catalogMaterialId
    if (!matId) continue
    const arr = grouped.get(matId) ?? []
    arr.push(p)
    grouped.set(matId, arr)
  }

  const result: MaterialConsumption[] = []

  for (const [matId, pcs] of grouped) {
    const mat = catalogMaterials.find(m => m.id === matId)
    if (!mat) continue

    // Total area of all pieces (m²)
    let totalAreaM2 = 0
    for (const p of pcs) {
      // Use the largest two dimensions (the cut face on the sheet)
      const dims = [p.w, p.h, p.d].sort((a, b) => b - a)
      totalAreaM2 += (dims[0] / 1000) * (dims[1] / 1000)
    }

    // Sheet dimensions
    const bw = mat.board_width  ?? DEFAULT_BOARD_W
    const bh = mat.board_height ?? DEFAULT_BOARD_H
    const sheetAreaM2 = (bw / 1000) * (bh / 1000)

    // Sheets needed (ceil — partial sheet = full sheet)
    const sheetsNeeded = Math.ceil(totalAreaM2 / sheetAreaM2)

    const previousStock = mat.stock_quantity ?? 0
    const newStock = Math.max(0, previousStock - sheetsNeeded)
    const belowMin = (mat.stock_min ?? 0) > 0 && newStock < (mat.stock_min ?? 0)

    result.push({
      materialId: matId,
      material: mat,
      totalAreaM2,
      sheetsNeeded,
      sheetAreaM2,
      previousStock,
      newStock,
      belowMin,
    })
  }

  return result
}

// ─── Deduct stock + auto-purchase ─────────────────────────────────────────────

/**
 * Process stock deduction for a furniture design.
 * Deducts sheets from material_catalog.stock_quantity and
 * auto-creates purchase_items for any material that falls below stock_min.
 */
export async function processStockConsumption(
  pieces: InteractivePiece[],
  module: ModuleDimensions,
  catalogMaterials: CatalogMaterial[],
  projectInfo?: string,
): Promise<ConsumptionReport> {
  const items = calculateConsumption(pieces, module, catalogMaterials)
  let purchaseItemsCreated = 0

  for (const item of items) {
    // 1. Deduct stock in Supabase
    try {
      const { error } = await supabase
        .from('material_catalog')
        .update({ stock_quantity: item.newStock })
        .eq('id', item.materialId)

      if (error) {
        console.warn(`⚠️ No se pudo actualizar stock de "${item.material.name}":`, error.message)
      }
    } catch (e) {
      console.warn('⚠️ Error actualizando stock:', e)
    }

    // 2. Auto-create purchase item if below minimum
    if (item.belowMin) {
      const quantityToOrder = (item.material.stock_min ?? 0) - item.newStock + (item.material.stock_min ?? 0)
      try {
        await PurchaseService.savePurchase({
          id: `pur-mat-${item.materialId}-${Date.now()}`,
          materialName: item.material.name,
          quantity: quantityToOrder,
          unit: 'tablero',
          provider: item.material.supplier ?? undefined,
          priority: 7,   // high priority — below minimum stock
          status: 'PENDING',
          notes: `Auto-generado: stock mínimo (${item.material.stock_min}) tras fabricación${projectInfo ? ` — ${projectInfo}` : ''}. Quedan ${item.newStock} uds.`,
          createdAt: new Date(),
        })
        purchaseItemsCreated++
      } catch (e) {
        console.warn('⚠️ Error creando pedido automático:', e)
      }
    }
  }

  // Invalidate material cache so next load shows updated stock
  MaterialCatalogService.invalidateCache()

  return { items, purchaseItemsCreated }
}
