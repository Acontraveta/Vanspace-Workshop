import { supabase } from '@/lib/supabase'
import { ProductionProject, ProductionTask, CalendarEvent, ScheduleSuggestion } from '../types/production.types'
import { AvailabilityService } from './availabilityService'
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

  /** Pause a project: revert to WAITING, clear dates, remove calendar event */
  static async pauseProject(id: string): Promise<void> {
    await this.updateProject(id, {
      status: 'WAITING',
      start_date: null as any,
      end_date: null as any,
      actual_start_date: null as any,
    })

    // Remove any calendar events linked to this project
    try {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('source_id', id)
    } catch { /* calendar event may not exist */ }
  }

  // ============================================
  // SUGERENCIAS DE CALENDARIO (con capacidad)
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

    const marginDays = parseInt(
      config?.find(c => c.key === 'calendario.margen_seguridad_compras')?.value || '2'
    )

    // ── Employee capacity ──────────────────────────────────
    const { employeeCount, dailyHours } = await AvailabilityService.getTallerCapacity()

    const suggestions: ScheduleSuggestion[] = []
    let baseDate = new Date()

    // Add materials/design margin before starting
    if (project.requires_materials && !project.materials_ready) {
      baseDate = addDays(baseDate, marginDays)
    }
    if (project.requires_design && !project.design_ready) {
      baseDate = addDays(baseDate, marginDays)
    }

    // Generate candidates: next 6 Mondays (so we can pick the best 4)
    for (let week = 0; week < 6; week++) {
      let startDate = addWeeks(baseDate, week)
      if (isWeekend(startDate)) {
        startDate = nextMonday(startDate)
      }

      // Build capacity window for this slot
      const window = AvailabilityService.buildCapacityWindow(
        startDate,
        project,
        scheduledProjects || [],
        dailyHours,
        employeeCount,
      )

      // Check date-range conflicts (existing projects that overlap)
      const conflicts = this.checkConflicts(
        parseISO(window.startDate),
        parseISO(window.endDate),
        scheduledProjects || [],
      )

      const score = this.calculateScoreWithCapacity(
        startDate,
        conflicts,
        project,
        window.avgUtilization,
        window.canFit,
        week,
      )

      suggestions.push({
        start_date: window.startDate,
        end_date: window.endDate,
        conflicts: conflicts.length > 0,
        conflictingProjects: conflicts,
        score,
        reason: this.getScoreReasonWithCapacity(score, conflicts, week, window.avgUtilization, window.canFit),
        capacity: {
          dailyCapacity: window.dailyCapacity,
          employeeCount: window.employeeCount,
          peakUtilization: window.peakUtilization,
          avgUtilization: window.avgUtilization,
          canFit: window.canFit,
          hasCapacity: window.hasCapacity,
        },
      })
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 4)
  }

  private static calculateScoreWithCapacity(
    startDate: Date,
    conflicts: ProductionProject[],
    project: ProductionProject,
    avgUtilization: number,
    canFit: boolean,
    week: number,
  ): number {
    let score = 100

    // Penalize for date-range conflicts with other projects
    score -= conflicts.length * 15

    // Penalize by capacity utilization (canFit = all days have room)
    if (!canFit) score -= 30
    else if (avgUtilization > 80) score -= 10
    else if (avgUtilization > 60) score -= 5

    // Penalize for distance in time (prefer sooner)
    const daysAway = differenceInDays(startDate, new Date())
    score -= Math.min(daysAway * 1.5, 25)

    // Bonus if materials/design ready
    if (!project.requires_materials || project.materials_ready) score += 8
    if (!project.requires_design || project.design_ready) score += 8

    // Priority bonus
    score += (project.priority - 5) * 4

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  private static getScoreReasonWithCapacity(
    score: number,
    conflicts: ProductionProject[],
    week: number,
    avgUtilization: number,
    canFit: boolean,
  ): string {
    const utilLabel = `${avgUtilization}% carga media`

    if (!canFit && conflicts.length > 0) return `🔴 Sin capacidad + ${conflicts.length} conflicto(s)`
    if (!canFit) return `🔴 Capacidad insuficiente (${utilLabel})`
    if (conflicts.length > 0) return `🟡 ${conflicts.length} proyecto(s) solapado(s) · ${utilLabel}`
    if (score >= 85) return `✅ Óptimo · ${utilLabel}`
    if (score >= 70) return `🟢 Buena disponibilidad · ${utilLabel}`
    if (score >= 50) return `🟡 Aceptable · ${utilLabel}`
    return `⏰ Fecha lejana · ${utilLabel}`
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
      return start <= pEnd && end >= pStart
    })
  }

  // ============================================
  // CALENDARIO
  // ============================================
  
  static async getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date')
    
    if (error) throw error
    return data || []
  }

  static async createCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at'>): Promise<CalendarEvent> {
    const e = event as any
    // Map old CalendarEvent shape (start_date, color, all_day, project_id)
    // to the actual DB schema (event_date, branch, source_id)
    const payload: Record<string, any> = {
      title:         e.title,
      description:   e.description ?? null,
      event_date:    e.start_date ?? e.event_date,
      end_date:      e.end_date ?? null,
      event_time:    e.event_time ?? null,
      branch:        e.branch ?? 'produccion',
      event_type:    (e.event_type === 'production' ? 'PROYECTO_SPAN' : e.event_type) ?? null,
      source_id:     e.project_id ?? e.source_id ?? null,
      metadata:      e.metadata ?? (e.project_id ? { projectId: e.project_id } : {}),
      visible_roles: e.visible_roles ?? ['admin','encargado','encargado_taller','compras','operario'],
      created_by:    e.created_by ?? null,
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(payload)
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
    // Parse JSON string columns stored by createTask
    return (data || []).map(row => ({
      ...row,
      materials_list: typeof row.materials_list === 'string'
        ? (() => { try { return JSON.parse(row.materials_list) } catch { return [] } })()
        : (row.materials_list ?? []),
      consumables_list: typeof row.consumables_list === 'string'
        ? (() => { try { return JSON.parse(row.consumables_list) } catch { return [] } })()
        : (row.consumables_list ?? []),
      materials: typeof row.materials === 'string'
        ? (() => { try { return JSON.parse(row.materials) } catch { return [] } })()
        : (row.materials ?? []),
      consumables: typeof row.consumables === 'string'
        ? (() => { try { return JSON.parse(row.consumables) } catch { return [] } })()
        : (row.consumables ?? []),
    }))
  }

  static async createTask(task: Omit<ProductionTask, 'id' | 'created_at'>): Promise<ProductionTask> {
    const taskAny = task as any
    const payload: any = {
      ...task,
      materials: task.materials ? JSON.stringify(task.materials) : (taskAny.materials_list ? JSON.stringify(taskAny.materials_list) : null),
      consumables: task.consumables ? JSON.stringify(task.consumables) : (taskAny.consumables_list ? JSON.stringify(taskAny.consumables_list) : null),
    }
    const { data, error } = await supabase
      .from('production_tasks')
      .insert(payload)
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

  // ============================================
  // ELIMINAR PROYECTO
  // ============================================

  /** Delete a production project and all related data (tasks, calendar events, work orders) */
  static async deleteProject(id: string): Promise<void> {
    // 1. Delete production tasks
    try {
      await supabase.from('production_tasks').delete().eq('project_id', id)
    } catch { /* tasks may not exist */ }

    // 2. Delete calendar events linked to this project
    try {
      await supabase.from('calendar_events').delete().eq('source_id', id)
    } catch { /* calendar events may not exist */ }

    // 3. Delete furniture work orders (CASCADE deletes furniture_designs, exterior_designs, interior_designs)
    try {
      await supabase.from('furniture_work_orders').delete().eq('project_id', id)
    } catch { /* work orders may not exist */ }

    // 4. Delete the project itself
    const { error } = await supabase
      .from('production_projects')
      .delete()
      .eq('id', id)

    if (error) throw error
  }
}