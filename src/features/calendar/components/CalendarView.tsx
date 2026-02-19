import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  CalendarEvent,
  CalendarEventForm,
  EventBranch,
  BRANCH_META,
  EVENT_TYPE_LABELS,
} from '../types/calendar.types'
import EventModal from './EventModal'
import { UnifiedCalendarService } from '../services/calendarService'
import { ProductionService } from '../../production/services/productionService'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWeekend,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────

interface CalendarViewProps {
  events: CalendarEvent[]
  onRefresh: () => void
  onCreate: (form: CalendarEventForm) => Promise<void>
  onDelete: (id: string) => Promise<void>
  userRole: string
}

const ALL_BRANCHES: EventBranch[] = ['produccion', 'crm', 'pedidos', 'presupuestos', 'general']

// Roles that can CREATE new calendar events
const CAN_CREATE_ROLES = ['admin', 'encargado', 'compras']

// ─────────────────────────────────────────────────────────────

export default function CalendarView({
  events,
  onRefresh,
  onCreate,
  onDelete,
  userRole,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activeBranches, setActiveBranches] = useState<EventBranch[]>([])

  // Event modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [modalMode, setModalMode] = useState<'view' | 'create'>('create')
  const [newEventDate, setNewEventDate] = useState<string>('')
  const [showModal, setShowModal] = useState(false)

  // Drag for production
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null)
  // Prevent onClick from firing after a drag completes
  const wasDragging = useRef(false)

  const canCreate = CAN_CREATE_ROLES.includes(userRole)

  // ── Date grid ─────────────────────────────────────────

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // ── Filter logic ──────────────────────────────────────

  const filteredEvents = activeBranches.length === 0
    ? events
    : events.filter((e) => activeBranches.includes(e.branch))

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    return UnifiedCalendarService.eventsForDay(filteredEvents, dateStr)
  }

  // ── Branch toggle ─────────────────────────────────────

  const toggleBranch = (branch: EventBranch) => {
    setActiveBranches((prev) =>
      prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch],
    )
  }

  // ── Handlers ──────────────────────────────────────────

  const handleDayClick = (day: Date) => {
    if (wasDragging.current) { wasDragging.current = false; return }
    if (!canCreate) return
    if (isWeekend(day)) return
    if (!isSameMonth(day, currentMonth)) return
    const dateStr = format(day, 'yyyy-MM-dd')
    setNewEventDate(dateStr)
    setSelectedEvent(null)
    setModalMode('create')
    setShowModal(true)
  }

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setModalMode('view')
    setShowModal(true)
  }

  // ── Production drag-and-drop ──────────────────────────

  const handleDragStart = (event: CalendarEvent) => {
    if (event.branch === 'produccion') {
      setDraggedEvent(event)
      wasDragging.current = true
    }
  }

  const handleDragEnd = () => {
    setDraggedEvent(null)
    // Keep the flag for a tick so the day's onClick handler can detect it
    setTimeout(() => { wasDragging.current = false }, 50)
  }

  const handleDragOver = (e: React.DragEvent) => e.preventDefault()

  const handleDrop = async (day: Date) => {
    if (!draggedEvent || !draggedEvent.sourceId) { setDraggedEvent(null); return }
    if (isWeekend(day)) {
      toast.error('No se puede planificar en fin de semana')
      setDraggedEvent(null)
      return
    }

    const startStr = draggedEvent.date
    const endStr = draggedEvent.endDate ?? startStr
    const start = parseISO(startStr)
    const end = parseISO(endStr)
    const durationMs = end.getTime() - start.getTime()

    const newStart = format(day, 'yyyy-MM-dd')
    const newEnd = format(new Date(day.getTime() + durationMs), 'yyyy-MM-dd')

    try {
      await ProductionService.scheduleProject(draggedEvent.sourceId, newStart, newEnd)
      toast.success(`Proyecto movido a ${format(day, 'dd/MM/yyyy', { locale: es })}`)
      onRefresh()
    } catch {
      toast.error('Error moviendo proyecto')
    }
    setDraggedEvent(null)
  }

  // ── Month counts for badge ────────────────────────────

  const monthStr = format(currentMonth, 'yyyy-MM')
  const monthEvents = filteredEvents.filter(
    (e) => e.date.startsWith(monthStr) || (e.endDate && e.endDate >= `${monthStr}-01`)
  )

  // ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </CardTitle>
              <div className="flex gap-1">
                <Button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} variant="outline" size="sm">←</Button>
                <Button onClick={() => setCurrentMonth(new Date())} variant="outline" size="sm">Hoy</Button>
                <Button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} variant="outline" size="sm">→</Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''} este mes
              </span>
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => {
                    setNewEventDate(format(new Date(), 'yyyy-MM-dd'))
                    setSelectedEvent(null)
                    setModalMode('create')
                    setShowModal(true)
                  }}
                >
                  ＋ Nuevo evento
                </Button>
              )}
            </div>
          </div>

          {/* Branch filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setActiveBranches([])}
              className={`px-3 py-1 rounded-full text-xs border transition
                ${activeBranches.length === 0
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
            >
              Todas las ramas
            </button>
            {ALL_BRANCHES.map((branch) => {
              const meta = BRANCH_META[branch]
              const active = activeBranches.includes(branch)
              const count = events.filter((e) => e.branch === branch).length
              if (count === 0 && !active) return null
              return (
                <button
                  key={branch}
                  onClick={() => toggleBranch(branch)}
                  className={`px-3 py-1 rounded-full text-xs border transition flex items-center gap-1
                    ${active
                      ? `${meta.bgClass} ${meta.borderClass} ${meta.textClass} font-medium`
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                >
                  {meta.icon} {meta.label}
                  <span className={`ml-1 rounded-full px-1 text-[10px] font-bold ${active ? meta.textClass : 'text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </CardHeader>
      </Card>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="text-center text-xs font-bold text-gray-500 py-2">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentM = isSameMonth(day, currentMonth)
              const isWeekendDay = isWeekend(day)
              const dateStr = format(day, 'yyyy-MM-dd')

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(day)}
                  className={`
                    min-h-[130px] border rounded-lg p-1.5 transition select-none
                    ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    ${!isCurrentM ? 'opacity-40 bg-gray-50' : 'bg-white'}
                    ${isWeekendDay ? 'bg-gray-50' : ''}
                    ${canCreate && !isWeekendDay && isCurrentM ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/30' : ''}
                  `}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                      {format(day, 'd')}
                    </span>
                    {isWeekendDay && <span className="text-[9px] text-gray-400">FIN</span>}
                  </div>

                  {/* Events */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const meta = BRANCH_META[ev.branch]
                      const isSpan = ev.eventType === 'PROYECTO_SPAN'
                      // For continuation days of a multi-day span, use a lighter visual
                      const isContinuation = isSpan && ev.date.substring(0, 10) !== dateStr

                      return (
                        <div
                          key={ev.id}
                          draggable={ev.branch === 'produccion'}
                          onDragStart={() => handleDragStart(ev)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(day) }}
                          onClick={(e) => handleEventClick(e, ev)}
                          title={ev.title + (ev.description ? '\n' + ev.description : '')}
                          className={`
                            px-1.5 py-1 rounded cursor-pointer
                            hover:opacity-80 transition-opacity
                            ${meta.bgClass} ${meta.textClass}
                            ${isContinuation
                              ? `border-y border-r ${meta.borderClass} opacity-60 rounded-l-none`
                              : `border-l-4 ${meta.borderClass}`}
                          `}
                        >
                          <div className="flex items-center gap-1 text-[9px] opacity-60 font-semibold uppercase tracking-wide leading-none">
                            <span>{meta.icon}</span>
                            <span className="truncate">{EVENT_TYPE_LABELS[ev.eventType] ?? meta.label}</span>
                            {ev.time && <span className="ml-auto shrink-0">{ev.time}</span>}
                          </div>
                          <div className="text-[11px] font-semibold truncate mt-0.5 leading-tight">{ev.title}</div>
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-gray-500 pl-1 font-medium">
                        +{dayEvents.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-3 border-t flex flex-wrap gap-3 items-center">
            {ALL_BRANCHES.map((branch) => {
              const meta = BRANCH_META[branch]
              return (
                <div key={branch} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className={`w-3 h-3 rounded ${meta.bgClass} border-l-2 ${meta.borderClass}`}></div>
                  <span>{meta.icon} {meta.label}</span>
                </div>
              )
            })}
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-50"></div>
              <span>Hoy</span>
            </div>
            {canCreate && (
              <span className="text-[10px] text-gray-400 ml-auto">
                💡 Clic en un día para crear evento · Arrastra 🔧 para reprogramar
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Event modal */}
      {showModal && (
        modalMode === 'view' && selectedEvent ? (
          <EventModal
            event={selectedEvent}
            canEdit={canCreate && selectedEvent.branch !== 'produccion'}
            onClose={() => setShowModal(false)}
            onCreate={onCreate}
            onDelete={onDelete}
          />
        ) : (
          <EventModal
            initialDate={newEventDate}
            canEdit={canCreate}
            onClose={() => setShowModal(false)}
            onCreate={onCreate}
          />
        )
      )}
    </div>
  )
}