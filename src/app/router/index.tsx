import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { ProtectedRoute } from './ProtectedRoute'

// Páginas (lazy loading)
import { lazy, Suspense } from 'react'

const Login = lazy(() => import('@/features/admin/components/Login'))
const InitialSetup = lazy(() => import('@/features/admin/components/InitialSetup'))
const Dashboard = lazy(() => import('@/features/admin/components/Dashboard'))
const CRMDashboard = lazy(() => import('@/features/crm/components/CRMDashboard'))
const Quotes = lazy(() => import('@/features/quotes/components/Quotes'))
const TaskBoard = lazy(() => import('@/features/production/components/TaskBoard'))
const PurchaseList = lazy(() => import('@/features/purchases/components/PurchaseList'))
const ProductionCalendar = lazy(() => import('@/features/calendar/components/ProductionCalendar'))

// Loading component
function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}

export function AppRoutes() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Setup route (public, temporary) */}
        <Route
          path="/setup"
          element={<InitialSetup />}
        />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/crm" element={<CRMDashboard />} />
          <Route path="/quotes" element={<Quotes />} />
          <Route path="/production" element={<TaskBoard />} />
          <Route path="/purchases" element={<PurchaseList />} />
          <Route path="/calendar" element={<ProductionCalendar />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}