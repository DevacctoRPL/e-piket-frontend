/**
 * Mock API Kehadiran Guru (Read-only dari API Presensi Guru).
 * GET /teacher-attendance?date&shiftCode -> daftar guru terjadwal hari itu beserta status kehadirannya.
 */
import { http, type HttpHandler } from 'msw'
import { isoDayOfWeek, todayISO } from '@/lib/date'
import type { ID, ISODate, ScheduledTeacherRow } from '@/types/entities'
import { db, isDeleted } from '../db'
import { dutyTeacherIds, getTeacher, slotsOn, teacherAttendanceOn } from '../domain'
import {
  apiPath,
  errors,
  latency,
  ok,
  requireAuth,
  requirePermission,
  searchParams,
} from '../utils'
import { getShift, ISO_DATE_RE, shiftCodeForTeacher } from './teacher-attendance-rules'

function findOn(teacherId: ID, date: ISODate) {
  const a = teacherAttendanceOn(teacherId, date)
  return a && !isDeleted('teacherAttendance', a.id) ? a : undefined
}

function readDate(value: string | null, field = 'date'): ISODate {
  if (!value) return todayISO()
  if (!ISO_DATE_RE.test(value)) throw errors.validation({ [field]: 'invalid' })
  return value
}

export const teacherAttendanceHandlers: HttpHandler[] = [
  http.get(apiPath('/teacher-attendance'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teacher_attendance:read')
    const sp = searchParams(request)
    const date = readDate(sp.get('date'))
    const shiftCode = sp.get('shiftCode') || null
    if (shiftCode && !getShift(shiftCode)) return errors.validation({ shiftCode: 'invalid' })

    const slots = slotsOn(date, { shiftCode })
    const shiftCodes = shiftCode
      ? [shiftCode]
      : db().shifts.filter((s) => !isDeleted('shifts', s.id)).map((s) => s.code)
    const duty = new Set(shiftCodes.flatMap((sc) => dutyTeacherIds(date, sc)))
    const dow = isoDayOfWeek(date)
    const presenceScheduled = new Set(
      db()
        .teachers.filter(
          (t) =>
            !isDeleted('teachers', t.id) &&
            t.status === 'ACTIVE' &&
            (t.attendanceDays ?? []).includes(dow) &&
            (!shiftCode || shiftCodeForTeacher(t.id, date) === shiftCode),
        )
        .map((t) => t.id),
    )
    const ids = new Set<ID>([...slots.map((s) => s.teacherId), ...duty, ...presenceScheduled])

    const rows: ScheduledTeacherRow[] = []
    for (const id of ids) {
      const t = getTeacher(id)
      if (!t || isDeleted('teachers', id)) continue
      const own = slots.filter((s) => s.teacherId === id)
      const attendance = findOn(id, date) ?? null
      rows.push({
        teacher: { id: t.id, nip: t.nip, name: t.name, code: t.code ?? null },
        scheduledPeriods: own.reduce((n, s) => n + s.periodCount, 0),
        slots: own.map((s) => ({
          id: s.id,
          classId: s.classId,
          subjectId: s.subjectId,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
        })),
        isDutyTeacher: duty.has(id),
        isAttendanceScheduled: (t.attendanceDays ?? []).includes(dow),
        attendance,
      })
    }
    rows.sort((a, b) => {
      const aHasClassOrDuty = a.scheduledPeriods > 0 || a.isDutyTeacher ? 1 : 0
      const bHasClassOrDuty = b.scheduledPeriods > 0 || b.isDutyTeacher ? 1 : 0
      if (aHasClassOrDuty !== bHasClassOrDuty) return bHasClassOrDuty - aHasClassOrDuty
      return a.teacher.name.localeCompare(b.teacher.name, 'id')
    })
    return ok(rows)
  }),
]
