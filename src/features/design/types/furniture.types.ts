// ─── Furniture Designer Types ────────────────────────────────────────────────

export type ModuleType =
  | 'armario'
  | 'cajonera'
  | 'cocina'
  | 'arcon'
  | 'altillo'
  | 'personalizado'

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
}

export interface ModuleDimensions {
  name: string
  type: ModuleType
  width: number
  height: number
  depth: number
  thickness: number
  materialPrice: number
}

export interface Piece {
  ref: string
  w: number
  h: number
  type: 'estructura' | 'frontal' | 'trasera'
  id?: string
}

export interface PlacedPiece extends Piece {
  x: number
  y: number
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
  created_at: string
  updated_at: string
}

// ─── Furniture Work Order ─────────────────────────────────────────────────────
// Created by automation when a quote with muebles is approved

export interface FurnitureWorkOrderItem {
  quoteItemName: string
  quoteItemSku?: string
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
  items: FurnitureWorkOrderItem[]
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
}
