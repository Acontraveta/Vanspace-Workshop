import { supabase } from '@/lib/supabase'
import {
  FurnitureDesign,
  FurnitureWorkOrder,
  FurnitureWorkOrderItem,
  InteractivePiece,
  ModuleDimensions,
  PlacedPiece,
  DesignType,
} from '../types/furniture.types'

const WO_TABLE  = 'furniture_work_orders'
const DES_TABLE = 'furniture_designs'

// ─── Work Orders ─────────────────────────────────────────────────────────────

const LS_WO_KEY = 'vanspace_furniture_work_orders'

export class FurnitureWorkOrderService {

  static async create(
    payload: Omit<FurnitureWorkOrder, 'id' | 'created_at' | 'updated_at'>
  ): Promise<FurnitureWorkOrder> {
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .insert({
          project_id:      payload.project_id,
          project_task_id: payload.project_task_id,
          lead_id:         payload.lead_id,
          quote_number:    payload.quote_number,
          client_name:     payload.client_name,
          design_type:     payload.design_type || 'furniture',
          items:           payload.items,
          status:          payload.status,
        })
        .select()
        .single()
      if (error) throw error
      return data as FurnitureWorkOrder
    } catch (err: any) {
      if (isTableMissing(err)) {
        // Fallback: save to localStorage
        const wo: FurnitureWorkOrder = {
          id: `local-wo-${Date.now()}`,
          project_id:      payload.project_id,
          project_task_id: payload.project_task_id ?? '',
          lead_id:         payload.lead_id,
          quote_number:    payload.quote_number,
          client_name:     payload.client_name,
          design_type:     payload.design_type || 'furniture',
          items:           payload.items as FurnitureWorkOrderItem[],
          status:          payload.status,
          created_at:      new Date().toISOString(),
          updated_at:      new Date().toISOString(),
        }
        const all = FurnitureWorkOrderService._lsGetAll()
        all.unshift(wo)
        localStorage.setItem(LS_WO_KEY, JSON.stringify(all))
        return wo
      }
      throw err
    }
  }

  static async getByProject(projectId: string): Promise<FurnitureWorkOrder | null> {
    let supabaseWo: FurnitureWorkOrder | null = null
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle()
      if (error) throw error
      supabaseWo = data as FurnitureWorkOrder | null
    } catch (err: any) {
      if (!isTableMissing(err)) throw err
    }

    // Always check localStorage for SVG data that may not be in Supabase
    // (cutlist_svg / board_cutlist_svgs columns might not exist in DB yet)
    const lsAll = FurnitureWorkOrderService._lsGetAll()
    const lsWo = lsAll.find(w => w.project_id === projectId) ?? null

    if (supabaseWo && lsWo) {
      // Merge: Supabase data + localStorage SVGs
      const merged = {
        ...supabaseWo,
        cutlist_svg: supabaseWo.cutlist_svg || lsWo.cutlist_svg,
        board_cutlist_svgs: (supabaseWo as any).board_cutlist_svgs || (lsWo as any).board_cutlist_svgs,
      }
      console.log('🔍 getByProject: merged Supabase + localStorage for', projectId,
        'cutlist_svg:', !!merged.cutlist_svg,
        'board_svgs:', !!merged.board_cutlist_svgs)
      return merged
    }

    if (supabaseWo) return supabaseWo
    if (lsWo) {
      console.log('🔍 getByProject: localStorage only for', projectId,
        'cutlist_svg:', !!lsWo.cutlist_svg,
        'board_svgs:', !!((lsWo as any).board_cutlist_svgs))
      return lsWo
    }

    console.log('🔍 getByProject: NOT FOUND for', projectId, '(supabase + localStorage)')
    return null
  }

  static async getByTask(taskId: string): Promise<FurnitureWorkOrder | null> {
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .select('*')
        .eq('project_task_id', taskId)
        .maybeSingle()
      if (error) throw error
      return data as FurnitureWorkOrder | null
    } catch (err: any) {
      if (isTableMissing(err)) return FurnitureWorkOrderService._lsGetAll().find(w => w.project_task_id === taskId) ?? null
      throw err
    }
  }

  static async getById(id: string): Promise<FurnitureWorkOrder | null> {
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as FurnitureWorkOrder | null
    } catch (err: any) {
      if (isTableMissing(err)) return FurnitureWorkOrderService._lsGetAll().find(w => w.id === id) ?? null
      throw err
    }
  }

  /** Update items array and recalculate status */
  static async updateItems(id: string, items: FurnitureWorkOrderItem[]): Promise<void> {
    const allDone    = items.every(i => i.designStatus === 'approved')
    const anyStarted = items.some(i => i.designStatus !== 'pending')
    const status     = allDone ? 'completed' : anyStarted ? 'in_progress' : 'pending'

    try {
      const { error } = await supabase
        .from(WO_TABLE)
        .update({ items, status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      if (isTableMissing(err)) {
        // Fallback: update in localStorage
        const all = FurnitureWorkOrderService._lsGetAll()
        const idx = all.findIndex(w => w.id === id)
        if (idx >= 0) {
          all[idx] = { ...all[idx], items, status, updated_at: new Date().toISOString() }
          localStorage.setItem(LS_WO_KEY, JSON.stringify(all))
        }
        return
      }
      throw err
    }
  }

  /** List all work orders, newest first */
  static async getAll(): Promise<FurnitureWorkOrder[]> {
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureWorkOrder[]
    } catch (err: any) {
      if (isTableMissing(err)) return FurnitureWorkOrderService._lsGetAll()
      throw err
    }
  }

  /** List work orders filtered by design_type */
  static async getAllByType(type: DesignType): Promise<FurnitureWorkOrder[]> {
    try {
      const { data, error } = await supabase
        .from(WO_TABLE)
        .select('*')
        .eq('design_type', type)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureWorkOrder[]
    } catch (err: any) {
      if (isTableMissing(err)) return FurnitureWorkOrderService._lsGetAll().filter(w => (w.design_type || 'furniture') === type)
      throw err
    }
  }

  /** Link the task id after the production task has been created */
  static async linkTask(id: string, taskId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(WO_TABLE)
        .update({ project_task_id: taskId, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      if (isTableMissing(err)) return
      throw err
    }
  }

  /** Store the combined cut-list SVG on the work order */
  static async updateCutlistSvg(id: string, cutlistSvg: string, boardCutlistSvgs?: string[]): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        cutlist_svg: cutlistSvg,
        updated_at: new Date().toISOString(),
      }
      if (boardCutlistSvgs) updates.board_cutlist_svgs = boardCutlistSvgs
      const { error } = await supabase
        .from(WO_TABLE)
        .update(updates)
        .eq('id', id)
      if (error) throw error
    } catch (err: any) {
      if (isTableMissing(err)) {
        try {
          const all = FurnitureWorkOrderService._lsGetAll()
          const idx = all.findIndex(w => w.id === id)
          if (idx >= 0) {
            all[idx] = {
              ...all[idx],
              cutlist_svg: cutlistSvg,
              ...(boardCutlistSvgs ? { board_cutlist_svgs: boardCutlistSvgs } : {}),
              updated_at: new Date().toISOString(),
            }
            const json = JSON.stringify(all)
            console.log('💾 updateCutlistSvg → localStorage:', (json.length / 1024).toFixed(0), 'KB,',
              boardCutlistSvgs?.length ?? 0, 'board SVGs')
            localStorage.setItem(LS_WO_KEY, json)
          } else {
            console.warn('⚠️ updateCutlistSvg: WO not found in localStorage for id:', id)
          }
        } catch (lsErr) {
          console.error('❌ updateCutlistSvg: localStorage write failed (quota?):', lsErr)
        }
        return
      }
      throw err
    }
  }

  /**
   * Replace MUEBLES_GROUP tasks with the final operator task list:
   *   1. "Cortar tablero N — MaterialName" (one per physical board)
   *   2. "Ensamblar: <itemName>" (one per furniture item)
   */
  static async rebuildFurnitureTasks(
    projectId: string,
    boards: { boardLabel: string; materialName: string; pieceCount: number; estimatedHours: number; pieceRefs?: string[] }[],
    assemblyItems: { quoteItemName: string; estimatedHours: number; pieceCount: number; pieceNames?: string[] }[],
  ): Promise<void> {
    try {
      // Delete old MUEBLES_GROUP tasks for this project
      const { error: delErr } = await supabase
        .from('production_tasks')
        .delete()
        .eq('project_id', projectId)
        .eq('task_block_id', 'MUEBLES_GROUP')
      if (delErr) throw delErr

      const now = new Date().toISOString()

      // Create one cutting task per board
      const cuttingTasks = boards.map((board, idx) => ({
        project_id: projectId,
        task_name: `Cortar: ${board.boardLabel}`,
        product_name: `${board.materialName} (${board.pieceCount} pieza${board.pieceCount !== 1 ? 's' : ''})`,
        estimated_hours: board.estimatedHours,
        status: 'PENDING',
        requires_material: null,
        material_ready: true,
        requires_design: true,
        design_ready: true,
        order_index: idx,
        task_block_id: 'MUEBLES_GROUP',
        block_order: idx,
        is_block_first: idx === 0,
        materials_collected: false,
        catalog_sku: 'MUEBLES_GROUP',
        created_at: now,
        // Populated fields for operator — JSON.stringify for TEXT columns
        materials: JSON.stringify([{ name: board.materialName, quantity: 1, unit: 'tablero' }]),
        consumables: JSON.stringify([{ name: 'Disco de sierra / cuchilla', quantity: 1, unit: 'ud' }]),
        instructions_design: `Cortar ${board.pieceCount} pieza${board.pieceCount !== 1 ? 's' : ''} del tablero de ${board.materialName}.\nVer plano de despiece adjunto.${board.pieceRefs?.length ? '\n\nPiezas: ' + board.pieceRefs.join(', ') : ''}`,
        requiere_diseno: true,
      }))

      if (cuttingTasks.length > 0) {
        const { error: cutErr } = await supabase
          .from('production_tasks')
          .insert(cuttingTasks)
        if (cutErr) throw cutErr
      }

      // Create one assembly task per furniture item
      const orderOffset = boards.length
      const assemblyTasks = assemblyItems.map((item, idx) => ({
        project_id: projectId,
        task_name: `Ensamblar: ${item.quoteItemName}`,
        product_name: item.quoteItemName,
        estimated_hours: item.estimatedHours,
        status: 'PENDING',
        requires_material: null,
        material_ready: true,
        requires_design: true,
        design_ready: true,
        order_index: orderOffset + idx,
        task_block_id: 'MUEBLES_GROUP',
        block_order: orderOffset + idx,
        is_block_first: false,
        materials_collected: false,
        catalog_sku: 'MUEBLES_GROUP',
        created_at: now,
        // Populated fields for operator — JSON.stringify for TEXT columns
        materials: JSON.stringify([]),
        consumables: JSON.stringify([
          { name: 'Cola de carpintero', quantity: 1, unit: 'ud' },
          { name: 'Tornillos / herrajes', quantity: 1, unit: 'juego' },
        ]),
        instructions_design: `Ensamblar ${item.quoteItemName} (${item.pieceCount} piezas).\nVer plano de montaje adjunto.${item.pieceNames?.length ? '\n\nPiezas: ' + item.pieceNames.join(', ') : ''}`,
        requiere_diseno: true,
      }))

      if (assemblyTasks.length > 0) {
        const { error: asmErr } = await supabase
          .from('production_tasks')
          .insert(assemblyTasks)
        if (asmErr) throw asmErr
      }
    } catch (err: any) {
      console.warn('rebuildFurnitureTasks: Supabase error, saving tasks to localStorage', err)
      // localStorage fallback: store the rebuilt task names on the WO so
      // TaskInstructionsModal can still find them
      try {
        const all = FurnitureWorkOrderService._lsGetAll()
        const idx = all.findIndex(w => w.project_id === projectId)
        if (idx >= 0) {
          (all[idx] as any)._rebuilt_tasks = [
            ...boards.map((b, i) => ({ task_name: `Cortar: ${b.boardLabel}`, product_name: b.materialName, type: 'cutting', block_order: i })),
            ...assemblyItems.map((item, i) => ({ task_name: `Ensamblar: ${item.quoteItemName}`, product_name: item.quoteItemName, type: 'assembly', block_order: boards.length + i })),
          ]
          localStorage.setItem(LS_WO_KEY, JSON.stringify(all))
        }
      } catch { /* best-effort */ }
      return
    }
  }

  /** localStorage helpers */
  static _lsGetAll(): FurnitureWorkOrder[] {
    try { return JSON.parse(localStorage.getItem(LS_WO_KEY) || '[]') } catch { return [] }
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
  const msg = String(err?.message ?? err ?? '').toLowerCase()
  // Catch any Supabase / PostgREST error that indicates the table or column
  // isn't available: PGRST204 (column), PGRST205 (table), schema cache issues,
  // Postgres relation errors, RLS errors on non-existent objects, etc.
  return (
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    msg.includes('does not exist') ||
    msg.includes('pgrst') ||
    msg.includes('could not find') ||
    msg.includes('column') ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('undefined') ||
    msg.includes('permission denied')
  )
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
      if (isTableMissing(err)) {
        // Fallback: search localStorage
        return lsGetAll().find(d =>
          d.work_order_id === workOrderId && d.quote_item_name === quoteItemName
        ) ?? null
      }
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
    let supabaseDesigns: FurnitureDesign[] | null = null
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      supabaseDesigns = (data ?? []) as FurnitureDesign[]
    } catch (err: any) {
      if (!isTableMissing(err)) throw err
    }

    // Merge localStorage (for blueprint_svg that may not be in DB column)
    const lsDesigns = lsGetAll().filter(d => d.work_order_id === workOrderId)

    if (supabaseDesigns && supabaseDesigns.length > 0) {
      // Merge blueprint_svg from localStorage into Supabase results
      const lsMap = new Map(lsDesigns.map(d => [d.id, d]))
      const merged = supabaseDesigns.map(d => {
        const lsVersion = lsMap.get(d.id)
        if (lsVersion?.blueprint_svg && !d.blueprint_svg) {
          return { ...d, blueprint_svg: lsVersion.blueprint_svg }
        }
        return d
      })
      console.log('🔍 getByWorkOrder: merged', merged.length, 'designs,',
        merged.filter(d => d.blueprint_svg).length, 'con plano')
      return merged
    }

    if (lsDesigns.length > 0) {
      console.log('🔍 getByWorkOrder localStorage:', lsDesigns.length, 'designs for WO:', workOrderId,
        lsDesigns.map(d => `${d.quote_item_name} bp:${!!d.blueprint_svg}`))
      return lsDesigns
    }

    return []
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

  /** Store generated blueprint SVG on a design (called on approval) */
  static async updateBlueprint(designId: string, blueprintSvg: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(DES_TABLE)
        .update({ blueprint_svg: blueprintSvg, updated_at: new Date().toISOString() })
        .eq('id', designId)
      if (error) throw error
    } catch (err: any) {
      if (isTableMissing(err)) {
        try {
          const all = lsGetAll()
          const idx = all.findIndex(d => d.id === designId)
          if (idx >= 0) {
            all[idx] = { ...all[idx], blueprint_svg: blueprintSvg, updated_at: new Date().toISOString() }
            console.log('💾 updateBlueprint → localStorage:', designId, blueprintSvg.length, 'bytes')
            lsSave(all)
          } else {
            console.warn('⚠️ updateBlueprint: Design not found in localStorage for id:', designId)
          }
        } catch (lsErr) {
          console.error('❌ updateBlueprint: localStorage write failed (quota?):', lsErr)
        }
        return
      }
      throw err
    }
  }

  /** Get all designs linked to a production task (by project_task_id) */
  static async getByProjectTaskId(projectTaskId: string): Promise<FurnitureDesign[]> {
    try {
      const { data, error } = await supabase
        .from(DES_TABLE)
        .select('*')
        .eq('project_task_id', projectTaskId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as FurnitureDesign[]
    } catch (err: any) {
      if (isTableMissing(err)) return lsGetAll().filter(d => d.project_task_id === projectTaskId)
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
