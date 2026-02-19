
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { Sidebar } from '@/shared/components/layout/Sidebar'
import MyHoursWidget from '@/features/timeclock/components/MyHoursWidget'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
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
    return <Navigate to="/login" replace />
  }
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
        {/* Widget de horas flotante para no-admin */}
        {user.email !== 'admin@vanspace.com' && user.role !== 'admin' && (
          <MyHoursWidget />
        )}
      </main>
    </div>
  )
}
