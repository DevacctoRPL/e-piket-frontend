import { type CurrentUser, type Permission, PERMISSIONS, type Role } from '@/types/entities'

/**
 * Matriks akses peran tunggal Guru Piket (5 panel operasional harian).
 * Backend tetap otoritas akhir — frontend menggunakannya untuk visibilitas UI dan mock API.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  DUTY_TEACHER: [...PERMISSIONS],
}

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>()
  for (const r of roles) ROLE_PERMISSIONS[r]?.forEach((p) => set.add(p))
  return [...set]
}

export function hasPermission(
  user: Pick<CurrentUser, 'permissions'> | null | undefined,
  permission: Permission | readonly Permission[],
  mode: 'any' | 'all' = 'any',
): boolean {
  if (!user) return false
  const list = Array.isArray(permission) ? permission : [permission as Permission]
  return mode === 'all'
    ? list.every((p) => user.permissions.includes(p))
    : list.some((p) => user.permissions.includes(p))
}

export function hasRole(user: Pick<CurrentUser, 'roles'> | null | undefined, ...roles: Role[]) {
  return !!user && roles.some((r) => user.roles.includes(r))
}

export const ADMIN_ROLES = ['DUTY_TEACHER'] as const satisfies readonly Role[]
export const LEADERSHIP_ROLES = ADMIN_ROLES
export const FULL_SCOPE_ROLES = ADMIN_ROLES
export const PRIVILEGED_ROLES = ADMIN_ROLES

export function isAdminLike(user: Pick<CurrentUser, 'roles'> | null | undefined) {
  return hasRole(user, ...ADMIN_ROLES)
}

export function canGrantRole(actorRoles: readonly Role[], role: Role) {
  return role === 'DUTY_TEACHER' && actorRoles.includes('DUTY_TEACHER')
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\s+/g, '')
  if (digits.length <= 6) return '****'
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`
}
