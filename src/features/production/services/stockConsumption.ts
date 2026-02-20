/**
 * Stock consumption service for furniture manufacturing.
 *
 * When a furniture design is finalized (work order generated / saved),
 * this service:
 *  1. Uses the Guillotine optimizer result (board count per material) for accurate deduction
 *  2. Deducts from the material_catalog stock_quantity
 *  3. Checks against stock_min thresholds
 *  4. Auto-creates purchase_items for materials below minimum stock
 */

import { InteractivePiece, PlacedPiece, CatalogMaterial, ModuleDimensions } from '@/features/design/types/furniture.types'
import { boardCountByMaterial } from '@/features/design/utils/geometry'
import { MaterialCatalogService } from '@/features/design/services/materialCatalogService'
import { PurchaseService } from '@/features/purchases/services/purchaseService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MaterialConsumption {
  materialId: string
  material: CatalogMaterial
  totalAreaM2: number        // total area used by all pieces with this material
  sheetsNeeded: number       // number of standard sheets consumed (from optimizer)
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
 * Uses the optimizer result (PlacedPiece[]) to count actual boards per material.
 * Falls back to area-based calculation when optimizer data is unavailable.
 */
export function calculateConsumption(
  pieces: InteractivePiece[],
  module: ModuleDimensions,
  catalogMaterials: CatalogMaterial[],
  optimizedPlacements?: PlacedPiece[],
): MaterialConsumption[] {
  // If we have optimizer results, use exact board count per material
  const optimizerBoardCounts = optimizedPlacements?.length
    ? boardCountByMaterial(optimizedPlacements)
    : null

  // Group pieces by material (for area stats display)
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

    // Total area of all pieces (m²) – for display purposes
    let totalAreaM2 = 0
    for (const p of pcs) {
      const dims = [p.w, p.h, p.d].sort((a, b) => b - a)
      totalAreaM2 += (dims[0] / 1000) * (dims[1] / 1000)
    }

    // Sheet dimensions
    const bw = mat.board_width  ?? DEFAULT_BOARD_W
    const bh = mat.board_height ?? DEFAULT_BOARD_H
    const sheetAreaM2 = (bw / 1000) * (bh / 1000)

    // Sheets needed: use optimizer board count if available, else area fallback
    const sheetsNeeded = optimizerBoardCounts?.get(matId)
      ?? Math.ceil(totalAreaM2 / sheetAreaM2)

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
 * Uses the optimizer result to determine exact board count per material,
 * deducts from material_catalog.stock_quantity, and auto-creates purchase
 * items when stock falls below minimum.
 */
export async function processStockConsumption(
  pieces: InteractivePiece[],
  module: ModuleDimensions,
  catalogMaterials: CatalogMaterial[],
  projectInfo?: string,
  optimizedPlacements?: PlacedPiece[],
): Promise<ConsumptionReport> {
  const items = calculateConsumption(pieces, module, catalogMaterials, optimizedPlacements)
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
