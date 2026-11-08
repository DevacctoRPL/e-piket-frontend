/**
 * Pembentuk data laporan (PRD §6.10, §13). Meniru perhitungan resmi backend:
 * UI hanya menampilkan angka ini, tidak menghitung ulang (PRD §11.3).
 *
 * Aturan yang dipakai:
 * - Absensi siswa: hanya sesi berstatus Dikirim/Final yang dihitung (Draft belum resmi).
 *   Persentase hadir = (Hadir + Terlambat) ÷ jumlah record status × 100.
 * - Jam kosong: identik dengan domain.substitutionSlotsOn per tanggal (FR-SUB-04).
 * - Kelengkapan jurnal: slot terjadwal pada hari sekolah s.d. hari ini (kecuali jam kosong yang
 *   tidak tertangani) dibanding slot yang memiliki jurnal Dikirim/Final (PRD §3.2).
 * - Scope role (PRD §4.1): admin/pimpinan/piket semua kelas; wali kelas & guru hanya kelas binaan
 *   atau yang diajar; data guru hanya milik sendiri tanpa permission baca semua.
 */
import { dateRange, isoDayOfWeek, todayISO } from '@/lib/date'
import { NON_PRESENT_STATUSES, TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  AttendanceReport,
  AttendanceReportRow,
  AttendanceGroupBy,
  AbsenteesReport,
  DismissalsReport,
  DutyAgendaReport,
  DutyAgendaReportRow,
  ExtraActivityReport,
  ExtraActivityReportRow,
  SubstitutionReport,
  TeacherAttendanceReport,
  TeacherAttendanceReportRow,
  TeachingLogReport,
} from '@/features/reports/types'
import {
  ATTENDANCE_STATUSES,
  DISMISSAL_TYPES,
  RECORD_STATUSES,
  type AbsenteeRow,
  TEACHER_ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type DismissalType,
  type ID,
  type ISODate,
  type RecordStatus,
  type ShiftCode,
  type SubstitutionSlot,
  type TeacherAttendanceStatus,
} from '@/types/entities'
import { db, isDeleted } from '../db'
import {
  className,
  getStudent,
  getTeacher,
  phoneForUser,
  scheduledPeriods,
  scheduledTeacherIds,
  slotsOn,
  substitutionSlotsOn,
  summarizeSlots,
  teacherAttendanceOn,
  dutyTeacherIds,
  teacherName,
} from '../domain'
import {
  accessibleClassIds,
  can,
  errors,
  nowTs,
  requireClassAccess,
  requirePermission,
  toCurrentUser,
  type AuthedUser,
} from '../utils'

/* ------------------------------------------------------------------ query parsing */

const EXTRA_ACTIVITY_TYPES = ['COURSE', 'EXTRA_HOURS', 'OTHER'] as const

export interface ReportParams {
  dateFrom: ISODate
  dateTo: ISODate
  classId: ID | null
  shiftCode: ShiftCode | null
  studentId: ID | null
  teacherId: ID | null
  subjectId: ID | null
  status: string | null
  /** Semua nilai status (?status=A&status=B atau ?status=A,B) — laporan siswa tidak hadir mendukung multi-status. */
  statuses: string[]
  type: string | null
  /** Ekspor kegiatan tambahan: filter pengampu. */
  instructorTeacherId: ID | null
  /** Ekspor siswa tidak hadir: 'true' = sudah dihubungi, 'false' = belum. */
  contacted: 'true' | 'false' | null
  /** Ekspor siswa tidak hadir: sertakan sesi Draft. */
  includeDraft: boolean
  groupBy: AttendanceGroupBy
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 400
const GROUP_BYS: AttendanceGroupBy[] = ['class', 'student', 'date']

function isValidDate(v: string) {
  if (!ISO_DATE_RE.test(v)) return false
  const d = new Date(`${v}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

/** Validasi filter umum. Melempar 422 dengan detail per field. */
export function parseReportParams(sp: URLSearchParams): ReportParams {
  const details: Record<string, string> = {}
  const dateFrom = sp.get('dateFrom') ?? ''
  const dateTo = sp.get('dateTo') ?? ''
  if (!dateFrom) details.dateFrom = 'required'
  else if (!isValidDate(dateFrom)) details.dateFrom = 'invalid'
  if (!dateTo) details.dateTo = 'required'
  else if (!isValidDate(dateTo)) details.dateTo = 'invalid'
  if (!details.dateFrom && !details.dateTo) {
    if (dateFrom > dateTo) {
      details.dateTo = 'Tanggal akhir harus sama dengan atau setelah tanggal awal.'
    } else if (dateRange(dateFrom, dateTo).length > MAX_RANGE_DAYS) {
      details.dateTo = `Rentang laporan maksimal ${MAX_RANGE_DAYS} hari.`
    }
  }
  const groupByRaw = sp.get('groupBy') || 'class'
  if (!GROUP_BYS.includes(groupByRaw as AttendanceGroupBy)) details.groupBy = 'invalid'
  if (Object.keys(details).length > 0) {
    throw errors.validation(details, 'Filter laporan tidak valid.')
  }
  const contactedRaw = sp.get('contacted')
  if (contactedRaw && contactedRaw !== 'true' && contactedRaw !== 'false') {
    throw errors.validation({ contacted: 'invalid' }, 'Filter laporan tidak valid.')
  }
  const opt = (k: string) => sp.get(k) || null
  const statuses = [...new Set(sp.getAll('status').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))]
  return {
    dateFrom,
    dateTo,
    classId: opt('classId'),
    shiftCode: opt('shiftCode'),
    studentId: opt('studentId'),
    teacherId: opt('teacherId'),
    subjectId: opt('subjectId'),
    status: statuses[0] ?? null,
    statuses,
    type: opt('type'),
    instructorTeacherId: opt('instructorTeacherId'),
    contacted: contactedRaw === 'true' || contactedRaw === 'false' ? contactedRaw : null,
    includeDraft: sp.get('includeDraft') === 'true',
    groupBy: groupByRaw as AttendanceGroupBy,
  }
}

function assertEnum(field: string, value: string | null | readonly string[], allowed: readonly string[]) {
  const values = value === null ? [] : typeof value === 'string' ? [value] : value
  if (values.some((v) => !allowed.includes(v))) throw errors.validation({ [field]: 'invalid' }, 'Filter laporan tidak valid.')
}

const inRange = (date: ISODate, p: ReportParams) => date >= p.dateFrom && date <= p.dateTo
const base = (p: ReportParams) => ({ period: { dateFrom: p.dateFrom, dateTo: p.dateTo }, generatedAt: nowTs() })

/* ------------------------------------------------------------------ scope */

/**
 * Scope kelas untuk data siswa + validasi filter classId/studentId (403 bila di luar wewenang).
 * null = semua kelas.
 */
function studentScope(user: AuthedUser, p: ReportParams): ID[] | null {
  if (p.classId) requireClassAccess(user, p.classId)
  if (p.studentId) {
    const s = getStudent(p.studentId)
    if (!s) throw errors.notFound('Siswa tidak ditemukan.')
    requireClassAccess(user, s.classId)
  }
  return accessibleClassIds(user)
}

const VALID_SESSION_STATUSES: RecordStatus[] = ['SUBMITTED', 'FINAL']

function emptyAttendanceCounts(): Record<AttendanceStatus, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>
}
function emptyTeacherCounts(): Record<TeacherAttendanceStatus, number> {
  return Object.fromEntries(TEACHER_ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<
    TeacherAttendanceStatus,
    number
  >
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
const classOrder = () => new Map(db().classes.map((c, i) => [c.id, i]))

/** Sesi absensi dalam rentang & scope (sebelum dipilah valid/draft). */
function sessionsInScope(user: AuthedUser, p: ReportParams) {
  const scope = studentScope(user, p)
  return db().studentSessions.filter(
    (s) =>
      inRange(s.date, p) &&
      !isDeleted('studentSessions', s.id) &&
      (!p.classId || s.classId === p.classId) &&
      (!p.shiftCode || s.shiftCode === p.shiftCode) &&
      (!scope || scope.includes(s.classId)),
  )
}

/* ------------------------------------------------------------------ 1. absensi siswa */

export function buildAttendanceReport(user: AuthedUser, p: ReportParams): AttendanceReport {
  requirePermission(user, 'student_attendance:read')
  const sessions = sessionsInScope(user, p)
  const valid = sessions.filter((s) => VALID_SESSION_STATUSES.includes(s.status))
  const sessionById = new Map(valid.map((s) => [s.id, s]))
  const records = db().studentRecords.filter(
    (r) =>
      sessionById.has(r.sessionId) &&
      !isDeleted('studentRecords', r.id) &&
      (!p.studentId || r.studentId === p.studentId),
  )

  type Acc = { row: AttendanceReportRow; sessionIds: Set<ID> }
  const groups = new Map<string, Acc>()
  const totals = { counts: emptyAttendanceCounts(), total: 0, present: 0, percentPresent: null as number | null, sessions: 0 }
  const allSessions = new Set<ID>()

  for (const r of records) {
    const s = sessionById.get(r.sessionId)
    if (!s) continue
    const key = p.groupBy === 'class' ? s.classId : p.groupBy === 'student' ? r.studentId : s.date
    let acc = groups.get(key)
    if (!acc) {
      acc = {
        sessionIds: new Set(),
        row: {
          key,
          label:
            p.groupBy === 'class' ? className(s.classId) : p.groupBy === 'student' ? r.studentName : s.date,
          sublabel:
            p.groupBy === 'student' ? `${r.studentNis} · ${className(s.classId)}` : null,
          classId: p.groupBy === 'date' ? null : s.classId,
          studentId: p.groupBy === 'student' ? r.studentId : null,
          date: p.groupBy === 'date' ? s.date : null,
          counts: emptyAttendanceCounts(),
          total: 0,
          present: 0,
          percentPresent: null,
          sessions: 0,
        },
      }
      groups.set(key, acc)
    }
    acc.row.counts[r.status] += 1
    acc.row.total += 1
    acc.sessionIds.add(s.id)
    totals.counts[r.status] += 1
    totals.total += 1
    allSessions.add(s.id)
  }

  const order = classOrder()
  const rows = [...groups.values()].map(({ row, sessionIds }) => {
    row.present = row.counts.PRESENT + row.counts.LATE
    row.percentPresent = pct(row.present, row.total)
    row.sessions = sessionIds.size
    return row
  })
  rows.sort((a, b) => {
    if (p.groupBy === 'date') return a.key.localeCompare(b.key)
    const byClass = (order.get(a.classId ?? '') ?? 0) - (order.get(b.classId ?? '') ?? 0)
    if (p.groupBy === 'class') return byClass
    return byClass || a.label.localeCompare(b.label, 'id')
  })
  totals.present = totals.counts.PRESENT + totals.counts.LATE
  totals.percentPresent = pct(totals.present, totals.total)
  totals.sessions = allSessions.size

  return {
    ...base(p),
    groupBy: p.groupBy,
    rows,
    totals,
    sessionsCounted: valid.length,
    sessionsExcluded: sessions.filter((s) => s.status === 'DRAFT').length,
  }
}

/* ------------------------------------------------------------------ 2. siswa tidak hadir */

export function buildAbsenteesReport(user: AuthedUser, p: ReportParams): AbsenteesReport {
  requirePermission(user, 'absentees:read')
  assertEnum('status', p.statuses, NON_PRESENT_STATUSES)
  const sessionStatuses: RecordStatus[] = p.includeDraft ? [...VALID_SESSION_STATUSES, 'DRAFT'] : VALID_SESSION_STATUSES
  const valid = sessionsInScope(user, p).filter((s) => sessionStatuses.includes(s.status))
  const sessionById = new Map(valid.map((s) => [s.id, s]))
  const statuses = p.statuses.length > 0 ? (p.statuses as AttendanceStatus[]) : NON_PRESENT_STATUSES
  const order = classOrder()
  const rows: AbsenteeRow[] = db()
    .studentRecords.filter(
      (r) =>
        sessionById.has(r.sessionId) &&
        !isDeleted('studentRecords', r.id) &&
        statuses.includes(r.status) &&
        (!p.studentId || r.studentId === p.studentId) &&
        (p.contacted === null || (r.contact !== null) === (p.contacted === 'true')),
    )
    .map((r) => {
      const s = sessionById.get(r.sessionId)!
      const st = getStudent(r.studentId)
      return {
        recordId: r.id,
        sessionId: s.id,
        date: s.date,
        shiftCode: s.shiftCode,
        classId: s.classId,
        className: className(s.classId),
        studentId: r.studentId,
        studentName: r.studentName,
        studentNis: r.studentNis,
        status: r.status,
        reason: r.reason,
        note: r.note,
        guardianName: st?.guardianName ?? null,
        guardianPhone: phoneForUser(st?.guardianPhone ?? null, user),
        contact: r.contact
          ? { ...r.contact, contactedPhone: phoneForUser(r.contact.contactedPhone, user) }
          : null,
        sessionStatus: s.status,
      }
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (order.get(a.classId) ?? 0) - (order.get(b.classId) ?? 0) ||
        a.studentName.localeCompare(b.studentName, 'id'),
    )
  const counts = emptyAttendanceCounts()
  for (const r of rows) counts[r.status] += 1
  const contacted = rows.filter((r) => r.contact?.contactedAt).length
  return { ...base(p), rows, counts, total: rows.length, contacted, notContacted: rows.length - contacted }
}

/* ------------------------------------------------------------------ 3. kepulangan */

export function buildDismissalsReport(user: AuthedUser, p: ReportParams): DismissalsReport {
  requirePermission(user, 'dismissal:read')
  assertEnum('type', p.type, DISMISSAL_TYPES)
  const scope = studentScope(user, p)
  const rows = db()
    .dismissals.filter(
      (x) =>
        inRange(x.date, p) &&
        !isDeleted('dismissals', x.id) &&
        (!p.classId || x.classId === p.classId) &&
        (!p.shiftCode || x.shiftCode === p.shiftCode) &&
        (!p.studentId || x.studentId === p.studentId) &&
        (!p.type || x.type === p.type) &&
        (!scope || scope.includes(x.classId)),
    )
    .sort((a, b) => a.exitTime.localeCompare(b.exitTime))
  const counts = Object.fromEntries(DISMISSAL_TYPES.map((t) => [t, 0])) as Record<DismissalType, number>
  for (const r of rows) counts[r.type] += 1
  return { ...base(p), rows, counts, total: rows.length }
}

/* ------------------------------------------------------------------ 4. absensi guru */

/** null = semua guru; selain itu hanya teacherId milik user (teacher_attendance:self). */
function teacherScope(user: AuthedUser, p: ReportParams): ID | null {
  if (can(user, 'teacher_attendance:read')) return null
  requirePermission(user, 'teacher_attendance:self')
  if (!user.teacherId) throw errors.forbidden('Akun Anda tidak terhubung dengan data guru.')
  if (p.teacherId && p.teacherId !== user.teacherId) {
    throw errors.forbidden('Anda hanya dapat melihat rekap kehadiran Anda sendiri.')
  }
  return user.teacherId
}

export function buildTeacherAttendanceReport(user: AuthedUser, p: ReportParams): TeacherAttendanceReport {
  const only = teacherScope(user, p)
  assertEnum('status', p.status, TEACHER_ATTENDANCE_STATUSES)
  const records = db()
    .teacherAttendance.filter(
      (a) =>
        inRange(a.date, p) &&
        !isDeleted('teacherAttendance', a.id) &&
        (!only || a.teacherId === only) &&
        (!p.teacherId || a.teacherId === p.teacherId) &&
        (!p.shiftCode || a.shiftCode === p.shiftCode) &&
        (!p.status || a.status === p.status),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.teacherName.localeCompare(b.teacherName, 'id'))

  const byTeacher = new Map<ID, TeacherAttendanceReportRow>()
  const totals = { counts: emptyTeacherCounts(), records: 0, lateMinutes: 0, affectedPeriods: 0 }
  for (const a of records) {
    let row = byTeacher.get(a.teacherId)
    if (!row) {
      row = {
        teacherId: a.teacherId,
        teacherName: a.teacherName,
        nip: getTeacher(a.teacherId)?.nip ?? '—',
        counts: emptyTeacherCounts(),
        records: 0,
        lateMinutes: 0,
        affectedPeriods: 0,
      }
      byTeacher.set(a.teacherId, row)
    }
    const late = a.lateMinutes ?? 0
    const affected = TEACHER_ABSENT_STATUSES.includes(a.status) ? a.affectedPeriods : 0
    row.counts[a.status] += 1
    row.records += 1
    row.lateMinutes += late
    row.affectedPeriods += affected
    totals.counts[a.status] += 1
    totals.records += 1
    totals.lateMinutes += late
    totals.affectedPeriods += affected
  }
  const teachers = [...byTeacher.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'id'))
  return { ...base(p), teachers, records, totals }
}

/* ------------------------------------------------------------------ 5. agenda piket */

function liveDutyNumbers(date: ISODate, shiftCode: ShiftCode) {
  const ids = scheduledTeacherIds(date, shiftCode)
  const absent = ids
    .map((id) => teacherAttendanceOn(id, date))
    .filter((a): a is NonNullable<typeof a> => !!a && TEACHER_ABSENT_STATUSES.includes(a.status))
  const handled = (tid: ID) =>
    db()
      .substitutions.filter(
        (r) => r.date === date && r.shiftCode === shiftCode && r.absentTeacherId === tid && r.status === 'ACTIVE',
      )
      .reduce((n, r) => n + r.periodCount, 0)
  return {
    scheduledTeacherCount: ids.length,
    presentTeacherCount: ids.length - absent.length,
    absentTeacherCount: absent.length,
    absentTeacherNames: absent.map((a) => a.teacherName),
    affectedPeriods: absent.reduce(
      (n, a) => n + (a.affectedPeriodsOverride ?? scheduledPeriods(a.teacherId, date, shiftCode)),
      0,
    ),
    handledPeriods: absent.reduce((n, a) => n + handled(a.teacherId), 0),
  }
}

export function buildDutyAgendaReport(user: AuthedUser, p: ReportParams): DutyAgendaReport {
  requirePermission(user, 'duty_agenda:read')
  const d = db()
  const today = todayISO()
  const schoolDays = d.settings.schoolDays
  const shifts = d.shifts.filter((s) => !isDeleted('shifts', s.id) && (!p.shiftCode || s.code === p.shiftCode))
  const rows: DutyAgendaReportRow[] = []
  for (const date of dateRange(p.dateFrom, p.dateTo)) {
    for (const sh of shifts) {
      const agenda = d.dutyAgendas.find(
        (a) => a.date === date && a.shiftCode === sh.code && !isDeleted('dutyAgendas', a.id),
      )
      const common = { key: `${date}:${sh.code}`, date, shiftCode: sh.code, shiftName: sh.name }
      if (agenda && agenda.status === 'FINAL') {
        // Agenda final memakai snapshot yang disahkan.
        rows.push({
          ...common,
          agendaId: agenda.id,
          dutyTeacherNames: agenda.dutyTeacherNames,
          status: agenda.status,
          scheduledTeacherCount: agenda.scheduledTeacherCount,
          presentTeacherCount: agenda.presentTeacherCount,
          absentTeacherCount: agenda.absentTeachers.length,
          absentTeacherNames: agenda.absentTeachers.map((a) => a.teacherName),
          affectedPeriods: agenda.absentTeachers.reduce((n, a) => n + a.affectedPeriods, 0),
          handledPeriods: agenda.absentTeachers.reduce((n, a) => n + a.handledPeriods, 0),
          notesCount: agenda.notes.length,
        })
      } else if (agenda) {
        rows.push({
          ...common,
          agendaId: agenda.id,
          dutyTeacherNames: agenda.dutyTeacherNames.length
            ? agenda.dutyTeacherNames
            : dutyTeacherIds(date, sh.code).map(teacherName),
          status: agenda.status,
          notesCount: agenda.notes.length,
          ...liveDutyNumbers(date, sh.code),
        })
      } else if (
        date <= today &&
        schoolDays.includes(isoDayOfWeek(date)) &&
        scheduledTeacherIds(date, sh.code).length > 0
      ) {
        rows.push({
          ...common,
          agendaId: null,
          dutyTeacherNames: dutyTeacherIds(date, sh.code).map(teacherName),
          status: null,
          notesCount: 0,
          ...liveDutyNumbers(date, sh.code),
        })
      }
    }
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || a.shiftCode.localeCompare(b.shiftCode) * -1)
  const sum = (f: (r: DutyAgendaReportRow) => number) => rows.reduce((n, r) => n + f(r), 0)
  return {
    ...base(p),
    rows,
    totals: {
      rows: rows.length,
      final: rows.filter((r) => r.status === 'FINAL').length,
      notFinal: rows.filter((r) => r.status !== null && r.status !== 'FINAL').length,
      notCreated: rows.filter((r) => r.status === null).length,
      absentTeacherCount: sum((r) => r.absentTeacherCount),
      affectedPeriods: sum((r) => r.affectedPeriods),
      handledPeriods: sum((r) => r.handledPeriods),
      notesCount: sum((r) => r.notesCount),
    },
  }
}

/* ------------------------------------------------------------------ 6. jurnal mengajar */

export function buildTeachingLogReport(user: AuthedUser, p: ReportParams): TeachingLogReport {
  requirePermission(user, 'teaching_log:read')
  assertEnum('status', p.status, RECORD_STATUSES)
  const readAll = can(user, 'teaching_log:read_all')
  const homeroom = readAll ? [] : toCurrentUser(user).homeroomClassIds
  if (!readAll && p.teacherId && p.teacherId !== user.teacherId && homeroom.length === 0) {
    throw errors.forbidden('Anda hanya dapat melihat jurnal mengajar Anda sendiri.')
  }
  const allowed = (teacherId: ID, classId: ID) =>
    readAll || teacherId === user.teacherId || homeroom.includes(classId)

  const d = db()
  const filtered = d.teachingLogs.filter(
    (l) =>
      inRange(l.date, p) &&
      !isDeleted('teachingLogs', l.id) &&
      l.status !== 'CANCELLED' &&
      (!p.teacherId || l.teacherId === p.teacherId) &&
      (!p.classId || l.classId === p.classId) &&
      (!p.subjectId || l.subjectId === p.subjectId) &&
      (!p.shiftCode || l.shiftCode === p.shiftCode) &&
      allowed(l.teacherId, l.classId),
  )
  // Tanpa filter status: jurnal Draft tidak dihitung. Dengan filter status (ekspor riwayat): ikuti filter.
  const rows = filtered
    .filter((l) => (p.status ? l.status === p.status : l.status !== 'DRAFT'))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.className.localeCompare(b.className) ||
        a.periodStart - b.periodStart,
    )

  // Kelengkapan: slot terjadwal (hari sekolah, s.d. hari ini) yang seharusnya memiliki jurnal.
  const today = todayISO()
  const schoolDays = d.settings.schoolDays
  const logged = new Set(rows.filter((l) => l.timetableSlotId).map((l) => `${l.date}:${l.timetableSlotId}`))
  let expectedSlots = 0
  let filledSlots = 0
  for (const date of dateRange(p.dateFrom, p.dateTo > today ? today : p.dateTo)) {
    if (!schoolDays.includes(isoDayOfWeek(date))) continue
    const unhandled = new Set(
      substitutionSlotsOn(date)
        .filter((s) => s.status === 'UNHANDLED')
        .map((s) => s.timetableSlotId),
    )
    for (const s of slotsOn(date, { shiftCode: p.shiftCode, classId: p.classId, teacherId: p.teacherId })) {
      if (p.subjectId && s.subjectId !== p.subjectId) continue
      if (!allowed(s.teacherId, s.classId)) continue
      if (unhandled.has(s.id)) continue
      expectedSlots += 1
      if (logged.has(`${date}:${s.id}`)) filledSlots += 1
    }
  }
  const held = rows.filter((l) => l.execution === 'HELD')
  return {
    ...base(p),
    rows,
    totals: {
      logs: rows.length,
      held: held.length,
      notHeld: rows.length - held.length,
      periods: held.reduce((n, l) => n + l.periodCount, 0),
      expectedSlots,
      filledSlots,
      fillRate: pct(filledSlots, expectedSlots),
      draftExcluded: filtered.length - rows.length,
    },
  }
}

/* ------------------------------------------------------------------ 7. jam kosong */

export function buildSubstitutionReport(user: AuthedUser, p: ReportParams): SubstitutionReport {
  requirePermission(user, 'substitution:read')
  if (p.classId) requireClassAccess(user, p.classId)
  const scope = accessibleClassIds(user)
  const mine = (s: SubstitutionSlot) =>
    !!user.teacherId &&
    (s.absentTeacherId === user.teacherId || s.substitution?.substituteTeacherId === user.teacherId)
  const days: SubstitutionReport['days'] = []
  const slots: SubstitutionSlot[] = []
  for (const date of dateRange(p.dateFrom, p.dateTo)) {
    const daySlots = substitutionSlotsOn(date, { shiftCode: p.shiftCode, classId: p.classId }).filter(
      (s) =>
        (!p.subjectId || s.subjectId === p.subjectId) &&
        (!p.teacherId ||
          s.absentTeacherId === p.teacherId ||
          s.substitution?.substituteTeacherId === p.teacherId) &&
        (!scope || scope.includes(s.classId) || mine(s)),
    )
    if (daySlots.length === 0) continue
    days.push({ date, summary: summarizeSlots(daySlots) })
    slots.push(...daySlots)
  }
  days.sort((a, b) => b.date.localeCompare(a.date))
  slots.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.shiftCode.localeCompare(b.shiftCode) * -1 ||
      a.className.localeCompare(b.className) ||
      a.periodStart - b.periodStart,
  )
  return { ...base(p), days, slots, totals: summarizeSlots(slots) }
}

/* ------------------------------------------------------------------ 8. kegiatan tambahan */

export function buildExtraActivityReport(user: AuthedUser, p: ReportParams): ExtraActivityReport {
  requirePermission(user, 'extra_activity:read')
  assertEnum('type', p.type, EXTRA_ACTIVITY_TYPES)
  assertEnum('status', p.status, RECORD_STATUSES)
  if (p.classId) requireClassAccess(user, p.classId)
  const scope = accessibleClassIds(user)
  const rows: ExtraActivityReportRow[] = db()
    .extraActivities.filter(
      (a) =>
        inRange(a.date, p) &&
        !isDeleted('extraActivities', a.id) &&
        (p.status ? a.status === p.status : a.status !== 'CANCELLED') &&
        (!p.classId || a.classIds.includes(p.classId)) &&
        (!p.shiftCode || a.shiftCode === p.shiftCode) &&
        (!p.type || a.type === p.type) &&
        (!p.instructorTeacherId || a.instructorTeacherId === p.instructorTeacherId) &&
        (!scope ||
          a.classIds.some((c) => scope.includes(c)) ||
          a.coordinatorUserId === user.id ||
          (!!user.teacherId && a.instructorTeacherId === user.teacherId)),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      date: a.date,
      shiftCode: a.shiftCode,
      startTime: a.startTime,
      endTime: a.endTime,
      classIds: a.classIds,
      classNames: a.classNames,
      instructorName: a.instructorName,
      topic: a.topic,
      note: a.note,
      status: a.status,
      participantAttendanceEnabled: a.participantAttendanceEnabled,
      participantCount: a.participants.length,
      presentCount: a.participants.filter((x) => x.status === 'PRESENT' || x.status === 'LATE').length,
    }))
  const byType = { COURSE: 0, EXTRA_HOURS: 0, OTHER: 0 }
  for (const r of rows) byType[r.type] += 1
  return {
    ...base(p),
    rows,
    totals: {
      activities: rows.length,
      byType,
      participants: rows.reduce((n, r) => n + r.participantCount, 0),
      present: rows.reduce((n, r) => n + r.presentCount, 0),
    },
  }
}
