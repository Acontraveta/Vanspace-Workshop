import * as XLSX from 'xlsx'
import { uploadExcel } from '@/lib/supabase'
import { getAllLeads } from './leadService'
import { CRM_EXCEL_FILENAME } from './excelImporter'
import type { Lead } from '../types/crm.types'

// Excel column headers (in order)
const EXPORT_COLUMNS: Array<{ header: string; key: keyof Lead }> = [
  { header: 'Fecha', key: 'fecha' },
  { header: 'Mes', key: 'mes' },
  { header: 'Asignado', key: 'asignado' },
  { header: 'Cliente', key: 'cliente' },
  { header: 'Teléfono', key: 'telefono' },
  { header: 'Email', key: 'email' },
  { header: 'Localidad', key: 'localidad' },
  { header: 'Provincia', key: 'provincia' },
  { header: 'Región', key: 'region' },
  { header: 'Origen', key: 'origen' },
  { header: 'Vehículo', key: 'vehiculo' },
  { header: 'Talla', key: 'talla' },
  { header: 'Viaj/Dorm', key: 'viaj_dorm' },
  { header: 'Línea negocio', key: 'linea_negocio' },
  { header: 'Estado', key: 'estado' },
  { header: 'Importe', key: 'importe' },
  { header: 'Próxima acción', key: 'proxima_accion' },
  { header: 'Fecha acción', key: 'fecha_accion' },
  { header: 'Notas', key: 'notas' },
  { header: 'Fecha entrega', key: 'fecha_entrega' },
  { header: 'Satisfacción', key: 'satisfaccion' },
  { header: 'Incidencias', key: 'incidencias' },
  { header: 'Reseña', key: 'resena' },
]

// ============================================================
// EXPORT: Supabase → XLSX → Storage
// ============================================================

export async function exportCRMToExcel(
  onProgress?: (msg: string) => void
): Promise<void> {
  try {
    onProgress?.('📤 Leyendo leads desde base de datos...')
    const leads = await getAllLeads()

    onProgress?.(`📊 Generando Excel con ${leads.length} leads...`)
    const workbook = buildWorkbook(leads)

    // Convert to blob
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const file = new File([blob], CRM_EXCEL_FILENAME)

    onProgress?.('☁️ Subiendo a Storage...')
    await uploadExcel(file, CRM_EXCEL_FILENAME)

    onProgress?.(`✅ CRM exportado: ${leads.length} leads`)
  } catch (error) {
    console.error('❌ Error exportando CRM:', error)
    throw error
  }
}

// ============================================================
// DOWNLOAD: build XLSX and trigger browser download
// ============================================================

export async function downloadCRMAsExcel(leads: Lead[]): Promise<void> {
  const workbook = buildWorkbook(leads)
  XLSX.writeFile(workbook, `crm_export_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ============================================================
// INTERNAL
// ============================================================

function buildWorkbook(leads: Lead[]): XLSX.WorkBook {
  const headers = EXPORT_COLUMNS.map(c => c.header)

  const rows = leads.map(lead =>
    EXPORT_COLUMNS.map(col => {
      const val = lead[col.key]
      if (val == null) return ''
      return val
    })
  )

  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = EXPORT_COLUMNS.map(c => ({
    wch: Math.min(40, Math.max(12, c.header.length + 4))
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CRM Leads')
  return wb
}
