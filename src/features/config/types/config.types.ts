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