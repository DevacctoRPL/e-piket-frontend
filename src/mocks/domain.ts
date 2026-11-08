/**
 * Aturan bisnis bersama untuk mock API (meniru apa yang akan dilakukan backend Go).
 * Semua handler fitur memakai helper ini agar angka antar modul konsisten (PRD §9.2, FR-SUB-04).
 */
import { isoDayOfWeek } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import { maskPhone } from '@/lib/permissions'
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

/** Siswa aktif di kelas pada tanggal tertentu (FR-MST-03: nonaktif tidak muncul setelah tanggal efektif). */
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

export function withSummary<T extends { id: ID }>(session: T) {
  return { ...session, summary: sessionSummary(session.id) }
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

/** Jumlah jam terjadwal guru pada tanggal (opsional per shift). */
export function scheduledPeriods(teacherId: ID, date: ISODate, shiftCode?: ShiftCode | null) {
  return slotsOn(date, { teacherId, shiftCode }).reduce((n, s) => n + s.periodCount, 0)
}

/** Guru yang terjadwal mengajar pada tanggal/shift (FR-TCH-04). */
export function scheduledTeacherIds(date: ISODate, shiftCode?: ShiftCode | null): ID[] {
  return [...new Set(slotsOn(date, { shiftCode }).map((s) => s.teacherId))]
}

/** Guru piket pada tanggal/shift: penugasan tanggal khusus menimpa penugasan rutin harian. */
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

export function isDutyTeacher(teacherId: ID | null, date: ISODate, shiftCode?: ShiftCode) {
  if (!teacherId) return false
  const shifts = shiftCode ? [shiftCode] : db().shifts.map((s) => s.code)
  return shifts.some((sc) => dutyTeacherIds(date, sc).includes(teacherId))
}

/* ------------------------------------------------------------------ teacher absence & substitutions */

export function teacherAttendanceOn(teacherId: ID, date: ISODate) {
  return db().teacherAttendance.find((a) => a.teacherId === teacherId && a.date === date)
}

export function isTeacherAbsent(teacherId: ID, date: ISODate) {
  const a = teacherAttendanceOn(teacherId, date)
  return !!a && TEACHER_ABSENT_STATUSES.includes(a.status)
}

/** Hitungan jam terdampak dari jadwal aktif (PRD §9.2). */
export function computeAffectedPeriods(teacherId: ID, date: ISODate) {
  return scheduledPeriods(teacherId, date)
}

export function activeSubstitutionFor(date: ISODate, timetableSlotId: ID) {
  return db().substitutions.find(
    (r) => r.date === date && r.timetableSlotId === timetableSlotId && r.status === 'ACTIVE',
  )
}

/**
 * Slot jam kosong = slot jadwal yang gurunya berstatus tidak hadir (FR-SUB-01).
 * Tertangani bila ada record pengganti ACTIVE (PRD §9.2).
 */
export function substitutionSlotsOn(
  date: ISODate,
  filter: { shiftCode?: ShiftCode | null; classId?: ID | null } = {},
): SubstitutionSlot[] {
  return slotsOn(date, filter)
    .filter((s) => isTeacherAbsent(s.teacherId, date))
    .map((s) => {
      const att = teacherAttendanceOn(s.teacherId, date)
      const sub = activeSubstitutionFor(date, s.id) ?? null
      return {
        id: `${date}:${s.id}`,
        date,
        shiftCode: s.shiftCode,
        timetableSlotId: s.id,
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

/** Jam yang sudah digantikan untuk guru tertentu pada tanggal. */
export function handledPeriodsFor(teacherId: ID, date: ISODate) {
  return db()
    .substitutions.filter(
      (r) => r.date === date && r.absentTeacherId === teacherId && r.status === 'ACTIVE',
    )
    .reduce((n, r) => n + r.periodCount, 0)
}

/** Apakah guru sibuk pada tanggal/shift/periode (jadwal sendiri atau tugas pengganti lain). */
export function teacherBusy(
  teacherId: ID,
  date: ISODate,
  shiftCode: ShiftCode,
  periodStart: number,
  periodEnd: number,
  excludeTimetableSlotId?: ID,
) {
  const overlap = (a1: number, a2: number) => a1 <= periodEnd && a2 >= periodStart
  const own = slotsOn(date, { teacherId, shiftCode }).find(
    (s) => overlap(s.periodStart, s.periodEnd) && s.id !== excludeTimetableSlotId,
  )
  const sub = db().substitutions.find(
    (r) =>
      r.date === date &&
      r.status === 'ACTIVE' &&
      r.substituteTeacherId === teacherId &&
      r.shiftCode === shiftCode &&
      r.timetableSlotId !== excludeTimetableSlotId &&
      overlap(r.periodStart, r.periodEnd),
  )
  return { ownSlot: own ?? null, substitution: sub ?? null }
}

/* ------------------------------------------------------------------ privacy */

/** Nomor wali hanya utuh untuk role berwenang (PRD §12.2, AC-05). */
export function phoneForUser(phone: string | null, user: AuthedUser) {
  return user.permissions.includes('student_contact:read') ? phone : maskPhone(phone)
}
