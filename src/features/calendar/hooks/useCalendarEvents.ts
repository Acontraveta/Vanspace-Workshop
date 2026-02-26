import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import { UnifiedCalendarService } from '../services/calendarService'
import {
  CalendarEvent,
  CalendarEventForm,
  EventBranch,
  emptyEventForm,
} from '../types/calendar.types'
import toast from 'react-hot-toast'

interface UseCalendarEventsOptions {
  activeBranches?: EventBranch[]
}

export function useCalendarEvents({ activeBranches = [] }: UseCalendarEventsOptions = {}) {
  const { user } = useAuth()
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [assignedProjectIds, setAssignedProjectIds] = useState<Set<string> | null>(null)
  const [loading, setLoading] = useState(true)

  const isOperario = (user?.role ?? 'operario') === 'operario'

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const [events, projectIds] = await Promise.all([
        UnifiedCalendarService.getAllEvents(),
        // Only fetch assigned projects for operario
        isOperario && user?.id
          ? UnifiedCalendarService.getAssignedProjectIds(user.id)
          : Promise.resolve(null),
      ])
      setAllEvents(events)
      if (projectIds !== null) setAssignedProjectIds(projectIds)
    } catch (err) {
      console.error('[useCalendarEvents] Error:', err)
      toast.error('Error cargando eventos del calendario')
    } finally {
      setLoading(false)
    }
  }, [isOperario, user?.id])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Events filtered by role + active branches + operario assignment
  const filteredEvents = (() => {
    const role = user?.role ?? 'operario'
    let events = UnifiedCalendarService.filterByRole(allEvents, role)

    // Operario: only show production projects where they have assigned tasks
    if (isOperario && assignedProjectIds) {
      events = events.filter((e) => {
        // Production events have sourceId = project id and id starts with 'prod-'
        if (e.id.startsWith('prod-') && e.sourceId) {
          return assignedProjectIds.has(e.sourceId)
        }
        // Non-production events (general notes etc.) pass through
        return true
      })
    }

    if (activeBranches.length > 0) {
      events = UnifiedCalendarService.filterByBranch(events, activeBranches)
    }
    return events
  })()

  const eventsForDay = (dateStr: string) =>
    UnifiedCalendarService.eventsForDay(filteredEvents, dateStr)

  const createEvent = async (form: CalendarEventForm) => {
    await UnifiedCalendarService.createEvent(form, user?.name ?? user?.email)
    await loadEvents()
  }

  const updateEvent = async (id: string, form: Partial<CalendarEventForm>) => {
    await UnifiedCalendarService.updateEvent(id, form)
    await loadEvents()
  }

  const deleteEvent = async (id: string) => {
    await UnifiedCalendarService.deleteEvent(id)
    await loadEvents()
  }

  // Count by branch (uses same filtering as filteredEvents)
  const countByBranch = (() => {
    const result: Record<EventBranch | 'total', number> = {
      total: filteredEvents.length,
      produccion: 0,
      crm: 0,
      pedidos: 0,
      presupuestos: 0,
      general: 0,
    }
    for (const e of filteredEvents) {
      result[e.branch] = (result[e.branch] ?? 0) + 1
    }
    return result
  })()

  return {
    allEvents,
    filteredEvents,
    loading,
    loadEvents,
    eventsForDay,
    createEvent,
    updateEvent,
    deleteEvent,
    countByBranch,
    userRole: user?.role ?? 'operario',
  }
}
