import { useAuth } from '@/app/providers/AuthProvider'
import { UserRole } from '@/shared/utils/constants'

export function usePermissions() {
  const { user } = useAuth()
  
  const userRole = ((user?.role?.toUpperCase()) || 'ADMIN') as UserRole

  const can = (action: string, resource: string): boolean => {
    // Admin puede todo
    if (userRole === UserRole.ADMIN) return true

    // Permisos por rol
    const permissions: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['*'],
      [UserRole.MARKETING]: ['crm:*', 'quotes:*', 'quotes:create', 'quotes:edit'],
      [UserRole.DESIGN]: ['design:*', 'design:create', 'design:upload'],
      [UserRole.ORDERS]: ['purchases:*', 'stock:*', 'purchases:create', 'stock:edit'],
      [UserRole.PRODUCTION]: [
        'tasks:view',
        'tasks:start',
        'tasks:complete',
        'tasks:upload_photos',
      ],
    }

    const userPerms = permissions[userRole] || []

    // Verificar si tiene el permiso
    return (
      userPerms.includes('*') ||
      userPerms.includes(`${resource}:*`) ||
      userPerms.includes(`${resource}:${action}`)
    )
  }

  const hasRole = (...roles: UserRole[]): boolean => {
    return roles.includes(userRole)
  }

  return {
    can,
    hasRole,
    userRole,
    isAdmin: userRole === UserRole.ADMIN,
  }
}
