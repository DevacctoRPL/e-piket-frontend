/**
 * Mock API jurnal mengajar (PRD §6.7 FR-TEACH-01..06, §7.4, §9.2, §9.3).
 * Meniru aturan yang akan ditegakkan backend Go: scoping per guru, validasi materi/alasan,
 * konsistensi JML dengan jadwal, cegah duplikat, koreksi data final dengan alasan + audit.
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import type {
  ID,
  ISODate,
  RecordStatus,
  TeachingExecution,
  TeachingLog,
  TeachingPresence,
  TimetableSlot,
  TodayTeachingSlot,
} from '@/types/entities'
import { TEACHING_EXECUTIONS, TEACHING_PRESENCES } from '@/types/entities'
import { db, isDeleted, newId, persist } from '../db'
import { className, getClass, periodTimes, slotsOn, subjectName, teacherName } from '../domain'
import {
  apiPath,
  audit,
  can,
  created,
  errors,
  latency,
  ok,
  paginate,
  pick,
  readJson,
  requireAuth,
  requireClassAccess,
  requirePermission,
  searchParams,
  toCurrentUser,
  withIdempotency,
  nowTs,
  type AuthedUser,
} from '../utils'

/* ------------------------------------------------------------------ helpers */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const AUDIT_FIELDS: (keyof TeachingLog)[] = [
  'status',
  'classId',
  'subjectId',
  'periodStart',
  'periodEnd',
  'periodCount',
  'periodCountOverrideReason',
  'meetingNumber',
  'topic',
  'activity',
  'note',
  'teacherPresence',
  'execution',
  'notHeldReason',
  'studentSick',
  'studentPermission',
  'studentAbsent',
]

function liveLogs() {
  return db().teachingLogs.filter((l) => !isDeleted('teachingLogs', l.id))
}

function findLog(id: string | readonly string[] | undefined) {
  return liveLogs().find((l) => l.id === id)
}

/** Jurnal yang boleh dibaca user: semua (read_all) atau milik sendiri + kelas binaan (wali kelas). */
function readableFilter(user: AuthedUser): (l: TeachingLog) => boolean {
  if (can(user, 'teaching_log:read_all', 'teaching_log:correct')) return () => true
  const homeroom = user.roles.includes('HOMEROOM') ? toCurrentUser(user).homeroomClassIds : []
  return (l) => (!!user.teacherId && l.teacherId === user.teacherId) || homeroom.includes(l.classId)
}

function activeSubstitution(date: ISODate, slotId: ID) {
  return db().substitutions.find(
    (r) => r.date === date && r.timetableSlotId === slotId && r.status === 'ACTIVE',
  )
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

/** Body create/update yang belum tervalidasi. */
interface RawBody {
  [key: string]: unknown
}

interface NormalizedLog {
  date: ISODate
  timetableSlotId: ID | null
  teacherId: ID
  classId: ID
  subjectId: ID
  shiftCode: string
  periodStart: number
  periodEnd: number
  periodCount: number
  periodCountOverrideReason: string | null
  meetingNumber: number | null
  topic: string | null
  activity: string | null
  note: string | null
  teacherPresence: TeachingPresence
  execution: TeachingExecution
  notHeldReason: string | null
  studentSick: number
  studentPermission: number
  studentAbsent: number
  substitutionRecordId: ID | null
}

/**
 * Validasi bersama POST/PATCH (PRD §9.3). Melempar 422 dengan detail per field,
 * atau 403 bila slot/kelas bukan tugas guru.
 */
function validate(input: RawBody, user: AuthedUser, teacherId: ID): NormalizedLog {
  const d = db()
  const details: Record<string, string> = {}
  const canCorrect = can(user, 'teaching_log:correct')

  const intField = (key: string, opts: { required?: boolean; min?: number } = {}): number | null => {
    const v = input[key]
    if (v === null || v === undefined || v === '') {
      if (opts.required) details[key] = 'required'
      return null
    }
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isInteger(n)) {
      details[key] = 'invalid'
      return null
    }
    if (n < (opts.min ?? 0)) {
      details[key] = n < 0 ? 'negative' : 'invalid'
      return null
    }
    return n
  }
  const textField = (key: string, max: number) => {
    const v = str(input[key])
    if (v && v.length > max) details[key] = 'too_long'
    return v
  }

  // tanggal
  const date = typeof input.date === 'string' ? input.date : ''
  if (!date) details.date = 'required'
  else if (!ISO_DATE.test(date)) details.date = 'invalid'
  else if (date > todayISO()) details.date = 'Tanggal jurnal tidak boleh melebihi hari ini.'

  // slot jadwal (opsional — jurnal di luar jadwal diperbolehkan sesuai izin)
  const timetableSlotId = str(input.timetableSlotId)
  let slot: TimetableSlot | undefined
  let substitutionRecordId: ID | null = null
  let substitutedCount: number | null = null
  if (timetableSlotId) {
    slot = d.timetable.find((s) => s.id === timetableSlotId && !isDeleted('timetable', s.id))
    if (!slot) details.timetableSlotId = 'Slot jadwal tidak ditemukan.'
  }

  let classId = str(input.classId) ?? ''
  let subjectId = str(input.subjectId) ?? ''
  let shiftCode = str(input.shiftCode) ?? ''
  let periodStart = intField('periodStart', { required: !slot, min: 1 })
  let periodEnd = intField('periodEnd', { required: !slot, min: 1 })

  if (slot) {
    if (date && ISO_DATE.test(date) && !slotsOn(date).some((s) => s.id === slot.id)) {
      details.date = 'Tanggal tidak sesuai dengan hari pada jadwal.'
    }
    if (classId && classId !== slot.classId) details.classId = 'Kelas tidak sesuai dengan jadwal.'
    if (subjectId && subjectId !== slot.subjectId)
      details.subjectId = 'Mata pelajaran tidak sesuai dengan jadwal.'
    classId = slot.classId
    subjectId = slot.subjectId
    shiftCode = slot.shiftCode
    periodStart = slot.periodStart
    periodEnd = slot.periodEnd
    // slot milik guru sendiri, atau guru ditugaskan sebagai pengganti (FR-SUB-03)
    const sub = date ? activeSubstitution(date, slot.id) : undefined
    const linked =
      typeof input.substitutionRecordId === 'string'
        ? d.substitutions.find((r) => r.id === input.substitutionRecordId && r.timetableSlotId === slot.id)
        : undefined
    if (slot.teacherId !== teacherId) {
      const record =
        sub && sub.substituteTeacherId === teacherId
          ? sub
          : linked && linked.substituteTeacherId === teacherId
            ? linked
            : undefined
      if (record) {
        substitutionRecordId = record.id
        // Guru pengganti hanya mengisi jam yang ia gantikan (bisa sebagian slot).
        periodStart = record.periodStart
        periodEnd = record.periodEnd
        substitutedCount = record.periodEnd - record.periodStart + 1
      } else if (!canCorrect) throw errors.forbidden('Slot jadwal ini bukan tugas mengajar Anda.')
    }
  } else {
    if (!classId) details.classId = 'required'
    else if (!getClass(classId)) details.classId = 'Kelas tidak ditemukan.'
    else if (!canCorrect) requireClassAccess(user, classId)
    if (!subjectId) details.subjectId = 'required'
    else if (!d.subjects.some((s) => s.id === subjectId)) details.subjectId = 'Mata pelajaran tidak ditemukan.'
    if (!shiftCode) details.shiftCode = 'required'
    else if (!d.shifts.some((s) => s.code === shiftCode)) details.shiftCode = 'invalid'
    if (periodStart !== null && periodEnd !== null && periodEnd < periodStart)
      details.periodEnd = 'Jam selesai tidak boleh sebelum jam mulai.'
  }

  // JML: harus konsisten dengan jadwal kecuali ada alasan koreksi (FR-TEACH-04)
  const scheduled =
    substitutedCount ??
    slot?.periodCount ??
    (periodStart !== null && periodEnd !== null ? Math.max(0, periodEnd - periodStart + 1) : 0)
  const rawCount = intField('periodCount')
  const periodCount = rawCount ?? scheduled
  let periodCountOverrideReason = textField('periodCountOverrideReason', 500)
  if (!details.periodCount && periodCount !== scheduled && !periodCountOverrideReason) {
    details.periodCountOverrideReason = `Alasan wajib diisi bila JML (${periodCount}) berbeda dari jadwal (${scheduled}).`
  }
  if (periodCount === scheduled) periodCountOverrideReason = null

  const meetingNumber = intField('meetingNumber', { min: 1 })
  const topic = textField('topic', 500)
  const activity = textField('activity', 1000)
  const note = textField('note', 1000)

  const teacherPresence = (input.teacherPresence ?? 'PRESENT') as TeachingPresence
  if (!TEACHING_PRESENCES.includes(teacherPresence)) details.teacherPresence = 'invalid'
  const execution = (input.execution ?? 'HELD') as TeachingExecution
  if (!TEACHING_EXECUTIONS.includes(execution)) details.execution = 'invalid'

  // PRD §9.2: tidak boleh mengklaim terlaksana tanpa materi; tidak terlaksana wajib alasan.
  let notHeldReason = textField('notHeldReason', 500)
  if (execution === 'HELD' && !topic) details.topic = 'Materi wajib diisi bila pertemuan terlaksana.'
  if (execution === 'NOT_HELD' && !notHeldReason)
    details.notHeldReason = 'Alasan wajib diisi bila pertemuan tidak terlaksana.'
  if (execution === 'HELD') notHeldReason = null

  const studentSick = intField('studentSick') ?? 0
  const studentPermission = intField('studentPermission') ?? 0
  const studentAbsent = intField('studentAbsent') ?? 0

  if (Object.keys(details).length) throw errors.validation(details)

  return {
    date,
    timetableSlotId: slot?.id ?? null,
    teacherId,
    classId,
    subjectId,
    shiftCode,
    periodStart: periodStart ?? 1,
    periodEnd: periodEnd ?? 1,
    periodCount,
    periodCountOverrideReason,
    meetingNumber,
    topic,
    activity,
    note,
    teacherPresence,
    execution,
    notHeldReason,
    studentSick,
    studentPermission,
    studentAbsent,
    substitutionRecordId,
  }
}

function findDuplicate(n: NormalizedLog, excludeId?: ID) {
  return liveLogs().find(
    (l) =>
      l.id !== excludeId &&
      l.date === n.date &&
      l.teacherId === n.teacherId &&
      (n.timetableSlotId
        ? l.timetableSlotId === n.timetableSlotId
        : l.timetableSlotId === null &&
          l.classId === n.classId &&
          l.subjectId === n.subjectId &&
          l.shiftCode === n.shiftCode &&
          l.periodStart === n.periodStart),
  )
}

function duplicateError(existing: TeachingLog) {
  return errors.conflict(
    'Jurnal untuk pertemuan ini sudah ada. Buka jurnal tersebut untuk melanjutkan.',
    'DUPLICATE',
    { existingId: existing.id },
  )
}

/** Tautkan jurnal pengganti ke record substitusi (FR-SUB-03). */
function linkSubstitution(log: TeachingLog) {
  if (!log.substitutionRecordId) return
  const rec = db().substitutions.find((r) => r.id === log.substitutionRecordId)
  if (rec && !rec.teachingLogId) rec.teachingLogId = log.id
}

function withNames(n: NormalizedLog) {
  return {
    ...n,
    teacherName: teacherName(n.teacherId),
    className: className(n.classId),
    subjectName: subjectName(n.subjectId),
  }
}

function ownerOrCorrector(user: AuthedUser, log: TeachingLog) {
  return (!!user.teacherId && log.teacherId === user.teacherId) || can(user, 'teaching_log:correct')
}

/* ------------------------------------------------------------------ handlers */

export const teachingLogsHandlers: HttpHandler[] = [
  // FR-TEACH-01: jadwal mengajar hari ini (+ tugas pengganti) beserta jurnal yang sudah ada.
  http.get(apiPath('/teaching-logs/today'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:write')
    const date = searchParams(request).get('date') || todayISO()
    if (!ISO_DATE.test(date)) throw errors.validation({ date: 'invalid' })
    const teacherId = user.teacherId
    if (!teacherId) return ok<TodayTeachingSlot[]>([])

    const d = db()
    const logs = liveLogs().filter((l) => l.date === date && l.teacherId === teacherId)
    const logFor = (slotId: ID) => logs.find((l) => l.timetableSlotId === slotId) ?? null

    const own: TodayTeachingSlot[] = slotsOn(date, { teacherId }).map((slot) => ({
      slot,
      className: className(slot.classId),
      subjectName: subjectName(slot.subjectId),
      ...periodTimes(slot.shiftCode, slot.periodStart, slot.periodEnd),
      isSubstitution: false,
      substitutionRecordId: null,
      log: logFor(slot.id),
    }))
    const subs: TodayTeachingSlot[] = d.substitutions
      .filter((r) => r.date === date && r.status === 'ACTIVE' && r.substituteTeacherId === teacherId)
      .flatMap((r) => {
        const slot = d.timetable.find((s) => s.id === r.timetableSlotId)
        if (!slot) return []
        return [
          {
            // Rentang jam yang digantikan (bisa sebagian dari slot asli).
            slot: { ...slot, periodStart: r.periodStart, periodEnd: r.periodEnd, periodCount: r.periodCount },
            className: className(slot.classId),
            subjectName: subjectName(slot.subjectId),
            ...periodTimes(slot.shiftCode, r.periodStart, r.periodEnd),
            isSubstitution: true,
            substitutionRecordId: r.id,
            log: logFor(slot.id),
          },
        ]
      })
    const items = [...own, ...subs].sort(
      (a, b) =>
        a.slot.shiftCode.localeCompare(b.slot.shiftCode) || a.slot.periodStart - b.slot.periodStart,
    )
    return ok(items)
  }),

  // FR-TEACH-05: histori dengan filter.
  http.get(apiPath('/teaching-logs'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:read')
    const sp = searchParams(request)
    const readable = readableFilter(user)
    const f = {
      dateFrom: sp.get('dateFrom'),
      dateTo: sp.get('dateTo'),
      teacherId: sp.get('teacherId'),
      classId: sp.get('classId'),
      subjectId: sp.get('subjectId'),
      shiftCode: sp.get('shiftCode'),
      status: sp.get('status') as RecordStatus | null,
    }
    const items = liveLogs()
      .filter(
        (l) =>
          readable(l) &&
          (!f.dateFrom || l.date >= f.dateFrom) &&
          (!f.dateTo || l.date <= f.dateTo) &&
          (!f.teacherId || l.teacherId === f.teacherId) &&
          (!f.classId || l.classId === f.classId) &&
          (!f.subjectId || l.subjectId === f.subjectId) &&
          (!f.shiftCode || l.shiftCode === f.shiftCode) &&
          (!f.status || l.status === f.status),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.shiftCode.localeCompare(b.shiftCode) ||
          a.periodStart - b.periodStart ||
          a.className.localeCompare(b.className),
      )
    return paginate(items, request)
  }),

  http.get(apiPath('/teaching-logs/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:read')
    const log = findLog(params.id)
    if (!log) return errors.notFound('Jurnal mengajar tidak ditemukan.')
    if (!readableFilter(user)(log)) return errors.forbidden('Anda tidak memiliki akses ke jurnal ini.')
    return ok(log)
  }),

  // FR-TEACH-02..04: buat jurnal (draft / final).
  http.post(apiPath('/teaching-logs'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:write', 'teaching_log:correct')
    return withIdempotency(request, async () => {
      const body = await readJson<RawBody>(request)
      const canCorrect = can(user, 'teaching_log:correct')
      const requestedTeacher = str(body.teacherId)
      let teacherId: ID
      if (requestedTeacher && requestedTeacher !== user.teacherId) {
        if (!canCorrect) throw errors.forbidden('Anda hanya dapat mengisi jurnal milik sendiri.')
        if (!db().teachers.some((t) => t.id === requestedTeacher))
          throw errors.validation({ teacherId: 'Guru tidak ditemukan.' })
        teacherId = requestedTeacher
      } else if (user.teacherId) {
        teacherId = user.teacherId
      } else if (canCorrect && typeof body.timetableSlotId === 'string') {
        // admin/pimpinan mencatat atas nama guru pemilik slot
        const slot = db().timetable.find((s) => s.id === body.timetableSlotId)
        if (!slot) throw errors.validation({ timetableSlotId: 'Slot jadwal tidak ditemukan.' })
        teacherId = slot.teacherId
      } else {
        throw errors.validation({ teacherId: 'required' }, 'Pilih guru pemilik jurnal.')
      }

      const n = validate(body, user, teacherId)
      const dup = findDuplicate(n)
      if (dup) throw duplicateError(dup)

      const submit = body.submit === true
      const ts = nowTs()
      const log: TeachingLog = {
        id: newId('tlog'),
        ...withNames(n),
        status: submit ? 'FINAL' : 'DRAFT',
        submittedAt: submit ? ts : null,
        approvedAt: null,
        approvedByName: null,
        createdAt: ts,
        updatedAt: ts,
        version: 1,
      }
      db().teachingLogs.push(log)
      linkSubstitution(log)
      persist()
      if (submit) {
        audit({
          user,
          action: 'FINALIZE',
          entity: 'TeachingLog',
          entityId: log.id,
          summary: `Finalisasi jurnal ${log.subjectName} ${log.className} (${log.date})`,
          after: pick(log, AUDIT_FIELDS),
        })
      }
      return created(log)
    })
  }),

  // Ubah draft milik sendiri; koreksi jurnal final butuh hak koreksi + alasan (PRD §9.2).
  http.patch(apiPath('/teaching-logs/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:write', 'teaching_log:correct')
    return withIdempotency(request, async () => {
      const log = findLog(params.id)
      if (!log) throw errors.notFound('Jurnal mengajar tidak ditemukan.')
      if (!ownerOrCorrector(user, log))
        throw errors.forbidden('Anda hanya dapat mengubah jurnal milik sendiri.')
      const body = await readJson<RawBody>(request)
      if (typeof body.version === 'number' && body.version !== log.version) throw errors.versionConflict()

      const canCorrect = can(user, 'teaching_log:correct')
      const isCorrection = log.status === 'FINAL'
      const correctionReason = str(body.correctionReason)
      if (isCorrection) {
        if (!canCorrect) throw errors.alreadyFinal()
        if (!correctionReason || correctionReason.length < 3)
          throw errors.validation(
            { correctionReason: 'required' },
            'Koreksi jurnal final wajib disertai alasan.',
          )
      }

      const merged: RawBody = { ...pick(log, [...AUDIT_FIELDS, 'date', 'timetableSlotId', 'shiftCode', 'substitutionRecordId']), ...body }
      // field konteks tidak boleh dipindah lewat PATCH
      merged.date = log.date
      merged.timetableSlotId = log.timetableSlotId
      const n = validate(merged, user, log.teacherId)
      const dup = findDuplicate(n, log.id)
      if (dup) throw duplicateError(dup)

      const before = pick(log, AUDIT_FIELDS)
      const submit = body.submit === true && log.status === 'DRAFT'
      Object.assign(log, withNames(n), {
        status: submit ? 'FINAL' : log.status,
        submittedAt: submit ? nowTs() : log.submittedAt,
        updatedAt: nowTs(),
        version: log.version + 1,
      })
      linkSubstitution(log)
      persist()
      if (isCorrection) {
        audit({
          user,
          action: 'CORRECT',
          entity: 'TeachingLog',
          entityId: log.id,
          summary: `Koreksi jurnal ${log.subjectName} ${log.className} (${log.date})`,
          before,
          after: pick(log, AUDIT_FIELDS),
          reason: correctionReason,
        })
      } else if (submit) {
        audit({
          user,
          action: 'FINALIZE',
          entity: 'TeachingLog',
          entityId: log.id,
          summary: `Finalisasi jurnal ${log.subjectName} ${log.className} (${log.date})`,
          before,
          after: pick(log, AUDIT_FIELDS),
        })
      }
      return ok(log)
    })
  }),

  // FR-TEACH-06 (P1): pengesahan oleh pimpinan/admin.
  http.post(apiPath('/teaching-logs/:id/approve'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'teaching_log:correct')
    return withIdempotency(request, () => {
      const log = findLog(params.id)
      if (!log) throw errors.notFound('Jurnal mengajar tidak ditemukan.')
      if (log.status !== 'FINAL')
        throw errors.conflict('Hanya jurnal berstatus final yang dapat disahkan.', 'NOT_FINAL')
      if (log.approvedAt) throw errors.conflict('Jurnal ini sudah disahkan.', 'ALREADY_APPROVED')
      log.approvedAt = nowTs()
      log.approvedByName = user.name
      log.updatedAt = log.approvedAt
      log.version += 1
      persist()
      audit({
        user,
        action: 'FINALIZE',
        entity: 'TeachingLog',
        entityId: log.id,
        summary: `Pengesahan jurnal ${log.subjectName} ${log.className} (${log.date})`,
        after: { approvedAt: log.approvedAt, approvedByName: log.approvedByName },
      })
      return ok(log)
    })
  }),
]
