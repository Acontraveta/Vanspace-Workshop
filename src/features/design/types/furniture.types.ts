// ─── Furniture Designer Types ────────────────────────────────────────────────

export type ModuleType =
  | 'armario'
  | 'cajonera'
  | 'cocina'
  | 'arcon'
  | 'altillo'
  | 'personalizado'

// ─── Material catalog ─────────────────────────────────────────────────────────

export interface CatalogMaterial {
  id: string
  name: string
  thickness: number          // mm
  price_per_m2: number       // €/m²
  color_hex: string          // display colour in 2D/3D
  texture_label: string      // e.g. "Roble", "Blanco", "Nogal"
  category: 'madera' | 'melamina' | 'contrachapado' | 'dm' | 'hpl' | 'otro'
  in_stock: boolean
  // ── Stock tracking ──
  stock_quantity?: number    // sheets/boards in stock
  stock_min?: number         // minimum stock threshold
  supplier?: string          // preferred supplier name
  board_width?: number       // sheet width mm (default 2440)
  board_height?: number      // sheet height mm (default 1220)
  created_at?: string
}

export interface InteractivePiece {
  id: string
  name: string
  type: 'estructura' | 'frontal' | 'trasera'
  x: number
  y: number
  z: number
  w: number // Ancho (eje X)
  h: number // Alto  (eje Y)
  d: number // Fondo (eje Z)
  materialId?: string       // links to CatalogMaterial.id
  hidden?: boolean           // hide piece in 2D/3D views without deleting
}

export interface ModuleDimensions {
  name: string
  type: ModuleType
  width: number
  height: number
  depth: number
  thickness: number
  materialPrice: number
  catalogMaterialId?: string  // links to CatalogMaterial.id chosen in wizard
}

export interface Piece {
  ref: string
  w: number
  h: number
  type: 'estructura' | 'frontal' | 'trasera'
  id?: string
  materialId?: string        // links to CatalogMaterial.id for grouping
  materialName?: string      // display name – "Melamina Blanco Brillo 16mm"
}

export interface PlacedPiece extends Piece {
  x: number
  y: number
  board?: number            // 0-indexed board number (legacy data may lack this)
  rotated?: boolean         // true if piece was rotated 90° during optimisation
}

// ─── Saved design for a single furniture item ─────────────────────────────────

export interface FurnitureDesign {
  id: string
  work_order_id?: string
  lead_id: string
  project_task_id?: string   // linked production task
  quote_item_name: string    // e.g. "Armario 3 puertas"
  quote_item_sku?: string
  module: ModuleDimensions
  pieces: InteractivePiece[]
  optimized_cuts: PlacedPiece[]
  blueprint_svg?: string     // technical drawing SVG stored on approval
  created_at: string
  updated_at: string
}

// ─── Design Work Order ───────────────────────────────────────────────────────
// Created by automation when a quote with design items is approved.
// design_type determines which design tool handles this order.

export type DesignType = 'furniture' | 'exterior' | 'interior'

export interface FurnitureWorkOrderItem {
  quoteItemName: string
  quoteItemSku?: string
  familia?: string           // product family (electricidad, fontaneria, muebles, ventanas)
  designId?: string          // set once the piece is designed
  designStatus: 'pending' | 'designed' | 'approved'
}

export interface FurnitureWorkOrder {
  id: string
  project_id: string         // production project
  project_task_id: string    // the "Corte de tableros" task id
  lead_id?: string           // CRM lead
  quote_number: string
  client_name: string
  design_type: DesignType    // furniture | exterior | interior
  items: FurnitureWorkOrderItem[]
  cutlist_svg?: string       // combined cut-list blueprint (generated on completion)
  board_cutlist_svgs?: string[] // per-board cut-list SVGs (one per physical board)
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}
