import * as XLSX from 'xlsx'
import { supabase, uploadExcel, downloadExcel } from './supabase'

// ============================================
// HELPER: Leer Excel desde File/Blob (compatible con navegador)
// xlsx 0.18.5 en browser necesita type:'binary', NO type:'buffer'
// ============================================
function readExcelFromBinary(binary: string): XLSX.WorkBook {
  const wb = XLSX.read(binary, { type: 'binary' })
  const hasData = wb.SheetNames.some(name => {
    const ws = wb.Sheets[name]
    return Object.keys(ws).filter(k => !k.startsWith('!')).length > 0
  })
  if (!hasData) {
    throw new Error('Excel leído pero sin datos en ninguna hoja')
  }
  return wb
}

async function fileToBinary(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i])
  }
  return binary
}

// Parsear catálogo desde un workbook ya leído
function parseCatalogWorkbook(workbook: XLSX.WorkBook) {
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  
  const aoa = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, raw: false, defval: null, blankrows: false
  })
  
  if (aoa.length < 2) throw new Error('Excel vacío o sin headers')
  
  const headers = aoa[0] as string[]
  console.log('📋 Headers catálogo:', headers)
  
  const products = []
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] as any[]
    const rowObj: any = {}
    headers.forEach((header, idx) => { rowObj[header] = row[idx] })
    
    if (!rowObj['SKU']) continue
    
    products.push({
      sku: rowObj['SKU'],
      familia: rowObj['FAMILIA'],
      categoria: rowObj['CATEGORIA'],
      nombre: rowObj['NOMBRE'],
      descripcion: rowObj['DESCRIPCION'],
      precio_compra: parseFloat(rowObj['PRECIO_COMPRA']) || 0,
      precio_venta: rowObj['PRECIO DE VENTA'] ? parseFloat(rowObj['PRECIO DE VENTA']) : null,
      proveedor: rowObj['PROVEEDOR'],
      dias_entrega_proveedor: rowObj['DIAS_ENTREGA_PROVEEDOR'] ? parseInt(rowObj['DIAS_ENTREGA_PROVEEDOR']) : null,
      tiempo_total_min: parseFloat(rowObj['TIEMPO_TOTAL_MIN']) || 0,
      requiere_diseno: rowObj['REQUIERE_DISEÑO'],
      tipo_diseno: rowObj['TIPO_DISEÑO'],
      instrucciones_diseno: rowObj['INSTRUCCIONES_DISEÑO'],
      
      materiales: Array.from({ length: 5 }, (_, j) => ({
        nombre: rowObj[`MATERIAL_${j + 1}`],
        cantidad: parseFloat(rowObj[`MATERIAL_${j + 1}_CANT`]) || 0,
        unidad: rowObj[`MATERIAL_${j + 1}_UNIDAD`]
      })).filter(m => m.nombre),
      
      consumibles: Array.from({ length: 10 }, (_, j) => ({
        nombre: rowObj[`CONSUMIBLE_${j + 1}`],
        cantidad: parseFloat(rowObj[`CONSUMIBLE_${j + 1}_CANT`]) || 0,
        unidad: rowObj[`CONSUMIBLE_${j + 1}_UNIDAD`]
      })).filter(c => c.nombre),
      
      tareas: Array.from({ length: 12 }, (_, j) => ({
        nombre: rowObj[`TAREA_${j + 1}_NOMBRE`],
        duracion: parseFloat(rowObj[`TAREA_${j + 1}_DURACION`]) || 0,
        requiere_material: rowObj[`TAREA_${j + 1}_REQUIERE_MATERIAL`],
        requiere_diseno: rowObj[`TAREA_${j + 1}_REQUIERE_DISEÑO`]
      })).filter(t => t.nombre)
    })
  }
  
  return products
}

// Parsear stock desde un workbook ya leído
function parseStockWorkbook(workbook: XLSX.WorkBook) {
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  
  const aoa = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, raw: false, defval: null, blankrows: false 
  })
  
  if (aoa.length < 2) throw new Error('Excel vacío o sin headers')
  
  // Detectar headers: probar fila 0, si hay fila título probar fila 1
  let headerRowIdx = 0
  let dataStartIdx = 1
  const row0 = aoa[0] as any[]
  
  // Si la primera celda parece un título (no tiene varias columnas con nombres cortos), usar fila 1
  if (aoa.length >= 3 && row0.filter(Boolean).length <= 2) {
    headerRowIdx = 1
    dataStartIdx = 2
  }
  
  const headers = aoa[headerRowIdx] as string[]
  console.log('📋 Headers stock (fila', headerRowIdx, '):', headers)
  
  const items: any[] = []
  for (let i = dataStartIdx; i < aoa.length; i++) {
    const row = aoa[i] as any[]
    const rowObj: any = {}
    headers.forEach((header, idx) => { rowObj[header] = row[idx] })
    
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
  
  return items
}

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

  if (!products || products.length === 0) {
    console.warn('⚠️ Catálogo vacío en BD - NO se sobreescribe el Excel en Storage')
    return
  }

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
// EXPORTAR STOCK (exported so callers can trigger directly)
// ============================================
export async function exportStockToExcel() {
  const { data: stock } = await supabase
    .from('stock_items')
    .select('*')
    .order('referencia')

  if (!stock || stock.length === 0) {
    console.warn('⚠️ Stock vacío en BD - NO se sobreescribe el Excel en Storage')
    return
  }

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
export async function exportQuotesToExcel() {
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })

  if (!quotes || quotes.length === 0) {
    console.warn('⚠️ Presupuestos vacíos en BD - NO se sobreescribe el Excel en Storage')
    return
  }

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

  if (!purchases || purchases.length === 0) {
    console.warn('⚠️ Pedidos vacíos en BD - NO se sobreescribe el Excel en Storage')
    return
  }

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
// IMPORTAR CATÁLOGO: Archivo local → BD (+ subir a Storage)
// Esta es la función principal para importación inicial
// ============================================
export async function importCatalogFromFile(file: File): Promise<number> {
  try {
    console.log('📥 Importando catálogo desde archivo local:', file.name, file.size, 'bytes')
    
    // 1. Leer y parsear el archivo local
    const binary = await fileToBinary(file)
    const workbook = readExcelFromBinary(binary)
    console.log('📊 Hojas:', workbook.SheetNames)
    
    const products = parseCatalogWorkbook(workbook)
    console.log('📦 Productos parseados:', products.length)
    console.log('📦 Primer producto:', JSON.stringify(products[0]))
    
    if (products.length === 0) {
      throw new Error('No se encontraron productos con SKU en el Excel')
    }
    
    // 2. Insertar en BD
    console.log('🗑️ Borrando productos existentes...')
    await supabase.from('catalog_products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('💾 Insertando', products.length, 'productos...')
    // Insertar en lotes de 100 para evitar timeouts
    for (let i = 0; i < products.length; i += 100) {
      const batch = products.slice(i, i + 100)
      const { error } = await supabase.from('catalog_products').insert(batch)
      if (error) {
        console.error(`❌ Error insertando lote ${i}-${i + batch.length}:`, error)
        throw error
      }
      console.log(`✅ Lote ${i + 1}-${i + batch.length} insertado`)
    }
    
    // 3. Subir a Storage (SINCRÓNICO con verificación)
    console.log('📤 Subiendo a Storage para respaldo...')
    const uploadFile = new File([file], 'catalogoproductos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    console.log(`📤 Archivo a subir: ${uploadFile.name} = ${uploadFile.size} bytes`)
    
    if (uploadFile.size === 0) {
      console.error('❌ El archivo a subir tiene 0 bytes! Releyendo desde original...')
      // Fallback: crear el file desde el arrayBuffer original
      const buf = await file.arrayBuffer()
      const fallbackFile = new File([buf], 'catalogoproductos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      console.log(`📤 Fallback file: ${fallbackFile.size} bytes`)
      await uploadExcel(fallbackFile, 'catalogoproductos.xlsx')
    } else {
      await uploadExcel(uploadFile, 'catalogoproductos.xlsx')
    }
    
    // Verificar que subió correctamente
    try {
      const verify = await downloadExcel('catalogoproductos.xlsx')
      console.log(`✅ Verificación: catalogoproductos.xlsx descargado = ${verify.size} bytes`)
      if (verify.size < 100) {
        console.warn('⚠️ El archivo en Storage parece muy pequeño, puede estar vacío')
      }
    } catch (e) {
      console.warn('⚠️ No se pudo verificar el archivo en Storage:', e)
    }
    
    // Desactivar auto-export para catálogo (evitar que sobreescriba)
    try {
      await supabase.from('excel_export_queue')
        .update({ needs_export: false })
        .eq('table_name', 'catalog_products')
      console.log('🔒 Auto-export desactivado para catalog_products')
    } catch { /* tabla puede no existir */ }
    
    console.log('✅ Catálogo importado:', products.length, 'productos')
    return products.length
    
  } catch (error) {
    console.error('❌ Error importando catálogo:', error)
    throw error
  }
}

// ============================================
// IMPORTAR STOCK: Archivo local → BD (+ subir a Storage)
// ============================================
export async function importStockFromFile(file: File): Promise<number> {
  try {
    console.log('📥 Importando stock desde archivo local:', file.name, file.size, 'bytes')
    
    // 1. Leer y parsear el archivo local
    const binary = await fileToBinary(file)
    const workbook = readExcelFromBinary(binary)
    console.log('📊 Hojas:', workbook.SheetNames)
    
    const items = parseStockWorkbook(workbook)
    console.log('📦 Items parseados:', items.length)
    console.log('📦 Primer item:', JSON.stringify(items[0]))
    
    if (items.length === 0) {
      throw new Error('No se encontraron items con Referencia/Artículo en el Excel')
    }
    
    // Deduplicar por referencia (quedarse con la última aparición)
    const deduped = new Map<string, any>()
    for (const item of items) {
      const key = item.referencia || item.articulo
      deduped.set(key, item)
    }
    const uniqueItems = Array.from(deduped.values())
    console.log(`\ud83d\udce6 Items únicos: ${uniqueItems.length} (de ${items.length} totales, ${items.length - uniqueItems.length} duplicados eliminados)`)
    
    // 2. Insertar en BD
    console.log('\ud83d\uddd1\ufe0f Borrando stock existente...')
    await supabase.from('stock_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    console.log('\ud83d\udcbe Insertando', uniqueItems.length, 'items...')
    for (let i = 0; i < uniqueItems.length; i += 100) {
      const batch = uniqueItems.slice(i, i + 100)
      const { error } = await supabase.from('stock_items').upsert(batch, { onConflict: 'referencia' })
      if (error) {
        console.error(`❌ Error insertando lote ${i}-${i + batch.length}:`, error)
        throw error
      }
      console.log(`✅ Lote ${i + 1}-${i + batch.length} insertado`)
    }
    
    // 3. Subir a Storage (SINCRÓNICO con verificación)
    console.log('📤 Subiendo a Storage para respaldo...')
    const uploadFile = new File([file], 'stock.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    console.log(`📤 Archivo a subir: ${uploadFile.name} = ${uploadFile.size} bytes`)
    
    if (uploadFile.size === 0) {
      const buf = await file.arrayBuffer()
      const fallbackFile = new File([buf], 'stock.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      console.log(`📤 Fallback file: ${fallbackFile.size} bytes`)
      await uploadExcel(fallbackFile, 'stock.xlsx')
    } else {
      await uploadExcel(uploadFile, 'stock.xlsx')
    }
    
    // Verificar
    try {
      const verify = await downloadExcel('stock.xlsx')
      console.log(`✅ Verificación: stock.xlsx descargado = ${verify.size} bytes`)
    } catch (e) {
      console.warn('⚠️ No se pudo verificar stock en Storage:', e)
    }
    
    // Desactivar auto-export para stock
    try {
      await supabase.from('excel_export_queue')
        .update({ needs_export: false })
        .eq('table_name', 'stock_items')
      console.log('🔒 Auto-export desactivado para stock_items')
    } catch { /* tabla puede no existir */ }
    
    console.log('✅ Stock importado:', uniqueItems.length, 'items')
    return uniqueItems.length
    
  } catch (error) {
    console.error('❌ Error importando stock:', error)
    throw error
  }
}

// ============================================
// IMPORTAR CATÁLOGO: Storage → BD (legacy, usa download)
// ============================================
export async function syncCatalogFromExcel() {
  try {
    console.log('📥 Importando catálogo desde Storage...')
    
    const blob = await downloadExcel('catalogoproductos.xlsx')
    const binary = await fileToBinary(blob)
    const workbook = readExcelFromBinary(binary)
    const products = parseCatalogWorkbook(workbook)
    
    console.log('📦 Products parseados:', products.length)
    
    if (products.length === 0) throw new Error('No se encontraron productos')
    
    await supabase.from('catalog_products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    for (let i = 0; i < products.length; i += 100) {
      const batch = products.slice(i, i + 100)
      const { error } = await supabase.from('catalog_products').insert(batch)
      if (error) throw error
    }
    
    console.log('✅ Catálogo sincronizado:', products.length, 'productos')
    return products.length
    
  } catch (error) {
    console.error('❌ Error sincronizando catálogo:', error)
    throw error
  }
}

// ============================================
// IMPORTAR STOCK: Storage → BD (legacy, usa download)
// ============================================
export async function syncStockFromExcel() {
  try {
    console.log('📥 Importando stock desde Storage...')
    
    const blob = await downloadExcel('stock.xlsx')
    const binary = await fileToBinary(blob)
    const workbook = readExcelFromBinary(binary)
    const items = parseStockWorkbook(workbook)
    
    console.log('📦 Items parseados:', items.length)
    
    if (items.length === 0) throw new Error('No se encontraron items')
    
    // Deduplicar por referencia
    const deduped = new Map<string, any>()
    for (const item of items) {
      const key = item.referencia || item.articulo
      deduped.set(key, item)
    }
    const uniqueItems = Array.from(deduped.values())
    
    await supabase.from('stock_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    for (let i = 0; i < uniqueItems.length; i += 100) {
      const batch = uniqueItems.slice(i, i + 100)
      const { error } = await supabase.from('stock_items').upsert(batch, { onConflict: 'referencia' })
      if (error) throw error
    }
    
    console.log('✅ Stock sincronizado:', uniqueItems.length, 'items (de', items.length, 'con duplicados)')
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
      tarifa: {}, // Necesitarías más lógica aquí
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

// ============================================
// IMPORTAR CONFIGURACIÓN: Excel → BD
// ============================================
export async function syncConfigFromExcel() {
  try {
    console.log('📥 Importando configuración desde Excel...')
    
    const blob = await downloadExcel('configuracion_general.xlsx')
    const arrayBuffer = await blob.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    console.log('📊 Hojas encontradas:', workbook.SheetNames)
    
    // 1. TARIFAS
    const tarifasSheet = workbook.Sheets['Líneas de Negocio']
    const tarifasData = XLSX.utils.sheet_to_json(tarifasSheet, { header: 1 })
    const tarifasHeaders = tarifasData[0] as string[]
    const tarifas = []
    
    for (let i = 1; i < tarifasData.length; i++) {
      const row = tarifasData[i] as any[]
      if (!row[0]) continue
      
      const rowObj: any = {}
      tarifasHeaders.forEach((header, idx) => { rowObj[header] = row[idx] })
      
      tarifas.push({
        id: rowObj['ID'],
        linea_negocio: rowObj['LINEA_NEGOCIO'],
        tarifa_hora_eur: parseFloat(rowObj['TARIFA_HORA_EUR']) || 0,
        margen_materiales_pct: parseFloat(rowObj['MARGEN_MATERIALES_%']) || 0,
        urgencia: rowObj['URGENCIA'],
        dias_trabajo_semana: parseInt(rowObj['DIAS_TRABAJO_SEMANA']) || null,
        horas_dia: parseFloat(rowObj['HORAS_DIA']) || null,
        activa: rowObj['ACTIVA'] === 'SÍ' || rowObj['ACTIVA'] === true,
      })
    }
    
    await supabase.from('business_lines').delete().neq('id', '---')
    await supabase.from('business_lines').insert(tarifas)
    console.log('✅ Tarifas:', tarifas.length)
    
    // 2. EMPLEADOS
    const employeesSheet = workbook.Sheets['Empleados Producción']
    const employeesData = XLSX.utils.sheet_to_json(employeesSheet, { header: 1 })
    const employeesHeaders = employeesData[0] as string[]
    const employees = []
    
    for (let i = 1; i < employeesData.length; i++) {
      const row = employeesData[i] as any[]
      if (!row[0]) continue
      
      const rowObj: any = {}
      employeesHeaders.forEach((header, idx) => { rowObj[header] = row[idx] })
      
      employees.push({
        id: rowObj['ID'],
        nombre: rowObj['NOMBRE'],
        rol: rowObj['ROL'],
        especialidad_principal: rowObj['ESPECIALIDAD_PRINCIPAL'],
        especialidad_secundaria: rowObj['ESPECIALIDAD_SECUNDARIA'],
        tarifa_hora_eur: parseFloat(rowObj['TARIFA_HORA_EUR']) || null,
        horas_semanales: parseInt(rowObj['HORAS_SEMANALES']) || null,
        email: rowObj['EMAIL'],
        telefono: rowObj['TELEFONO'],
        activo: true,
      })
    }
    
    await supabase.from('production_employees').delete().neq('id', '---')
    await supabase.from('production_employees').insert(employees)
    console.log('✅ Empleados:', employees.length)
    
    // 3. ROLES
    const rolesSheet = workbook.Sheets['Roles y Responsabilidades']
    const rolesData = XLSX.utils.sheet_to_json(rolesSheet, { header: 1 })
    const rolesHeaders = rolesData[0] as string[]
    const roles = []
    
    for (let i = 1; i < rolesData.length; i++) {
      const row = rolesData[i] as any[]
      if (!row[0]) continue
      
      const rowObj: any = {}
      rolesHeaders.forEach((header, idx) => { rowObj[header] = row[idx] })
      
      roles.push({
        rol: rowObj['ROL'],
        nivel: rowObj['NIVEL'],
        anos_experiencia: rowObj['AÑOS_EXPERIENCIA'],
        puede_realizar: rowObj['PUEDE_REALIZAR'],
        tarifa_min_eur: parseFloat(rowObj['TARIFA_MIN_EUR']) || null,
        tarifa_max_eur: parseFloat(rowObj['TARIFA_MAX_EUR']) || null,
        descripcion: rowObj['DESCRIPCION'],
      })
    }
    
    await supabase.from('roles').delete().neq('rol', '---')
    await supabase.from('roles').insert(roles)
    console.log('✅ Roles:', roles.length)
    
    // 4. CONFIGURACIÓN GENERAL (todas las hojas de config)
    const configSheets = [
      'Configuración Calendario',
      'Configuración Compras',
      'Configuración Producción',
      'Configuración Diseño',
      'Configuración Presupuestos'
    ]
    
    const configSettings = []
    
    for (const sheetName of configSheets) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
      const category = sheetName.replace('Configuración ', '').toLowerCase()
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[]
        if (!row[0]) continue
        
        const key = String(row[0]).toLowerCase().replace(/ /g, '_')
        let value = String(row[1] || '')
        const unit = row[2] || null
        const description = row[3] || null
        
        // Detectar tipo de dato
        let dataType = 'text'
        if (value === 'SÍ' || value === 'NO') {
          dataType = 'boolean'
          value = value === 'SÍ' ? 'true' : 'false'
        } else if (!isNaN(parseFloat(value))) {
          dataType = 'number'
        }
        
        configSettings.push({
          key: `${category}.${key}`,
          value,
          category,
          unit,
          description,
          data_type: dataType,
        })
      }
    }
    
    await supabase.from('config_settings').delete().neq('key', '---')
    await supabase.from('config_settings').insert(configSettings)
    console.log('✅ Configuraciones:', configSettings.length)
    
    // 5. ALERTAS
    const alertsSheet = workbook.Sheets['Alertas y Notificaciones']
    const alertsData = XLSX.utils.sheet_to_json(alertsSheet, { header: 1 })
    const alertsHeaders = alertsData[0] as string[]
    const alerts = []
    
    for (let i = 1; i < alertsData.length; i++) {
      const row = alertsData[i] as any[]
      if (!row[0]) continue
      
      const rowObj: any = {}
      alertsHeaders.forEach((header, idx) => { rowObj[header] = row[idx] })
      
      alerts.push({
        tipo_alerta: rowObj['TIPO_ALERTA'],
        activa: rowObj['ACTIVA'] === 'SÍ' || rowObj['ACTIVA'] === true,
        destinatario: rowObj['DESTINATARIO'],
        condicion: rowObj['CONDICION'],
      })
    }
    
    await supabase.from('alert_settings').delete().neq('tipo_alerta', '---')
    await supabase.from('alert_settings').insert(alerts)
    console.log('✅ Alertas:', alerts.length)
    
    // 6. DATOS EMPRESA
    const companySheet = workbook.Sheets['Datos Empresa']
    const companyData = XLSX.utils.sheet_to_json(companySheet, { header: 1 })
    const companyInfo = []
    
    for (let i = 1; i < companyData.length; i++) {
      const row = companyData[i] as any[]
      if (!row[0]) continue
      
      companyInfo.push({
        campo: row[0],
        valor: row[1] || '',
      })
    }
    
    await supabase.from('company_info').delete().neq('campo', '---')
    await supabase.from('company_info').insert(companyInfo)
    console.log('✅ Datos empresa:', companyInfo.length)
    
    return {
      tarifas: tarifas.length,
      employees: employees.length,
      roles: roles.length,
      config: configSettings.length,
      alerts: alerts.length,
      company: companyInfo.length,
    }
    
  } catch (error) {
    console.error('❌ Error importando configuración:', error)
    throw error
  }
}