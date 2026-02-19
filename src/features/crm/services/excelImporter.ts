import * as XLSX from 'xlsx'
import { downloadExcel } from '@/lib/supabase'
import { upsertLeads } from './leadService'
import type { Lead } from '../types/crm.types'

// The CRM Excel file name in Supabase Storage (bucket: excel-files)
export const CRM_EXCEL_FILENAME = 'CRM_VanSpace_Mejorado (1).xlsx'

// ============================================================
// NORMALISE helper
// ============================================================

const norm = (s: any): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_\-\/]+/g, '_')
    .trim()

// Map normalised header → Lead field name
const NORM_FIELD_MAP: Record<string, keyof Lead> = {
  // fecha
  fecha: 'fecha', date: 'fecha',
  // mes
  mes: 'mes', month: 'mes',
  // asignado
  asignado: 'asignado', assigned: 'asignado', comercial: 'asignado', vendedor: 'asignado',
  // cliente
  cliente: 'cliente', client: 'cliente', nombre: 'cliente', nombre_cliente: 'cliente',
  customer: 'cliente', nombre_del_cliente: 'cliente',
  // telefono
  telefono: 'telefono', tlf: 'telefono', tel: 'telefono', movil: 'telefono',
  phone: 'telefono', telfono: 'telefono',
  // email
  email: 'email', correo: 'email', e_mail: 'email',
  // localidad
  localidad: 'localidad', ciudad: 'localidad', poblacion: 'localidad', municipio: 'localidad',
  // provincia
  provincia: 'provincia',
  // region
  region: 'region', zona: 'region', comunidad: 'region',
  // origen
  origen: 'origen', canal: 'origen', fuente: 'origen', procedencia: 'origen',
  // vehiculo
  vehiculo: 'vehiculo', coche: 'vehiculo', furgoneta: 'vehiculo', modelo: 'vehiculo',
  vehiculo_modelo: 'vehiculo',
  // talla
  talla: 'talla', tamano: 'talla', size: 'talla',
  // viaj_dorm
  viaj_dorm: 'viaj_dorm', viajero_dormitorio: 'viaj_dorm', viaj: 'viaj_dorm',
  tipo_distribucion: 'viaj_dorm', distribucion: 'viaj_dorm',
  // linea_negocio
  linea_negocio: 'linea_negocio', linea: 'linea_negocio', negocio: 'linea_negocio',
  tipo_proyecto: 'linea_negocio',
  // estado
  estado: 'estado', status: 'estado', situacion: 'estado',
  // importe
  importe: 'importe', precio: 'importe', presupuesto: 'importe', total: 'importe',
  valor: 'importe', importe_eur: 'importe',
  // proxima_accion
  proxima_accion: 'proxima_accion', proxima: 'proxima_accion', siguiente_accion: 'proxima_accion',
  accion: 'proxima_accion', next_action: 'proxima_accion',
  // fecha_accion
  fecha_accion: 'fecha_accion', fecha_proxima: 'fecha_accion', fecha_seguimiento: 'fecha_accion',
  // notas
  notas: 'notas', nota: 'notas', observaciones: 'notas', comentarios: 'notas',
  // fecha_entrega
  fecha_entrega: 'fecha_entrega', entrega: 'fecha_entrega',
  f__entrega: 'fecha_entrega', f_entrega: 'fecha_entrega', fentrega: 'fecha_entrega',
  // satisfaccion
  satisfaccion: 'satisfaccion', valoracion: 'satisfaccion', rating: 'satisfaccion',
  // incidencias
  incidencias: 'incidencias', incidencia: 'incidencias', problemas: 'incidencias',
  // resena
  resena: 'resena', review: 'resena', opinion: 'resena',
}

// ============================================================
// FIND BEST SHEET + HEADER ROW
// ============================================================

function buildResolvedMap(
  headers: string[],
  onProgress?: (msg: string) => void
): Record<number, keyof Lead> {
  const resolved: Record<number, keyof Lead> = {}
  const matched: string[] = []
  const unmatched: string[] = []

  headers.forEach((h, i) => {
    if (!h || h === '__EMPTY') { unmatched.push(`col${i}`); return }
    const n = norm(h)
    if (NORM_FIELD_MAP[n]) {
      resolved[i] = NORM_FIELD_MAP[n]
      matched.push(`${h}→${NORM_FIELD_MAP[n]}`)
    } else {
      unmatched.push(h)
    }
  })

  onProgress?.(`🗺️ Columnas reconocidas: ${matched.length}/${headers.length} → ${matched.join(', ')}`)
  if (unmatched.length) onProgress?.(`⚠️ Sin mapeo: ${unmatched.join(', ')}`)
  return resolved
}

// ============================================================
// PARSE DATE
// ============================================================

function parseExcelDate(value: any): string | undefined {
  if (value == null || value === '' || value === 0) return undefined
  if (typeof value === 'number') {
    // Excel serial 0 or 1 = invalid / 1900-01-00 artefact
    if (value < 2) return undefined
    const date = XLSX.SSF.parse_date_code(value)
    if (!date || date.y < 1900 || date.d === 0) return undefined
    return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return undefined
    // Reject obviously invalid dates
    if (s === '1900-01-00' || s.endsWith('-00')) return undefined
    const ddmm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmm) return `${ddmm[3]}-${ddmm[2].padStart(2,'0')}-${ddmm[1].padStart(2,'0')}`
    return s
  }
  return undefined
}

// ============================================================
// ROW → LEAD (uses column index map)
// ============================================================

function rawRowToLead(
  row: any[],
  rowIndex: number,
  colMap: Record<number, keyof Lead>
): Partial<Lead> {
  const lead: Partial<Lead> = { excel_row_number: rowIndex }

  for (const [colStr, field] of Object.entries(colMap)) {
    const value = row[Number(colStr)]
    if (value == null || value === '') continue

    if (['fecha', 'fecha_accion', 'fecha_entrega'].includes(field as string)) {
      ;(lead as any)[field] = parseExcelDate(value)
    } else if (field === 'importe') {
      const parsed = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'))
      ;(lead as any)[field] = isNaN(parsed) ? undefined : parsed
    } else {
      ;(lead as any)[field] = String(value).trim()
    }
  }

  return lead
}

// ============================================================
// PARSE WORKBOOK → leads array
// ============================================================

function scoreSheet(rawRows: any[][]): { headerRowIndex: number; headers: string[]; score: number } {
  let bestRow = 0
  let bestScore = 0
  const limit = Math.min(15, rawRows.length)
  for (let i = 0; i < limit; i++) {
    const row = rawRows[i] ?? []
    const score = row.filter((cell: any) => {
      const n = norm(cell)
      return n.length > 1 && !!NORM_FIELD_MAP[n]
    }).length
    if (score > bestScore) {
      bestScore = score
      bestRow = i
    }
  }
  const headers = (rawRows[bestRow] ?? []).map((c: any) =>
    c == null ? '__EMPTY' : String(c).trim()
  )
  return { headerRowIndex: bestRow, headers, score: bestScore }
}

function parseWorkbook(
  workbook: XLSX.WorkBook,
  onProgress?: (msg: string) => void
): Partial<Lead>[] {
  // Find the sheet with the highest column-recognition score
  let bestSheetName = workbook.SheetNames[0]
  let bestResult = { headerRowIndex: 0, headers: [] as string[], score: -1 }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, raw: true, defval: null,
    }) as any[][]
    const result = scoreSheet(rawRows)
    onProgress?.(`📄 Hoja "${sheetName}": score ${result.score} (cabecera fila ${result.headerRowIndex + 1})`)
    if (result.score > bestResult.score) {
      bestResult = result
      bestSheetName = sheetName
    }
  }

  onProgress?.(`✅ Usando hoja: "${bestSheetName}"`)

  const worksheet = workbook.Sheets[bestSheetName]
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, raw: true, defval: null,
  }) as any[][]

  const { headerRowIndex, headers } = bestResult
  onProgress?.(`📋 Cabecera en fila ${headerRowIndex + 1}: ${headers.join(', ')}`)

  const colMap = buildResolvedMap(headers, onProgress)

  const dataRows = rawRows.slice(headerRowIndex + 1)
  onProgress?.(`📦 ${dataRows.length} filas de datos`)

  return dataRows
    .map((row, i) => rawRowToLead(row, headerRowIndex + i + 2, colMap))
    .filter(l => l.cliente && String(l.cliente).trim() !== '')
}

// ============================================================
// IMPORT: Storage → Parse → Supabase
// ============================================================

export async function importCRMFromExcel(
  onProgress?: (msg: string) => void
): Promise<number> {
  try {
    onProgress?.('📥 Descargando Excel desde Storage...')
    const blob = await downloadExcel(CRM_EXCEL_FILENAME)

    const arrayBuffer = await blob.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })

    const leads = parseWorkbook(workbook, onProgress)

    if (leads.length === 0) {
      throw new Error('No se encontraron filas con cliente válido tras detectar cabeceras')
    }

    const count = await upsertLeads(leads)
    onProgress?.(`✅ ${count} leads importados correctamente`)
    return count

  } catch (error) {
    console.error('❌ Error importando CRM:', error)
    throw error
  }
}

// ============================================================
// IMPORT FROM FILE (user uploads manually)
// ============================================================

export async function importCRMFromFile(
  file: File,
  onProgress?: (msg: string) => void
): Promise<number> {
  try {
    onProgress?.('📊 Parseando archivo...')
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })

    const leads = parseWorkbook(workbook, onProgress)

    if (leads.length === 0) {
      throw new Error('No se encontraron filas con cliente válido')
    }

    const count = await upsertLeads(leads)
    onProgress?.(`✅ ${count} leads importados`)
    return count

  } catch (error) {
    console.error('❌ Error importando CRM desde archivo:', error)
    throw error
  }
}

