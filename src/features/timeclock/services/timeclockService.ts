import { supabase } from '@/lib/supabase'

export interface TimeEntry {
  id: string
  employee_id: string
  employee_name: string
  type: 'login' | 'logout' | 'pause' | 'resume'
  timestamp: string
  date: string
  notes?: string
}

export interface WorkSession {
  id: string
  employee_id: string
  employee_name: string
  date: string
  login_time: string
  logout_time?: string
  total_minutes: number
  status: 'active' | 'paused' | 'finished'
}

export class TimeclockService {

  // Registrar entrada (login) o reanudar sesión pausada
  static async registerLogin(employeeId: string, employeeName: string): Promise<WorkSession> {
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    // Verificar si ya hay una sesión activa hoy
    const { data: activeSession } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .eq('status', 'active')
      .single()

    if (activeSession) {
      return activeSession
    }

    // Verificar si hay sesión pausada → reanudarla
    const { data: pausedSession } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .eq('status', 'paused')
      .single()

    if (pausedSession) {
      // Reanudar: nueva login_time para el nuevo tramo, mantener total_minutes acumulados
      const { data: resumed, error: resumeError } = await supabase
        .from('work_sessions')
        .update({
          login_time: now,
          status: 'active',
          updated_at: now
        })
        .eq('id', pausedSession.id)
        .select()
        .single()

      if (resumeError) throw resumeError

      // Registrar reanudación
      await supabase
        .from('time_entries')
        .insert({
          employee_id: employeeId,
          employee_name: employeeName,
          type: 'resume',
          timestamp: now,
          date: today
        })

      return resumed!
    }

    // Crear nueva sesión
    const { data: session, error: sessionError } = await supabase
      .from('work_sessions')
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        date: today,
        login_time: now,
        status: 'active',
        total_minutes: 0
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Registrar entrada
    await supabase
      .from('time_entries')
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        type: 'login',
        timestamp: now,
        date: today
      })

    return session
  }

  // Registrar salida (logout) — finaliza la jornada
  static async registerLogout(employeeId: string, employeeName: string): Promise<void> {
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    // Buscar sesión activa o pausada
    const { data: session } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .in('status', ['active', 'paused'])
      .single()

    if (session) {
      // Minutos acumulados de tramos anteriores (pausas)
      const accumulated = session.total_minutes || 0

      // Si estaba activa, sumar el tramo actual
      let currentPeriod = 0
      if (session.status === 'active') {
        currentPeriod = Math.round(
          (new Date(now).getTime() - new Date(session.login_time).getTime()) / 60000
        )
      }

      const totalMinutes = accumulated + currentPeriod

      // Actualizar sesión
      await supabase
        .from('work_sessions')
        .update({
          logout_time: now,
          total_minutes: totalMinutes,
          status: 'finished',
          updated_at: now
        })
        .eq('id', session.id)
    }

    // Registrar salida
    await supabase
      .from('time_entries')
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        type: 'logout',
        timestamp: now,
        date: today
      })
  }

  // Pausar jornada — guarda minutos acumulados sin finalizar la sesión
  static async registerPause(employeeId: string, employeeName: string): Promise<void> {
    const now = new Date().toISOString()
    const today = new Date().toISOString().split('T')[0]

    // Buscar sesión activa
    const { data: session } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .eq('status', 'active')
      .single()

    if (session) {
      // Minutos de este tramo
      const currentPeriod = Math.round(
        (new Date(now).getTime() - new Date(session.login_time).getTime()) / 60000
      )
      const accumulated = (session.total_minutes || 0) + currentPeriod

      // Marcar como pausada con los minutos acumulados
      await supabase
        .from('work_sessions')
        .update({
          total_minutes: accumulated,
          status: 'paused',
          updated_at: now
        })
        .eq('id', session.id)
    }

    // Registrar evento de pausa
    await supabase
      .from('time_entries')
      .insert({
        employee_id: employeeId,
        employee_name: employeeName,
        type: 'pause',
        timestamp: now,
        date: today
      })
  }

  // Obtener sesión activa de hoy
  static async getActiveSession(employeeId: string): Promise<WorkSession | null> {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .in('status', ['active', 'paused'])
      .single()

    return data || null
  }

  // Obtener historial de sesiones de un empleado
  static async getEmployeeSessions(employeeId: string, days: number = 30): Promise<WorkSession[]> {
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)

    const { data } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: false })

    return data || []
  }

  // Obtener todas las sesiones de hoy (para admin)
  static async getTodaySessions(): Promise<WorkSession[]> {
    const today = new Date().toISOString().split('T')[0]

    const { data } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('date', today)
      .order('login_time', { ascending: true })

    return data || []
  }

  // Obtener resumen semanal de un empleado
  static async getWeeklySummary(employeeId: string): Promise<{
    date: string
    total_minutes: number
    sessions: number
  }[]> {
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 7)

    const { data } = await supabase
      .from('work_sessions')
      .select('date, total_minutes')
      .eq('employee_id', employeeId)
      .eq('status', 'finished')
      .gte('date', fromDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (!data) return []

    // Agrupar por día
    const summary = data.reduce((acc, session) => {
      const existing = acc.find(s => s.date === session.date)
      if (existing) {
        existing.total_minutes += session.total_minutes
        existing.sessions++
      } else {
        acc.push({
          date: session.date,
          total_minutes: session.total_minutes,
          sessions: 1
        })
      }
      return acc
    }, [] as { date: string, total_minutes: number, sessions: number }[])

    return summary
  }

  // Formatear minutos a horas decimales
  static formatMinutes(minutes: number): string {
    const hours = minutes / 60
    return `${hours.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`
  }
}