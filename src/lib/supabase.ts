import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rqumbscotqlcffmcwswv.supabase.co'
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdW1ic2NvdHFsY2ZmbWN3c3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjYwNjIsImV4cCI6MjA4NjIwMjA2Mn0.gGAdFHsZvO1syM6dISwRcOdkVa9KNOfYaSw-FuduXEA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funciones helper para Storage
export const uploadExcel = async (file: File, path: string) => {
  console.log(`📤 Storage: subiendo ${path} (${file.size} bytes)...`)
  
  // PASO 1: Borrar el archivo viejo primero (upsert no siempre funciona)
  const { error: removeError } = await supabase.storage
    .from('excel-files')
    .remove([path])
  
  if (removeError) {
    console.warn('⚠️ No se pudo borrar archivo anterior (puede no existir):', removeError.message)
  } else {
    console.log('🗑️ Archivo anterior eliminado')
  }
  
  // PASO 2: Subir el nuevo archivo
  const { data, error } = await supabase.storage
    .from('excel-files')
    .upload(path, file, {
      cacheControl: '0',
      upsert: true
    })
  
  if (error) {
    console.error('❌ Error subiendo:', error)
    throw error
  }
  
  console.log('✅ Storage: archivo subido correctamente:', data)
  return data
}

export const getExcelUrl = (path: string) => {
  const { data } = supabase.storage
    .from('excel-files')
    .getPublicUrl(path)
  
  return data.publicUrl
}

export const downloadExcel = async (path: string): Promise<Blob> => {
  console.log(`📥 Storage: descargando ${path}...`)
  // Use public URL with cache-busting timestamp to bypass CDN cache
  const { data: urlData } = supabase.storage
    .from('excel-files')
    .getPublicUrl(path)
  
  const cacheBuster = `t=${Date.now()}`
  const separator = urlData.publicUrl.includes('?') ? '&' : '?'
  const freshUrl = `${urlData.publicUrl}${separator}${cacheBuster}`
  
  const response = await fetch(freshUrl, { cache: 'no-store' })
  if (!response.ok) {
    const errMsg = `Error descargando ${path}: ${response.status}`
    console.error('❌', errMsg)
    throw new Error(errMsg)
  }
  const data = await response.blob()
  console.log(`📥 Storage: descargado ${path}: ${data.size} bytes`)
  return data
}

export const listExcelFiles = async () => {
  const { data, error } = await supabase.storage
    .from('excel-files')
    .list()
  
  if (error) throw error
  return data
}
