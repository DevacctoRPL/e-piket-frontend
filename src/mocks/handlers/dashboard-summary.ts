/**
 * Perhitungan ringkasan dashboard (FR-RPT-01) — meniru apa yang akan dihitung backend Go.
 * Semua angka diturunkan dari helper domain bersama agar konsisten dengan modul lain (PRD §9.2).
 * Payload TIDAK pernah memuat data kontak siswa/wali (PRD §12 Privasi).
 */
import { addDays, formatDate, formatWallTime, nowWallTime, todayISO, wallTimeToMinutes } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  AttendanceSummaryCounts,
  DashboardSummary,
  ID,
  ISODate,
  PendingTask,
  ShiftCode,
  TimetableSlot,
} from '@/types/entities'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import { db, isDeleted } from '../db'
import {
  activeAcademicYear,
  className,
  emptyCounts,
  isDutyTeacher,
  isTeacherAbsent,
  periodTimes,
  scheduledTeacherIds,
  sessionSummary,
  slotsOn,
  subjectName,
  substitutionSlotsOn,
  summarizeSlots,
  teacherAttendanceOn,
  dutyTeacherIds,
} from '../domain'
import { accessibleClassIds, can, type AuthedUser } from '../utils'

const SUBMITTED_STATES = new Set(['SUBMITTED', 'FINAL'])
const IGNORED_STATES = new Set(['CANCELLED', 'REJECTED'])
/** Rentang hari ke belakang untuk mencari check-out yang terlupa. */
const CHECKOUT_LOOKBACK_DAYS = 6

export interface SummaryParams {
  date: ISODate
  shiftCode: ShiftCode | null
}

function qs(params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

function addCounts(into: AttendanceSummaryCounts, add: AttendanceSummaryCounts) {
  for (const s of ATTENDANCE_STATUSES) into[s] += add[s]
  into.total += add.total
  into.unmarked += add.unmarked
}

function activeShifts(shiftCode: ShiftCode | null) {
  return db().shifts.filter(
    (s) => s.isActive && !isDeleted('shifts', s.id) && (!shiftCode || s.code === shiftCode),
  )
}

function liveTeachingLogs(date: ISODate) {
  return db().teachingLogs.filter(
    (l) => l.date === date && !isDeleted('teachingLogs', l.id) && !IGNORED_STATES.has(l.status),
  )
}

/**
 * Slot yang diharapkan memiliki jurnal:
 * - teacherId terisi → slot milik guru tsb (kecuali ia berhalangan) + slot yang ia gantikan;
 * - tanpa teacherId → seluruh slot sekolah yang berlangsung (guru hadir atau sudah ada pengganti).
 */
function expectedLogSlots(
  date: ISODate,
  shiftCode: ShiftCode | null,
  teacherId: ID | null,
): { slot: TimetableSlot; isSubstitution: boolean }[] {
  const all = slotsOn(date, { shiftCode })
  const activeSubs = db().substitutions.filter((r) => r.date === date && r.status === 'ACTIVE')
  if (teacherId) {
    const own = isTeacherAbsent(teacherId, date)
      ? []
      : all.filter((s) => s.teacherId === teacherId).map((slot) => ({ slot, isSubstitution: false }))
    const subIds = new Set(
      activeSubs.filter((r) => r.substituteTeacherId === teacherId).map((r) => r.timetableSlotId),
    )
    const subs = all.filter((s) => subIds.has(s.id)).map((slot) => ({ slot, isSubstitution: true }))
    return [...own, ...subs]
  }
  const handled = new Set(activeSubs.map((r) => r.timetableSlotId))
  return all
    .filter((s) => !isTeacherAbsent(s.teacherId, date) || handled.has(s.id))
    .map((slot) => ({ slot, isSubstitution: isTeacherAbsent(slot.teacherId, date) }))
}

export function computeDashboardSummary(user: AuthedUser, { date, shiftCode }: SummaryParams): DashboardSummary {
  const d = db()
  const today = todayISO()
  const isPastOrToday = date <= today
  const shifts = activeShifts(shiftCode)
  const shiftCodes = new Set(shifts.map((s) => s.code))
  const classScope = accessibleClassIds(user)
  const inScope = (classId: ID) => !classScope || classScope.includes(classId)
  const teacherId = user.teacherId
  const tasks: PendingTask[] = []

  /* ---------------------------------------------------------- absensi siswa */
  const yearId = activeAcademicYear()?.id
  const classes = d.classes
    .filter(
      (c) =>
        c.status === 'ACTIVE' &&
        !isDeleted('classes', c.id) &&
        (!yearId || c.academicYearId === yearId) &&
        shiftCodes.has(c.shiftCode) &&
        inScope(c.id),
    )
    .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name, 'id'))

  const counts = emptyCounts()
  let sessionsSubmitted = 0
  let sessionsDraft = 0
  const canFillAttendance = can(user, 'student_attendance:write')
  // Guru ber-scope hanya ditugasi kelas yang ia ajar pada tanggal tsb atau kelas binaannya.
  const dutyClassIds: Set<ID> | null = classScope
    ? new Set([
        ...(teacherId ? slotsOn(date, { teacherId }).map((s) => s.classId) : []),
        ...d.classes.filter((c) => teacherId && c.homeroomTeacherId === teacherId).map((c) => c.id),
      ])
    : null
  for (const c of classes) {
    const sessions = d.studentSessions
      .filter(
        (s) =>
          s.classId === c.id &&
          s.date === date &&
          !isDeleted('studentSessions', s.id) &&
          !IGNORED_STATES.has(s.status),
      )
      .sort((a, b) => a.sessionNumber - b.sessionNumber)
    const submitted = sessions.some((s) => SUBMITTED_STATES.has(s.status))
    const daily = sessions[0]
    if (submitted) sessionsSubmitted += 1
    else if (daily) sessionsDraft += 1
    // Hitungan siswa memakai sesi harian (sesi pertama) agar siswa tidak terhitung ganda.
    if (daily) addCounts(counts, sessionSummary(daily.id))
    if (!submitted && canFillAttendance && isPastOrToday && (!dutyClassIds || dutyClassIds.has(c.id))) {
      tasks.push({
        id: `att:${date}:${c.id}`,
        kind: 'ATTENDANCE_NOT_SUBMITTED',
        title: `Absensi ${c.name} belum dikirim`,
        description: daily
          ? 'Sesi absensi masih Draft. Lengkapi status siswa lalu kirim.'
          : 'Belum ada data absensi untuk kelas ini pada tanggal tersebut.',
        href: `/absensi-siswa${qs({ date, shift: c.shiftCode, classId: c.id })}`,
      })
    }
  }

  /* ---------------------------------------------------------- absensi guru */
  const canReadTeachers = can(user, 'teacher_attendance:read')
  let scheduledIds = scheduledTeacherIds(date, shiftCode)
  // Tanpa izin baca absensi guru, ringkasan hanya mencakup diri sendiri.
  if (!canReadTeachers) scheduledIds = scheduledIds.filter((id) => id === teacherId)
  const teacherAttendance = { scheduled: scheduledIds.length, present: 0, absent: 0, late: 0, notCheckedIn: 0 }
  for (const id of scheduledIds) {
    const a = teacherAttendanceOn(id, date)
    if (!a) teacherAttendance.notCheckedIn += 1
    else if (TEACHER_ABSENT_STATUSES.includes(a.status)) teacherAttendance.absent += 1
    else if (a.status === 'LATE') {
      teacherAttendance.present += 1
      teacherAttendance.late += 1
    } else if (a.checkInAt || a.status === 'PRESENT') teacherAttendance.present += 1
    else teacherAttendance.notCheckedIn += 1
  }

  /* ---------------------------------------------------------- jam kosong */
  const subSlots = substitutionSlotsOn(date, { shiftCode }).filter(
    (s) => shiftCodes.has(s.shiftCode) && inScope(s.classId),
  )
  const substitutions = summarizeSlots(subSlots)
  if (can(user, 'substitution:write') && isPastOrToday) {
    for (const sh of shifts) {
      const summary = summarizeSlots(subSlots.filter((s) => s.shiftCode === sh.code))
      if (summary.unhandledSlots === 0) continue
      tasks.push({
        id: `sub:${date}:${sh.code}`,
        kind: 'SUBSTITUTION_UNHANDLED',
        title: `${summary.unhandledSlots} slot jam kosong shift ${sh.name} belum tertangani`,
        description: `${summary.unhandledPeriods} jam pelajaran belum memiliki guru pengganti.`,
        href: `/jam-kosong${qs({ date, shift: sh.code })}`,
      })
    }
  }

  /* ---------------------------------------------------------- agenda piket */
  const dutyAgenda = shifts.map((sh) => {
    const agenda = d.dutyAgendas.find(
      (a) =>
        a.date === date &&
        a.shiftCode === sh.code &&
        !isDeleted('dutyAgendas', a.id) &&
        a.status !== 'CANCELLED',
    )
    return { id: agenda?.id ?? null, status: agenda?.status ?? null, shiftCode: sh.code }
  })
  const isLeadership = user.roles.some((r) => r === 'ADMIN' || r === 'PRINCIPAL')
  if (isPastOrToday) {
    for (const sh of shifts) {
      const mine = isDutyTeacher(teacherId, date, sh.code)
      const hasDuty = dutyTeacherIds(date, sh.code).length > 0
      if (!mine && !(isLeadership && hasDuty)) continue
      const entry = dutyAgenda.find((a) => a.shiftCode === sh.code)
      if (entry?.status === 'FINAL') continue
      const state =
        entry?.status === 'SUBMITTED'
          ? { title: 'menunggu finalisasi', desc: 'Agenda sudah dikirim, tetapi belum difinalisasi.' }
          : entry?.status === 'DRAFT'
            ? { title: 'masih Draft', desc: 'Lengkapi guru tidak hadir & catatan penting, lalu finalisasi.' }
            : { title: 'belum dibuat', desc: 'Belum ada agenda piket untuk shift ini.' }
      tasks.push({
        id: `duty:${date}:${sh.code}`,
        kind: 'DUTY_AGENDA_DRAFT',
        title: `Agenda piket shift ${sh.name} ${state.title}`,
        description: mine ? `${state.desc} Anda bertugas piket pada shift ini.` : state.desc,
        href: `/agenda-piket${qs({ date, shift: sh.code })}`,
      })
    }
  }

  /* ---------------------------------------------------------- jurnal mengajar */
  const logs = liveTeachingLogs(date)
  const readAll = can(user, 'teaching_log:read_all')
  const scopeTeacher = readAll ? null : teacherId
  const expected =
    readAll || teacherId ? expectedLogSlots(date, shiftCode, scopeTeacher) : []
  // "Terisi" = slot yang sudah memiliki jurnal (status apa pun selain dibatalkan/ditolak).
  const loggedSlotIds = new Set(
    logs
      .filter((l) => !scopeTeacher || l.teacherId === scopeTeacher)
      .map((l) => l.timetableSlotId)
      .filter((id): id is ID => !!id),
  )
  const teachingLogs = {
    expected: expected.length,
    filled: expected.filter((e) => loggedSlotIds.has(e.slot.id)).length,
  }

  /* ---------------------------------------------------------- kepulangan */
  const dismissalRows = d.dismissals.filter(
    (r) =>
      r.date === date &&
      !isDeleted('dismissals', r.id) &&
      shiftCodes.has(r.shiftCode) &&
      inScope(r.classId),
  )
  const dismissals = {
    total: dismissalRows.length,
    earlyLeave: dismissalRows.filter((r) => r.type === 'EARLY_LEAVE').length,
    temporaryExit: dismissalRows.filter((r) => r.type === 'TEMPORARY_EXIT').length,
  }

  /* ---------------------------------------------------------- ringkasan pribadi guru */
  let me: DashboardSummary['me'] = null
  if (teacherId) {
    const mySlots = scopeTeacher === teacherId ? expected : expectedLogSlots(date, shiftCode, teacherId)
    const myLogs = logs.filter((l) => l.teacherId === teacherId)
    const myLogged = new Set(myLogs.map((l) => l.timetableSlotId))
    const myDrafts = new Set(myLogs.filter((l) => l.status === 'DRAFT').map((l) => l.timetableSlotId))
    me = {
      teacherAttendance: teacherAttendanceOn(teacherId, date) ?? null,
      todaySlots: mySlots.length,
      logsFilled: mySlots.filter((e) => myLogged.has(e.slot.id)).length,
      isDutyToday: isDutyTeacher(teacherId, date, shiftCode ?? undefined),
    }

    if (can(user, 'teaching_log:write') && isPastOrToday) {
      for (const { slot, isSubstitution } of mySlots) {
        const isDraft = myDrafts.has(slot.id)
        if (myLogged.has(slot.id) && !isDraft) continue
        const t = periodTimes(slot.shiftCode, slot.periodStart, slot.periodEnd)
        tasks.push({
          id: `log:${date}:${slot.id}`,
          kind: 'TEACHING_LOG_MISSING',
          title: `Jurnal ${className(slot.classId)} · ${subjectName(slot.subjectId)} ${isDraft ? 'belum dikirim' : 'belum diisi'}`,
          description: `Jam ke-${slot.periodStart}–${slot.periodEnd} (${formatWallTime(t.startTime)}–${formatWallTime(t.endTime)})${isSubstitution ? ' · tugas pengganti' : ''}.`,
          href: `/jurnal-mengajar${qs({ date })}`,
        })
      }
    }

    if (can(user, 'teacher_attendance:self')) {
      const nowMin = wallTimeToMinutes(nowWallTime())
      for (let i = 0; i <= CHECKOUT_LOOKBACK_DAYS; i++) {
        const day = addDays(date, -i)
        if (day > today) continue
        const a = teacherAttendanceOn(teacherId, day)
        if (!a?.checkInAt || a.checkOutAt) continue
        const shift = d.shifts.find((s) => s.code === a.shiftCode)
        const ended = day < today || (shift ? nowMin > wallTimeToMinutes(shift.endTime) : false)
        if (!ended) continue
        tasks.push({
          id: `checkout:${day}`,
          kind: 'CHECK_OUT_MISSING',
          title: day === today ? 'Anda belum check-out hari ini' : `Check-out ${formatDate(day)} belum tercatat`,
          description:
            day === today
              ? `Shift ${shift?.name ?? a.shiftCode} sudah berakhir. Catat waktu pulang Anda.`
              : 'Anda check-in tetapi belum check-out. Hubungi petugas piket/TU bila perlu koreksi.',
          href: `/absensi-guru${qs({ date: day })}`,
        })
      }
    }
  }

  return {
    date,
    shiftCode,
    studentAttendance: {
      classesScheduled: classes.length,
      sessionsSubmitted,
      sessionsDraft,
      counts,
    },
    teacherAttendance,
    substitutions,
    dutyAgenda,
    teachingLogs,
    dismissals,
    me,
    pendingTasks: tasks,
  }
}
