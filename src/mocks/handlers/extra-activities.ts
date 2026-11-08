/**
 * Mock API Kursus / Jam Tambahan (PRD §6.9 FR-EXT-01..03).
 *
 * Aturan yang ditiru dari backend:
 * - Satu agenda induk dapat memuat beberapa kelas (classIds) — tidak menggandakan record (FR-EXT-02).
 * - Ubah/hapus: perlu extra_activity:write + (ADMIN | koordinator | pengampu). Guru pengampu tanpa
 *   permission tulis tetap boleh mengisi presensi peserta kegiatannya ("isi bila ditugaskan", PRD §4.1).
 * - Presensi peserta terpisah dari absensi reguler (FR-EXT-03); peserta harus siswa dari kelas kegiatan.
 * - Data FINAL hanya dapat dikoreksi dengan alasan dan tercatat di audit log (PRD §9.2, FR-AUD-01).
 */
import { http, type HttpHandler } from 'msw'
import { EXTRA_ACTIVITY_TYPE_META } from '@/lib/enums'
import { ATTENDANCE_STATUSES, type AttendanceStatus, type ExtraActivity, type ID } from '@/types/entities'
import { db, isDeleted, newId, persist, softDelete } from '../db'
import { getClass, getTeacher, rosterForClass } from '../domain'
import {
  apiPath,
  audit,
  can,
  created,
  errors,
  latency,
  matchesSearch,
  noContent,
  nowTs,
  ok,
  paginate,
  pick,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'

const COLLECTION = 'extraActivities'
const ENTITY = 'ExtraActivity'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const TYPES = Object.keys(EXTRA_ACTIVITY_TYPE_META) as ExtraActivity['type'][]

type Body = Record<string, unknown>

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const optStr = (v: unknown) => {
  const s = str(v)
  return s ? s : null
}

function findActivity(id: unknown): ExtraActivity {
  const a = db().extraActivities.find((x) => x.id === id && !isDeleted(COLLECTION, x.id))
  if (!a) throw errors.notFound('Kegiatan tidak ditemukan.')
  return a
}

/** ADMIN, koordinator kegiatan, atau guru pengampu. */
function isOwner(user: AuthedUser, a: ExtraActivity) {
  return (
    user.roles.includes('ADMIN') ||
    a.coordinatorUserId === user.id ||
    (user.teacherId !== null && a.instructorTeacherId === user.teacherId)
  )
}

function requireManage(user: AuthedUser, a: ExtraActivity) {
  requirePermission(user, 'extra_activity:write')
  if (!isOwner(user, a)) {
    throw errors.forbidden('Hanya koordinator, pengampu, atau admin yang dapat mengubah kegiatan ini.')
  }
}

function requireParticipantAccess(user: AuthedUser, a: ExtraActivity) {
  const instructor = user.teacherId !== null && a.instructorTeacherId === user.teacherId
  if (instructor && can(user, 'extra_activity:read')) return
  requireManage(user, a)
}

/** Roster gabungan kelas kegiatan (siswa aktif pada tanggal kegiatan), urut kelas lalu nama. */
function rosterFor(classIds: ID[], date: string) {
  return classIds.flatMap((cid) => rosterForClass(cid, date))
}

/** Sinkronkan peserta dengan kelas kegiatan: tambah siswa kelas baru (Hadir), buang yang kelasnya dilepas. */
function syncParticipants(a: ExtraActivity) {
  if (!a.participantAttendanceEnabled) return
  const existing = new Map(a.participants.map((p) => [p.studentId, p]))
  a.participants = rosterFor(a.classIds, a.date).map(
    (s) =>
      existing.get(s.id) ?? { studentId: s.id, studentName: s.name, classId: s.classId, status: 'PRESENT' as const },
  )
}

interface ParsedFields {
  name?: string
  type?: ExtraActivity['type']
  instructorTeacherId?: ID | null
  instructorName?: string
  date?: string
  shiftCode?: string
  startTime?: string | null
  endTime?: string | null
  classIds?: ID[]
  topic?: string | null
  note?: string | null
  participantAttendanceEnabled?: boolean
}

/**
 * Validasi field kegiatan. `partial` = PATCH (hanya field yang dikirim).
 * `current` dipakai untuk aturan lintas field (jam mulai < jam selesai) pada PATCH.
 */
function parseFields(body: Body, partial: boolean, current?: ExtraActivity): ParsedFields {
  const d = db()
  const details: Record<string, string> = {}
  const out: ParsedFields = {}
  const has = (k: string) => !partial || k in body

  if (has('name')) {
    const name = str(body.name)
    if (!name) details.name = 'required'
    else if (name.length > 150) details.name = 'too_long'
    else out.name = name
  }
  if (has('type')) {
    const type = body.type as ExtraActivity['type']
    if (!TYPES.includes(type)) details.type = 'required'
    else out.type = type
  }
  if (has('instructorTeacherId') || has('instructorName')) {
    const tid = optStr(body.instructorTeacherId)
    if (tid) {
      const t = getTeacher(tid)
      if (!t || isDeleted('teachers', tid)) details.instructorTeacherId = 'Guru tidak ditemukan.'
      else {
        out.instructorTeacherId = tid
        out.instructorName = t.name
      }
    } else {
      const name = str(body.instructorName)
      if (!name) details.instructorName = 'Pilih guru pengampu atau isi nama pengampu dari luar.'
      else {
        out.instructorTeacherId = null
        out.instructorName = name
      }
    }
  }
  if (has('date')) {
    const date = str(body.date)
    if (!date) details.date = 'required'
    else if (!DATE_RE.test(date)) details.date = 'invalid'
    else out.date = date
  }
  if (has('shiftCode')) {
    const code = str(body.shiftCode)
    if (!code) details.shiftCode = 'required'
    else if (!d.shifts.some((s) => s.code === code && !isDeleted('shifts', s.id))) details.shiftCode = 'invalid'
    else out.shiftCode = code
  }
  for (const key of ['startTime', 'endTime'] as const) {
    if (!has(key)) continue
    const t = optStr(body[key])
    if (t && !TIME_RE.test(t)) details[key] = 'invalid'
    else out[key] = t
  }
  const start = out.startTime !== undefined ? out.startTime : (current?.startTime ?? null)
  const end = out.endTime !== undefined ? out.endTime : (current?.endTime ?? null)
  if (!details.startTime && !details.endTime) {
    if ((start && !end) || (!start && end)) {
      details[start ? 'endTime' : 'startTime'] = 'Isi jam mulai dan jam selesai, atau kosongkan keduanya.'
    } else if (start && end && start >= end) {
      details.endTime = 'Jam selesai harus setelah jam mulai.'
    }
  }
  if (has('classIds')) {
    const raw = Array.isArray(body.classIds) ? body.classIds : []
    const ids = raw.filter((x): x is string => typeof x === 'string')
    if (ids.length === 0) details.classIds = 'Pilih minimal satu kelas peserta.'
    else if (new Set(ids).size !== ids.length) details.classIds = 'duplicate'
    else if (ids.some((id) => !getClass(id))) details.classIds = 'Kelas tidak ditemukan.'
    else out.classIds = ids
  }
  if (has('topic')) {
    const v = optStr(body.topic)
    if (v && v.length > 500) details.topic = 'too_long'
    else out.topic = v
  }
  if (has('note')) {
    const v = optStr(body.note)
    if (v && v.length > 1000) details.note = 'too_long'
    else out.note = v
  }
  if (has('participantAttendanceEnabled')) {
    out.participantAttendanceEnabled = body.participantAttendanceEnabled === true
  }
  if (Object.keys(details).length > 0) throw errors.validation(details)
  return out
}

function applyFields(a: ExtraActivity, f: ParsedFields) {
  Object.assign(a, f)
  if (f.classIds) a.classNames = f.classIds.map((id) => getClass(id)?.name ?? '—')
  if (f.participantAttendanceEnabled === false) a.participants = []
  syncParticipants(a)
}

const AUDIT_KEYS: (keyof ExtraActivity)[] = [
  'name',
  'type',
  'instructorName',
  'date',
  'shiftCode',
  'startTime',
  'endTime',
  'classIds',
  'topic',
  'note',
  'participantAttendanceEnabled',
  'status',
]

function checkVersion(a: ExtraActivity, body: Body) {
  if (typeof body.version === 'number' && body.version !== a.version) throw errors.versionConflict()
}

/** Data FINAL hanya dapat dikoreksi dengan alasan. */
function finalReason(a: ExtraActivity, body: Body): string | null {
  if (a.status !== 'FINAL') return null
  const reason = str(body.reason)
  if (!reason) throw errors.alreadyFinal()
  if (reason.length < 3) throw errors.validation({ reason: 'Alasan minimal 3 karakter.' })
  return reason
}

export const extraActivitiesHandlers: HttpHandler[] = [
  http.get(apiPath('/extra-activities'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'extra_activity:read')
    const sp = searchParams(request)
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    const classId = sp.get('classId')
    const type = sp.get('type')
    const instructor = sp.get('instructorTeacherId')
    const shiftCode = sp.get('shiftCode')
    const status = sp.get('status')
    const q = sp.get('search')
    const items = db()
      .extraActivities.filter(
        (a) =>
          !isDeleted(COLLECTION, a.id) &&
          (!dateFrom || a.date >= dateFrom) &&
          (!dateTo || a.date <= dateTo) &&
          (!classId || a.classIds.includes(classId)) &&
          (!type || a.type === type) &&
          (!instructor || a.instructorTeacherId === instructor) &&
          (!shiftCode || a.shiftCode === shiftCode) &&
          (!status || a.status === status) &&
          matchesSearch(q, a.name, a.topic, a.note, a.instructorName),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
          a.name.localeCompare(b.name, 'id'),
      )
    return paginate(items, request)
  }),

  http.get(apiPath('/extra-activities/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'extra_activity:read')
    return ok(findActivity(params.id))
  }),

  http.post(apiPath('/extra-activities'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'extra_activity:write')
    return withIdempotency(request, async () => {
      const body = await readJson<Body>(request)
      const f = parseFields(body, false)
      const a: ExtraActivity = {
        id: newId('ext'),
        name: f.name ?? '',
        type: f.type ?? 'OTHER',
        instructorTeacherId: f.instructorTeacherId ?? null,
        instructorName: f.instructorName ?? '',
        coordinatorUserId: user.id,
        date: f.date ?? '',
        shiftCode: f.shiftCode ?? '',
        startTime: f.startTime ?? null,
        endTime: f.endTime ?? null,
        classIds: [],
        classNames: [],
        topic: f.topic ?? null,
        note: f.note ?? null,
        participantAttendanceEnabled: false,
        participants: [],
        status: 'DRAFT',
        createdAt: nowTs(),
        version: 1,
      }
      applyFields(a, f)
      db().extraActivities.unshift(a)
      persist()
      audit({ user, action: 'CREATE', entity: ENTITY, entityId: a.id, summary: `Membuat kegiatan "${a.name}"`, after: pick(a, AUDIT_KEYS) })
      return created(a)
    })
  }),

  http.patch(apiPath('/extra-activities/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findActivity(params.id)
    requireManage(user, a)
    const body = await readJson<Body>(request)
    checkVersion(a, body)
    const reason = finalReason(a, body)
    const f = parseFields(body, true, a)
    const before = pick(a, AUDIT_KEYS)
    const finalize = body.status === 'FINAL' && a.status !== 'FINAL'
    if (body.status !== undefined && body.status !== 'FINAL') {
      throw errors.validation({ status: 'invalid' })
    }
    applyFields(a, f)
    if (finalize) a.status = 'FINAL'
    a.version += 1
    persist()
    audit({
      user,
      action: reason ? 'CORRECT' : finalize ? 'FINALIZE' : 'UPDATE',
      entity: ENTITY,
      entityId: a.id,
      summary: reason
        ? `Koreksi kegiatan final "${a.name}"`
        : finalize
          ? `Menandai kegiatan "${a.name}" terlaksana (final)`
          : `Mengubah kegiatan "${a.name}"`,
      before,
      after: pick(a, AUDIT_KEYS),
      reason,
    })
    return ok(a)
  }),

  http.delete(apiPath('/extra-activities/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findActivity(params.id)
    requireManage(user, a)
    const body = request.headers.get('Content-Type')?.includes('json') ? await readJson<Body>(request) : {}
    const reason = optStr(body.reason)
    if (a.status === 'FINAL' && !reason) {
      throw errors.validation({ reason: 'Alasan wajib diisi untuk menghapus kegiatan final.' })
    }
    softDelete(COLLECTION, a.id)
    audit({
      user,
      action: 'DELETE',
      entity: ENTITY,
      entityId: a.id,
      summary: `Menghapus kegiatan "${a.name}"`,
      before: pick(a, AUDIT_KEYS),
      reason,
    })
    return noContent()
  }),

  http.put(apiPath('/extra-activities/:id/participants'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findActivity(params.id)
    requireParticipantAccess(user, a)
    return withIdempotency(request, async () => {
      const body = await readJson<Body>(request)
      checkVersion(a, body)
      if (!a.participantAttendanceEnabled) {
        throw errors.conflict('Presensi peserta belum diaktifkan untuk kegiatan ini.', 'CONFLICT')
      }
      const reason = finalReason(a, body)
      const raw = Array.isArray(body.participants) ? (body.participants as unknown[]) : null
      if (!raw) throw errors.validation({ participants: 'required' })

      const allowed = new Set(a.classIds)
      const roster = new Map(rosterFor(a.classIds, a.date).map((s) => [s.id, s]))
      const details: Record<string, string> = {}
      const seen = new Set<ID>()
      const next: ExtraActivity['participants'] = []
      raw.forEach((item, i) => {
        const row = (item ?? {}) as Body
        const studentId = str(row.studentId)
        const status = row.status as AttendanceStatus
        if (!studentId) {
          details[`participants.${i}.studentId`] = 'required'
          return
        }
        const student = roster.get(studentId) ?? db().students.find((s) => s.id === studentId)
        if (!student || !allowed.has(student.classId)) {
          details[`participants.${i}.studentId`] = 'Siswa bukan anggota kelas peserta kegiatan ini.'
          return
        }
        if (!roster.has(studentId)) {
          details[`participants.${i}.studentId`] = 'Siswa tidak aktif pada tanggal kegiatan.'
          return
        }
        if (seen.has(studentId)) {
          details[`participants.${i}.studentId`] = 'duplicate'
          return
        }
        seen.add(studentId)
        if (!ATTENDANCE_STATUSES.includes(status)) {
          details[`participants.${i}.status`] = 'required'
          return
        }
        next.push({ studentId, studentName: student.name, classId: student.classId, status })
      })
      if (Object.keys(details).length > 0) {
        throw errors.validation(details, 'Periksa kembali presensi peserta yang ditandai.')
      }

      const before = { participants: a.participants.map((p) => pick(p, ['studentId', 'status'])), status: a.status }
      a.participants = next
      const submit = body.submit === true && a.status !== 'FINAL'
      if (submit) a.status = 'FINAL'
      a.version += 1
      persist()
      if (reason || submit) {
        audit({
          user,
          action: reason ? 'CORRECT' : 'FINALIZE',
          entity: ENTITY,
          entityId: a.id,
          summary: reason
            ? `Koreksi presensi peserta kegiatan "${a.name}"`
            : `Mengirim presensi peserta kegiatan "${a.name}"`,
          before,
          after: { participants: next.map((p) => pick(p, ['studentId', 'status'])), status: a.status },
          reason,
        })
      }
      return ok(a)
    })
  }),
]
