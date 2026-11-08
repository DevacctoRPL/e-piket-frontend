import { ApiError } from '@/lib/api-client'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type { ScheduledTeacherRow, TeacherAttendance } from '@/types/entities'

/** "4 jam" atau "4 jam (koreksi: 2)" — nilai sistem tetap terlihat saat dikoreksi (FR-TCH-03). */
export function formatAffected(a: Pick<TeacherAttendance, 'affectedPeriodsComputed' | 'affectedPeriodsOverride'>) {
  if (a.affectedPeriodsOverride === null) return `${a.affectedPeriodsComputed} jam`
  return `${a.affectedPeriodsComputed} jam (koreksi: ${a.affectedPeriodsOverride})`
}

export function formatLate(minutes: number | null | undefined) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes} menit`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

export type ScheduledSummary = {
  total: number
  present: number
  late: number
  absent: number
  notCheckedIn: number
}

/** Ringkasan chip daftar guru terjadwal. */
export function summarizeScheduled(rows: ScheduledTeacherRow[]): ScheduledSummary {
  const s: ScheduledSummary = { total: rows.length, present: 0, late: 0, absent: 0, notCheckedIn: 0 }
  for (const r of rows) {
    const st = r.attendance?.status
    if (!st) s.notCheckedIn += 1
    else if (st === 'LATE') s.late += 1
    else if (TEACHER_ABSENT_STATUSES.includes(st)) s.absent += 1
    else s.present += 1
  }
  return s
}

export type ScheduledFilter = 'all' | keyof Omit<ScheduledSummary, 'total'>

export function matchesScheduledFilter(row: ScheduledTeacherRow, f: ScheduledFilter) {
  const st = row.attendance?.status
  switch (f) {
    case 'all':
      return true
    case 'notCheckedIn':
      return !st
    case 'late':
      return st === 'LATE'
    case 'absent':
      return !!st && TEACHER_ABSENT_STATUSES.includes(st)
    case 'present':
      return st === 'PRESENT'
  }
}

/** 409 versi/duplikat: tampilkan pesan jelas + opsi muat ulang. */
export function isConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409
}
