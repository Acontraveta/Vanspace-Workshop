export const APP_NAME = 'VanSpace Workshop'
export const APP_VERSION = '1.0.0'

// Roles de usuario
export enum UserRole {
  ADMIN = 'ADMIN',
  MARKETING = 'MARKETING',
  DESIGN = 'DESIGN',
  ORDERS = 'ORDERS',
  PRODUCTION = 'PRODUCTION',
}

// Estados de leads
export enum LeadStatus {
  NUEVO = '1-Nuevo',
  CONTACTADO = '2-Contactado',
  PRESUPUESTO_ENVIADO = '3-Presupuesto enviado',
  NEGOCIACION = '4-Negociación',
  ACEPTADO = '5-Aceptado',
  EN_TALLER = '6-En taller',
  ENTREGADO = '7-Entregado',
  PERDIDO = '8-Perdido',
}

// Estados de presupuestos
export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  NEGOTIATION = 'NEGOTIATION',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Estados de tareas
export enum TaskStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  BLOCKED = 'BLOCKED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

// Estados de compras
export enum PurchaseStatus {
  PENDING = 'PENDING',
  ORDERED = 'ORDERED',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

// Líneas de negocio
export const BUSINESS_LINES = [
  { value: 'camperizacion_total', label: 'Camperización Total', rate: 50, margin: 25 },
  { value: 'camperizacion_parcial', label: 'Camperización Parcial', rate: 50, margin: 25 },
  { value: 'reparacion_normal', label: 'Reparación Normal', rate: 45, margin: 20 },
  { value: 'reparacion_urgente', label: 'Reparación Urgente', rate: 65, margin: 15 },
  { value: 'accesorios', label: 'Accesorios', rate: 50, margin: 30 },
]

// Configuración
export const CONFIG = {
  HORAS_TRABAJO_DIA: 8,
  DIAS_TRABAJO_SEMANA: 5,
  MARGEN_SEGURIDAD_COMPRAS: 2,
  MARGEN_SEGURIDAD_DISEÑO: 3,
  PORCENTAJE_IMPREVISTOS: 15,
  IVA: 21,
}
