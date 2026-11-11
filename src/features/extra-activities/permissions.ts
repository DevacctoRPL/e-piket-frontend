import type { CurrentUser, ExtraActivity } from '@/types/entities'
import { isAdminLike } from '@/lib/permissions'

/** Cermin aturan backend: ubah/hapus hanya ADMIN, koordinator, atau pengampu dengan extra_activity:write. */
export function canManageActivity(user: CurrentUser | null, a: Pick<ExtraActivity, 'id' | 'coordinatorUserId' | 'instructorTeacherId'>) {
  if (!user || !user.permissions.includes('extra_activity:write')) return false
  return (
    isAdminLike(user) ||
    a.coordinatorUserId === user.id ||
    user.coordinatedActivityIds.includes(a.id) ||
    (user.teacherId !== null && a.instructorTeacherId === user.teacherId)
  )
}

/** Presensi peserta: pengelola kegiatan, atau guru pengampu ("isi bila ditugaskan", PRD §4.1). */
export function canFillParticipants(user: CurrentUser | null, a: Pick<ExtraActivity, 'id' | 'coordinatorUserId' | 'instructorTeacherId'>) {
  if (!user) return false
  if (user.teacherId !== null && a.instructorTeacherId === user.teacherId) return true
  return canManageActivity(user, a)
}
