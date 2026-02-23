import { supabase } from '@/lib/supabase'

const BUCKET = 'lead-documents'
const TABLE  = 'lead_documents'

// ─── Types ───────────────────────────────────────────────────

export type DocCategory =
  | 'presupuesto'
  | 'factura'
  | 'inspeccion'
  | 'homologacion'
  | 'contrato'
  | 'seguro'
  | 'ficha_tecnica'
  | 'foto'
  | 'plano'
  | 'despiece'
  | 'otro'

export const DOC_CATEGORIES: { value: DocCategory; label: string; icon: string }[] = [
  { value: 'presupuesto',   label: 'Presupuesto',    icon: '📋' },
  { value: 'factura',       label: 'Factura',         icon: '🧾' },
  { value: 'inspeccion',    label: 'Inspección',      icon: '🔍' },
  { value: 'homologacion',  label: 'Homologación',    icon: '📜' },
  { value: 'contrato',      label: 'Contrato',        icon: '✍️' },
  { value: 'seguro',        label: 'Seguro',          icon: '🛡️' },
  { value: 'ficha_tecnica', label: 'Ficha técnica',   icon: '📄' },
  { value: 'foto',          label: 'Foto',            icon: '📷' },
  { value: 'plano',         label: 'Plano técnico',   icon: '📐' },
  { value: 'despiece',      label: 'Despiece',        icon: '🪚' },
  { value: 'otro',          label: 'Otro',            icon: '📎' },
]

export interface LeadDocument {
  id: string
  lead_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  doc_category: DocCategory
  notes?: string
  uploaded_by?: string
  uploaded_at: string
}

// ─── Service ─────────────────────────────────────────────────

export class LeadDocumentsService {

  static async getByLead(leadId: string): Promise<LeadDocument[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false })

    if (error) throw error
    return (data ?? []) as LeadDocument[]
  }

  static async upload(
    leadId: string,
    file: File,
    category: DocCategory,
    notes: string,
    uploadedBy: string
  ): Promise<LeadDocument> {
    // 1. Upload to Storage
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${leadId}/${Date.now()}-${safeName}`

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file)

    if (storageError) throw storageError

    // 2. Save metadata to DB
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        lead_id: leadId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        doc_category: category,
        notes: notes || null,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single()

    if (error) {
      // Rollback storage upload on DB error
      await supabase.storage.from(BUCKET).remove([filePath])
      throw error
    }

    return data as LeadDocument
  }

  static async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, expiresIn)

    if (error) {
      console.error('Error getting signed URL:', error)
      return null
    }
    return data.signedUrl
  }

  static async download(filePath: string, fileName: string): Promise<void> {
    const url = await this.getSignedUrl(filePath)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.click()
  }

  static async openInTab(filePath: string): Promise<void> {
    const url = await this.getSignedUrl(filePath)
    if (url) window.open(url, '_blank')
  }

  static async delete(id: string, filePath: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([filePath])
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (error) throw error
  }

  static formatSize(bytes: number): string {
    if (bytes < 1024)       return `${bytes} B`
    if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  }

  static mimeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/'))                return '🖼️'
    if (mimeType === 'application/pdf')               return '📕'
    if (mimeType === 'image/svg+xml')                 return '📐'
    if (mimeType.includes('word'))                    return '📝'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
    if (mimeType.includes('zip') || mimeType.includes('rar'))           return '🗜️'
    return '📎'
  }

  /**
   * Upload an SVG string as a document file for a lead.
   * Used to auto-save blueprints and cutlists from furniture design.
   */
  static async uploadSvg(
    leadId: string,
    svgContent: string,
    fileName: string,
    category: DocCategory,
    notes: string,
  ): Promise<LeadDocument | null> {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const file = new File([blob], fileName, { type: 'image/svg+xml' })
      return await this.upload(leadId, file, category, notes, 'sistema')
    } catch (err) {
      console.error('Error uploading SVG to lead documents:', err)
      return null
    }
  }
}
