
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import Sidebar from '../../../components/Sidebar'

export function ProtectedRoute() {
  const { user, loading, signOut } = useAuth()

  console.log('🔍 ProtectedRoute. Loading:', loading, 'User:', user?.email || 'none')

  if (loading) {
    console.log('⏳ ProtectedRoute: Mostrando loading')
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log('❌ No user, redirect to login')
    return <Navigate to="/login" replace />
  }

  console.log('✅ User authenticated, showing content')
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentView="dashboard" onViewChange={() => {}} currentUser={user} onLogout={signOut} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
