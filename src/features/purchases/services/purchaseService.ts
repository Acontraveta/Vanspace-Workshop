import { PurchaseItem } from '../types/purchase.types'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// â”€â”€ Row mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toDb(item: PurchaseItem): Record<string, any> {
  return {
    id:             item.id,
    project_id:     item.projectId ?? null,
    project_number: item.projectNumber ?? null,
    referencia:     item.referencia ?? null,
    material_name:  item.materialName,
    quantity:       item.quantity,
    unit:           item.unit,
    provider:       item.provider ?? null,
    delivery_days:  item.deliveryDays ?? 7,
    priority:       item.priority,
    product_sku:    item.productSKU ?? null,
    product_name:   item.productName ?? null,
    status:         item.status,
    ordered_at:     item.orderedAt instanceof Date ? item.orderedAt.toISOString() : (item.orderedAt ?? null),
    received_at:    item.receivedAt instanceof Date ? item.receivedAt.toISOString() : (item.receivedAt ?? null),
    notes:          item.notes ?? null,
    attachments:    item.attachments && item.attachments.length > 0 ? JSON.stringify(item.attachments) : null,
    created_at:     item.createdAt instanceof Date ? item.createdAt.toISOString() : new Date().toISOString(),
    order_group_id:      item.orderGroupId ?? null,
    invoice_number:      item.invoiceNumber ?? null,
    invoice_date:        item.invoiceDate ?? null,
    invoice_amount:      item.invoiceAmount ?? null,
    invoice_vat_pct:     item.invoiceVatPct ?? null,
    invoice_vat_amount:  item.invoiceVatAmount ?? null,
    invoice_provider_nif: item.invoiceProviderNif ?? null,
    invoice_image_url:    item.invoiceImageUrl ?? null,
  }
}

function fromDb(row: any): PurchaseItem {
  return {
    id:            row.id,
    projectId:     row.project_id ?? undefined,
    projectNumber: row.project_number ?? undefined,
    referencia:    row.referencia ?? undefined,
    materialName:  row.material_name,
    quantity:      Number(row.quantity ?? 0),
    unit:          row.unit ?? 'ud',
    provider:      row.provider ?? undefined,
    deliveryDays:  row.delivery_days ?? 7,
    priority:      Number(row.priority ?? 5),
    productSKU:    row.product_sku ?? undefined,
    productName:   row.product_name ?? undefined,
    status:        row.status,
    orderedAt:     row.ordered_at ? new Date(row.ordered_at) : undefined,
    receivedAt:    row.received_at ? new Date(row.received_at) : undefined,
    notes:         row.notes ?? undefined,
    attachments:   row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : undefined,
    createdAt:     new Date(row.created_at ?? Date.now()),
    orderGroupId:      row.order_group_id ?? undefined,
    invoiceNumber:     row.invoice_number ?? undefined,
    invoiceDate:       row.invoice_date ?? undefined,
    invoiceAmount:     row.invoice_amount != null ? Number(row.invoice_amount) : undefined,
    invoiceVatPct:     row.invoice_vat_pct != null ? Number(row.invoice_vat_pct) : undefined,
    invoiceVatAmount:  row.invoice_vat_amount != null ? Number(row.invoice_vat_amount) : undefined,
    invoiceProviderNif: row.invoice_provider_nif ?? undefined,
    invoiceImageUrl:    row.invoice_image_url ?? undefined,
  }
}

export class PurchaseService {

  // Generar cÃ³digo QR para un producto
  // Generar QR para un producto
  static async generateProductQR(item: PurchaseItem): Promise<string> {
    try {
      return await QRCode.toDataURL(
        JSON.stringify({ type: 'warehouse_product', referencia: item.referencia, nombre: item.materialName, timestamp: Date.now() }),
        { width: 400, margin: 2 }
      )
    } catch (error) {
      console.error('Error generando QR:', error)
      return ''
    }
  }

  // Obtener todos los pedidos
  static async getAllPurchases(): Promise<PurchaseItem[]> {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Error cargando pedidos:', error)
      return []
    }
    return (data ?? []).map(fromDb)
  }

  // Guardar (upsert) pedido
  static async savePurchase(item: PurchaseItem): Promise<void> {
    const { error } = await supabase
      .from('purchase_items')
      .upsert(toDb(item), { onConflict: 'id' })
    if (error) throw error
  }

  // Guardar múltiples pedidos a la vez
  static async savePurchases(items: PurchaseItem[]): Promise<void> {
    if (items.length === 0) return
    const { data, error } = await supabase
      .from('purchase_items')
      .upsert(items.map(toDb), { onConflict: 'id' })
      .select('id')
    if (error) throw error
    // Verify rows were actually inserted (RLS without WITH CHECK silently drops INSERTs)
    if (!data || data.length === 0) {
      throw new Error(`RLS bloqueó la inserción de ${items.length} pedidos. Ejecuta la migración 031 en Supabase SQL Editor.`)
    }
  }

  // Marcar como pedido
  static async markAsOrdered(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('purchase_items')
      .update({ status: 'ORDERED', ordered_at: new Date().toISOString() })
      .eq('id', itemId)
    if (error) throw error
    toast.success('Marcado como pedido')
  }

  /**
   * Marcar varios items como pedidos agrupados en un bloque de pedido,
   * con datos de factura de compra compartidos.
   */
  static async markOrderGroup(
    itemIds: string[],
    invoiceData: {
      invoiceNumber?: string
      invoiceDate?: string
      invoiceAmount?: number
      invoiceVatPct?: number
      invoiceVatAmount?: number
      invoiceProviderNif?: string
    }
  ): Promise<void> {
    if (itemIds.length === 0) return
    const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('purchase_items')
      .update({
        status: 'ORDERED',
        ordered_at: now,
        order_group_id: groupId,
        invoice_number: invoiceData.invoiceNumber || null,
        invoice_date: invoiceData.invoiceDate || null,
        invoice_amount: invoiceData.invoiceAmount ?? null,
        invoice_vat_pct: invoiceData.invoiceVatPct ?? null,
        invoice_vat_amount: invoiceData.invoiceVatAmount ?? null,
        invoice_provider_nif: invoiceData.invoiceProviderNif || null,
      })
      .in('id', itemIds)
    if (error) throw error

    toast.success(`📦 ${itemIds.length} artículo(s) marcados como pedidos`)
  }

  // Marcar como recibido y generar QR
  static async markAsReceived(itemId: string): Promise<string | null> {
    try {
      const { data: row, error: fetchErr } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('id', itemId)
        .single()
      if (fetchErr || !row) throw new Error('Pedido no encontrado')

      const item = fromDb(row)
      const referenciaFinal = item.referencia || item.materialName.replace(/\s+/g, '-').toUpperCase()

      // 1. AÃ±adir o actualizar stock
      const { data: existingStock } = await supabase
        .from('stock_items')
        .select('*')
        .eq('referencia', referenciaFinal)
        .maybeSingle()

      if (existingStock) {
        const { error: upErr } = await supabase
          .from('stock_items')
          .update({ cantidad: existingStock.cantidad + item.quantity, updated_at: new Date().toISOString() })
          .eq('referencia', existingStock.referencia)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase
          .from('stock_items')
          .insert({
            referencia:   referenciaFinal,
            articulo:     item.materialName,
            descripcion:  `Material recibido â€” pedido ${item.projectNumber || 'sin proyecto'}`,
            cantidad:     item.quantity,
            unidad:       item.unit,
            familia:      'Materiales',
            categoria:    'Compras',
            proveedor:    item.provider,
            stock_minimo: Math.ceil(item.quantity * 0.2),
            ubicacion:    null,
          })
        if (insErr) throw insErr
      }

      // 2. Generar QR
      const qrDataURL = await QRCode.toDataURL(
        JSON.stringify({ type: 'warehouse_product', referencia: referenciaFinal, nombre: item.materialName, quantity: item.quantity, unit: item.unit }),
        { width: 300, margin: 2 }
      )

      // 3. Marcar pedido como recibido
      const { error: statusErr } = await supabase
        .from('purchase_items')
        .update({ status: 'RECEIVED', received_at: new Date().toISOString() })
        .eq('id', itemId)
      if (statusErr) throw statusErr

      // 4. Re-exportar stock.xlsx en Storage (no-blocking)
      import('@/lib/excelSync')
        .then(({ exportStockToExcel }) => exportStockToExcel())
        .catch(e => console.warn('⚠️ No se pudo actualizar stock.xlsx tras recepción:', e))

      return qrDataURL
    } catch (error) {
      console.error('Error en markAsReceived:', error)
      throw error
    }
  }

  // Obtener por estado
  static async getByStatus(status: PurchaseItem['status']): Promise<PurchaseItem[]> {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('status', status)
      .order('priority', { ascending: false })
    if (error) return []
    return (data ?? []).map(fromDb)
  }

  // Obtener por proyecto
  static async getByProject(projectId: string): Promise<PurchaseItem[]> {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('project_id', projectId)
    if (error) return []
    return (data ?? []).map(fromDb)
  }

  // Agrupar por proveedor
  static async groupByProvider(): Promise<Record<string, PurchaseItem[]>> {
    const items = await this.getAllPurchases()
    return items.reduce((acc, item) => {
      const provider = item.provider || 'Sin proveedor'
      if (!acc[provider]) acc[provider] = []
      acc[provider].push(item)
      return acc
    }, {} as Record<string, PurchaseItem[]>)
  }

  // Pendientes ordenados por prioridad
  static async getPendingByPriority(): Promise<PurchaseItem[]> {
    return this.getByStatus('PENDING')
  }

  /**
   * Subir factura de compra compartida para un bloque de pedido.
   * Se sube una sola imagen/PDF y se asigna la URL a TODOS los items del grupo.
   */
  static async uploadGroupInvoice(orderGroupId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin'
    const ts = Date.now()
    const path = `purchases/groups/${orderGroupId}/${ts}.${ext}`

    // Subir a Storage
    const { error: uploadErr } = await supabase.storage
      .from('excel-files')
      .upload(path, file, { cacheControl: '3600', upsert: true })
    if (uploadErr) throw uploadErr

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('excel-files')
      .getPublicUrl(path)
    const url = urlData.publicUrl

    // Asignar la URL a todos los items del grupo
    const { error: updateErr } = await supabase
      .from('purchase_items')
      .update({ invoice_image_url: url })
      .eq('order_group_id', orderGroupId)
    if (updateErr) throw updateErr

    return url
  }

  /**
   * Eliminar factura de compra compartida de un bloque de pedido.
   */
  static async removeGroupInvoice(orderGroupId: string, url: string): Promise<void> {
    // Eliminar de Storage
    const match = url.match(/\/excel-files\/(.+)$/)
    if (match) {
      await supabase.storage.from('excel-files').remove([match[1]])
    }

    // Quitar la URL de todos los items del grupo
    const { error } = await supabase
      .from('purchase_items')
      .update({ invoice_image_url: null })
      .eq('order_group_id', orderGroupId)
    if (error) throw error
  }

  // Subir documento adjunto (albarán, factura, etc.)
  static async uploadAttachment(itemId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'bin'
    const ts = Date.now()
    const path = `purchases/${itemId}/${ts}.${ext}`

    // Subir a Storage
    const { error: uploadErr } = await supabase.storage
      .from('excel-files')
      .upload(path, file, { cacheControl: '3600', upsert: true })
    if (uploadErr) throw uploadErr

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('excel-files')
      .getPublicUrl(path)

    const url = urlData.publicUrl

    // Añadir al array de attachments del pedido
    const { data: row } = await supabase
      .from('purchase_items')
      .select('attachments')
      .eq('id', itemId)
      .single()

    const existing: string[] = row?.attachments
      ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments)
      : []
    existing.push(url)

    await supabase
      .from('purchase_items')
      .update({ attachments: JSON.stringify(existing) })
      .eq('id', itemId)

    return url
  }

  // Eliminar documento adjunto
  static async removeAttachment(itemId: string, url: string): Promise<void> {
    // Extraer path desde URL
    const match = url.match(/\/excel-files\/(.+)$/)
    if (match) {
      await supabase.storage.from('excel-files').remove([match[1]])
    }

    const { data: row } = await supabase
      .from('purchase_items')
      .select('attachments')
      .eq('id', itemId)
      .single()

    const existing: string[] = row?.attachments
      ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments)
      : []
    const updated = existing.filter(a => a !== url)

    await supabase
      .from('purchase_items')
      .update({ attachments: JSON.stringify(updated) })
      .eq('id', itemId)
  }

  // ── Eliminar pedido completamente del sistema ──────────
  static async deletePurchase(itemId: string): Promise<void> {
    // Limpiar adjuntos de Storage antes de borrar la fila
    const { data: row } = await supabase
      .from('purchase_items')
      .select('attachments, invoice_image_url')
      .eq('id', itemId)
      .single()

    if (row) {
      const attachments: string[] = row.attachments
        ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments)
        : []
      const paths: string[] = []
      for (const url of attachments) {
        const m = url.match(/\/excel-files\/(.+)$/)
        if (m) paths.push(m[1])
      }
      if (row.invoice_image_url) {
        const m = row.invoice_image_url.match(/\/excel-files\/(.+)$/)
        if (m) paths.push(m[1])
      }
      if (paths.length > 0) {
        await supabase.storage.from('excel-files').remove(paths)
      }
    }

    const { error } = await supabase
      .from('purchase_items')
      .delete()
      .eq('id', itemId)

    if (error) {
      console.error('❌ Error eliminando pedido:', error.message)
      throw error
    }
  }

  // Eliminar múltiples pedidos a la vez
  static async deletePurchases(itemIds: string[]): Promise<void> {
    for (const id of itemIds) {
      await this.deletePurchase(id)
    }
  }
}
