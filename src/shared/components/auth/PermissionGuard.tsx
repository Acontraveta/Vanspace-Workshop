import { ReactNode } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent } from '@/shared/components/ui/card'

interface PermissionGuardProps {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  module?: string
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({
  permission,
  permissions,
  requireAll = false,
  module,
  fallback,
  children
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, canAccessModule } = usePermissions()

  let hasAccess = false

  if (permission) {
    hasAccess = hasPermission(permission)
  } else if (permissions) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
  } else if (module) {
    hasAccess = canAccessModule(module)
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Card className="border-orange-300 bg-orange-50">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-bold mb-2">Acceso Restringido</h3>
          <p className="text-gray-600">
            No tienes permisos para acceder a esta funcionalidad.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Contacta con un administrador si necesitas acceso.
          </p>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}

// Hook alternativo para usar en componentes
export function useRequirePermission(permission: string): boolean {
  const { hasPermission } = usePermissions()
  return hasPermission(permission)
}

// Componente inline para botones/elementos
export function WithPermission({
  permission,
  children,
  fallback = null
}: {
  permission: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { hasPermission } = usePermissions()

  if (!hasPermission(permission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
