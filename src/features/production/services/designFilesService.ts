import { supabase } from '@/lib/supabase'

export interface DesignFile {
  id: string
  block_id: string
  project_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
  notes?: string
}

export class DesignFilesService {
  
  // Subir archivo al bucket
  static async uploadFile(
    file: File,
    blockId: string,
    projectId: string,
    uploadedBy: string,
    notes?: string
  ): Promise<DesignFile | null> {
    try {
      // 1. Subir archivo a Storage
      const fileName = `${blockId}/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('design-files')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // 2. Guardar metadata en la tabla
      const { data, error } = await supabase
        .from('design_files')
        .insert({
          block_id: blockId,
          project_id: projectId,
          file_name: file.name,
          file_path: uploadData.path,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: uploadedBy,
          notes: notes || null
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error subiendo archivo:', error)
      return null
    }
  }

  // Obtener archivos de un bloque
  static async getBlockFiles(blockId: string): Promise<DesignFile[]> {
    try {
      const { data, error } = await supabase
        .from('design_files')
        .select('*')
        .eq('block_id', blockId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error obteniendo archivos:', error)
      return []
    }
  }

  // Obtener URL pública temporal (signed URL válida 1 hora)
  static async getFileUrl(filePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('design-files')
        .createSignedUrl(filePath, 3600) // 1 hora

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Error obteniendo URL:', error)
      return null
    }
  }

  // Descargar archivo
  static async downloadFile(filePath: string, fileName: string): Promise<void> {
    const url = await this.getFileUrl(filePath)
    if (!url) return

    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }

  // Eliminar archivo
  static async deleteFile(fileId: string, filePath: string): Promise<boolean> {
    try {
      // 1. Eliminar de Storage
      const { error: storageError } = await supabase.storage
        .from('design-files')
        .remove([filePath])

      if (storageError) throw storageError

      // 2. Eliminar metadata
      const { error: dbError } = await supabase
        .from('design_files')
        .delete()
        .eq('id', fileId)

      if (dbError) throw dbError
      return true
    } catch (error) {
      console.error('Error eliminando archivo:', error)
      return false
    }
  }
}