/**
 * Aturan bisnis absensi guru untuk mock API (meniru backend Go) — PRD §6.5, §9.2, §9.3.
 * Dipisah dari handler agar dapat diuji langsung.
 */
import { dateOf, wallTimeOf, wallTimeToMinutes } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  ID,
  ISODate,
  ISODateTime,
  Shift,
  ShiftCode,
  TeacherAttendanceStatus,
} from '@/types/entities'
import { TEACHER_ATTENDANCE_STATUSES } from '@/types/entities'
import { db, isDeleted } from '../db'
import { dutyTeacherIds, periodTimes, slotsOn } from '../domain'

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isTeacherStatus(v: unknown): v is TeacherAttendanceStatus {
  return typeof v === 'string' && (TEACHER_ATTENDANCE_STATUSES as readonly string[]).includes(v)
}

export function isAbsentStatus(s: TeacherAttendanceStatus) {
  return TEACHER_ABSENT_STATUSES.includes(s)
}

export function getShift(code: ShiftCode | null | undefined): Shift | undefined {
  if (!code) return undefined
  return db().shifts.find((s) => s.code === code && !isDeleted('shifts', s.id))
}

/**
 * Menit terlambat dihitung dari batas toleransi (startTime + lateToleranceMinutes).
 * null bila tepat waktu.
 */
export function computeLateMinutes(shift: Pick<Shift, 'startTime' | 'lateToleranceMinutes'>, checkInAt: ISODateTime) {
  const arrived = wallTimeToMinutes(wallTimeOf(checkInAt))
  const limit = wallTimeToMinutes(shift.startTime) + shift.lateToleranceMinutes
  const late = arrived - limit
  return late > 0 ? late : null
}

/** Status otomatis saat check-in mandiri (FR-TCH-01). */
export function statusForCheckIn(shift: Pick<Shift, 'startTime' | 'lateToleranceMinutes'>, checkInAt: ISODateTime) {
  const lateMinutes = computeLateMinutes(shift, checkInAt)
  return { status: (lateMinutes ? 'LATE' : 'PRESENT') as TeacherAttendanceStatus, lateMinutes }
}

/** Menit terlambat yang disimpan untuk status yang dicatat manual. */
export function lateMinutesFor(
  status: TeacherAttendanceStatus,
  shiftCode: ShiftCode,
  checkInAt: ISODateTime | null,
) {
  const shift = getShift(shiftCode)
  if (status !== 'LATE' || !checkInAt || !shift) return null
  return computeLateMinutes(shift, checkInAt)
}

/**
 * Shift acuan guru pada tanggal: shift slot paling awal hari itu, lalu shift tugas piket,
 * lalu MORNING (atau shift aktif pertama).
 */
export function shiftCodeForTeacher(teacherId: ID, date: ISODate): ShiftCode {
  const slots = slotsOn(date, { teacherId })
    .map((s) => ({ s, start: periodTimes(s.shiftCode, s.periodStart, s.periodEnd).startTime }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const first = slots[0]
  if (first) return first.s.shiftCode
  const shifts = db().shifts.filter((s) => !isDeleted('shifts', s.id))
  const duty = shifts.find((sh) => dutyTeacherIds(date, sh.code).includes(teacherId))
  if (duty) return duty.code
  return shifts.find((s) => s.code === 'MORNING')?.code ?? shifts[0]?.code ?? 'MORNING'
}

/**
 * Validasi jam datang/pulang (PRD §9.3: check-in tidak boleh lebih lambat dari check-out).
 * Menulis ke `details` dengan nama field API.
 */
export function validateTimes(
  details: Record<string, string>,
  date: ISODate,
  checkInAt: unknown,
  checkOutAt: unknown,
) {
  const parsed: { checkInAt: ISODateTime | null; checkOutAt: ISODateTime | null } = {
    checkInAt: null,
    checkOutAt: null,
  }
  for (const [field, value] of [
    ['checkInAt', checkInAt],
    ['checkOutAt', checkOutAt],
  ] as const) {
    if (value === null || value === undefined || value === '') continue
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      details[field] = 'invalid'
      continue
    }
    if (dateOf(value) !== date) {
      details[field] = 'Jam harus berada pada tanggal absensi yang sama.'
      continue
    }
    parsed[field] = value
  }
  if (parsed.checkOutAt && !parsed.checkInAt && !details.checkInAt) {
    details.checkInAt = 'Isi jam datang sebelum jam pulang.'
  }
  if (parsed.checkInAt && parsed.checkOutAt && Date.parse(parsed.checkInAt) > Date.parse(parsed.checkOutAt)) {
    details.checkOutAt = 'Jam pulang tidak boleh lebih awal dari jam datang.'
  }
  return parsed
}

export function reasonRequiredFor(status: TeacherAttendanceStatus) {
  return db().settings.teacherReasonRequiredStatuses.includes(status)
}

export function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}
