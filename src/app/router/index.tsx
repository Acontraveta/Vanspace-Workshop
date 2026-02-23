import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LoginPage from '@/features/auth/components/LoginPage'
import InitialSetup from '@/features/admin/components/InitialSetup'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionGuard } from '@/shared/components/auth/PermissionGuard'
import { useAuth } from '@/app/providers/AuthProvider'

// Lazy load with auto-reload on stale chunk (new deploy invalidates old hashes)
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch((err: any) => {
      // Only reload once to avoid infinite loops
      const key = 'chunk_reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        return { default: () => null } as any
      }
      sessionStorage.removeItem(key)
      throw err
    })
  )
}

// Lazy load pages
const Quotes = lazyRetry(() => import('@/features/quotes/components/Quotes'))
const ProductionDashboard = lazyRetry(() => import('@/features/production/components/ProductionDashboard'))
const PurchaseList = lazyRetry(() => import('@/features/purchases/components/PurchaseList'))
const ProductionCalendar = lazyRetry(() => import('@/features/calendar/components/ProductionCalendar'))
const ConfigurationPanel = lazyRetry(() => import('@/features/config/components/ConfigurationPanel'))
const TimeclockPage = lazyRetry(() => import('@/features/timeclock/components/TimeclockPage'))
const CRMDashboard = lazyRetry(() => import('@/features/crm/components/CRMDashboard'))
const FurnitureWorkOrderPage = lazyRetry(() => import('@/features/design/pages/FurnitureWorkOrderPage'))
const FurnitureDesignList = lazyRetry(() => import('@/features/design/pages/FurnitureDesignList'))
const FurnitureStandaloneEditor = lazyRetry(() => import('@/features/design/pages/FurnitureStandaloneEditor'))

// Dashboards
const AdminDashboard = lazyRetry(() => import('@/features/dashboards/AdminDashboard'))
const EncargadoDashboard = lazyRetry(() => import('@/features/dashboards/EncargadoDashboard'))
const EncargadoTallerDashboard = lazyRetry(() => import('@/features/dashboards/EncargadoTallerDashboard'))
const ComprasDashboard = lazyRetry(() => import('@/features/dashboards/ComprasDashboard'))
const OperarioDashboard = lazyRetry(() => import('@/features/dashboards/OperarioDashboard'))

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
        path: 'furniture-design',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <FurnitureDesignList />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'furniture-design/new',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <FurnitureStandaloneEditor />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'furniture-design/edit/:designId',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <FurnitureStandaloneEditor />
            </PermissionGuard>
          </Suspense>
        )
      },
      {
        path: 'furniture-design/:workOrderId',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PermissionGuard module="quotes">
              <FurnitureWorkOrderPage />
            </PermissionGuard>
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