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

  /** Link the task id after the production task has been created */
  static async linkTask(id: string, taskId: string): Promise<void> {
    const { error } = await supabase
      .from(WO_TABLE)
      .update({ project_task_id: taskId, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }
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
  }

  static async getByWorkOrderItem(
    workOrderId: string,
    quoteItemName: string
  ): Promise<FurnitureDesign | null> {
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
  }

  /** All designs saved for a CRM lead — used in LeadDocuments */
  static async getByLead(leadId: string): Promise<FurnitureDesign[]> {
    const { data, error } = await supabase
      .from(DES_TABLE)
      .select('*')
      .eq('lead_id', leadId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as FurnitureDesign[]
  }

  /** All designs for a work order */
  static async getByWorkOrder(workOrderId: string): Promise<FurnitureDesign[]> {
    const { data, error } = await supabase
      .from(DES_TABLE)
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as FurnitureDesign[]
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase.from(DES_TABLE).delete().eq('id', id)
    if (error) throw error
  }
}
