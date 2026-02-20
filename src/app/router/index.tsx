import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LoginPage from '@/features/auth/components/LoginPage'
import InitialSetup from '@/features/admin/components/InitialSetup'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionGuard } from '@/shared/components/auth/PermissionGuard'
import { useAuth } from '@/app/providers/AuthProvider'

// Lazy load pages
const Quotes = lazy(() => import('@/features/quotes/components/Quotes'))
const ProductionDashboard = lazy(() => import('@/features/production/components/ProductionDashboard'))
const PurchaseList = lazy(() => import('@/features/purchases/components/PurchaseList'))
const ProductionCalendar = lazy(() => import('@/features/calendar/components/ProductionCalendar'))
const ConfigurationPanel = lazy(() => import('@/features/config/components/ConfigurationPanel'))
const TimeclockPage = lazy(() => import('@/features/timeclock/components/TimeclockPage'))
const CRMDashboard = lazy(() => import('@/features/crm/components/CRMDashboard'))
const FurnitureWorkOrderPage = lazy(() => import('@/features/design/pages/FurnitureWorkOrderPage'))

// Dashboards
const AdminDashboard = lazy(() => import('@/features/dashboards/AdminDashboard'))
const EncargadoDashboard = lazy(() => import('@/features/dashboards/EncargadoDashboard'))
const EncargadoTallerDashboard = lazy(() => import('@/features/dashboards/EncargadoTallerDashboard'))
const ComprasDashboard = lazy(() => import('@/features/dashboards/ComprasDashboard'))
const OperarioDashboard = lazy(() => import('@/features/dashboards/OperarioDashboard'))

// Loading component
function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando...</p>
      </div>
    </div>
  )
}

// Dashboard redirect
function DashboardRedirect() {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  switch (user.role) {
    case 'admin':
      return <Navigate to="/dashboard/admin" replace />
    case 'encargado':
      return <Navigate to="/dashboard/encargado" replace />
    case 'encargado_taller':
      return <Navigate to="/dashboard/taller" replace />
    case 'compras':
      return <Navigate to="/dashboard/compras" replace />
    case 'operario':
      return <Navigate to="/dashboard/operario" replace />
    default:
      return <Navigate to="/dashboard/operario" replace />
  }
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/setup',
    element: <InitialSetup />
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <DashboardRedirect />
      },
      // Dashboards
      {
        path: 'dashboard/admin',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="admin.full">
              <AdminDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'dashboard/encargado',
        element: (
          <Suspense fallback={<PageLoading />}>
            <EncargadoDashboard />
          </Suspense>
        )
      },
      {
        path: 'dashboard/taller',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="production.manage">
              <EncargadoTallerDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'dashboard/compras',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="purchases.view">
              <ComprasDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'dashboard/operario',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="tasks.view">
              <OperarioDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      // Módulos principales
      {
        path: 'quotes',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <Quotes />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'production',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="production">
              <ProductionDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'purchases',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="purchases">
              <PurchaseList />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'calendar',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="calendar">
              <ProductionCalendar />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'config',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="config.view">
              <ConfigurationPanel />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'crm',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <CRMDashboard />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'timeclock',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard permission="admin.full">
              <TimeclockPage />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'furniture-design/:workOrderId',
        element: (
          <Suspense fallback={<PageLoading />}>
            <FurnitureWorkOrderPage />
          </Suspense>
        )
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])