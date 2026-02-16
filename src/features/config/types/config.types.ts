export interface AppPermission {
  id: string
  module: string
  permission_key: string
  permission_name: string
  description?: string
  category: string
}

export type UserRole = 'admin' | 'encargado' | 'compras' | 'encargado_taller' | 'operario'

export interface EmployeePermissions {
  [key: string]: boolean
}

export interface ProductionEmployee {
  id: string
  nombre: string
  rol?: string // Deprecated, use 'role'
  especialidad_principal?: string
  especialidad_secundaria?: string
  tarifa_hora_eur: number
  horas_semanales?: number
  // Campos de acceso
  email: string
  password_hash?: string
  telefono?: string
  activo: boolean
  // Roles y permisos
  role: UserRole
  permissions: EmployeePermissions
  last_login?: string
  active_session?: boolean
}

// Permisos por rol predefinidos
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  // ADMINISTRADOR - Acceso total
  admin: ['admin.full'],
  // ENCARGADO - Puede visualizar todo y editar con permiso del administrador
  encargado: [
    // Ver todo
    'quotes.view',
    'purchases.view', 'stock.view', 'warehouse.view',
    'production.view', 'tasks.view',
    'calendar.view',
    'config.view', 'employees.view',
    'reports.view', 'exports.excel',
    // Puede solicitar/sugerir pero no ejecutar cambios críticos
  ],
  // COMPRAS - Acceso a compras, stock y CRM
  compras: [
    'quotes.view', 'quotes.create', 'quotes.edit', // CRM básico
    'purchases.view', 'purchases.create', 'purchases.receive',
    'stock.view', 'stock.edit',
    'warehouse.view', 'warehouse.manage',
    'exports.excel'
  ],
  // ENCARGADO DE TALLER - Gestión de producción
  encargado_taller: [
    'quotes.view', // Ver presupuestos aprobados
    'purchases.view', 'stock.view', 'warehouse.view', // Ver materiales
    'production.view', 'production.manage', // Gestionar producción
    'tasks.view', 'tasks.complete', 'tasks.assign', // Gestionar tareas
    'calendar.view', 'calendar.schedule', 'calendar.edit', // Planificar
    'reports.view'
  ],
  // OPERARIO - Solo sus tareas
  operario: [
    'tasks.view', // Solo sus tareas
    'tasks.complete', // Completar sus tareas
    'tasks.pause', // Pausar sus tareas
    'production.view', // Ver el proyecto en el que trabaja
  ]
}

// Descripciones de roles
export const ROLE_DESCRIPTIONS: Record<UserRole, { label: string; icon: string; description: string }> = {
  admin: {
    label: 'Administrador',
    icon: '⚡',
    description: 'Acceso total al sistema. Control completo de todas las funcionalidades.'
  },
  encargado: {
    label: 'Encargado',
    icon: '👔',
    description: 'Puede visualizar todo el sistema. Editar con permiso del administrador.'
  },
  compras: {
    label: 'Compras',
    icon: '📦',
    description: 'Gestiona pedidos, stock, almacén y CRM de clientes.'
  },
  encargado_taller: {
    label: 'Encargado de Taller',
    icon: '🏭',
    description: 'Gestiona la producción, asigna tareas y planifica proyectos.'
  },
  operario: {
    label: 'Operario',
    icon: '👷',
    description: 'Ve y completa sus propias tareas asignadas.'
  }
}
export interface Tarifa {
  id: string
  nombre_tarifa: string
  tarifa_hora_eur: number
  margen_materiales_pct: number
  urgencia?: string
  dias_trabajo_semana?: number
  horas_dia?: number
  activa: boolean
  created_at?: string
  updated_at?: string
}

export interface ProductionEmployee {
  id: string
  nombre: string
  rol: string
  especialidad_principal?: string
  especialidad_secundaria?: string
  tarifa_hora_eur?: number
  horas_semanales?: number
  email?: string
  telefono?: string
  activo: boolean
  created_at?: string
  updated_at?: string
}

export interface Role {
  rol: string
  nivel: string
  anos_experiencia?: string
  puede_realizar?: string
  tarifa_min_eur?: number
  tarifa_max_eur?: number
  descripcion?: string
  created_at?: string
}

export interface ConfigSetting {
  key: string
  value: string
  category: string
  unit?: string
  description?: string
  data_type: 'text' | 'number' | 'boolean'
  updated_at?: string
}

export interface AlertSetting {
  tipo_alerta: string
  activa: boolean
  destinatario?: string
  condicion?: string
  created_at?: string
  updated_at?: string
}

export interface CompanyInfo {
  campo: string
  valor: string
  updated_at?: string
}