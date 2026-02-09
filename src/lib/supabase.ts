import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rqumbscotqlcffmcwswv.supabase.co'
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdW1ic2NvdHFsY2ZmbWN3c3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjYwNjIsImV4cCI6MjA4NjIwMjA2Mn0.gGAdFHsZvO1syM6dISwRcOdkVa9KNOfYaSw-FuduXEA'

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
