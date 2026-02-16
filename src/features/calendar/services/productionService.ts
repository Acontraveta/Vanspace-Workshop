import { supabase } from '@/lib/supabase'
import { ProductionProject, ProductionTask, CalendarEvent, ScheduleSuggestion } from '../types/production.types'
import { addDays, addWeeks, isWeekend, nextMonday, format, parseISO, differenceInDays } from 'date-fns'

export class ProductionService {
  
  // ============================================
  // PROYECTOS
  // ============================================
  
  static async getProjects(): Promise<ProductionProject[]> {
    const { data, error } = await supabase
      .from('production_projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  static async getWaitingProjects(): Promise<ProductionProject[]> {
    const { data, error } = await supabase
      .from('production_projects')
      .select('*')
      .eq('status', 'WAITING')
      .order('priority', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  static async createProject(project: Omit<ProductionProject, 'id' | 'created_at' | 'updated_at'>): Promise<ProductionProject> {
    const { data, error } = await supabase
      .from('production_projects')
      .insert(project)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateProject(id: string, updates: Partial<ProductionProject>): Promise<void> {
    const { error } = await supabase
      .from('production_projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    
    if (error) throw error
  }

  static async scheduleProject(id: string, start_date: string, end_date: string): Promise<void> {
    await this.updateProject(id, {
      start_date,
      end_date,
      status: 'SCHEDULED'
    })

    // Crear evento en calendario
    const { data: project } = await supabase
      .from('production_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (project) {
      await this.createCalendarEvent({
        project_id: id,
        title: `${project.quote_number} - ${project.client_name}`,
        description: project.vehicle_model,
        start_date,
        end_date,
        all_day: true,
        color: '#3b82f6',
        event_type: 'production'
      })
    }
  }

  // ============================================
  // SUGERENCIAS DE CALENDARIO
  // ============================================
  
  static async getSuggestions(projectId: string): Promise<ScheduleSuggestion[]> {
    const { data: project } = await supabase
      .from('production_projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project || !project.total_days) return []

    const { data: scheduledProjects } = await supabase
      .from('production_projects')
      .select('*')
      .in('status', ['SCHEDULED', 'IN_PROGRESS'])

    const { data: config } = await supabase
      .from('config_settings')
      .select('*')
      .in('key', [
        'calendario.margen_seguridad_compras',
        'calendario.margen_seguridad_diseño'
      ])

    const marginDays = config?.find(c => c.key === 'calendario.margen_seguridad_compras')?.value || '2'
    
    const suggestions: ScheduleSuggestion[] = []
    let currentDate = new Date()

    // Añadir margen si requiere materiales
    if (project.requires_materials && !project.materials_ready) {
      currentDate = addDays(currentDate, parseInt(marginDays))
    }

    // Generar sugerencias para las próximas 4 semanas
    for (let week = 0; week < 4; week++) {
      let startDate = addWeeks(currentDate, week)
      
      // Si cae en fin de semana, mover al lunes
      if (isWeekend(startDate)) {
        startDate = nextMonday(startDate)
      }

      const endDate = this.calculateEndDate(startDate, project.total_days)

      // Verificar conflictos
      const conflicts = this.checkConflicts(startDate, endDate, scheduledProjects || [])
      
      // Calcular puntuación
      const score = this.calculateScore(startDate, conflicts, project)

      suggestions.push({
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        conflicts: conflicts.length > 0,
        conflictingProjects: conflicts,
        score,
        reason: this.getScoreReason(score, conflicts, week)
      })
    }

    return suggestions.sort((a, b) => b.score - a.score)
  }

  private static calculateEndDate(startDate: Date, totalDays: number): Date {
    let remainingDays = totalDays
    let currentDate = new Date(startDate)

    while (remainingDays > 0) {
      if (!isWeekend(currentDate)) {
        remainingDays--
      }
      if (remainingDays > 0) {
        currentDate = addDays(currentDate, 1)
      }
    }

    return currentDate
  }

  private static checkConflicts(
    start: Date,
    end: Date,
    projects: ProductionProject[]
  ): ProductionProject[] {
    return projects.filter(p => {
      if (!p.start_date || !p.end_date) return false
      
      const pStart = parseISO(p.start_date)
      const pEnd = parseISO(p.end_date)
      
      return (start <= pEnd && end >= pStart)
    })
  }

  private static calculateScore(
    startDate: Date,
    conflicts: ProductionProject[],
    project: ProductionProject
  ): number {
    let score = 100

    // Penalizar por conflictos
    score -= conflicts.length * 20

    // Penalizar por lejanía (preferir fechas más cercanas)
    const daysAway = differenceInDays(startDate, new Date())
    score -= Math.min(daysAway * 2, 30)

    // Bonificar si materiales/diseño están listos
    if (!project.requires_materials || project.materials_ready) {
      score += 10
    }
    if (!project.requires_design || project.design_ready) {
      score += 10
    }

    // Bonificar por prioridad
    score += (project.priority - 5) * 5

    return Math.max(0, Math.min(100, score))
  }

  private static getScoreReason(score: number, conflicts: ProductionProject[], week: number): string {
    if (score >= 90) return '✅ Fecha óptima - Sin conflictos'
    if (score >= 70) return '🟢 Buena fecha - Pocos conflictos'
    if (score >= 50) return '🟡 Fecha aceptable - Algunos conflictos'
    if (conflicts.length > 0) return `🔴 ${conflicts.length} conflictos detectados`
    if (week >= 3) return '⏰ Fecha lejana'
    return '🟡 Revisar disponibilidad'
  }

  // ============================================
  // CALENDARIO
  // ============================================
  
  static async getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order('start_date')
    
    if (error) throw error
    return data || []
  }

  static async createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateCalendarEvent(id: string, updates: Partial<CalendarEvent>): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
    
    if (error) throw error
  }

  static async deleteCalendarEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // ============================================
  // TAREAS
  // ============================================
  
  static async getProjectTasks(projectId: string): Promise<ProductionTask[]> {
    const { data, error } = await supabase
      .from('production_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index')
    
    if (error) throw error
    return data || []
  }

  static async createTask(task: Omit<ProductionTask, 'id' | 'created_at'>): Promise<ProductionTask> {
    const { data, error } = await supabase
      .from('production_tasks')
      .insert(task)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  static async updateTask(id: string, updates: Partial<ProductionTask>): Promise<void> {
    const { error } = await supabase
      .from('production_tasks')
      .update(updates)
      .eq('id', id)
    
    if (error) throw error
  }
}