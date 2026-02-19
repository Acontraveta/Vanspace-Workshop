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
  const [loading, setLoading] = useState(true)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const events = await UnifiedCalendarService.getAllEvents()
      setAllEvents(events)
    } catch (err) {
      console.error('[useCalendarEvents] Error:', err)
      toast.error('Error cargando eventos del calendario')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Events filtered by role + active branches
  const filteredEvents = (() => {
    const role = user?.role ?? 'operario'
    let events = UnifiedCalendarService.filterByRole(allEvents, role)
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

  // Count by branch
  const countByBranch = (() => {
    const role = user?.role ?? 'operario'
    const roleFiltered = UnifiedCalendarService.filterByRole(allEvents, role)
    const result: Record<EventBranch | 'total', number> = {
      total: roleFiltered.length,
      produccion: 0,
      crm: 0,
      pedidos: 0,
      presupuestos: 0,
      general: 0,
    }
    for (const e of roleFiltered) {
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
