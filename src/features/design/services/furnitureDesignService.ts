import { supabase } from '@/lib/supabase'
import {
  FurnitureDesign,
  FurnitureWorkOrder,
  FurnitureWorkOrderItem,
  InteractivePiece,
  ModuleDimensions,
  PlacedPiece,
} from '../types/furniture.types'

const WO_TABLE  = 'furniture_work_orders'
const DES_TABLE = 'furniture_designs'

// ─── Work Orders ─────────────────────────────────────────────────────────────

export class FurnitureWorkOrderService {

  static async create(
    payload: Omit<FurnitureWorkOrder, 'id' | 'created_at' | 'updated_at'>
  ): Promise<FurnitureWorkOrder> {
    const { data, error } = await supabase
      .from(WO_TABLE)
      .insert({
        project_id:      payload.project_id,
        project_task_id: payload.project_task_id,
        lead_id:         payload.lead_id,
        quote_number:    payload.quote_number,
        client_name:     payload.client_name,
        items:           payload.items,
        status:          payload.status,
      })
      .select()
      .single()
    if (error) throw error
    return data as FurnitureWorkOrder
  }

  static async getByProject(projectId: string): Promise<FurnitureWorkOrder | null> {
    const { data, error } = await supabase
      .from(WO_TABLE)
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle()
    if (error) throw error
    return data as FurnitureWorkOrder | null
  }

  static async getByTask(taskId: string): Promise<FurnitureWorkOrder | null> {
    const { data, error } = await supabase
      .from(WO_TABLE)
      .select('*')
      .eq('project_task_id', taskId)
      .maybeSingle()
    if (error) throw error
    return data as FurnitureWorkOrder | null
  }

  static async getById(id: string): Promise<FurnitureWorkOrder | null> {
    const { data, error } = await supabase
      .from(WO_TABLE)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data as FurnitureWorkOrder | null
  }

  /** Update items array and recalculate status */
  static async updateItems(id: string, items: FurnitureWorkOrderItem[]): Promise<void> {
    const allDone    = items.every(i => i.designStatus === 'approved')
    const anyStarted = items.some(i => i.designStatus !== 'pending')
    const status     = allDone ? 'completed' : anyStarted ? 'in_progress' : 'pending'

    const { error } = await supabase
      .from(WO_TABLE)
      .update({ items, status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  /** List all work orders, newest first */
  static async getAll(): Promise<FurnitureWorkOrder[]> {
    const { data, error } = await supabase
      .from(WO_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as FurnitureWorkOrder[]
  }

  /** Link the task id after the production task has been created */
  static async linkTask(id: string, taskId: string): Promise<void> {
    const { error } = await supabase
      .from(WO_TABLE)
      .update({ project_task_id: taskId, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }
}

const LS_KEY = 'vanspace_furniture_designs'

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsGetAll(): FurnitureDesign[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function lsSave(designs: FurnitureDesign[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(designs))
}

function isTableMissing(err: any): boolean {
  const msg = String(err?.message ?? err ?? '')
  return msg.includes('schema cache') || msg.includes('relation') || msg.includes('does not exist')
}

// ─── Furniture Designs (individual piece designs) ─────────────────────────────

export class FurnitureDesignService {

  static async save(payload: {
    workOrderId: string
    leadId?: string
    projectTaskId?: string
    quoteItemName: string
    quoteItemSku?: string
    module: ModuleDimensions
    pieces: InteractivePiece[]
    optimizedCuts: PlacedPiece[]
    existingId?: string   // pass to UPDATE instead of INSERT
  }): Promise<FurnitureDesign> {
    const row = {
      work_order_id:   payload.workOrderId,
      lead_id:         payload.leadId,
      project_task_id: payload.projectTaskId,
      quote_item_name: payload.quoteItemName,
      quote_item_sku:  payload.quoteItemSku,
      module:          payload.module,
      pieces:          payload.pieces,
      optimized_cuts:  payload.optimizedCuts,
      updated_at:      new Date().toISOString(),
    }

    try {
      if (payload.existingId) {
        const { data, error } = await supabase
          .from(DES_TABLE)
          .update(row)
          .eq('id', payload.existingId)
          .select()
          .single()
        if (error) throw error
        return data as FurnitureDesign
      } else {
        const { data, error } = await supabase
          .from(DES_TABLE)
          .insert(row)
          .select()
          .single()
        if (error) throw error
        return data as FurnitureDesign
      }
    } catch (err: any) {
      if (isTableMissing(err)) {
        return FurnitureDesignService._saveToLocalStorage({
          ...row,
          id: payload.existingId || `local-${Date.now()}`,
          created_at: new Date().toISOString(),
        } as FurnitureDesign)
      }
      throw err
    }
  }

  static async getByWorkOrderItem(
    workOrderId: string,
    quoteItemName: string
  ): Promise<FurnitureDesign | null> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('work_order_id', workOrderId)
        .eq('quote_item_name', quoteItemName)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as FurnitureDesign | null
    } catch (err: any) {
      if (isTableMissing(err)) return null
      throw err
    }
  }

  /** All designs saved for a CRM lead — used in LeadDocuments */
  static async getByLead(leadId: string): Promise<FurnitureDesign[]> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureDesign[]
    } catch (err: any) {
      if (isTableMissing(err)) return lsGetAll().filter(d => d.lead_id === leadId)
      throw err
    }
  }

  /** All designs for a work order */
  static async getByWorkOrder(workOrderId: string): Promise<FurnitureDesign[]> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureDesign[]
    } catch (err: any) {
      if (isTableMissing(err)) return lsGetAll().filter(d => d.work_order_id === workOrderId)
      throw err
    }
  }

  /** Get a single design by its id */
  static async getById(id: string): Promise<FurnitureDesign | null> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as FurnitureDesign | null
    } catch (err: any) {
      if (isTableMissing(err)) return lsGetAll().find(d => d.id === id) ?? null
      throw err
    }
  }

  /** All standalone designs (no work order), newest first — the "library" */
  static async getAllStandalone(): Promise<FurnitureDesign[]> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .is('work_order_id', null)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureDesign[]
    } catch (err: any) {
      if (isTableMissing(err)) return lsGetAll().filter(d => !d.work_order_id)
      throw err
    }
  }

  /** Save a standalone design (no work order) — create or update */
  static async saveStandalone(payload: {
    name: string
    module: ModuleDimensions
    pieces: InteractivePiece[]
    optimizedCuts: PlacedPiece[]
    existingId?: string
  }): Promise<FurnitureDesign> {
    const row = {
      work_order_id:   null,
      lead_id:         null,
      project_task_id: null,
      quote_item_name: payload.name,
      module:          payload.module,
      pieces:          payload.pieces,
      optimized_cuts:  payload.optimizedCuts,
      updated_at:      new Date().toISOString(),
    }

    try {
      if (payload.existingId) {
        const { data, error } = await supabase
          .from(DES_TABLE)
          .update(row)
          .eq('id', payload.existingId)
          .select()
          .single()
        if (error) throw error
        return data as FurnitureDesign
      } else {
        const { data, error } = await supabase
          .from(DES_TABLE)
          .insert(row)
          .select()
          .single()
        if (error) throw error
        return data as FurnitureDesign
      }
    } catch (err: any) {
      if (isTableMissing(err)) {
        return FurnitureDesignService._saveToLocalStorage({
          ...row,
          id: payload.existingId || `local-${Date.now()}`,
          quote_item_name: payload.name,
          created_at: new Date().toISOString(),
        } as FurnitureDesign)
      }
      throw err
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase.from(DES_TABLE).delete().eq('id', id)
      if (error) throw error
    } catch (err: any) {
      if (isTableMissing(err)) {
        const all = lsGetAll().filter(d => d.id !== id)
        lsSave(all)
        return
      }
      throw err
    }
  }

  /** Private: save/update a design in localStorage when Supabase table is missing */
  static _saveToLocalStorage(design: FurnitureDesign): FurnitureDesign {
    const all = lsGetAll()
    const idx = all.findIndex(d => d.id === design.id)
    if (idx >= 0) all[idx] = design
    else all.unshift(design)
    lsSave(all)
    return design
  }
}
