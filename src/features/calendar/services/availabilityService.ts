import { supabase } from '@/lib/supabase'
import { ProductionProject } from '../types/production.types'
import { addDays, isWeekend, format, parseISO, eachDayOfInterval } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CapacityDay {
  date: string
  /** Total available hours on this day (all active taller employees) */
  totalHours: number
  /** Hours already committed by currently scheduled/in-progress projects */
  committedHours: number
  /** Projected hours committed after adding the candidate project */
  projectedHours: number
  /** Free hours BEFORE adding candidate project */
  freeHours: number
  /** Utilization % AFTER adding candidate project */
  utilizationPct: number
}

export interface CapacityWindow {
  startDate: string
  endDate: string
  workingDays: number
  /** Total daily hours available (sum of all active taller employees) */
  dailyCapacity: number
  /** Employee count used for the calculation */
  employeeCount: number
  /** Peak utilization across all days in the window */
  peakUtilization: number
  /** Average utilization across all days in the window */
  avgUtilization: number
  /** True if the project fits in every day without exceeding 100% capacity */
  canFit: boolean
  /** True if there is at least partial capacity on every day */
  hasCapacity: boolean
  capacityDays: CapacityDay[]
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class AvailabilityService {

  // ── Employee capacity ─────────────────────────────────────

  /**
   * Returns total daily taller hours from active operario/encargado_taller employees.
   * Falls back to 3 operators × 8 h = 24 h if the query fails.
   */
  static async getTallerCapacity(): Promise<{ employeeCount: number; dailyHours: number }> {
    try {
      const { data } = await supabase
        .from('production_employees')
        .select('id, horas_semanales, role')
        .eq('activo', true)
        .in('role', ['operario', 'encargado_taller'])

      if (!data || data.length === 0) {
        return { employeeCount: 3, dailyHours: 24 }
      }

      // horas_semanales / 5 working days = daily hours per employee
      const dailyHours = data.reduce(
        (sum, e) => sum + Math.round((Number(e.horas_semanales) || 40) / 5),
        0,
      )

      return { employeeCount: data.length, dailyHours }
    } catch {
      return { employeeCount: 3, dailyHours: 24 }
    }
  }

  // ── Load calculation ──────────────────────────────────────

  /**
   * For each working day in `days`, compute how many hours are already
   * committed by the given scheduled/in-progress projects.
   */
  static computeDailyLoad(
    days: Date[],
    scheduledProjects: ProductionProject[],
    excludeProjectId?: string,
  ): Map<string, number> {
    const load = new Map<string, number>()
    for (const d of days) load.set(format(d, 'yyyy-MM-dd'), 0)

    for (const project of scheduledProjects) {
      if (project.id === excludeProjectId) continue
      if (!project.start_date || !project.end_date || !project.total_hours) continue

      const pStart = parseISO(project.start_date)
      const pEnd = parseISO(project.end_date)
      const projectWorkingDays = eachDayOfInterval({ start: pStart, end: pEnd }).filter(
        (d) => !isWeekend(d),
      )
      if (projectWorkingDays.length === 0) continue

      const hpd = project.total_hours / projectWorkingDays.length

      for (const wd of projectWorkingDays) {
        const key = format(wd, 'yyyy-MM-dd')
        if (load.has(key)) load.set(key, (load.get(key) ?? 0) + hpd)
      }
    }

    return load
  }

  // ── Capacity window builder ───────────────────────────────

  /**
   * Given a candidate start date & project, compute a full CapacityWindow
   * showing per-day utilization if this project were scheduled there.
   */
  static buildCapacityWindow(
    startDate: Date,
    project: ProductionProject,
    scheduledProjects: ProductionProject[],
    dailyHours: number,
    employeeCount: number,
  ): CapacityWindow {
    const neededDays = project.total_days ?? Math.ceil((project.total_hours ?? 8) / 8)

    // Build the working-days array for the project span
    const projectWorkingDays: Date[] = []
    let cursor = new Date(startDate)
    while (projectWorkingDays.length < neededDays) {
      if (!isWeekend(cursor)) projectWorkingDays.push(new Date(cursor))
      cursor = addDays(cursor, 1)
    }

    const endDate = projectWorkingDays[projectWorkingDays.length - 1]
    const projectHpd = project.total_hours / (projectWorkingDays.length || 1)

    const load = this.computeDailyLoad(projectWorkingDays, scheduledProjects, project.id)

    const capacityDays: CapacityDay[] = projectWorkingDays.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const committedHours = load.get(key) ?? 0
      const freeHours = Math.max(0, dailyHours - committedHours)
      const projectedHours = committedHours + projectHpd
      const utilizationPct = Math.min(100, Math.round((projectedHours / dailyHours) * 100))

      return { date: key, totalHours: dailyHours, committedHours, projectedHours, freeHours, utilizationPct }
    })

    const peakUtilization = Math.max(...capacityDays.map((d) => d.utilizationPct))
    const avgUtilization = Math.round(
      capacityDays.reduce((s, d) => s + d.utilizationPct, 0) / (capacityDays.length || 1),
    )
    const canFit = capacityDays.every((d) => d.freeHours >= projectHpd)
    const hasCapacity = capacityDays.every((d) => d.freeHours > 0)

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      workingDays: projectWorkingDays.length,
      dailyCapacity: dailyHours,
      employeeCount,
      peakUtilization,
      avgUtilization,
      canFit,
      hasCapacity,
      capacityDays,
    }
  }
}
