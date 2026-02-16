import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
// Definición de usuario extendido
export interface User {
  id: string
  email: string
  role: 'admin' | 'manager' | 'worker' | 'viewer'
  permissions: Record<string, boolean>
  name?: string
}
import { Session } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  signUp: (email: string, password: string) => Promise<{ user: User | null; session: Session | null } | undefined>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('🔍 AuthProvider: Iniciando...')
    const storedUser = localStorage.getItem('auth_user')
    console.log('🔍 Stored user:', storedUser)
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        console.log('✅ Usuario cargado:', parsed)
        setUser(parsed)
      } catch (error) {
        console.error('❌ Error parsing user:', error)
        localStorage.removeItem('auth_user')
      }
    } else {
      console.log('ℹ️ No hay usuario guardado')
    }
    setLoading(false)
    console.log('✅ AuthProvider ready. User:', user ? user.email : 'No user')
  }, [])

  console.log('🔍 AuthProvider render. Loading:', loading, 'User:', user?.email || 'none')

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      // Buscar empleado por email
      const { data: employee, error } = await supabase
        .from('production_employees')
        .select('*')
        .eq('email', email)
        .eq('activo', true)
        .single()

      if (error || !employee) {
        throw new Error('Credenciales inválidas')
      }

      // Verificar contraseña (en producción usar hash bcrypt)
      // Por ahora comparación simple para demo
      if (employee.password_hash !== password) {
        throw new Error('Credenciales inválidas')
      }

      const user: User = {
        id: employee.id,
        email: employee.email,
        role: (employee.role ? String(employee.role).toLowerCase() : 'worker'),
        permissions: employee.permissions || {},
        name: employee.nombre
      }

      // Actualizar last_login
      await supabase
        .from('production_employees')
        .update({ 
          last_login: new Date().toISOString(),
          active_session: true
        })
        .eq('id', employee.id)

      setUser(user)
      localStorage.setItem('auth_user', JSON.stringify(user))
      toast.success('¡Bienvenido!')
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      toast.success('Sesión cerrada')
    } catch (error: any) {
      toast.error('Error al cerrar sesión')
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      toast.success('Usuario creado. Revisa tu email para confirmar.')
      
      return data
    } catch (error: any) {
      toast.error(error.message || 'Error al registrarse')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signOut,
    signUp,
  }

  if (loading) {
    console.log('⏳ Mostrando loading...')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando usuario...</p>
        </div>
      </div>
    )
  }

  console.log('✅ Renderizando children')
  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
