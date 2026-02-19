import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { TimeclockService, WorkSession } from '../services/timeclockService'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface Employee {
  id: string
  nombre: string
  rol: string
  horas_semanales: number
}

export default function TimeclockPanel() {
  const [todaySessions, setTodaySessions] = useState<WorkSession[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [historicSessions, setHistoricSessions] = useState<WorkSession[]>([])
  const [activeTab, setActiveTab] = useState<'today' | 'historic'>('today')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [loadingHistoric, setLoadingHistoric] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadTodaySessions, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeTab === 'historic') {
      loadHistoric()
    }
  }, [activeTab, selectedEmployee, dateFrom, dateTo])

  const loadData = async () => {
    try {
      await Promise.all([loadTodaySessions(), loadEmployees()])
    } finally {
      setLoading(false)
    }
  }

  const loadTodaySessions = async () => {
    const sessions = await TimeclockService.getTodaySessions()
    setTodaySessions(sessions)
  }

  const loadEmployees = async () => {
    const { data } = await supabase
      .from('production_employees')
      .select('id, nombre, rol, horas_semanales')
      .eq('activo', true)
      .order('nombre')
    setEmployees(data || [])
  }

  const loadHistoric = async () => {
    setLoadingHistoric(true)
    try {
      let query = supabase
        .from('work_sessions')
        .select('*')
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: false })
        .order('login_time', { ascending: false })

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee)
      }

      const { data } = await query
      setHistoricSessions(data || [])
    } catch (error) {
      toast.error('Error cargando histórico')
    } finally {
      setLoadingHistoric(false)
    }
  }

  // Calcular resumen por empleado para el histórico
  const getEmployeeSummary = () => {
    const summary: Record<string, {
      nombre: string
      totalMinutes: number
      days: number
      extraMinutes: number
      expectedMinutes: number
    }> = {}

    historicSessions
      .filter(s => s.status === 'finished')
      .forEach(session => {
        if (!summary[session.employee_id]) {
          const emp = employees.find(e => e.id === session.employee_id)
          const horasSemanales = emp?.horas_semanales || 40
          const diasPeriodo = Math.ceil(
            (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
          )
          const semanasPeriodo = diasPeriodo / 7
          
          summary[session.employee_id] = {
            nombre: session.employee_name,
            totalMinutes: 0,
            days: 0,
            extraMinutes: 0,
            expectedMinutes: Math.round(horasSemanales * 60 * semanasPeriodo)
          }
        }
        summary[session.employee_id].totalMinutes += session.total_minutes
        summary[session.employee_id].days++
      })

    // Calcular horas extra
    Object.values(summary).forEach(emp => {
      emp.extraMinutes = emp.totalMinutes - emp.expectedMinutes
    })

    return Object.values(summary)
  }

  // EXPORTAR A CSV
  const exportToCSV = () => {
    const sessions = historicSessions.filter(s => s.status === 'finished')

    if (sessions.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    // Cabeceras
    const headers = [
      'Empleado',
      'Fecha',
      'Día semana',
      'Hora Entrada',
      'Hora Salida',
      'Horas trabajadas',
      'Minutos totales'
    ]

    // Filas
    const rows = sessions.map(session => {
      const date = new Date(session.date)
      const dayName = date.toLocaleDateString('es-ES', { weekday: 'long' })
      const loginTime = new Date(session.login_time).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      })
      const logoutTime = session.logout_time
        ? new Date(session.logout_time).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })
        : '-'

      return [
        session.employee_name,
        session.date,
        dayName,
        loginTime,
        logoutTime,
        TimeclockService.formatMinutes(session.total_minutes),
        session.total_minutes.toString()
      ]
    })

    // Añadir fila de totales por empleado
    const summary = getEmployeeSummary()
    rows.push([]) // Línea vacía
    rows.push(['--- RESUMEN POR EMPLEADO ---', '', '', '', '', '', ''])
    rows.push(['Empleado', 'Días trabajados', 'Total horas', 'Horas esperadas', 'Horas extra', '', ''])

    summary.forEach(emp => {
      rows.push([
        emp.nombre,
        emp.days.toString(),
        TimeclockService.formatMinutes(emp.totalMinutes),
        TimeclockService.formatMinutes(emp.expectedMinutes),
        emp.extraMinutes >= 0
          ? `+${TimeclockService.formatMinutes(emp.extraMinutes)}`
          : `-${TimeclockService.formatMinutes(Math.abs(emp.extraMinutes))}`,
        '',
        ''
      ])
    })

    // Generar CSV
    const csvContent = [
      // Título del informe
      [`INFORME DE FICHAJES - VanSpace Workshop`],
      [`Período: ${dateFrom} a ${dateTo}`],
      [`Generado: ${new Date().toLocaleString('es-ES')}`],
      [],
      headers,
      ...rows
    ]
      .map(row => row.map(cell => `"${cell}"`).join(';'))
      .join('\n')

    // Descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fichajes_${dateFrom}_${dateTo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('✅ Informe exportado correctamente')
  }

  // EXPORTAR A HTML (tabla visual)
  const exportToHTML = () => {
    const sessions = historicSessions.filter(s => s.status === 'finished')

    if (sessions.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const summary = getEmployeeSummary()

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe de Fichajes - VanSpace</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #1e40af; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f9fafb; }
    tr:hover { background: #eff6ff; }
    .positive { color: #16a34a; font-weight: bold; }
    .negative { color: #dc2626; font-weight: bold; }
    .summary-card { 
      display: inline-block; 
      padding: 15px 25px; 
      margin: 10px; 
      border-radius: 8px; 
      background: #eff6ff; 
      border: 1px solid #bfdbfe;
    }
    .summary-card p { margin: 0; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #1e40af; }
    .footer { margin-top: 40px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>⏰ Informe de Fichajes - VanSpace Workshop</h1>
  <div class="meta">
    <p>📅 Período: <strong>${dateFrom}</strong> a <strong>${dateTo}</strong></p>
    <p>🕐 Generado: <strong>${new Date().toLocaleString('es-ES')}</strong></p>
    ${selectedEmployee !== 'all' ? `<p>👤 Empleado: <strong>${employees.find(e => e.id === selectedEmployee)?.nombre}</strong></p>` : ''}
  </div>

  <!-- Resumen general -->
  <div>
    <div class="summary-card">
      <p>Total registros</p>
      <p class="value">${sessions.length}</p>
    </div>
    <div class="summary-card">
      <p>Total horas</p>
      <p class="value">${TimeclockService.formatMinutes(sessions.reduce((sum, s) => sum + s.total_minutes, 0))}</p>
    </div>
    <div class="summary-card">
      <p>Empleados</p>
      <p class="value">${summary.length}</p>
    </div>
  </div>

  <!-- Resumen por empleado -->
  <h2>📊 Resumen por Empleado</h2>
  <table>
    <thead>
      <tr>
        <th>Empleado</th>
        <th>Días trabajados</th>
        <th>Total horas</th>
        <th>Horas esperadas</th>
        <th>Horas extra</th>
      </tr>
    </thead>
    <tbody>
      ${summary.map(emp => `
        <tr>
          <td><strong>${emp.nombre}</strong></td>
          <td>${emp.days} días</td>
          <td>${TimeclockService.formatMinutes(emp.totalMinutes)}</td>
          <td>${TimeclockService.formatMinutes(emp.expectedMinutes)}</td>
          <td class="${emp.extraMinutes >= 0 ? 'positive' : 'negative'}">
            ${emp.extraMinutes >= 0
              ? `+${TimeclockService.formatMinutes(emp.extraMinutes)}`
              : `-${TimeclockService.formatMinutes(Math.abs(emp.extraMinutes))}`
            }
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Detalle de fichajes -->
  <h2>📋 Detalle de Fichajes</h2>
  <table>
    <thead>
      <tr>
        <th>Empleado</th>
        <th>Fecha</th>
        <th>Día</th>
        <th>Entrada</th>
        <th>Salida</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${sessions.map(session => `
        <tr>
          <td><strong>${session.employee_name}</strong></td>
          <td>${session.date}</td>
          <td>${new Date(session.date).toLocaleDateString('es-ES', { weekday: 'long' })}</td>
          <td>${new Date(session.login_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${session.logout_time
            ? new Date(session.logout_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            : '-'
          }</td>
          <td><strong>${TimeclockService.formatMinutes(session.total_minutes)}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Informe generado automáticamente por VanSpace Workshop Management System</p>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fichajes_${dateFrom}_${dateTo}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('✅ Informe HTML exportado')
  }

  const activeSessions = todaySessions.filter(s => s.status === 'active')
  const finishedSessions = todaySessions.filter(s => s.status === 'finished')
  const totalMinutesToday = finishedSessions.reduce((sum, s) => sum + s.total_minutes, 0)

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          onClick={() => setActiveTab('today')}
          variant={activeTab === 'today' ? 'default' : 'outline'}
        >
          📅 Hoy
        </Button>
        <Button
          onClick={() => setActiveTab('historic')}
          variant={activeTab === 'historic' ? 'default' : 'outline'}
        >
          📋 Histórico
        </Button>
      </div>

      {activeTab === 'today' ? (
        <>
          {/* KPIs de hoy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Trabajando Ahora</p>
                <p className="text-4xl font-bold text-green-600">{activeSessions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Han Trabajado Hoy</p>
                <p className="text-4xl font-bold text-blue-600">{finishedSessions.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-1">Total Horas Hoy</p>
                <p className="text-4xl font-bold text-purple-600">
                  {TimeclockService.formatMinutes(totalMinutesToday)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sesiones activas */}
          {activeSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  Trabajando Ahora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeSessions.map(session => {
                    const minutes = Math.round(
                      (new Date().getTime() - new Date(session.login_time).getTime()) / 60000
                    )
                    return (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-bold text-lg">{session.employee_name}</p>
                          <p className="text-sm text-gray-600">
                            Entrada: {new Date(session.login_time).toLocaleTimeString('es-ES', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600 font-mono">
                            {TimeclockService.formatMinutes(minutes)}
                          </p>
                          <Badge className="bg-green-600">🟢 Activo</Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fichajes del día */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Fichajes de Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              {finishedSessions.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-sm text-gray-600">Empleado</th>
                      <th className="text-left py-2 px-3 text-sm text-gray-600">Entrada</th>
                      <th className="text-left py-2 px-3 text-sm text-gray-600">Salida</th>
                      <th className="text-left py-2 px-3 text-sm text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedSessions.map(session => (
                      <tr key={session.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3 font-medium">{session.employee_name}</td>
                        <td className="py-3 px-3 text-sm">
                          {new Date(session.login_time).toLocaleTimeString('es-ES', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {session.logout_time
                            ? new Date(session.logout_time).toLocaleTimeString('es-ES', {
                                hour: '2-digit', minute: '2-digit'
                              })
                            : '-'
                          }
                        </td>
                        <td className="py-3 px-3 font-bold text-blue-600">
                          {TimeclockService.formatMinutes(session.total_minutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-500 py-8">No hay fichajes finalizados hoy</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Filtros del histórico */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-2">Empleado</label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="all">Todos los empleados</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre} - {emp.rol}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Desde</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Hasta</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={loadHistoric}
                    className="flex-1"
                    disabled={loadingHistoric}
                  >
                    🔍 Buscar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de exportación */}
          {historicSessions.length > 0 && (
            <div className="flex gap-3">
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="gap-2 border-green-300 text-green-700 hover:bg-green-50"
              >
                📊 Exportar CSV
              </Button>
              <Button
                onClick={exportToHTML}
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                📄 Exportar HTML
              </Button>
              <span className="text-sm text-gray-500 self-center">
                {historicSessions.filter(s => s.status === 'finished').length} registros encontrados
              </span>
            </div>
          )}

          {/* Resumen por empleado */}
          {historicSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Resumen por Empleado</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Empleado</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Días</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total Horas</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Horas Esperadas</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Horas Extra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getEmployeeSummary().map((emp, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-bold">{emp.nombre}</td>
                        <td className="py-3 px-4">{emp.days} días</td>
                        <td className="py-3 px-4 font-medium text-blue-600">
                          {TimeclockService.formatMinutes(emp.totalMinutes)}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {TimeclockService.formatMinutes(emp.expectedMinutes)}
                        </td>
                        <td className={`py-3 px-4 font-bold ${emp.extraMinutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {emp.extraMinutes >= 0
                            ? `+${TimeclockService.formatMinutes(emp.extraMinutes)}`
                            : `-${TimeclockService.formatMinutes(Math.abs(emp.extraMinutes))}`
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Detalle de fichajes */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Detalle de Fichajes</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistoric ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : historicSessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Empleado</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Fecha</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Día</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Entrada</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Salida</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicSessions.map(session => (
                        <tr key={session.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{session.employee_name}</td>
                          <td className="py-3 px-4 text-sm">{session.date}</td>
                          <td className="py-3 px-4 text-sm capitalize">
                            {new Date(session.date).toLocaleDateString('es-ES', { weekday: 'long' })}
                          </td>
                          <td className="py-3 px-4 text-sm font-mono">
                            {new Date(session.login_time).toLocaleTimeString('es-ES', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4 text-sm font-mono">
                            {session.logout_time
                              ? new Date(session.logout_time).toLocaleTimeString('es-ES', {
                                  hour: '2-digit', minute: '2-digit'
                                })
                              : '-'
                            }
                          </td>
                          <td className="py-3 px-4 font-bold text-blue-600">
                            {session.status === 'finished'
                              ? TimeclockService.formatMinutes(session.total_minutes)
                              : '...'
                            }
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={
                              session.status === 'finished' ? 'secondary' :
                              session.status === 'active' ? 'default' : 'warning'
                            }>
                              {session.status === 'finished' ? '✅ Finalizado' :
                               session.status === 'active' ? '🟢 Activo' : '⏸ Pausado'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📋</div>
                  <p className="text-gray-500">No hay fichajes en el período seleccionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}