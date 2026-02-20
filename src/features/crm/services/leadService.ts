import { supabase } from '@/lib/supabase'
import type { Lead, LeadFormData, LeadFilters } from '../types/crm.types'

const TABLE = 'crm_leads'

// ============================================================
// READ
// ============================================================

export async function getAllLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Lead[]
}

export async function getLeadById(id: string): Promise<Lead> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Lead
}

export async function getLeadsByEstado(estado: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('estado', estado)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Lead[]
}

export async function getLeadsByAsignado(asignado: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('asignado', asignado)
    .order('fecha', { ascending: false })

  if (error) throw error
  return data as Lead[]
}

// ============================================================
// CREATE / UPDATE / DELETE
// ============================================================

// Converts empty-string date fields to null before sending to Supabase
function sanitizeDates(obj: Record<string, any>): Record<string, any> {
  const result = { ...obj }
  for (const field of ['fecha', 'fecha_accion', 'fecha_entrega']) {
    if (result[field] === '') result[field] = null
  }
  return result
}

export async function createLead(formData: LeadFormData): Promise<Lead> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert([{
      ...sanitizeDates(formData),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) throw error

  // Re-exportar CRM Excel en Storage (no-blocking)
  import('./excelExporter')
    .then(({ exportCRMToExcel }) => exportCRMToExcel())
    .catch(e => console.warn('⚠️ No se pudo actualizar CRM.xlsx:', e))

  return data as Lead
}

export async function updateLead(id: string, changes: Partial<LeadFormData>): Promise<Lead> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      ...sanitizeDates(changes),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  // Re-exportar CRM Excel en Storage (no-blocking)
  import('./excelExporter')
    .then(({ exportCRMToExcel }) => exportCRMToExcel())
    .catch(e => console.warn('⚠️ No se pudo actualizar CRM.xlsx:', e))

  return data as Lead
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)

  if (error) throw error

  // Re-exportar CRM Excel en Storage (no-blocking)
  import('./excelExporter')
    .then(({ exportCRMToExcel }) => exportCRMToExcel())
    .catch(e => console.warn('⚠️ No se pudo actualizar CRM.xlsx:', e))
}

// ============================================================
// BULK UPSERT (used by Excel importer)
// ============================================================

export async function upsertLeads(leads: Partial<Lead>[]): Promise<number> {
  if (leads.length === 0) return 0

  let total = 0
  const BATCH = 100

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH).map(l => ({
      ...l,
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'excel_row_number' })

    if (error) {
      console.error(`❌ CRM upsert error (batch ${i}):`, error)
      throw error
    }

    total += batch.length
    console.log(`✅ CRM upsert: ${i + 1}-${i + batch.length} / ${leads.length}`)
  }

  return total
}

// ============================================================
// UNIQUE VALUES (for filter dropdowns)
// ============================================================

export async function getUniqueValues(field: keyof Lead): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(field as string)

  if (error) throw error

  const values = (data ?? [])
    .map((row: any) => row[field])
    .filter((v: any) => v != null && v !== '')
  
  return [...new Set(values)].sort() as string[]
}
