/**
 * Aturan validasi untuk endpoint tulis data master (meniru validasi backend Go).
 * Dipisah dari master-write.ts agar handler tetap ringkas dan aturan dapat diuji langsung.
 */
import { dayName, wallTimeToMinutes } from '@/lib/date'
import type { ID, TimetableSlot } from '@/types/entities'
import { db, isDeleted } from '../db'
import { activeSemester, className, subjectName, teacherName } from '../domain'
import { errors } from '../utils'

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export const PHONE_RE = /^\+?\d{8,15}$/

/** Pengumpul error per field; `throwIfAny()` melempar 422 bila ada. */
export class FieldErrors {
  readonly details: Record<string, string> = {}

  add(field: string, message: string) {
    if (!(field in this.details)) this.details[field] = message
    return this
  }

  get size() {
    return Object.keys(this.details).length
  }

  throwIfAny(message?: string) {
    if (this.size > 0) throw errors.validation(this.details, message)
  }
}

export const isStr = (v: unknown): v is string => typeof v === 'string'
export const trimmed = (v: unknown) => (isStr(v) ? v.trim() : '')
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

export function requireText(fe: FieldErrors, body: Record<string, unknown>, field: string, max = 120) {
  const v = trimmed(body[field])
  if (!v) fe.add(field, 'required')
  else if (v.length > max) fe.add(field, 'too_long')
  return v
}

export function requireDate(fe: FieldErrors, body: Record<string, unknown>, field: string) {
  const v = trimmed(body[field])
  if (!v) fe.add(field, 'required')
  else if (!DATE_RE.test(v)) fe.add(field, 'invalid')
  return v
}

export function requireTime(fe: FieldErrors, body: Record<string, unknown>, field: string) {
  const v = trimmed(body[field])
  if (!v) fe.add(field, 'required')
  else if (!TIME_RE.test(v)) fe.add(field, 'invalid')
  return v
}

export function optionalText(body: Record<string, unknown>, field: string): string | null {
  const v = trimmed(body[field])
  return v ? v : null
}

export function normalizePhone(v: unknown): string | null {
  const s = trimmed(v).replace(/[\s-]/g, '')
  return s ? s : null
}

export const minutesBetween = (start: string, end: string) =>
  wallTimeToMinutes(end) - wallTimeToMinutes(start)

/** Objek body JSON (bukan array/null). */
export function asRecord(v: unknown): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw errors.validation({ body: 'invalid' }, 'Format permintaan tidak valid.')
  }
  return v as Record<string, unknown>
}

/** Gabungkan nilai lama dengan patch (field yang tidak dikirim tetap). */
export function merged<T extends object>(current: T, patch: Record<string, unknown>): Record<string, unknown> {
  return { ...(current as Record<string, unknown>), ...patch }
}

export const alive = <T extends { id: ID }>(collection: string, items: T[]) =>
  items.filter((x) => !isDeleted(collection, x.id))

/* ------------------------------------------------------------------ timetable conflicts */

export interface ScheduleConflict {
  kind: 'TEACHER' | 'CLASS'
  slot: TimetableSlot
  message: string
}

const overlaps = (a: Pick<TimetableSlot, 'periodStart' | 'periodEnd'>, b: Pick<TimetableSlot, 'periodStart' | 'periodEnd'>) =>
  a.periodStart <= b.periodEnd && a.periodEnd >= b.periodStart

const rangeLabel = (s: Pick<TimetableSlot, 'periodStart' | 'periodEnd'>) =>
  s.periodStart === s.periodEnd ? `jam ke-${s.periodStart}` : `jam ke-${s.periodStart}–${s.periodEnd}`

/**
 * Bentrok jadwal pada semester yang sama, hari & shift yang sama, dan rentang jam ke- yang beririsan:
 * - guru mengajar di dua kelas sekaligus (double-booking guru), atau
 * - kelas mendapat dua mapel sekaligus (double-booking kelas).
 */
export function findScheduleConflicts(
  candidate: Pick<
    TimetableSlot,
    'semesterId' | 'dayOfWeek' | 'shiftCode' | 'classId' | 'teacherId' | 'periodStart' | 'periodEnd'
  >,
  excludeId?: ID,
): ScheduleConflict[] {
  const out: ScheduleConflict[] = []
  for (const s of alive('timetable', db().timetable)) {
    if (s.id === excludeId) continue
    if (s.semesterId !== candidate.semesterId || s.dayOfWeek !== candidate.dayOfWeek) continue
    if (s.shiftCode !== candidate.shiftCode || !overlaps(s, candidate)) continue
    if (s.teacherId === candidate.teacherId) {
      out.push({
        kind: 'TEACHER',
        slot: s,
        message: `${teacherName(s.teacherId)} sudah mengajar ${subjectName(s.subjectId)} di ${className(s.classId)} pada ${dayName(s.dayOfWeek)} ${rangeLabel(s)}.`,
      })
    }
    if (s.classId === candidate.classId) {
      out.push({
        kind: 'CLASS',
        slot: s,
        message: `${className(s.classId)} sudah ada ${subjectName(s.subjectId)} (${teacherName(s.teacherId)}) pada ${dayName(s.dayOfWeek)} ${rangeLabel(s)}.`,
      })
    }
  }
  return out
}

/** Bentuk `details` untuk 409 SCHEDULE_CONFLICT: teacherId/classId → pesan, conflictSlotIds → daftar id. */
export function conflictDetails(conflicts: ScheduleConflict[]): Record<string, string> {
  const details: Record<string, string> = {}
  const teacher = conflicts.filter((c) => c.kind === 'TEACHER').map((c) => c.message)
  const klass = conflicts.filter((c) => c.kind === 'CLASS').map((c) => c.message)
  if (teacher.length) details.teacherId = teacher.join(' ')
  if (klass.length) details.classId = klass.join(' ')
  details.conflictSlotIds = [...new Set(conflicts.map((c) => c.slot.id))].join(',')
  // Daftar pesan per bentrok untuk ditampilkan apa adanya: conflicts.0, conflicts.1, …
  conflicts.forEach((c, i) => {
    details[`conflicts.${i}`] = c.message
  })
  return details
}

export function currentSemesterIds() {
  const sem = activeSemester()
  return { semesterId: sem?.id ?? '', academicYearId: sem?.academicYearId ?? '' }
}
