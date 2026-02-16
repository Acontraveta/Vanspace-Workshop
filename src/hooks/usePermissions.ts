import { useAuth } from '@/app/providers/AuthProvider'
import { ROLE_PERMISSIONS } from '@/features/config/types/config.types'

export function usePermissions() {
  const { user } = useAuth()

  const hasPermission = (permission: string): boolean => {
    if (!user) return false

    // Admin siempre tiene todos los permisos
    if (user.role === 'admin' || user.email === 'admin@vanspace.com') {
      return true
    }

    // Verificar en permisos personalizados
    if (user.permissions && user.permissions[permission]) {
      return true
    }

    // Verificar en permisos del rol
    const rolePermissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] || []
    return rolePermissions.includes(permission)
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(p => hasPermission(p))
  }

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(p => hasPermission(p))
  }

  const canAccessModule = (module: string): boolean => {
    const modulePermissions = [
      `${module}.view`,
      `${module}.create`,
      `${module}.edit`,
      `${module}.manage`
    ]
    return hasAnyPermission(modulePermissions)
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessModule,
    isAdmin: user?.role === 'admin' || user?.email === 'admin@vanspace.com'
  }
}
