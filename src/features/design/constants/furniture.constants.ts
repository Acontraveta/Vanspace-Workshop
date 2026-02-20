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
  { value: 'armario',      label: '🚪 Armario' },
  { value: 'cajonera',     label: '🗂️ Cajonera' },
  { value: 'cocina',       label: '🍳 Módulo cocina' },
  { value: 'arcon',        label: '📦 Arcón' },
  { value: 'altillo',      label: '🛏️ Altillo' },
  { value: 'personalizado', label: '✏️ Personalizado' },
] as const

/** Colour palette for piece types */
export const PIECE_COLORS = {
  estructura: { fill: '#64748b', stroke: '#475569', selected: '#3b82f6', label: 'Estructura' },
  frontal:    { fill: '#3b82f6', stroke: '#2563eb', selected: '#f59e0b', label: 'Frontal' },
  trasera:    { fill: '#334155', stroke: '#1e293b', selected: '#3b82f6', label: 'Trasera' },
} as const

