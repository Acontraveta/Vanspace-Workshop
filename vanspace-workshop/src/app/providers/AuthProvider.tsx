import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '@/shared/api/client'
import { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isConfigured: boolean
  isDemoMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Demo user para modo sin Supabase
const DEMO_USER: any = {
  id: 'demo-user-id',
  email: 'demo@vanspace.es',
  user_metadata: {
    role: 'ADMIN',
    name: 'Usuario Demo',
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()
  const [demoMode, setDemoMode] = useState(!configured)

  useEffect(() => {
    // Si está configurado Supabase, usar Supabase
    if (configured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setDemoMode(false)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      })

      return () => subscription.unsubscribe()
    } else {
      // Modo DEMO - verificar si hay sesión en localStorage
      const demoSession = localStorage.getItem('demo_session')
      if (demoSession) {
        setUser(DEMO_USER)
        setSession({ user: DEMO_USER } as any)
      }
      setLoading(false)
      setDemoMode(true)
    }
  }, [configured])

  const signIn = async (email: string, password: string) => {
    if (configured && supabase) {
      // Login real con Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
    } else {
      // Login DEMO - aceptar cualquier email/password
      if (email && password) {
        const demoUser = { ...DEMO_USER, email }
        setUser(demoUser)
        setSession({ user: demoUser } as any)
        localStorage.setItem('demo_session', 'true')
      } else {
        throw new Error('Email y contraseña requeridos')
      }
    }
  }

  const signOut = async () => {
    if (configured && supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } else {
      // Logout DEMO
      setUser(null)
      setSession(null)
      localStorage.removeItem('demo_session')
    }
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isConfigured: configured,
    isDemoMode: demoMode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
