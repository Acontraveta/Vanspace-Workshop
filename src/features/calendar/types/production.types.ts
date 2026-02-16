export interface ProductionProject {
  id: string
  quote_id?: string
  quote_number: string
  client_name: string
  vehicle_model?: string
  
  total_hours: number
  total_days?: number
  
  start_date?: string
  end_date?: string
  
  status: 'WAITING' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
  priority: number
  
  requires_materials: boolean
  materials_ready: boolean
  requires_design: boolean
  design_ready: boolean
  
  actual_start_date?: string
  actual_end_date?: string
  actual_hours?: number
  
  notes?: string
  
  created_at: string
  updated_at: string
}

export interface ProductionTask {
  id: string
  project_id: string
  
  task_name: string
  product_name?: string
  
  estimated_hours: number
  actual_hours?: number
  
  assigned_to?: string
  assigned_date?: string
  
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED'
  
  requires_material?: string
  material_ready: boolean
  requires_design: boolean
  design_ready: boolean
  blocked_reason?: string
  
  order_index: number
  
  completed_at?: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  project_id?: string
  
  title: string
  description?: string
  
  start_date: string
  end_date: string
  
  all_day: boolean
  
  color: string
  event_type: 'production' | 'holiday' | 'maintenance' | 'other'
  
  created_at: string
}

export interface ScheduleSuggestion {
  start_date: string
  end_date: string
  conflicts: boolean
  conflictingProjects: ProductionProject[]
  score: number
  reason: string
}