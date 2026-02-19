import { Link, useLocation, NavLink } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'
import { useAuth } from '@/app/providers/AuthProvider'
import { usePermissions } from '@/hooks/usePermissions'
import { useState } from 'react'
import { Button } from '../ui/button'
import { AlertsBell } from '@/features/alerts/components/AlertsBell'
export function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { canAccessModule, hasPermission } = usePermissions()
  const [open, setOpen] = useState(false)

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'admin':
        return '/dashboard/admin'
      case 'encargado':
        return '/dashboard/encargado'
      case 'encargado_taller':
        return '/dashboard/taller'
      case 'compras':
        return '/dashboard/compras'
      case 'operario':
        return '/dashboard/operario'
      default:
        return '/'
    }
  }

  const menuItems = [
    {
      icon: '🏠',
      label: 'Inicio',
      path: getDashboardPath(),
      show: true
    },
    {
      icon: '💰',
      label: 'Presupuestos',
      path: '/quotes',
      show: canAccessModule('quotes')
    },
    {
      icon: '📦',
      label: 'Pedidos',
      path: '/purchases',
      show: canAccessModule('purchases')
    },
    {
      icon: '🏭',
      label: 'Producción',
      path: '/production',
      show: canAccessModule('production') && user?.role !== 'operario'
    },
    {
      icon: '📅',
      label: 'Calendario',
      path: '/calendar',
      show: canAccessModule('calendar')
    },
    {
      icon: '👥',
      label: 'CRM',
      path: '/crm',
      show: canAccessModule('quotes')
    },
    {
      icon: '⏰',
      label: 'Fichajes',
      path: '/timeclock',
      show: hasPermission('admin.full')
    },
    {
      icon: '⚙️',
      label: 'Configuración',
      path: '/config',
      show: hasPermission('config.view')
    },
  ]

      return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚐</span>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-none">VanSpace</h1>
                <p className="text-xs text-gray-400 mt-0.5">Workshop Manager</p>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name || user?.email}</p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">
              {user?.role === 'admin' && '⚡ Administrador'}
              {user?.role === 'encargado' && '👔 Encargado'}
              {user?.role === 'encargado_taller' && '🏭 Enc. Taller'}
              {user?.role === 'compras' && '📦 Compras'}
              {user?.role === 'operario' && '👷 Operario'}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems
              .filter(item => item.show)
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              ))}
          </nav>

          {/* Alerts bell */}
          {(['admin', 'encargado', 'compras'] as string[]).includes((user?.role as string) ?? '') && (
            <div className="px-4 pb-2">
              <AlertsBell />
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Button
              onClick={signOut}
              variant="outline"
              className="w-full text-sm"
            >
              🚪 Finalizar/pausar jornada
            </Button>
          </div>
        </aside>
      )
    }
