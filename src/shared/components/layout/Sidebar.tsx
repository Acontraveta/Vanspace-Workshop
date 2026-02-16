import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/shared/utils/cn'
import { useAuth } from '@/app/providers/AuthProvider'

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'CRM', href: '/crm', icon: '👥' },
  { name: 'Presupuestos', href: '/quotes', icon: '💰' },
  { name: 'Producción', href: '/production', icon: '🏭' },
  { name: 'Pedidos', href: '/purchases', icon: '🛒' },
  { name: 'Calendario', href: '/calendar', icon: '📅' },
  { name: 'Configuración', href: '/config', icon: '⚙️' },
]

export function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b">
        <h1 className="text-2xl font-bold text-blue-600">🚐 VanSpace</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email || 'Usuario'}
            </p>
            <p className="text-xs text-gray-500">Administrador</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
