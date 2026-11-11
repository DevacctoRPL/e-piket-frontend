import type { CurrentUser, Permission, Role } from '@/types/entities'

/** Hak penuh Admin/TU (juga dimiliki Super Admin). */
const ADMIN_PERMISSIONS: Permission[] = [
  'dashboard:read',
  'master:read',
  'master:write',
  'schedule:read',
  'student_attendance:read',
  'student_attendance:write',
  'student_attendance:correct',
  'student_contact:read',
  'absentees:read',
  'absentees:write',
  'dismissal:read',
  'dismissal:write',
  'teacher_attendance:read',
  'teacher_attendance:write',
  'duty_assignment:write',
  'duty_agenda:read',
  'duty_agenda:correct',
  'teaching_log:read',
  'teaching_log:read_all',
  'teaching_log:correct',
  'substitution:read',
  'substitution:write',
  'extra_activity:read',
  'extra_activity:write',
  'report:read',
  'report:export',
  'audit:read',
  'settings:write',
]

/**
 * Matriks akses baseline (PRD §4.1). Backend tetap otoritas akhir —
 * frontend menggunakannya hanya untuk menyembunyikan menu/aksi dan sebagai sumber permission di mock API.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  /** Pemilik sistem sekolah: semua hak Admin/TU + kelola akun, keamanan, dan sistem. */
  SUPER_ADMIN: [...ADMIN_PERMISSIONS, 'user:read', 'user:write', 'security:read', 'system:manage'],
  ADMIN: ADMIN_PERMISSIONS,
  PRINCIPAL: [
    'dashboard:read',
    'master:read',
    'schedule:read',
    'student_attendance:read',
    'student_contact:read',
    'absentees:read',
    'dismissal:read',
    'teacher_attendance:read',
    'duty_agenda:read',
    'duty_agenda:correct',
    'teaching_log:read',
    'teaching_log:read_all',
    'teaching_log:correct',
    'substitution:read',
    'extra_activity:read',
    'report:read',
    'report:export',
    'audit:read',
  ],
  TEACHER: [
    'dashboard:read',
    'schedule:read',
    'student_attendance:read',
    'student_attendance:write',
    'teacher_attendance:self',
    'duty_agenda:read',
    'teaching_log:read',
    'teaching_log:write',
    'substitution:read',
    'extra_activity:read',
    'report:read',
  ],
  DUTY_TEACHER: [
    'dashboard:read',
    'master:read',
    'schedule:read',
    'student_attendance:read',
    'student_attendance:write',
    'student_contact:read',
    'absentees:read',
    'absentees:write',
    'dismissal:read',
    'dismissal:write',
    'teacher_attendance:self',
    'teacher_attendance:read',
    'teacher_attendance:write',
    'duty_agenda:read',
    'duty_agenda:write',
    'teaching_log:read',
    'teaching_log:read_all',
    'substitution:read',
    'substitution:write',
    'extra_activity:read',
    'report:read',
    'report:export',
  ],
  HOMEROOM: [
    'dashboard:read',
    'master:read',
    'schedule:read',
    'student_attendance:read',
    'student_attendance:write',
    'student_contact:read',
    'absentees:read',
    'absentees:write',
    'dismissal:read',
    'teacher_attendance:self',
    'duty_agenda:read',
    'teaching_log:read',
    'teaching_log:write',
    'substitution:read',
    'extra_activity:read',
    'report:read',
    'report:export',
  ],
  ACTIVITY_COORDINATOR: [
    'dashboard:read',
    'schedule:read',
    'teacher_attendance:self',
    'extra_activity:read',
    'extra_activity:write',
    'teaching_log:read',
    'teaching_log:write',
    'report:read',
  ],
}

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>()
  for (const r of roles) ROLE_PERMISSIONS[r].forEach((p) => set.add(p))
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

/* ------------------------------------------------------------------ kelompok peran (hindari 'ADMIN' hard-code) */

/** Peran dengan kuasa penuh Admin/TU. Pakai ini — jangan menulis 'ADMIN' langsung. */
export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const satisfies readonly Role[]
/** Pimpinan: Admin/TU + Kepala Sekolah. */
export const LEADERSHIP_ROLES = [...ADMIN_ROLES, 'PRINCIPAL'] as const satisfies readonly Role[]
/** Peran yang melihat seluruh kelas (tanpa pembatasan kelas ajar/binaan). */
export const FULL_SCOPE_ROLES = [...LEADERSHIP_ROLES, 'DUTY_TEACHER'] as const satisfies readonly Role[]
/** Hanya Super Admin yang boleh memberi/mencabut peran ini. */
export const PRIVILEGED_ROLES = ADMIN_ROLES
/** Peran yang wajib ditautkan ke data guru. */
export const TEACHER_LINK_ROLES = ['TEACHER', 'DUTY_TEACHER', 'HOMEROOM'] as const satisfies readonly Role[]

export function isAdminLike(user: Pick<CurrentUser, 'roles'> | null | undefined) {
  return hasRole(user, ...ADMIN_ROLES)
}

/** Apakah pemegang `actorRoles` boleh memberi/mencabut `role`. */
export function canGrantRole(actorRoles: readonly Role[], role: Role) {
  return !(PRIVILEGED_ROLES as readonly Role[]).includes(role) || actorRoles.includes('SUPER_ADMIN')
}

/** Mask nomor telepon untuk tampilan umum (PRD §12 Privasi). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\s+/g, '')
  if (digits.length <= 6) return '****'
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`
}
