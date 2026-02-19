
import { useState, useEffect } from 'react'
import { TimeclockService, WorkSession } from '../services/timeclockService'
import { useAuth } from '@/app/providers/AuthProvider'
import { supabase } from '@/lib/supabase'

export default function MyHoursWidget() {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [expectedMinutes, setExpectedMinutes] = useState(2400) // 40h default
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.id !== 'admin') loadData()
  }, [user])

  // Contador en tiempo real cada minuto
  useEffect(() => {
    if (!activeSession) return
    const update = () => {
      const mins = Math.round(
        (new Date().getTime() - new Date(activeSession.login_time).getTime()) / 60000
      )
      setElapsed(mins)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [activeSession])

  const loadData = async () => {
    if (!user) return
    try {
      // Sesión activa
      const session = await TimeclockService.getActiveSession(user.id)
      setActiveSession(session)

      // Horas contratadas
      const { data: emp } = await supabase
        .from('production_employees')
        .select('horas_semanales')
        .eq('id', user.id)
        .single()

      const horasSemanales = emp?.horas_semanales || 40
      setExpectedMinutes(horasSemanales * 60)

      // Horas de la semana
      const weekStart = getWeekStart()
      const { data: sessions } = await supabase
        .from('work_sessions')
        .select('total_minutes, status')
        .eq('employee_id', user.id)
        .gte('date', weekStart)
        .eq('status', 'finished')

      const total = (sessions || []).reduce((sum, s) => sum + s.total_minutes, 0)
      setWeekMinutes(total)
    } catch (error) {
      console.error('Error cargando widget:', error)
    } finally {
      setLoading(false)
    }
  }

  const getWeekStart = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    return monday.toISOString().split('T')[0]
  }

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return `${h}:${m.toString().padStart(2, '0')}`
  }

  if (!user || user.id === 'admin' || loading) return null

  const totalWeek = weekMinutes + elapsed
  const weekProgress = Math.min(100, Math.round((totalWeek / expectedMinutes) * 100))
  const extraMinutes = totalWeek - expectedMinutes
  const todayProgress = Math.min(100, Math.round((elapsed / 480) * 100))

  return (
    <>
      {/* Widget flotante */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Panel expandido */}
        {expanded && (
          <div className="mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 w-72 overflow-hidden animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
              <p className="text-xs font-medium opacity-80">Horas trabajadas</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-3xl font-bold font-mono">{formatTime(elapsed)}</p>
                <div className="text-right">
                  <p className="text-xs opacity-80">hoy</p>
                  {activeSession && (
                    <p className="text-xs opacity-70">
                      desde {new Date(activeSession.login_time).toLocaleTimeString('es-ES', {
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Barra de progreso diaria */}
              <div className="mt-3">
                <div className="flex justify-between text-xs opacity-70 mb-1">
                  <span>Jornada diaria</span>
                  <span>{todayProgress}%</span>
                </div>
                <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5">
                  <div
                    className="bg-white h-1.5 rounded-full transition-all"
                    style={{ width: `${todayProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Semana */}
            <div className="p-4 space-y-3">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-medium text-gray-600">Esta semana</p>
                  <p className="text-sm font-bold text-gray-800">{formatTime(totalWeek)}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      weekProgress >= 100 ? 'bg-green-500' :
                      weekProgress >= 75 ? 'bg-blue-500' :
                      weekProgress >= 50 ? 'bg-yellow-400' : 'bg-gray-300'
                    }`}
                    style={{ width: `${weekProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{weekProgress}% completado</span>
                  <span>de {formatTime(expectedMinutes)}</span>
                </div>
              </div>

              {/* Horas extra */}
              <div className={`rounded-lg p-3 text-center ${
                extraMinutes > 0
                  ? 'bg-green-50 border border-green-200'
                  : extraMinutes < 0
                  ? 'bg-orange-50 border border-orange-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                {extraMinutes > 0 ? (
                  <>
                    <p className="text-xs text-green-600">Horas extra</p>
                    <p className="text-lg font-bold text-green-600">+{formatTime(extraMinutes)}</p>
                  </>
                ) : extraMinutes < 0 ? (
                  <>
                    <p className="text-xs text-orange-600">Pendientes</p>
                    <p className="text-lg font-bold text-orange-600">-{formatTime(Math.abs(extraMinutes))}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">Jornada completa</p>
                    <p className="text-lg font-bold text-gray-600">✅</p>
                  </>
                )}
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-5 gap-1">
                {['L', 'M', 'X', 'J', 'V'].map((day, idx) => {
                  const weekStart = new Date(getWeekStart())
                  const dayDate = new Date(weekStart)
                  dayDate.setDate(weekStart.getDate() + idx)
                  const isToday = dayDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                  const isPast = dayDate < new Date() && !isToday

                  return (
                    <div key={day} className={`text-center p-1.5 rounded-lg ${
                      isToday ? 'bg-blue-100 border border-blue-300' : ''
                    }`}>
                      <p className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-400'}`}>
                        {day}
                      </p>
                      <div className={`w-full mx-auto mt-1 rounded-full h-1 ${
                        isToday && elapsed > 0 ? 'bg-blue-500' :
                        isPast ? 'bg-gray-300' : 'bg-gray-100'
                      }`}></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Botón flotante */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`
            flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg
            transition-all duration-300 hover:shadow-xl hover:scale-105
            ${activeSession
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200'
            }
          `}
        >
          {/* Indicador de estado */}
          <div className={`w-2 h-2 rounded-full ${
            activeSession ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
          }`}></div>

          {/* Tiempo actual */}
          <span className="font-mono font-bold text-sm">
            {activeSession ? formatTime(elapsed) : '--:--'}
          </span>

          {/* Separador */}
          <span className="opacity-50 text-xs">|</span>

          {/* Progreso semanal */}
          <span className="text-xs font-medium opacity-90">
            {weekProgress}%
          </span>

          {/* Chevron */}
          <span className={`text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▲
          </span>
        </button>
      </div>
    </>
  )
}