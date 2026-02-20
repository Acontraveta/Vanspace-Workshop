import type { CatalogMaterial } from '../types/furniture.types'

export const BOARD_WIDTH    = 2440  // mm – tablero estándar
export const BOARD_HEIGHT   = 1220  // mm
export const SNAP_DISTANCE  = 8     // mm – distancia de atracción magnética
export const DEFAULT_THICKNESS = 16 // mm – grosor de tablero por defecto
export const BACK_THICKNESS    = 4  // mm – trasera

export const MATERIALS = [
  { name: 'Contrachapado Chopo 16mm',  price: 42 },
  { name: 'Contrachapado Chopo 18mm',  price: 50 },
  { name: 'Contrachapado Abedul 12mm', price: 55 },
  { name: 'Contrachapado Abedul 18mm', price: 72 },
  { name: 'DM hidrófugo 16mm',         price: 35 },
  { name: 'Tablero HPL (Alta Calidad)',  price: 95 },
]

export const MODULE_TYPES = [
  { value: 'armario',       label: '🚪 Armario',        width: 800,  height: 2100, depth: 550 },
  { value: 'cajonera',      label: '🗂️ Cajonera',       width: 500,  height: 700,  depth: 450 },
  { value: 'cocina',        label: '🍳 Módulo cocina',   width: 600,  height: 700,  depth: 580 },
  { value: 'arcon',         label: '📦 Arcón',           width: 800,  height: 450,  depth: 450 },
  { value: 'altillo',       label: '🛏️ Altillo',        width: 1000, height: 350,  depth: 350 },
  { value: 'personalizado', label: '✏️ Personalizado',   width: 800,  height: 700,  depth: 450 },
] as const

/** Colour palette for piece types (used when no material is assigned) */
export const PIECE_COLORS = {
  estructura: { fill: '#64748b', stroke: '#475569', selected: '#3b82f6', label: 'Estructura' },
  frontal:    { fill: '#3b82f6', stroke: '#2563eb', selected: '#f59e0b', label: 'Frontal' },
  trasera:    { fill: '#334155', stroke: '#1e293b', selected: '#3b82f6', label: 'Trasera' },
} as const

/** Material categories for catalog UI */
export const MATERIAL_CATEGORIES = [
  { value: 'madera',         label: '🪵 Madera maciza' },
  { value: 'contrachapado',  label: '📦 Contrachapado' },
  { value: 'melamina',       label: '🎨 Melamina' },
  { value: 'dm',             label: '🟫 DM / MDF' },
  { value: 'hpl',            label: '💎 HPL' },
  { value: 'otro',           label: '✏️ Otro' },
] as const

/** Default built-in material catalog */
export const DEFAULT_CATALOG_MATERIALS: CatalogMaterial[] = [
  { id: 'mat-chopo-16',    name: 'Contrachapado Chopo 16mm',    thickness: 16, price_per_m2: 42,  color_hex: '#c4a882', texture_label: 'Chopo',    category: 'contrachapado', in_stock: true },
  { id: 'mat-chopo-18',    name: 'Contrachapado Chopo 18mm',    thickness: 18, price_per_m2: 50,  color_hex: '#b89b72', texture_label: 'Chopo',    category: 'contrachapado', in_stock: true },
  { id: 'mat-abedul-12',   name: 'Contrachapado Abedul 12mm',   thickness: 12, price_per_m2: 55,  color_hex: '#e8d5b7', texture_label: 'Abedul',   category: 'contrachapado', in_stock: true },
  { id: 'mat-abedul-18',   name: 'Contrachapado Abedul 18mm',   thickness: 18, price_per_m2: 72,  color_hex: '#d4be96', texture_label: 'Abedul',   category: 'contrachapado', in_stock: true },
  { id: 'mat-dm-hidro-16', name: 'DM hidrófugo 16mm',           thickness: 16, price_per_m2: 35,  color_hex: '#8b7355', texture_label: 'DM Hidro', category: 'dm',             in_stock: true },
  { id: 'mat-hpl-blanco',  name: 'HPL Blanco',                  thickness: 16, price_per_m2: 95,  color_hex: '#f0f0f0', texture_label: 'Blanco',   category: 'hpl',            in_stock: true },
  { id: 'mat-mel-blanco',  name: 'Melamina Blanco Brillo 16mm', thickness: 16, price_per_m2: 28,  color_hex: '#ffffff', texture_label: 'Blanco',   category: 'melamina',       in_stock: true },
  { id: 'mat-mel-gris',    name: 'Melamina Gris Claro 16mm',    thickness: 16, price_per_m2: 30,  color_hex: '#b0b0b0', texture_label: 'Gris',     category: 'melamina',       in_stock: true },
  { id: 'mat-mel-roble',   name: 'Melamina Roble Natural 16mm', thickness: 16, price_per_m2: 32,  color_hex: '#ba8c5c', texture_label: 'Roble',    category: 'melamina',       in_stock: true },
  { id: 'mat-mel-nogal',   name: 'Melamina Nogal 16mm',         thickness: 16, price_per_m2: 34,  color_hex: '#5e3a22', texture_label: 'Nogal',    category: 'melamina',       in_stock: true },
  { id: 'mat-mel-negro',   name: 'Melamina Negro Mate 16mm',    thickness: 16, price_per_m2: 32,  color_hex: '#2a2a2a', texture_label: 'Negro',    category: 'melamina',       in_stock: true },
  { id: 'mat-pino-18',     name: 'Pino macizo 18mm',            thickness: 18, price_per_m2: 48,  color_hex: '#d4b896', texture_label: 'Pino',     category: 'madera',         in_stock: true },
  { id: 'mat-roble-20',    name: 'Roble macizo 20mm',           thickness: 20, price_per_m2: 120, color_hex: '#a07040', texture_label: 'Roble',    category: 'madera',         in_stock: false },
]

