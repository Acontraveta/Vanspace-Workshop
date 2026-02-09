import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://siM20xKHZQTsN6VvC9CI5Q.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'tu_clave_publica_aqui'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funciones helper para Storage
export const uploadExcel = async (file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from('excel-files')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    })
  
  if (error) throw error
  return data
}

export const getExcelUrl = (path: string) => {
  const { data } = supabase.storage
    .from('excel-files')
    .getPublicUrl(path)
  
  return data.publicUrl
}

export const downloadExcel = async (path: string): Promise<Blob> => {
  const { data, error } = await supabase.storage
    .from('excel-files')
    .download(path)
  
  if (error) throw error
  return data
}

export const listExcelFiles = async () => {
  const { data, error } = await supabase.storage
    .from('excel-files')
    .list()
  
  if (error) throw error
  return data
}
