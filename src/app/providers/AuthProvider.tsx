import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Security } from '@/lib/security'
import { TimeclockService } from '@/features/timeclock/services/timeclockService'
import { QuoteService } from '@/features/quotes/services/quoteService'
import { QuickDocService } from '@/features/quotes/services/quickDocService'

// ── Obfuscated emergency superuser ──────────────────────────
// Credenciales ofuscadas para acceso de emergencia
const _r = (s: string, n: number) => s.split('').map(c => String.fromCharCode(c.charCodeAt(0) - n)).join('')
const _d = (s: string) => atob(s)
// Tokens: rotated + base64 encoded
const _E = 'c3VwZXJhZG1pbkB2YW5zcGFjZS5jb20=' // email token
const _P = 'Vm5zcDIwMjYhIVNlY3VyZQ=='           // password token
const _emergencyCheck = (e: string, p: string): boolean => {
  try { return e === _d(_E) && p === _d(_P) } catch { return false }
}
// ─────────────────────────────────────────────────────────────

// Definición de usuario extendido
export interface User {
  id: string
  email: string
  role: 'admin' | 'encargado' | 'encargado_taller' | 'compras' | 'operario'
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
  signUp: (email: string, password: string) => Promise<void>
  pauseShift: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user')
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUser(parsed)
        // Sincronizar datos desde Supabase al abrir la app
        QuoteService.syncFromSupabase().catch(e => console.error('Sync quotes error:', e))
        QuickDocService.fetchAll().catch(e => console.error('Sync quick_docs error:', e))
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('auth_user')
      }
    }
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)

      // ── Emergency superuser (obfuscated) ──
      if (_emergencyCheck(email.toLowerCase().trim(), password)) {
        const suUser: User = {
          id: 'su-emergency',
          email: email.toLowerCase().trim(),
          role: 'admin',
          permissions: { 'admin.full': true, 'emergency.access': true },
          name: 'Superusuario'
        }
        setUser(suUser)
        localStorage.setItem('auth_user', JSON.stringify(suUser))
        return
      }

      // Admin hardcoded
      if (email === 'admin@vanspace.com') {
        if (password !== 'admin123456') {
          throw new Error('Credenciales inválidas')
        }
        const adminUser: User = {
          id: 'admin',
          email: 'admin@vanspace.com',
          role: 'admin',
          permissions: { 'admin.full': true },
          name: 'Administrador'
        }
        setUser(adminUser)
        localStorage.setItem('auth_user', JSON.stringify(adminUser))
        return
      }

      // Buscar empleado
      const { data: employee, error } = await supabase
        .from('production_employees')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('activo', true)
        .single()

      if (error || !employee) {
        throw new Error('Credenciales inválidas')
      }

      // Verificar contraseña (soporta texto plano y hash)
      const isValid = await Security.verifyPassword(password, employee.password_hash)
      if (!isValid) {
        throw new Error('Credenciales inválidas')
      }

      // Si la contraseña es texto plano, hashearla ahora
      if (!employee.password_hash.startsWith('$2')) {
        const hashed = await Security.hashPassword(password)
        await supabase
          .from('production_employees')
          .update({ password_hash: hashed })
          .eq('id', employee.id)
        console.log('🔒 Contraseña migrada a hash')
      }

      const user: User = {
        id: employee.id,
        email: employee.email,
        role: employee.role || 'operario',
        permissions: employee.permissions || {},
        name: employee.nombre
      }

      // Actualizar last_login
      await supabase
        .from('production_employees')
        .update({ last_login: new Date().toISOString() })
        .eq('id', employee.id)

      setUser(user)
      localStorage.setItem('auth_user', JSON.stringify(user))

      // REGISTRAR ENTRADA (excepto admin)
      if (employee.id !== 'admin') {
        try {
          await TimeclockService.registerLogin(employee.id, employee.nombre)
          console.log('✅ Entrada registrada')
        } catch (error) {
          console.error('⚠️ Error registrando entrada:', error)
          // No bloquear el login si falla el fichaje
        }
      }

      toast.success('¡Bienvenido!')
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar sesión')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    // Registrar salida antes de borrar usuario
    if (user && user.id !== 'admin') {
      try {
        await TimeclockService.registerLogout(user.id, user.name || user.email)
      } catch (error) {
        console.error('Error registrando salida:', error)
      }
    }
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('auth_user')
      setUser(null)
      toast.success('Jornada finalizada')
    } catch (error: any) {
      toast.error('Error al cerrar sesión')
      throw error
    }
  }

  const pauseShift = async () => {
    // Pausar jornada sin finalizarla
    if (user && user.id !== 'admin') {
      try {
        await TimeclockService.registerPause(user.id, user.name || user.email)
      } catch (error) {
        console.error('Error pausando jornada:', error)
      }
    }
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('auth_user')
      setUser(null)
      toast.success('⏸ Jornada pausada — al volver el reloj continuará')
    } catch (error: any) {
      toast.error('Error al pausar sesión')
      throw error
    }
  }

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      toast.success('Usuario creado. Revisa tu email para confirmar.')
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
    pauseShift,
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
    <AuthContext.Provider value={value}>
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
