import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rqumbscotqlcffmcwswv.supabase.co'
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxdW1ic2NvdHFsY2ZmbWN3c3d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjYwNjIsImV4cCI6MjA4NjIwMjA2Mn0.gGAdFHsZvO1syM6dISwRcOdkVa9KNOfYaSw-FuduXEA'

// Helper para verificar si está configurado
export const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  return !!(url && key && url !== '' && key !== '')
}

// Solo crear cliente si está configurado
export const supabase = isSupabaseConfigured() 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any

// Export para verificaciones
export const DEMO_MODE = !isSupabaseConfigured()
