export const BOARD_WIDTH    = 2440  // mm – tablero estándar
export const BOARD_HEIGHT   = 1220  // mm
export const SNAP_DISTANCE  = 8     // mm – distancia de atracción magnética
export const DEFAULT_THICKNESS = 16 // mm – grosor de tablero por defecto

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
