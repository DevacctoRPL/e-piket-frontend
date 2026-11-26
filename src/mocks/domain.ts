/**
 * Aturan bisnis bersama untuk mock API 5 panel Guru Piket.
 */
import { isoDayOfWeek } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  AttendanceSummaryCounts,
  ID,
  ISODate,
  ShiftCode,
  Student,
  SubstitutionSlot,
  SubstitutionSummary,
  TimetableSlot,
} from '@/types/entities'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import { db, isDeleted } from './db'
import type { AuthedUser } from './utils'

/* ------------------------------------------------------------------ lookups */

export const className = (id: ID) => db().classes.find((c) => c.id === id)?.name ?? '—'
export const subjectName = (id: ID) => db().subjects.find((s) => s.id === id)?.name ?? '—'
export const teacherName = (id: ID) => db().teachers.find((t) => t.id === id)?.name ?? '—'
export const getClass = (id: ID) => db().classes.find((c) => c.id === id && !isDeleted('classes', id))
export const getTeacher = (id: ID) => db().teachers.find((t) => t.id === id)
export const getStudent = (id: ID) => db().students.find((s) => s.id === id)

export function activeAcademicYear() {
  return db().academicYears.find((y) => y.isActive) ?? db().academicYears[0]
}
export function activeSemester() {
  return activeAcademicYear()?.semesters.find((s) => s.isActive)
}

export function periodTimes(shiftCode: ShiftCode, start: number, end: number) {
  const ps = db().periods.filter((p) => p.shiftCode === shiftCode)
  return {
    startTime: ps.find((p) => p.number === start)?.startTime ?? '00:00',
    endTime: ps.find((p) => p.number === end)?.endTime ?? '00:00',
  }
}

/* ------------------------------------------------------------------ roster */

export function rosterForClass(classId: ID, date: ISODate): Student[] {
  return db()
    .students.filter(
      (s) =>
        s.classId === classId &&
        !isDeleted('students', s.id) &&
        (s.status === 'ACTIVE' || (s.inactiveFrom !== null && date < s.inactiveFrom)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export function emptyCounts(): AttendanceSummaryCounts {
  const base = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<
    (typeof ATTENDANCE_STATUSES)[number],
    number
  >
  return { ...base, total: 0, unmarked: 0 }
}

export function sessionSummary(sessionId: ID): AttendanceSummaryCounts {
  const d = db()
  const session = d.studentSessions.find((s) => s.id === sessionId)
  const counts = emptyCounts()
  if (!session) return counts
  const roster = rosterForClass(session.classId, session.date)
  const records = d.studentRecords.filter((r) => r.sessionId === sessionId)
  const byStudent = new Map(records.map((r) => [r.studentId, r]))
  counts.total = roster.length
  for (const s of roster) {
    const r = byStudent.get(s.id)
    if (r) counts[r.status] += 1
    else counts.unmarked += 1
  }
  return counts
}

/* ------------------------------------------------------------------ timetable */

export function slotsOn(
  date: ISODate,
  filter: { shiftCode?: ShiftCode | null; classId?: ID | null; teacherId?: ID | null } = {},
): TimetableSlot[] {
  const dow = isoDayOfWeek(date)
  const sem = activeSemester()
  return db()
    .timetable.filter(
      (s) =>
        s.dayOfWeek === dow &&
        (!sem || s.semesterId === sem.id) &&
        !isDeleted('timetable', s.id) &&
        (!filter.shiftCode || s.shiftCode === filter.shiftCode) &&
        (!filter.classId || s.classId === filter.classId) &&
        (!filter.teacherId || s.teacherId === filter.teacherId),
    )
    .sort((a, b) => a.shiftCode.localeCompare(b.shiftCode) || a.periodStart - b.periodStart)
}

export function scheduledPeriods(teacherId: ID, date: ISODate, shiftCode?: ShiftCode | null) {
  return slotsOn(date, { teacherId, shiftCode }).reduce((n, s) => n + s.periodCount, 0)
}

export function scheduledTeacherIds(date: ISODate, shiftCode?: ShiftCode | null): ID[] {
  return [...new Set(slotsOn(date, { shiftCode }).map((s) => s.teacherId))]
}

export function dutyTeacherIds(date: ISODate, shiftCode: ShiftCode): ID[] {
  const d = db()
  const specific = d.dutyAssignments.find(
    (a) => a.date === date && a.shiftCode === shiftCode && !isDeleted('dutyAssignments', a.id),
  )
  if (specific) return specific.teacherIds
  const dow = isoDayOfWeek(date)
  return (
    d.dutyAssignments.find(
      (a) =>
        a.date === null &&
        a.dayOfWeek === dow &&
        a.shiftCode === shiftCode &&
        !isDeleted('dutyAssignments', a.id),
    )?.teacherIds ?? []
  )
}

/* ------------------------------------------------------------------ teacher absence & substitutions */

export function teacherAttendanceOn(teacherId: ID, date: ISODate) {
  return db().teacherAttendance.find((a) => a.teacherId === teacherId && a.date === date)
}

export function isTeacherAbsent(teacherId: ID, date: ISODate) {
  const a = teacherAttendanceOn(teacherId, date)
  return !!a && TEACHER_ABSENT_STATUSES.includes(a.status)
}

export function computeAffectedPeriods(teacherId: ID, date: ISODate) {
  return scheduledPeriods(teacherId, date)
}

export function activeSubstitutionFor(date: ISODate, timetableSlotId: ID) {
  return db().substitutions.find(
    (r) =>
      r.date === date &&
      r.timetableSlotId === timetableSlotId &&
      r.status === 'ACTIVE' &&
      !isDeleted('substitutions', r.id),
  )
}

export function activeSubstitutionForManual(manualSlotId: ID) {
  return db().substitutions.find(
    (r) => r.manualSlotId === manualSlotId && r.status === 'ACTIVE' && !isDeleted('substitutions', r.id),
  )
}

/**
 * Gabungan slot jam kosong otomatis (dari guru berhalangan) dan slot jam kosong manual (Tambah Manual).
 */
export function substitutionSlotsOn(
  date: ISODate,
  filter: { shiftCode?: ShiftCode | null; classId?: ID | null } = {},
): SubstitutionSlot[] {
  const autoSlots: SubstitutionSlot[] = slotsOn(date, filter)
    .filter((s) => isTeacherAbsent(s.teacherId, date))
    .map((s) => {
      const att = teacherAttendanceOn(s.teacherId, date)
      const sub = activeSubstitutionFor(date, s.id) ?? null
      return {
        id: `${date}:${s.id}`,
        date,
        shiftCode: s.shiftCode,
        timetableSlotId: s.id,
        manualSlotId: null,
        isManual: false,
        classId: s.classId,
        className: className(s.classId),
        subjectId: s.subjectId,
        subjectName: subjectName(s.subjectId),
        absentTeacherId: s.teacherId,
        absentTeacherName: teacherName(s.teacherId),
        absentTeacherStatus: att?.status ?? 'ABSENT',
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
        periodCount: s.periodCount,
        status: sub ? ('HANDLED' as const) : ('UNHANDLED' as const),
        substitution: sub,
      }
    })

  const manualSlots: SubstitutionSlot[] = (db().manualEmptySlots ?? [])
    .filter(
      (m) =>
        m.date === date &&
        !isDeleted('manualEmptySlots', m.id) &&
        (!filter.shiftCode || m.shiftCode === filter.shiftCode) &&
        (!filter.classId || m.classId === filter.classId),
    )
    .map((m) => {
      const sub = activeSubstitutionForManual(m.id) ?? null
      return {
        id: `manual:${m.id}`,
        date: m.date,
        shiftCode: m.shiftCode,
        timetableSlotId: null,
        manualSlotId: m.id,
        isManual: true,
        classId: m.classId,
        className: className(m.classId),
        subjectId: m.subjectId,
        subjectName: m.subjectName,
        absentTeacherId: m.absentTeacherId,
        absentTeacherName: m.absentTeacherName,
        absentTeacherStatus: 'ABSENT' as const,
        periodStart: m.periodStart,
        periodEnd: m.periodEnd,
        periodCount: m.periodCount,
        status: sub ? ('HANDLED' as const) : ('UNHANDLED' as const),
        substitution: sub,
      }
    })

  return [...autoSlots, ...manualSlots]
}

export function summarizeSlots(slots: SubstitutionSlot[]): SubstitutionSummary {
  const affectedPeriods = slots.reduce((n, s) => n + s.periodCount, 0)
  const handledPeriods = slots.reduce((n, s) => n + (s.substitution?.periodCount ?? 0), 0)
  const handledSlots = slots.filter((s) => s.status === 'HANDLED').length
  return {
    affectedPeriods,
    handledPeriods,
    unhandledPeriods: Math.max(0, affectedPeriods - handledPeriods),
    affectedSlots: slots.length,
    handledSlots,
    unhandledSlots: slots.length - handledSlots,
  }
}

export function phoneForUser(phone: string | null, _user: AuthedUser) {
  return phone
}
