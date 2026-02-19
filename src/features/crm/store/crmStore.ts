import { create } from 'zustand'
import type { Lead, LeadFilters, CRMView, ExcelSyncStatus } from '../types/crm.types'
import { getAllLeads, createLead, updateLead, deleteLead } from '../services/leadService'
import type { LeadFormData } from '../types/crm.types'
import { computeCRMStats } from '../utils/crmHelpers'

interface CRMState {
  // Data
  leads: Lead[]
  isLoading: boolean
  error: string | null

  // Filters & view
  filters: LeadFilters
  view: CRMView

  // Excel sync
  syncStatus: ExcelSyncStatus

  // Selected lead (form open)
  selectedLead: Lead | null
  isFormOpen: boolean

  // Actions
  loadLeads: () => Promise<void>
  createLead: (data: LeadFormData) => Promise<Lead>
  updateLead: (id: string, changes: Partial<LeadFormData>) => Promise<Lead>
  deleteLead: (id: string) => Promise<void>
  setFilters: (filters: LeadFilters) => void
  setView: (view: CRMView) => void
  setSyncStatus: (status: Partial<ExcelSyncStatus>) => void
  openForm: (lead?: Lead) => void
  closeForm: () => void
}

export const useCRMStore = create<CRMState>((set, get) => ({
  leads: [],
  isLoading: false,
  error: null,
  filters: {},
  view: 'table',
  syncStatus: { isImporting: false, isExporting: false },
  selectedLead: null,
  isFormOpen: false,

  loadLeads: async () => {
    set({ isLoading: true, error: null })
    try {
      const leads = await getAllLeads()
      set({ leads, isLoading: false })
    } catch (err: any) {
      set({ isLoading: false, error: err?.message ?? 'Error cargando leads' })
    }
  },

  createLead: async (data) => {
    const lead = await createLead(data)
    set(state => ({ leads: [lead, ...state.leads] }))
    return lead
  },

  updateLead: async (id, changes) => {
    const updated = await updateLead(id, changes)
    set(state => ({
      leads: state.leads.map(l => l.id === id ? updated : l)
    }))
    return updated
  },

  deleteLead: async (id) => {
    await deleteLead(id)
    set(state => ({ leads: state.leads.filter(l => l.id !== id) }))
  },

  setFilters: (filters) => set({ filters }),
  setView: (view) => set({ view }),
  setSyncStatus: (status) => set(state => ({
    syncStatus: { ...state.syncStatus, ...status }
  })),

  openForm: (lead) => set({ selectedLead: lead ?? null, isFormOpen: true }),
  closeForm: () => set({ selectedLead: null, isFormOpen: false }),
}))
