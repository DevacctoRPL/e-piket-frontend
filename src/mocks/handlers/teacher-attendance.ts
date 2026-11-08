/**
 * Mock API absensi guru (PRD §6.4 FR-OUT-03, §6.5 FR-TCH-01..05, §7.3, §9.2, §9.3).
 *
 *   GET   /teacher-attendance/me?date            → kehadiran saya + jadwal hari itu (teacher_attendance:self)
 *   POST  /teacher-attendance/check-in           → check-in mandiri (idempoten)
 *   POST  /teacher-attendance/check-out          → check-out mandiri (idempoten)
 *   GET   /teacher-attendance/history?...        → riwayat + rekap (self untuk diri sendiri, read untuk semua)
 *   GET   /teacher-attendance?date&shiftCode     → guru terjadwal hari itu (teacher_attendance:read)
 *   POST  /teacher-attendance                    → piket/admin mencatat status (upsert per guru+tanggal)
 *   PATCH /teacher-attendance/:id                → koreksi (versi, alasan wajib, audit CORRECT)
 */
import { http, type HttpHandler } from 'msw'
import { addDays, dateRange, todayISO } from '@/lib/date'
import type {
  MyScheduleSlot,
  MyTeacherAttendanceDay,
  TeacherAttendanceCounts,
  TeacherAttendanceHistory,
  TeacherRecapRow,
} from '@/features/teacher-attendance/types'
import type {
  ID,
  ISODate,
  ScheduledTeacherRow,
  TeacherAttendance,
  TeacherAttendanceStatus,
} from '@/types/entities'
import { TEACHER_ATTENDANCE_STATUSES } from '@/types/entities'
import { db, isDeleted, newId, persist } from '../db'
import {
  className,
  computeAffectedPeriods,
  dutyTeacherIds,
  getTeacher,
  isDutyTeacher,
  periodTimes,
  slotsOn,
  subjectName,
  teacherAttendanceOn,
} from '../domain'
import {
  apiPath,
  audit,
  can,
  created,
  errors,
  latency,
  nowTs,
  ok,
  pick,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'
import {
  ISO_DATE_RE,
  cleanText,
  getShift,
  isAbsentStatus,
  isTeacherStatus,
  lateMinutesFor,
  reasonRequiredFor,
  shiftCodeForTeacher,
  statusForCheckIn,
  validateTimes,
} from './teacher-attendance-rules'

const ENTITY = 'TeacherAttendance'
const AUDIT_FIELDS: (keyof TeacherAttendance)[] = [
  'status',
  'reason',
  'checkInAt',
  'checkOutAt',
  'affectedPeriodsComputed',
  'affectedPeriodsOverride',
  'overrideReason',
  'affectedPeriods',
  'lateMinutes',
]

function liveRecords() {
  return db().teacherAttendance.filter((a) => !isDeleted('teacherAttendance', a.id))
}

function findOn(teacherId: ID, date: ISODate) {
  const a = teacherAttendanceOn(teacherId, date)
  return a && !isDeleted('teacherAttendance', a.id) ? a : undefined
}

function requireTeacherOf(user: AuthedUser) {
  if (!user.teacherId || !getTeacher(user.teacherId)) {
    throw errors.forbidden('Akun Anda belum terhubung dengan data guru.')
  }
  return user.teacherId
}

function readDate(value: string | null, field = 'date'): ISODate {
  if (!value) return todayISO()
  if (!ISO_DATE_RE.test(value)) throw errors.validation({ [field]: 'invalid' })
  return value
}

function mySlots(teacherId: ID, date: ISODate): MyScheduleSlot[] {
  return slotsOn(date, { teacherId }).map((s) => ({
    id: s.id,
    shiftCode: s.shiftCode,
    classId: s.classId,
    className: className(s.classId),
    subjectId: s.subjectId,
    subjectName: subjectName(s.subjectId),
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    periodCount: s.periodCount,
    ...periodTimes(s.shiftCode, s.periodStart, s.periodEnd),
  }))
}

/** Hitung ulang field turunan agar konsisten dengan modul lain (agenda piket, jam kosong). */
function recompute(a: TeacherAttendance) {
  a.affectedPeriodsComputed = isAbsentStatus(a.status) ? computeAffectedPeriods(a.teacherId, a.date) : 0
  a.affectedPeriods = a.affectedPeriodsOverride ?? a.affectedPeriodsComputed
  a.lateMinutes = lateMinutesFor(a.status, a.shiftCode, a.checkInAt)
}

function emptyCounts(): TeacherAttendanceCounts {
  const base = Object.fromEntries(TEACHER_ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<
    TeacherAttendanceStatus,
    number
  >
  return { ...base, total: 0, lateMinutes: 0, affectedPeriods: 0 }
}

function addTo(c: TeacherAttendanceCounts, a: TeacherAttendance) {
  c[a.status] += 1
  c.total += 1
  c.lateMinutes += a.lateMinutes ?? 0
  c.affectedPeriods += a.affectedPeriods
}

function sourceFor(user: AuthedUser): TeacherAttendance['source'] {
  return user.roles.includes('ADMIN') ? 'ADMIN' : 'DUTY'
}

export const teacherAttendanceHandlers: HttpHandler[] = [
  /* ------------------------------------------------ kehadiran saya */
  http.get(apiPath('/teacher-attendance/me'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teacher_attendance:self')
    const teacherId = requireTeacherOf(user)
    const date = readDate(searchParams(request).get('date'))
    const slots = mySlots(teacherId, date)
    const data: MyTeacherAttendanceDay = {
      date,
      teacherId,
      teacherName: getTeacher(teacherId)?.name ?? user.name,
      shift: getShift(findOn(teacherId, date)?.shiftCode ?? shiftCodeForTeacher(teacherId, date)) ?? null,
      attendance: findOn(teacherId, date) ?? null,
      slots,
      scheduledPeriods: slots.reduce((n, s) => n + s.periodCount, 0),
      isDutyTeacher: isDutyTeacher(teacherId, date),
    }
    return ok(data)
  }),

  http.post(apiPath('/teacher-attendance/check-in'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'teacher_attendance:self')
      const teacherId = requireTeacherOf(user)
      const date = todayISO()
      const now = nowTs()
      const existing = findOn(teacherId, date)
      if (existing?.checkInAt) {
        return errors.conflict('Anda sudah check-in hari ini.', 'ALREADY_CHECKED_IN')
      }
      if (existing && isAbsentStatus(existing.status)) {
        return errors.conflict(
          'Status Anda hari ini sudah dicatat piket sebagai tidak hadir. Hubungi guru piket untuk koreksi.',
          'ALREADY_RECORDED',
        )
      }
      const shiftCode = existing?.shiftCode ?? shiftCodeForTeacher(teacherId, date)
      const shift = getShift(shiftCode)
      const { status, lateMinutes } = shift
        ? statusForCheckIn(shift, now)
        : { status: 'PRESENT' as const, lateMinutes: null }
      const teacher = getTeacher(teacherId)
      const record: TeacherAttendance = existing ?? {
        id: newId('tatt'),
        teacherId,
        teacherName: teacher?.name ?? user.name,
        date,
        shiftCode,
        checkInAt: null,
        checkOutAt: null,
        status,
        reason: null,
        affectedPeriodsComputed: 0,
        affectedPeriodsOverride: null,
        overrideReason: null,
        affectedPeriods: 0,
        lateMinutes: null,
        source: 'SELF',
        updatedAt: now,
        updatedByName: user.name,
        version: 0,
      }
      record.checkInAt = now
      record.status = status
      record.source = 'SELF'
      recompute(record)
      record.lateMinutes = lateMinutes
      record.updatedAt = now
      record.updatedByName = user.name
      record.version += 1
      if (!existing) db().teacherAttendance.push(record)
      persist()
      return ok(record)
    }),
  ),

  http.post(apiPath('/teacher-attendance/check-out'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'teacher_attendance:self')
      const teacherId = requireTeacherOf(user)
      const date = todayISO()
      const record = findOn(teacherId, date)
      if (!record?.checkInAt) {
        return errors.conflict('Anda belum check-in hari ini. Lakukan check-in terlebih dahulu.', 'NOT_CHECKED_IN')
      }
      if (record.checkOutAt) {
        return errors.conflict('Anda sudah check-out hari ini.', 'ALREADY_CHECKED_OUT')
      }
      const now = nowTs()
      record.checkOutAt = now
      record.updatedAt = now
      record.updatedByName = user.name
      record.version += 1
      persist()
      return ok(record)
    }),
  ),

  /* ------------------------------------------------ riwayat & rekap (FR-TCH-05) */
  http.get(apiPath('/teacher-attendance/history'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teacher_attendance:read', 'teacher_attendance:self')
    const sp = searchParams(request)
    const readAll = can(user, 'teacher_attendance:read')
    let teacherId = sp.get('teacherId') || null
    if (!readAll) {
      const own = requireTeacherOf(user)
      if (teacherId && teacherId !== own) {
        return errors.forbidden('Anda hanya dapat melihat riwayat kehadiran Anda sendiri.')
      }
      teacherId = own
    }
    const today = todayISO()
    let dateTo = readDate(sp.get('dateTo'), 'dateTo')
    let dateFrom = sp.get('dateFrom') ? readDate(sp.get('dateFrom'), 'dateFrom') : addDays(dateTo, -29)
    const semesterId = sp.get('semesterId')
    if (semesterId) {
      const sem = db()
        .academicYears.flatMap((y) => y.semesters)
        .find((s) => s.id === semesterId)
      if (!sem) return errors.validation({ semesterId: 'invalid' })
      if (!sp.get('dateFrom') || dateFrom < sem.startDate) dateFrom = sem.startDate
      if (!sp.get('dateTo') || dateTo > sem.endDate) dateTo = sem.endDate < today ? sem.endDate : today
    }
    if (dateFrom > dateTo) {
      return errors.validation({ dateTo: 'Tanggal akhir tidak boleh sebelum tanggal awal.' })
    }
    if (dateRange(dateFrom, dateTo).length > 366) {
      return errors.validation({ dateFrom: 'Rentang maksimal 1 tahun.' })
    }
    const status = sp.get('status')
    if (status && !isTeacherStatus(status)) return errors.validation({ status: 'invalid' })
    const shiftCode = sp.get('shiftCode')

    const records = liveRecords()
      .filter(
        (a) =>
          a.date >= dateFrom &&
          a.date <= dateTo &&
          (!teacherId || a.teacherId === teacherId) &&
          (!status || a.status === status) &&
          (!shiftCode || a.shiftCode === shiftCode),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.teacherName.localeCompare(b.teacherName, 'id'))

    const summary = emptyCounts()
    const per = new Map<ID, TeacherRecapRow>()
    for (const a of records) {
      addTo(summary, a)
      let row = per.get(a.teacherId)
      if (!row) {
        const t = getTeacher(a.teacherId)
        row = { teacherId: a.teacherId, teacherName: t?.name ?? a.teacherName, teacherNip: t?.nip ?? '—', counts: emptyCounts() }
        per.set(a.teacherId, row)
      }
      addTo(row.counts, a)
    }
    const data: TeacherAttendanceHistory = {
      dateFrom,
      dateTo,
      records,
      summary,
      byTeacher: [...per.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'id')),
    }
    return ok(data)
  }),

  /* ------------------------------------------------ guru terjadwal (FR-TCH-04) */
  http.get(apiPath('/teacher-attendance'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teacher_attendance:read')
    const sp = searchParams(request)
    const date = readDate(sp.get('date'))
    const shiftCode = sp.get('shiftCode') || null
    if (shiftCode && !getShift(shiftCode)) return errors.validation({ shiftCode: 'invalid' })

    const slots = slotsOn(date, { shiftCode })
    const shiftCodes = shiftCode ? [shiftCode] : db().shifts.filter((s) => !isDeleted('shifts', s.id)).map((s) => s.code)
    const duty = new Set(shiftCodes.flatMap((sc) => dutyTeacherIds(date, sc)))
    const ids = new Set<ID>([...slots.map((s) => s.teacherId), ...duty])

    const rows: ScheduledTeacherRow[] = []
    for (const id of ids) {
      const t = getTeacher(id)
      if (!t || isDeleted('teachers', id)) continue
      const own = slots.filter((s) => s.teacherId === id)
      const attendance = findOn(id, date) ?? null
      // Bila memfilter shift: guru yang tercatat di shift lain tetap tampil bila terjadwal di shift ini.
      rows.push({
        teacher: { id: t.id, nip: t.nip, name: t.name },
        scheduledPeriods: own.reduce((n, s) => n + s.periodCount, 0),
        slots: own.map((s) => ({
          id: s.id,
          classId: s.classId,
          subjectId: s.subjectId,
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
        })),
        isDutyTeacher: duty.has(id),
        attendance,
      })
    }
    rows.sort((a, b) => a.teacher.name.localeCompare(b.teacher.name, 'id'))
    return ok(rows)
  }),

  /* ------------------------------------------------ catat status oleh piket/admin (FR-TCH-02/03) */
  http.post(apiPath('/teacher-attendance'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'teacher_attendance:write')
      const body = await readJson<Record<string, unknown>>(request)
      const details: Record<string, string> = {}

      const teacherId = typeof body.teacherId === 'string' ? body.teacherId : ''
      const teacher = teacherId ? getTeacher(teacherId) : undefined
      if (!teacherId) details.teacherId = 'required'
      else if (!teacher || isDeleted('teachers', teacherId)) details.teacherId = 'Guru tidak ditemukan.'

      const date = typeof body.date === 'string' ? body.date : ''
      if (!date) details.date = 'required'
      else if (!ISO_DATE_RE.test(date)) details.date = 'invalid'
      else if (date > todayISO()) details.date = 'Tanggal tidak boleh melewati hari ini.'

      const shiftCode = typeof body.shiftCode === 'string' ? body.shiftCode : ''
      if (!shiftCode) details.shiftCode = 'required'
      else if (!getShift(shiftCode)) details.shiftCode = 'invalid'

      const status = body.status
      if (!status) details.status = 'required'
      else if (!isTeacherStatus(status)) details.status = 'invalid'

      const reason = cleanText(body.reason)
      if (isTeacherStatus(status) && reasonRequiredFor(status) && !reason) {
        details.reason = 'Alasan wajib diisi untuk status ini.'
      }
      if (reason && reason.length > 500) details.reason = 'too_long'

      const times = validateTimes(details, date, body.checkInAt, body.checkOutAt)
      if (status === 'LATE' && !times.checkInAt && !details.checkInAt) {
        details.checkInAt = 'Jam datang wajib diisi untuk status Terlambat.'
      }
      if (Object.keys(details).length > 0 || !isTeacherStatus(status) || !teacher) {
        return errors.validation(details)
      }

      const now = nowTs()
      const existing = findOn(teacherId, date)
      if (existing) {
        // Upsert: satu guru hanya punya satu record per tanggal (PRD §9.2).
        const before = pick(existing, AUDIT_FIELDS)
        existing.shiftCode = shiftCode
        existing.status = status
        existing.reason = reason
        existing.checkInAt = times.checkInAt ?? (isAbsentStatus(status) ? null : existing.checkInAt)
        existing.checkOutAt = times.checkOutAt ?? (isAbsentStatus(status) ? null : existing.checkOutAt)
        existing.source = sourceFor(user)
        recompute(existing)
        existing.updatedAt = now
        existing.updatedByName = user.name
        existing.version += 1
        persist()
        audit({
          user,
          action: 'UPDATE',
          entity: ENTITY,
          entityId: existing.id,
          summary: `Status kehadiran ${existing.teacherName} (${date}) dicatat ulang`,
          before,
          after: pick(existing, AUDIT_FIELDS),
          reason,
        })
        return ok(existing)
      }

      const record: TeacherAttendance = {
        id: newId('tatt'),
        teacherId,
        teacherName: teacher.name,
        date,
        shiftCode,
        checkInAt: times.checkInAt,
        checkOutAt: times.checkOutAt,
        status,
        reason,
        affectedPeriodsComputed: 0,
        affectedPeriodsOverride: null,
        overrideReason: null,
        affectedPeriods: 0,
        lateMinutes: null,
        source: sourceFor(user),
        updatedAt: now,
        updatedByName: user.name,
        version: 1,
      }
      recompute(record)
      db().teacherAttendance.push(record)
      persist()
      audit({
        user,
        action: 'CREATE',
        entity: ENTITY,
        entityId: record.id,
        summary: `Status kehadiran ${record.teacherName} (${date}) dicatat`,
        after: pick(record, AUDIT_FIELDS),
        reason,
      })
      return created(record)
    }),
  ),

  /* ------------------------------------------------ koreksi (FR-TCH-03, FR-OUT-03) */
  http.patch(apiPath('/teacher-attendance/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teacher_attendance:write')
    const record = liveRecords().find((a) => a.id === params.id)
    if (!record) return errors.notFound('Data kehadiran guru tidak ditemukan.')
    const body = await readJson<Record<string, unknown>>(request)
    if (typeof body.version !== 'number') return errors.validation({ version: 'required' })
    if (body.version !== record.version) return errors.versionConflict()

    const details: Record<string, string> = {}
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

    let status = record.status
    if (has('status')) {
      if (!isTeacherStatus(body.status)) details.status = 'invalid'
      else status = body.status
    }
    const reason = has('reason') ? cleanText(body.reason) : record.reason
    if (reasonRequiredFor(status) && !reason) details.reason = 'Alasan wajib diisi untuk status ini.'
    if (reason && reason.length > 500) details.reason = 'too_long'

    const times = validateTimes(
      details,
      record.date,
      has('checkInAt') ? body.checkInAt : record.checkInAt,
      has('checkOutAt') ? body.checkOutAt : record.checkOutAt,
    )
    if (status === 'LATE' && !times.checkInAt && !details.checkInAt) {
      details.checkInAt = 'Jam datang wajib diisi untuk status Terlambat.'
    }

    let override = record.affectedPeriodsOverride
    let overrideReason = record.overrideReason
    const overrideChanged = has('affectedPeriodsOverride') && body.affectedPeriodsOverride !== record.affectedPeriodsOverride
    if (has('affectedPeriodsOverride')) {
      const v = body.affectedPeriodsOverride
      if (v === null) {
        override = null
        overrideReason = null
      } else if (typeof v !== 'number' || !Number.isInteger(v)) {
        details.affectedPeriodsOverride = 'invalid'
      } else if (v < 0) {
        details.affectedPeriodsOverride = 'negative'
      } else if (v > 24) {
        details.affectedPeriodsOverride = 'Jumlah jam terlalu besar.'
      } else {
        override = v
        overrideReason = cleanText(body.overrideReason)
        if (!overrideReason || overrideReason.length < 3) {
          details.overrideReason = 'Alasan koreksi jam terdampak wajib diisi.'
        }
      }
    }

    const statusChanged = status !== record.status
    const timesChanged = times.checkInAt !== record.checkInAt || times.checkOutAt !== record.checkOutAt
    const correctionReason = cleanText(body.correctionReason)
    if ((statusChanged || timesChanged) && (!correctionReason || correctionReason.length < 3)) {
      details.correctionReason = 'Alasan koreksi wajib diisi bila status atau jam diubah.'
    }
    if (Object.keys(details).length > 0) return errors.validation(details)

    const reasonChanged = reason !== record.reason
    if (!statusChanged && !timesChanged && !overrideChanged && !reasonChanged) return ok(record)

    const before = pick(record, AUDIT_FIELDS)
    record.status = status
    record.reason = reason
    record.checkInAt = times.checkInAt
    record.checkOutAt = times.checkOutAt
    record.affectedPeriodsOverride = override
    record.overrideReason = overrideReason
    recompute(record)
    record.updatedAt = nowTs()
    record.updatedByName = user.name
    record.version += 1
    persist()
    const parts = [
      statusChanged && 'status',
      timesChanged && 'jam datang/pulang',
      overrideChanged && 'jam terdampak',
      reasonChanged && 'keterangan',
    ].filter(Boolean)
    audit({
      user,
      action: 'CORRECT',
      entity: ENTITY,
      entityId: record.id,
      summary: `Koreksi ${parts.join(', ')} kehadiran ${record.teacherName} (${record.date})`,
      before,
      after: pick(record, AUDIT_FIELDS),
      reason: correctionReason ?? cleanText(body.overrideReason),
    })
    return ok(record)
  }),
]
