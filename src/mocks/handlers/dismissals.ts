/**
 * Mock API kepulangan siswa (PRD §6.4 FR-OUT-01/02/04, §7.2, §9.2, §9.3, AC-06).
 *
 * Aturan penting: pencatatan kepulangan TIDAK PERNAH mengubah StudentAttendanceRecord —
 * kedatangan dan kepulangan adalah dua peristiwa terpisah (PRD §9.2).
 */
import { http, type HttpHandler } from 'msw'
import { dateOf, todayISO } from '@/lib/date'
import type { DismissalType, ID, StudentDismissal } from '@/types/entities'
import { DISMISSAL_TYPES } from '@/types/entities'
import { db, isDeleted, newId, persist, softDelete } from '../db'
import { getClass, rosterForClass } from '../domain'
import {
  accessibleClassIds,
  apiPath,
  audit,
  created,
  errors,
  latency,
  matchesSearch,
  noContent,
  ok,
  paginate,
  pick,
  readJson,
  requireAuth,
  requireClassAccess,
  requirePermission,
  searchParams,
  sortBy,
  withIdempotency,
  nowTs,
  type AuthedUser,
} from '../utils'

const COLLECTION = 'dismissals'
const ENTITY = 'StudentDismissal'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
const MAX_NAME = 100
const MAX_NOTE = 500

const AUDIT_FIELDS: (keyof StudentDismissal)[] = [
  'type',
  'exitTime',
  'returnTime',
  'pickupName',
  'pickupRelation',
  'note',
]

interface DismissalBody {
  studentId?: unknown
  date?: unknown
  exitTime?: unknown
  type?: unknown
  returnTime?: unknown
  pickupName?: unknown
  pickupRelation?: unknown
  note?: unknown
  reason?: unknown
}

/** Nilai teks opsional: '' / spasi → null. */
function text(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function isValidTs(v: string | null): v is string {
  return !!v && TS_RE.test(v) && !Number.isNaN(Date.parse(v))
}

function isDismissalType(v: unknown): v is DismissalType {
  return typeof v === 'string' && (DISMISSAL_TYPES as readonly string[]).includes(v)
}

function activeDismissals() {
  return db().dismissals.filter((d) => !isDeleted(COLLECTION, d.id))
}

function findDismissal(id: string | readonly string[] | undefined) {
  return activeDismissals().find((d) => d.id === id)
}

/** Field kepulangan yang sudah dinormalisasi & divalidasi (dipakai create & koreksi). */
interface DismissalFields {
  date: string
  exitTime: string
  type: DismissalType
  returnTime: string | null
  pickupName: string | null
  pickupRelation: string | null
  note: string | null
}

/** Validasi PRD §9.3. Mengembalikan detail error per field (kosong = valid). */
function validateFields(f: {
  date: string | null
  exitTime: string | null
  type: unknown
  returnTime: string | null
  pickupName: string | null
  pickupRelation: string | null
  note: string | null
}): Record<string, string> {
  const details: Record<string, string> = {}
  if (!f.date) details.date = 'required'
  else if (!DATE_RE.test(f.date)) details.date = 'invalid'
  else if (f.date > todayISO()) details.date = 'Tanggal tidak boleh melebihi hari ini.'

  if (!f.exitTime) details.exitTime = 'required'
  else if (!isValidTs(f.exitTime)) details.exitTime = 'invalid'
  else if (f.date && DATE_RE.test(f.date) && dateOf(f.exitTime) !== f.date)
    details.exitTime = 'Waktu keluar harus pada tanggal kepulangan.'

  if (f.type === undefined || f.type === null || f.type === '') details.type = 'required'
  else if (!isDismissalType(f.type)) details.type = 'invalid'

  if (f.returnTime) {
    if (!isValidTs(f.returnTime)) details.returnTime = 'invalid'
    else if (f.type !== 'TEMPORARY_EXIT')
      details.returnTime = 'Waktu kembali hanya untuk izin keluar sementara.'
    else if (isValidTs(f.exitTime) && Date.parse(f.returnTime) <= Date.parse(f.exitTime))
      details.returnTime = 'Waktu kembali harus setelah waktu keluar.'
  }

  const requiresPickup = db().settings.dismissalRequiresPickup
  if (requiresPickup && (f.type === 'NORMAL' || f.type === 'EARLY_LEAVE') && !f.pickupName) {
    details.pickupName = 'Nama penjemput/penerima wajib diisi sesuai kebijakan sekolah.'
  }
  if (f.pickupName && f.pickupName.length > MAX_NAME) details.pickupName = 'too_long'
  if (f.pickupRelation && f.pickupRelation.length > MAX_NAME) details.pickupRelation = 'too_long'

  if (f.type === 'EARLY_LEAVE' && !f.note)
    details.note = 'Alasan/catatan wajib diisi untuk pulang lebih awal.'
  if (f.note && f.note.length > MAX_NOTE) details.note = 'too_long'
  return details
}

/** 403 bila dismissal milik kelas di luar kewenangan user (AC-13). */
function requireDismissalAccess(user: AuthedUser, d: StudentDismissal) {
  requireClassAccess(user, d.classId)
}

/** Siswa sudah tercatat pulang (normal/lebih awal) pada tanggal ini. */
function existingFinalExit(studentId: ID, date: string, excludeId?: ID) {
  return activeDismissals().find(
    (d) =>
      d.studentId === studentId &&
      d.date === date &&
      d.id !== excludeId &&
      (d.type === 'NORMAL' || d.type === 'EARLY_LEAVE'),
  )
}

export const dismissalsHandlers: HttpHandler[] = [
  /* -------------------------------------------------- konteks absensi siswa (PRD §7.2 langkah 2) */
  http.get(apiPath('/student-dismissals/context'), async ({ request }) => {
    await latency(120)
    const user = requireAuth(request)
    requirePermission(user, 'dismissal:read')
    const sp = searchParams(request)
    const studentId = sp.get('studentId')
    const date = sp.get('date') ?? todayISO()
    if (!studentId) return errors.validation({ studentId: 'required' })
    if (!DATE_RE.test(date)) return errors.validation({ date: 'invalid' })
    const student = db().students.find((s) => s.id === studentId && !isDeleted('students', s.id))
    if (!student) return errors.notFound('Siswa tidak ditemukan.')
    requireClassAccess(user, student.classId)
    const cls = getClass(student.classId)

    const d = db()
    const sessions = d.studentSessions
      .filter(
        (s) =>
          s.classId === student.classId &&
          s.date === date &&
          s.status !== 'CANCELLED' &&
          !isDeleted('studentSessions', s.id),
      )
      .sort((a, b) => a.sessionNumber - b.sessionNumber)
    const attendance = sessions.map((s) => {
      const r = d.studentRecords.find((x) => x.sessionId === s.id && x.studentId === student.id)
      return {
        sessionId: s.id,
        sessionLabel: s.sessionLabel,
        sessionStatus: s.status,
        status: r?.status ?? null,
        arrivalTime: r?.arrivalTime ?? null,
        reason: r?.reason ?? null,
      }
    })
    const dismissals = sortBy(
      activeDismissals().filter((x) => x.studentId === student.id && x.date === date),
      'exitTime',
    )
    return ok({
      student: {
        id: student.id,
        nis: student.nis,
        name: student.name,
        classId: student.classId,
        className: cls?.name ?? '—',
        shiftCode: cls?.shiftCode ?? null,
      },
      date,
      attendance,
      dismissals,
    })
  }),

  /* -------------------------------------------------- histori (FR-OUT-04) */
  http.get(apiPath('/student-dismissals'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'dismissal:read')
    const sp = searchParams(request)
    const scope = accessibleClassIds(user)
    const classId = sp.get('classId')
    if (classId && scope && !scope.includes(classId)) {
      return errors.forbidden('Anda tidak memiliki akses ke data kelas ini.')
    }
    const date = sp.get('date')
    const from = sp.get('dateFrom')
    const to = sp.get('dateTo')
    const bad: Record<string, string> = {}
    for (const [k, v] of [['date', date], ['dateFrom', from], ['dateTo', to]] as const) {
      if (v && !DATE_RE.test(v)) bad[k] = 'invalid'
    }
    if (from && to && from > to) bad.dateTo = 'Tanggal akhir harus setelah tanggal awal.'
    if (Object.keys(bad).length) return errors.validation(bad)

    const type = sp.get('type')
    const studentId = sp.get('studentId')
    const shiftCode = sp.get('shiftCode')
    const search = sp.get('search')
    const items = activeDismissals().filter(
      (x) =>
        (!scope || scope.includes(x.classId)) &&
        (!date || x.date === date) &&
        (!from || x.date >= from) &&
        (!to || x.date <= to) &&
        (!classId || x.classId === classId) &&
        (!studentId || x.studentId === studentId) &&
        (!type || x.type === type) &&
        (!shiftCode || x.shiftCode === shiftCode) &&
        matchesSearch(search, x.studentName, x.studentNis, x.pickupName),
    )
    return paginate(sortBy(items, sp.get('sort') ?? '-exitTime'), request)
  }),

  /* -------------------------------------------------- catat kepulangan (FR-OUT-01/02, AC-06) */
  http.post(apiPath('/student-dismissals'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'dismissal:write')
    return withIdempotency(request, async () => {
      const body = await readJson<DismissalBody>(request)
      const studentId = text(body.studentId)
      const fields = {
        date: text(body.date),
        exitTime: text(body.exitTime),
        type: body.type,
        returnTime: text(body.returnTime),
        pickupName: text(body.pickupName),
        pickupRelation: text(body.pickupRelation),
        note: text(body.note),
      }
      const details = validateFields(fields)
      const student = studentId
        ? db().students.find((s) => s.id === studentId && !isDeleted('students', s.id))
        : undefined
      if (!studentId) details.studentId = 'required'
      else if (!student) details.studentId = 'Siswa tidak ditemukan.'
      else if (
        fields.date &&
        DATE_RE.test(fields.date) &&
        !rosterForClass(student.classId, fields.date).some((s) => s.id === student.id)
      ) {
        details.studentId = 'Siswa tidak aktif pada tanggal tersebut.'
      }
      if (Object.keys(details).length) throw errors.validation(details)
      // setelah validasi, field pasti terisi
      const f = fields as DismissalFields
      const s = student!
      requireClassAccess(user, s.classId)

      if ((f.type === 'NORMAL' || f.type === 'EARLY_LEAVE') && existingFinalExit(s.id, f.date)) {
        throw errors.conflict(
          'Siswa ini sudah tercatat pulang pada tanggal tersebut. Muat ulang daftar untuk melihat datanya.',
        )
      }

      const cls = getClass(s.classId)
      const now = nowTs()
      const record: StudentDismissal = {
        id: newId('dis'),
        studentId: s.id,
        studentName: s.name,
        studentNis: s.nis,
        classId: s.classId,
        className: cls?.name ?? '—',
        date: f.date,
        shiftCode: cls?.shiftCode ?? 'MORNING',
        exitTime: f.exitTime,
        returnTime: f.type === 'TEMPORARY_EXIT' ? f.returnTime : null,
        type: f.type,
        pickupName: f.pickupName,
        pickupRelation: f.pickupRelation,
        note: f.note,
        recordedBy: user.id,
        recordedByName: user.name,
        recordedAt: now,
      }
      db().dismissals.push(record)
      persist()
      audit({
        user,
        action: 'CREATE',
        entity: ENTITY,
        entityId: record.id,
        summary: `Mencatat kepulangan ${record.studentName} (${record.className}) — ${record.type}`,
        after: pick(record, AUDIT_FIELDS),
      })
      return created(record)
    })
  }),

  /* -------------------------------------------------- tandai kembali / koreksi */
  http.patch(apiPath('/student-dismissals/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'dismissal:write')
    const existing = findDismissal(params.id)
    if (!existing) return errors.notFound('Data kepulangan tidak ditemukan.')
    requireDismissalAccess(user, existing)
    const body = await readJson<DismissalBody>(request)

    const keys = Object.keys(body).filter((k) => k !== 'reason')
    const reason = text(body.reason)
    const isMarkReturn =
      keys.length === 1 && keys[0] === 'returnTime' && !reason && existing.type === 'TEMPORARY_EXIT'

    if (isMarkReturn) {
      const returnTime = text(body.returnTime)
      if (existing.returnTime) {
        return errors.conflict('Siswa sudah ditandai kembali. Muat ulang untuk melihat data terbaru.')
      }
      if (!returnTime) return errors.validation({ returnTime: 'required' })
      if (!isValidTs(returnTime)) return errors.validation({ returnTime: 'invalid' })
      if (Date.parse(returnTime) <= Date.parse(existing.exitTime))
        return errors.validation({ returnTime: 'Waktu kembali harus setelah waktu keluar.' })
      const before = pick(existing, AUDIT_FIELDS)
      existing.returnTime = returnTime
      persist()
      audit({
        user,
        action: 'UPDATE',
        entity: ENTITY,
        entityId: existing.id,
        summary: `Menandai ${existing.studentName} kembali dari izin keluar`,
        before,
        after: pick(existing, AUDIT_FIELDS),
      })
      return ok(existing)
    }

    // Koreksi: wajib alasan (PRD §9.2 — perubahan data operasional memiliki jejak audit & alasan)
    const has = (k: keyof DismissalBody) => Object.prototype.hasOwnProperty.call(body, k)
    const fields = {
      date: existing.date,
      exitTime: has('exitTime') ? text(body.exitTime) : existing.exitTime,
      type: has('type') ? body.type : existing.type,
      returnTime: has('returnTime') ? text(body.returnTime) : existing.returnTime,
      pickupName: has('pickupName') ? text(body.pickupName) : existing.pickupName,
      pickupRelation: has('pickupRelation') ? text(body.pickupRelation) : existing.pickupRelation,
      note: has('note') ? text(body.note) : existing.note,
    }
    // jenis selain izin keluar tidak menyimpan waktu kembali
    if (fields.type !== 'TEMPORARY_EXIT' && !has('returnTime')) fields.returnTime = null
    const details = validateFields(fields)
    if (!reason || reason.length < 3) details.reason = 'Alasan koreksi wajib diisi (minimal 3 karakter).'
    if (Object.keys(details).length) return errors.validation(details)
    const f = fields as DismissalFields

    if (
      (f.type === 'NORMAL' || f.type === 'EARLY_LEAVE') &&
      existingFinalExit(existing.studentId, existing.date, existing.id)
    ) {
      return errors.conflict('Siswa ini sudah memiliki catatan pulang lain pada tanggal tersebut.')
    }

    const before = pick(existing, AUDIT_FIELDS)
    Object.assign(existing, {
      exitTime: f.exitTime,
      type: f.type,
      returnTime: f.type === 'TEMPORARY_EXIT' ? f.returnTime : null,
      pickupName: f.pickupName,
      pickupRelation: f.pickupRelation,
      note: f.note,
    } satisfies Partial<StudentDismissal>)
    persist()
    audit({
      user,
      action: 'CORRECT',
      entity: ENTITY,
      entityId: existing.id,
      summary: `Mengoreksi kepulangan ${existing.studentName} (${existing.className})`,
      before,
      after: pick(existing, AUDIT_FIELDS),
      reason,
    })
    return ok(existing)
  }),

  /* -------------------------------------------------- hapus (soft delete, FR-AUD-02) */
  http.delete(apiPath('/student-dismissals/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'dismissal:write')
    const existing = findDismissal(params.id)
    if (!existing) return errors.notFound('Data kepulangan tidak ditemukan.')
    requireDismissalAccess(user, existing)
    let reason: string | null = searchParams(request).get('reason')
    if (!reason) {
      const raw = await request.text()
      if (raw) {
        try {
          reason = text((JSON.parse(raw) as DismissalBody).reason)
        } catch {
          return errors.validation({ body: 'invalid' }, 'Format permintaan tidak valid.')
        }
      }
    }
    reason = text(reason)
    if (!reason || reason.length < 3)
      return errors.validation({ reason: 'Alasan penghapusan wajib diisi (minimal 3 karakter).' })
    softDelete(COLLECTION, existing.id)
    audit({
      user,
      action: 'DELETE',
      entity: ENTITY,
      entityId: existing.id,
      summary: `Menghapus catatan kepulangan ${existing.studentName} (${existing.className})`,
      before: pick(existing, AUDIT_FIELDS),
      reason,
    })
    return noContent()
  }),
]
