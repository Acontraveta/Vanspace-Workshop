import * as XLSX from 'xlsx'
import { supabase, uploadExcel, downloadExcel } from './supabase'

// ============================================
// EXPORTAR BD → Excel (automático después de cambios)
// ============================================

export async function exportAllToExcel() {
  try {
    // Verificar qué tablas necesitan exportación
    const { data: queue } = await supabase
      .from('excel_export_queue')
      .select('*')
      .eq('needs_export', true)

    if (!queue || queue.length === 0) {
      console.log('✅ Excels ya están actualizados')
      return
    }

    console.log('📤 Exportando a Excel:', queue.map(q => q.table_name))

    for (const item of queue) {
      switch (item.table_name) {
        case 'catalog_products':
          await exportCatalogToExcel()
          break
        case 'stock_items':
          await exportStockToExcel()
          break
        case 'quotes':
          await exportQuotesToExcel()
          break
        case 'purchase_items':
          await exportPurchasesToExcel()
          break
      }

      // Marcar como exportado
      await supabase
        .from('excel_export_queue')
        .update({ needs_export: false, last_exported_at: new Date().toISOString() })
        .eq('table_name', item.table_name)
    }

    console.log('✅ Excels actualizados en Storage')
  } catch (error) {
    console.error('❌ Error exportando:', error)
  }
}

// ============================================
// EXPORTAR CATÁLOGO
// ============================================
async function exportCatalogToExcel() {
  const { data: products } = await supabase
    .from('catalog_products')
    .select('*')
    .order('sku')

  if (!products) return

  const rows = products.map(p => {
    const row: any = {
      SKU: p.sku,
      FAMILIA: p.familia,
      CATEGORIA: p.categoria,
      NOMBRE: p.nombre,
      DESCRIPCION: p.descripcion,
      PRECIO_COMPRA: p.precio_compra,
      'PRECIO DE VENTA': p.precio_venta,
      PROVEEDOR: p.proveedor,
      DIAS_ENTREGA_PROVEEDOR: p.dias_entrega_proveedor,
      TIEMPO_TOTAL_MIN: p.tiempo_total_min,
      REQUIERE_DISEÑO: p.requiere_diseno,
      TIPO_DISEÑO: p.tipo_diseno,
      INSTRUCCIONES_DISEÑO: p.instrucciones_diseno,
    }

    // Expandir materiales
    const materiales = p.materiales || []
    for (let i = 0; i < 5; i++) {
      const mat = materiales[i] || {}
      row[`MATERIAL_${i + 1}`] = mat.nombre || ''
      row[`MATERIAL_${i + 1}_CANT`] = mat.cantidad || 0
      row[`MATERIAL_${i + 1}_UNIDAD`] = mat.unidad || ''
    }

    // Consumibles
    const consumibles = p.consumibles || []
    for (let i = 0; i < 10; i++) {
      const cons = consumibles[i] || {}
      row[`CONSUMIBLE_${i + 1}`] = cons.nombre || ''
      row[`CONSUMIBLE_${i + 1}_CANT`] = cons.cantidad || 0
      row[`CONSUMIBLE_${i + 1}_UNIDAD`] = cons.unidad || ''
    }

    // Tareas
    const tareas = p.tareas || []
    for (let i = 0; i < 12; i++) {
      const tarea = tareas[i] || {}
      row[`TAREA_${i + 1}_NOMBRE`] = tarea.nombre || ''
      row[`TAREA_${i + 1}_DURACION`] = tarea.duracion || 0
      row[`TAREA_${i + 1}_REQUIERE_MATERIAL`] = tarea.requiere_material || ''
      row[`TAREA_${i + 1}_REQUIERE_DISEÑO`] = tarea.requiere_diseno || ''
    }

    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catálogo')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], 'catalogoproductos.xlsx')

  await uploadExcel(file, 'catalogoproductos.xlsx')
  console.log('✅ Catálogo exportado a Storage')
}

// ============================================
// EXPORTAR STOCK
// ============================================
async function exportStockToExcel() {
  const { data: stock } = await supabase
    .from('stock_items')
    .select('*')
    .order('referencia')

  if (!stock) return

  const rows = stock.map(s => ({
    'Referencia': s.referencia,
    'Familia': s.familia,
    'Categoría': s.categoria,
    'Artículo': s.articulo,
    'Descripción': s.descripcion,
    'Cantidad': s.cantidad,
    'Stock mínimo': s.stock_minimo,
    'Unidad': s.unidad,
    'Coste IVA incluido': s.coste_iva_incluido,
    'Ubicación': s.ubicacion,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], 'stock.xlsx')

  await uploadExcel(file, 'stock.xlsx')
  console.log('✅ Stock exportado a Storage')
}

// ============================================
// EXPORTAR PRESUPUESTOS
// ============================================
async function exportQuotesToExcel() {
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })

  if (!quotes) return

  const rows = quotes.map(q => ({
    'Nº Presupuesto': q.quote_number,
    'Cliente': q.client_name,
    'Email': q.client_email,
    'Teléfono': q.client_phone,
    'Vehículo': q.vehicle_model,
    'NIF': q.billing_nif,
    'Razón Social': q.billing_fiscal_name,
    'Dirección': q.billing_address,
    'CP': q.billing_postal_code,
    'Ciudad': q.billing_city,
    'Provincia': q.billing_province,
    'País': q.billing_country,
    'Subtotal Materiales': q.subtotal_materials,
    'Subtotal Mano Obra': q.subtotal_labor,
    'Subtotal': q.subtotal,
    'Beneficio': q.profit_amount,
    'Total': q.total,
    'Horas Totales': q.total_hours,
    'Estado': q.status,
    'Fecha Creación': new Date(q.created_at).toLocaleDateString('es-ES'),
    'Válido Hasta': q.valid_until ? new Date(q.valid_until).toLocaleDateString('es-ES') : '',
    'Fecha Aprobación': q.approved_at ? new Date(q.approved_at).toLocaleDateString('es-ES') : '',
    'Notas': q.notes,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Presupuestos')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], 'presupuestos.xlsx')

  await uploadExcel(file, 'presupuestos.xlsx')
  console.log('✅ Presupuestos exportados a Storage')
}

// ============================================
// EXPORTAR PEDIDOS
// ============================================
async function exportPurchasesToExcel() {
  const { data: purchases } = await supabase
    .from('purchase_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (!purchases) return

  const rows = purchases.map(p => ({
    'Proyecto ID': p.project_id,
    'Nº Proyecto': p.project_number,
    'Referencia': p.referencia,
    'Material': p.material_name,
    'Cantidad': p.quantity,
    'Unidad': p.unit,
    'Proveedor': p.provider,
    'Días Entrega': p.delivery_days,
    'Prioridad': p.priority,
    'SKU Producto': p.product_sku,
    'Producto': p.product_name,
    'Estado': p.status,
    'Fecha Creación': new Date(p.created_at).toLocaleDateString('es-ES'),
    'Fecha Pedido': p.ordered_at ? new Date(p.ordered_at).toLocaleDateString('es-ES') : '',
    'Fecha Recepción': p.received_at ? new Date(p.received_at).toLocaleDateString('es-ES') : '',
    'Notas': p.notes,
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos')

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const file = new File([blob], 'pedidos.xlsx')

  await uploadExcel(file, 'pedidos.xlsx')
  console.log('✅ Pedidos exportados a Storage')
}

// ============================================
// IMPORTAR CATÁLOGO: Excel → BD
// ============================================
export async function syncCatalogFromExcel() {
  try {
    console.log('📥 Importando catálogo desde Excel...')
    
    const blob = await downloadExcel('catalogoproductos.xlsx')
    const arrayBuffer = await blob.arrayBuffer()
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null })
    
    const products = jsonData.map((row: any) => ({
      sku: row['SKU'],
      familia: row['FAMILIA'],
      categoria: row['CATEGORIA'],
      nombre: row['NOMBRE'],
      descripcion: row['DESCRIPCION'],
      precio_compra: parseFloat(row['PRECIO_COMPRA']) || 0,
      precio_venta: row['PRECIO DE VENTA'] ? parseFloat(row['PRECIO DE VENTA']) : null,
      proveedor: row['PROVEEDOR'],
      dias_entrega_proveedor: row['DIAS_ENTREGA_PROVEEDOR'] ? parseInt(row['DIAS_ENTREGA_PROVEEDOR']) : null,
      tiempo_total_min: parseFloat(row['TIEMPO_TOTAL_MIN']) || 0,
      requiere_diseno: row['REQUIERE_DISEÑO'],
      tipo_diseno: row['TIPO_DISEÑO'],
      instrucciones_diseno: row['INSTRUCCIONES_DISEÑO'],
      
      materiales: Array.from({ length: 5 }, (_, i) => ({
        nombre: row[`MATERIAL_${i + 1}`],
        cantidad: parseFloat(row[`MATERIAL_${i + 1}_CANT`]) || 0,
        unidad: row[`MATERIAL_${i + 1}_UNIDAD`]
      })).filter(m => m.nombre),
      
      consumibles: Array.from({ length: 10 }, (_, i) => ({
        nombre: row[`CONSUMIBLE_${i + 1}`],
        cantidad: parseFloat(row[`CONSUMIBLE_${i + 1}_CANT`]) || 0,
        unidad: row[`CONSUMIBLE_${i + 1}_UNIDAD`]
      })).filter(c => c.nombre),
      
      tareas: Array.from({ length: 12 }, (_, i) => ({
        nombre: row[`TAREA_${i + 1}_NOMBRE`],
        duracion: parseFloat(row[`TAREA_${i + 1}_DURACION`]) || 0,
        requiere_material: row[`TAREA_${i + 1}_REQUIERE_MATERIAL`],
        requiere_diseno: row[`TAREA_${i + 1}_REQUIERE_DISEÑO`]
      })).filter(t => t.nombre)
    }))
    
    // Borrar productos existentes
    await supabase.from('catalog_products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insertar nuevos
    const { error } = await supabase.from('catalog_products').insert(products)
    
    if (error) throw error
    
    console.log('✅ Catálogo sincronizado:', products.length, 'productos')
    return products.length
    
  } catch (error) {
    console.error('❌ Error sincronizando catálogo:', error)
    throw error
  }
}

// ============================================
// IMPORTAR STOCK: Excel → BD
// ============================================
export async function syncStockFromExcel() {
  try {
    console.log('📥 Importando stock desde Excel...')
    
    const blob = await downloadExcel('stock.xlsx')
    const arrayBuffer = await blob.arrayBuffer()
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null })
    
    const headers = aoa[1] as string[]
    const items: any[] = []
    
    for (let i = 2; i < aoa.length; i++) {
      const row = aoa[i] as any[]
      const rowObj: any = {}
      headers.forEach((header, idx) => {
        rowObj[header] = row[idx]
      })
      
      if (rowObj['Referencia'] || rowObj['Artículo']) {
        items.push({
          referencia: String(rowObj['Referencia'] || ''),
          familia: String(rowObj['Familia'] || ''),
          categoria: String(rowObj['Categoría'] || ''),
          articulo: String(rowObj['Artículo'] || ''),
          descripcion: rowObj['Descripción'] || null,
          cantidad: parseFloat(rowObj['Cantidad']) || 0,
          stock_minimo: parseFloat(rowObj['Stock mínimo']) || null,
          unidad: String(rowObj['Unidad'] || 'ud'),
          coste_iva_incluido: parseFloat(rowObj['Coste IVA incluido']) || 0,
          ubicacion: rowObj['Ubicación'] || rowObj['UBICACION'] || rowObj['Ubicacion'] || null,
        })
      }
    }
    
    // Borrar stock existente
    await supabase.from('stock_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insertar nuevo stock
    const { error } = await supabase.from('stock_items').insert(items)
    
    if (error) throw error
    
    console.log('✅ Stock sincronizado:', items.length, 'items')
    return items.length
    
  } catch (error) {
    console.error('❌ Error sincronizando stock:', error)
    throw error
  }
}

// ============================================
// IMPORTAR PRESUPUESTOS: Excel → BD
// ============================================
export async function syncQuotesFromExcel() {
  try {
    console.log('📥 Importando presupuestos desde Excel...')
    
    const blob = await downloadExcel('presupuestos.xlsx')
    const arrayBuffer = await blob.arrayBuffer()
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null })
    
    const quotes = jsonData.map((row: any) => ({
      quote_number: row['Nº Presupuesto'],
      client_name: row['Cliente'],
      client_email: row['Email'],
      client_phone: row['Teléfono'],
      vehicle_model: row['Vehículo'],
      billing_nif: row['NIF'],
      billing_fiscal_name: row['Razón Social'],
      billing_address: row['Dirección'],
      billing_postal_code: row['CP'],
      billing_city: row['Ciudad'],
      billing_province: row['Provincia'],
      billing_country: row['País'],
      subtotal_materials: parseFloat(row['Subtotal Materiales']) || 0,
      subtotal_labor: parseFloat(row['Subtotal Mano Obra']) || 0,
      subtotal: parseFloat(row['Subtotal']) || 0,
      profit_amount: parseFloat(row['Beneficio']) || 0,
      total: parseFloat(row['Total']) || 0,
      total_hours: parseFloat(row['Horas Totales']) || 0,
      status: row['Estado'] || 'DRAFT',
      notes: row['Notas'],
      business_line: {}, // Necesitarías más lógica aquí
      items: [], // Necesitarías más lógica aquí
    }))
    
    // Borrar presupuestos existentes
    await supabase.from('quotes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insertar nuevos
    const { error } = await supabase.from('quotes').insert(quotes)
    
    if (error) throw error
    
    console.log('✅ Presupuestos sincronizados:', quotes.length)
    return quotes.length
    
  } catch (error) {
    console.error('❌ Error sincronizando presupuestos:', error)
    throw error
  }
}

// ============================================
// IMPORTAR PEDIDOS: Excel → BD
// ============================================
export async function syncPurchasesFromExcel() {
  try {
    console.log('📥 Importando pedidos desde Excel...')
    
    const blob = await downloadExcel('pedidos.xlsx')
    const arrayBuffer = await blob.arrayBuffer()
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null })
    
    const purchases = jsonData.map((row: any) => ({
      project_id: row['Proyecto ID'],
      project_number: row['Nº Proyecto'],
      referencia: row['Referencia'],
      material_name: row['Material'],
      quantity: parseFloat(row['Cantidad']) || 0,
      unit: row['Unidad'] || 'ud',
      provider: row['Proveedor'],
      delivery_days: row['Días Entrega'] ? parseInt(row['Días Entrega']) : null,
      priority: row['Prioridad'] ? parseInt(row['Prioridad']) : 5,
      product_sku: row['SKU Producto'],
      product_name: row['Producto'],
      status: row['Estado'] || 'PENDING',
      notes: row['Notas'],
    }))
    
    // Borrar pedidos existentes
    await supabase.from('purchase_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Insertar nuevos
    const { error } = await supabase.from('purchase_items').insert(purchases)
    
    if (error) throw error
    
    console.log('✅ Pedidos sincronizados:', purchases.length)
    return purchases.length
    
  } catch (error) {
    console.error('❌ Error sincronizando pedidos:', error)
    throw error
  }
}

// ============================================
// DESCARGAR EXCEL (para usuario)
// ============================================
export async function downloadCatalogExcel() {
  const blob = await downloadExcel('catalogoproductos.xlsx')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `catalogo_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadStockExcel() {
  const blob = await downloadExcel('stock.xlsx')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `stock_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadQuotesExcel() {
  const blob = await downloadExcel('presupuestos.xlsx')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `presupuestos_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadPurchasesExcel() {
  const blob = await downloadExcel('pedidos.xlsx')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pedidos_${new Date().toISOString().split('T')[0]}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}