import { useEffect } from 'react'
import { useCRMStore } from '../store/crmStore'
import { filterLeads, computeCRMStats } from '../utils/crmHelpers'

export function useLeads() {
  const {
    leads,
    isLoading,
    error,
    filters,
    loadLeads,
  } = useCRMStore()

  useEffect(() => {
    if (leads.length === 0 && !isLoading) {
      loadLeads()
    }
  }, [])

  const filtered = filterLeads(leads, filters)
  const stats = computeCRMStats(leads)

  return {
    leads: filtered,
    allLeads: leads,
    stats,
    isLoading,
    error,
    reload: loadLeads,
  }
}
