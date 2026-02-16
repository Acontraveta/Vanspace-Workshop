import { Link, useLocation, NavLink } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'
import { useAuth } from '@/app/providers/AuthProvider'
import { usePermissions } from '@/hooks/usePermissions'

import { useState } from 'react'
import { Button } from '../ui/button'
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
      show: canAccessModule('production')
    },
    {
      icon: '📅',
      label: 'Calendario',
      path: '/calendar',
      show: canAccessModule('calendar')
    },
    {
      icon: '⚙️',
      label: 'Configuración',
      path: '/config',
      show: hasPermission('config.view')
    },
  ]

      return (
          <aside className="w-64 bg-white text-gray-800 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-white">
            <h1 className="text-2xl font-bold">VanSpace</h1>
            <p className="text-xs text-gray-500 mt-1">Workshop Manager</p>
          </div>

          {/* User info */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <p className="text-sm font-semibold text-gray-800">{user?.name || user?.email}</p>
            <p className="text-xs font-bold text-blue-600 capitalize">
              {user?.role === 'admin' && '⚡ Administrador'}
              {user?.role === 'encargado' && '👔 Encargado'}
              {user?.role === 'encargado_taller' && '🏭 Enc. Taller'}
              {user?.role === 'compras' && '📦 Compras'}
              {user?.role === 'operario' && '👷 Operario'}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {menuItems
              .filter(item => item.show)
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-semibold text-gray-800">{item.label}</span>
                </NavLink>
              ))}
          </nav>

          {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
            <Button
              onClick={() => {
                localStorage.removeItem('auth_user')
                window.location.href = '/login'
              }}
              variant="outline"
              className="w-full"
            >
              🚪 Cerrar Sesión
            </Button>
          </div>
        </aside>
      )
    }
