/**
 * Mock API ringkasan sistem untuk Dashboard Super Admin: GET /system/overview?date=YYYY-MM-DD.
 * Izin `security:read`; blok `system` hanya untuk pemegang `system:manage`.
 *
 * Semua angka dihitung dari record NYATA (akun, log login, audit, absensi, jurnal, agenda, data master) —
 * bukan angka sintetis grafik. Payload TIDAK memuat nomor telepon wali/guru maupun kata sandi.
 */
import { http, type HttpHandler } from 'msw'
import { addDays, dateOf, isoDayOfWeek, todayISO } from '@/lib/date'
import { TEACHER_LINK_ROLES } from '@/lib/permissions'
import { ROLES, type AuditAction, type Completeness, type ID, type ISODate, type Role, type SystemOverview } from '@/types/entities'
import { db, isDeleted, MOCK_SCHEMA_VERSION } from '../db'
import { activeAcademicYear, activeSemester, dutyTeacherIds } from '../domain'
import { apiError, apiPath, can, errors, latency, nowTs, ok, requireAuth, requirePermission, searchParams, type AuthedUser } from '../utils'
import { expectedLogSlots } from './dashboard-summary'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** YYYY-MM-DD yang benar-benar ada di kalender (tolak 2026-02-31 yang di-roll oleh Date.parse). */
function isValidISODate(v: string) {
  if (!ISO_DATE.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v
}
const SHORT_DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const dayShort = (d: ISODate) => SHORT_DAYS[isoDayOfWeek(d) - 1] ?? 'Har'
const SUBMITTED_STATES = new Set(['SUBMITTED', 'FINAL'])
const IGNORED_STATES = new Set(['CANCELLED', 'REJECTED'])
const IMPORTANT_ACTIONS = new Set<AuditAction>(['CORRECT', 'DELETE', 'ROLE_CHANGE', 'STATUS_CHANGE', 'PASSWORD_RESET'])
/** Perubahan pengaturan/penugasan piket juga dianggap penting. */
const IMPORTANT_UPDATE_ENTITIES = new Set(['SchoolSettings', 'DutyAssignment'])
const REPEATED_FAILURE_THRESHOLD = 3
const DAY_MS = 24 * 60 * 60_000

function qs(params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** N hari sekolah terakhir (≤ date, menurut pengaturan hari sekolah), urut lama → baru. */
function recentSchoolDays(date: ISODate, n: number): ISODate[] {
  const schoolDays = db().settings.schoolDays?.length ? db().settings.schoolDays : [1, 2, 3, 4, 5, 6]
  const out: ISODate[] = []
  for (let off = 0; out.length < n && off < n * 7; off++) {
    const d = addDays(date, -off)
    if (schoolDays.includes(isoDayOfWeek(d))) out.unshift(d)
  }
  return out
}

function accountsBlock(): SystemOverview['accounts'] {
  const users = db().users
  const active = users.filter((u) => u.status === 'ACTIVE')
  return {
    total: users.length,
    active: active.length,
    inactive: users.length - active.length,
    mustChangePassword: users.filter((u) => u.status === 'ACTIVE' && u.mustChangePassword).length,
    neverLoggedIn: users.filter((u) => u.status === 'ACTIVE' && !u.lastLoginAt).length,
    byRole: ROLES.map((role) => ({
      role,
      total: users.filter((u) => u.roles.includes(role)).length,
      active: active.filter((u) => u.roles.includes(role)).length,
    })),
  }
}

function securityBlock(date: ISODate): SystemOverview['security'] {
  const events = db().loginEvents ?? []
  const from7 = addDays(date, -6)
  const inRange = events.filter((e) => {
    const day = dateOf(e.timestamp)
    return day >= from7 && day <= date
  })
  const today = inRange.filter((e) => dateOf(e.timestamp) === date)
  const series = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(date, i - 6)
    const ofDay = inRange.filter((e) => dateOf(e.timestamp) === day)
    return {
      date: day,
      dayShort: dayShort(day),
      success: ofDay.filter((e) => e.success).length,
      failed: ofDay.filter((e) => !e.success).length,
    }
  })

  // Percobaan gagal berulang: ≥3 dalam 24 jam terakhir (dihitung mundur dari sekarang / akhir tanggal terpilih).
  const endMs = date >= todayISO() ? Date.now() : Date.parse(`${addDays(date, 1)}T00:00:00Z`)
  const groups = new Map<string, { username: string; userId: ID | null; count: number; lastAt: string }>()
  for (const e of events) {
    if (e.success) continue
    const t = Date.parse(e.timestamp)
    if (!(t <= endMs && t > endMs - DAY_MS)) continue
    const key = e.username.toLowerCase()
    const g = groups.get(key)
    if (g) {
      g.count += 1
      if (e.timestamp > g.lastAt) g.lastAt = e.timestamp
    } else groups.set(key, { username: e.username, userId: e.userId, count: 1, lastAt: e.timestamp })
  }
  const repeatedFailures = [...groups.values()]
    .filter((g) => g.count >= REPEATED_FAILURE_THRESHOLD)
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))

  return {
    loginsToday: today.filter((e) => e.success).length,
    failedToday: today.filter((e) => !e.success).length,
    failed7d: inRange.filter((e) => !e.success).length,
    activeUsers7d: new Set(inRange.filter((e) => e.success && e.userId).map((e) => e.userId)).size,
    series,
    repeatedFailures,
  }
}

function importantEventsBlock(): SystemOverview['importantEvents'] {
  return db()
    .auditLogs.filter(
      (a) => IMPORTANT_ACTIONS.has(a.action) || (a.action === 'UPDATE' && IMPORTANT_UPDATE_ENTITIES.has(a.entity)),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 15)
    .map((a) => {
      const day = dateOf(a.timestamp)
      return {
        id: a.id,
        timestamp: a.timestamp,
        actorName: a.actorName,
        action: a.action,
        entity: a.entity,
        summary: a.summary,
        href: `/audit${qs({ entity: a.entity, action: a.action, dateFrom: day, dateTo: day })}`,
      }
    })
}

function dataHealthBlock(date: ISODate): SystemOverview['dataHealth'] {
  const d = db()
  const yearId = activeAcademicYear()?.id
  const sem = activeSemester()
  const classes = d.classes.filter(
    (c) => c.status === 'ACTIVE' && !isDeleted('classes', c.id) && (!yearId || c.academicYearId === yearId),
  )
  const activeShiftCodes = d.shifts.filter((s) => s.isActive && !isDeleted('shifts', s.id)).map((s) => s.code)
  const missingByClass = new Map<ID, number>()

  const days = recentSchoolDays(date, 7).map((day) => {
    // absensi kelas terkirim (Terkirim/Final)
    let attDone = 0
    for (const c of classes) {
      const submitted = d.studentSessions.some(
        (s) =>
          s.classId === c.id &&
          s.date === day &&
          !isDeleted('studentSessions', s.id) &&
          SUBMITTED_STATES.has(s.status),
      )
      if (submitted) attDone += 1
      else missingByClass.set(c.id, (missingByClass.get(c.id) ?? 0) + 1)
    }
    // jurnal terisi untuk slot yang berlangsung
    const expected = expectedLogSlots(day, null, null)
    const logged = new Set(
      d.teachingLogs
        .filter((l) => l.date === day && !isDeleted('teachingLogs', l.id) && !IGNORED_STATES.has(l.status))
        .map((l) => l.timetableSlotId)
        .filter((id): id is ID => !!id),
    )
    const logsDone = expected.filter((e) => logged.has(e.slot.id)).length
    // agenda piket final per shift yang memiliki petugas
    const dutyShifts = activeShiftCodes.filter((code) => dutyTeacherIds(day, code).length > 0)
    const agendaDone = dutyShifts.filter((code) =>
      d.dutyAgendas.some(
        (a) => a.date === day && a.shiftCode === code && a.status === 'FINAL' && !isDeleted('dutyAgendas', a.id),
      ),
    ).length
    return {
      date: day,
      dayShort: dayShort(day),
      attendance: { done: attDone, expected: classes.length } satisfies Completeness,
      teachingLogs: { done: logsDone, expected: expected.length } satisfies Completeness,
      dutyAgendas: { done: agendaDone, expected: dutyShifts.length } satisfies Completeness,
    }
  })

  const totals = days.reduce(
    (acc, day) => {
      for (const k of ['attendance', 'teachingLogs', 'dutyAgendas'] as const) {
        acc.done += day[k].done
        acc.expected += day[k].expected
      }
      return acc
    },
    { done: 0, expected: 0 },
  )
  const completenessPct = totals.expected ? Math.round((totals.done / totals.expected) * 1000) / 10 : 100

  const laggingClasses = classes
    .map((c) => ({ classId: c.id, className: c.name, attendanceMissingDays: missingByClass.get(c.id) ?? 0 }))
    .filter((c) => c.attendanceMissingDays > 0)
    .sort((a, b) => b.attendanceMissingDays - a.attendanceMissingDays || a.className.localeCompare(b.className, 'id'))
    .slice(0, 5)

  /* celah data master */
  const teachers = d.teachers.filter((t) => t.status === 'ACTIVE' && !isDeleted('teachers', t.id))
  const linkedTeacherIds = new Set(d.users.map((u) => u.teacherId).filter((id): id is ID => !!id))
  const timetable = d.timetable.filter((s) => !isDeleted('timetable', s.id) && (!sem || s.semesterId === sem.id))
  const scheduledTeachers = new Set(timetable.map((s) => s.teacherId))
  const scheduledClasses = new Set(timetable.map((s) => s.classId))
  const students = d.students.filter((s) => s.status === 'ACTIVE' && !isDeleted('students', s.id))
  const classesWithStudents = new Set(students.map((s) => s.classId))
  const teacherRoles = TEACHER_LINK_ROLES as readonly Role[]
  const schoolDays = d.settings.schoolDays?.length ? d.settings.schoolDays : [1, 2, 3, 4, 5, 6]
  let dutyUnassigned = 0
  for (const dow of schoolDays) {
    for (const code of activeShiftCodes) {
      const routine = d.dutyAssignments.find(
        (a) => a.date === null && a.dayOfWeek === dow && a.shiftCode === code && !isDeleted('dutyAssignments', a.id),
      )
      if (!routine || routine.teacherIds.length === 0) dutyUnassigned += 1
    }
  }

  const gaps: SystemOverview['dataHealth']['gaps'] = [
    {
      key: 'TEACHER_NO_ACCOUNT',
      label: 'Guru aktif tanpa akun',
      count: teachers.filter((t) => !t.userId && !linkedTeacherIds.has(t.id)).length,
      href: '/master?tab=guru',
    },
    {
      key: 'TEACHER_NO_SCHEDULE',
      label: 'Guru aktif tanpa jadwal mengajar',
      count: teachers.filter((t) => !scheduledTeachers.has(t.id)).length,
      href: '/master?tab=jadwal',
    },
    {
      key: 'TEACHER_ROLE_NO_LINK',
      label: 'Akun peran guru tanpa tautan data guru',
      count: d.users.filter(
        (u) => u.status === 'ACTIVE' && !u.teacherId && u.roles.some((r) => teacherRoles.includes(r)),
      ).length,
      href: '/pengguna?link=none&status=ACTIVE',
    },
    {
      key: 'CLASS_NO_HOMEROOM',
      label: 'Kelas tanpa wali kelas',
      count: classes.filter((c) => !c.homeroomTeacherId).length,
      href: '/master?tab=kelas',
    },
    {
      key: 'CLASS_NO_SCHEDULE',
      label: 'Kelas tanpa jadwal pelajaran',
      count: classes.filter((c) => !scheduledClasses.has(c.id)).length,
      href: '/master?tab=jadwal',
    },
    {
      key: 'CLASS_NO_STUDENTS',
      label: 'Kelas tanpa siswa aktif',
      count: classes.filter((c) => !classesWithStudents.has(c.id)).length,
      href: '/master?tab=siswa',
    },
    {
      key: 'STUDENT_NO_GUARDIAN_PHONE',
      label: 'Siswa aktif tanpa nomor wali',
      // hanya jumlah — nomor wali tidak pernah dikirim
      count: students.filter((s) => !s.guardianPhone?.trim()).length,
      href: '/master?tab=siswa',
    },
    {
      key: 'DUTY_SLOT_UNASSIGNED',
      label: 'Slot piket rutin tanpa petugas',
      count: dutyUnassigned,
      href: '/master?tab=piket',
    },
  ]

  return { days, completenessPct, classes: laggingClasses, gaps }
}

function systemBlock(): NonNullable<SystemOverview['system']> {
  const d = db()
  return {
    schemaVersion: d.schemaVersion ?? MOCK_SCHEMA_VERSION,
    seedDate: d.seedDate,
    mockApi: true,
    counts: {
      users: d.users.length,
      teachers: d.teachers.filter((t) => !isDeleted('teachers', t.id)).length,
      students: d.students.filter((s) => !isDeleted('students', s.id)).length,
      classes: d.classes.filter((c) => !isDeleted('classes', c.id)).length,
      timetable: d.timetable.filter((s) => !isDeleted('timetable', s.id)).length,
      auditLogs: d.auditLogs.length,
      loginEvents: (d.loginEvents ?? []).length,
    },
  }
}

export function computeSystemOverview(user: AuthedUser, date: ISODate): SystemOverview {
  const overview: SystemOverview = {
    generatedAt: nowTs(),
    date,
    accounts: accountsBlock(),
    security: securityBlock(date),
    importantEvents: importantEventsBlock(),
    dataHealth: dataHealthBlock(date),
  }
  if (can(user, 'system:manage')) overview.system = systemBlock()
  return overview
}

export const systemOverviewHandlers: HttpHandler[] = [
  http.get(apiPath('/system/overview'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'security:read')
    const date = searchParams(request).get('date') || todayISO()
    if (!isValidISODate(date)) {
      return errors.validation({ date: 'Format tanggal harus YYYY-MM-DD.' }, 'Parameter tidak valid.')
    }
    try {
      return ok(computeSystemOverview(user, date))
    } catch (err) {
      console.error('[mock] /system/overview gagal dihitung:', err)
      return apiError(500, 'INTERNAL_ERROR', 'Ringkasan sistem gagal dihitung. Coba muat ulang halaman.')
    }
  }),
]
