/**
 * Mock API Siswa Tidak Hadir (Absensi Siswa) — integrasi BE Presensi Siswa.
 * Mendukung 5 status ketidakhadiran: Sakit (S), Izin (I), Alpa (A), Dispensasi (D), PKL (P)
 * serta pembaruan status kembali ke Hadir (H) via Edit atau Hapus.
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import {
  ABSENTEE_STATUSES,
  type AbsenteeRow,
  type AbsenteeStatus,
  type AttendanceStatus,
  type StudentAttendanceRecord,
} from '@/types/entities'
import { db, isDeleted, newId, persist } from '../db'
import { className, getClass, getStudent } from '../domain'
import {
  apiPath,
  audit,
  created,
  errors,
  latency,
  matchesSearch,
  noContent,
  nowTs,
  ok,
  paginate,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
} from '../utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EDITABLE_STATUSES: AttendanceStatus[] = ['PRESENT', ...ABSENTEE_STATUSES]

const isAbsenteeStatus = (v: unknown): v is AbsenteeStatus =>
  typeof v === 'string' && (ABSENTEE_STATUSES as readonly string[]).includes(v)

const cleanText = (v: unknown) => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

function collectAbsentees(params: {
  date: string
  classId: string | null
  status: AbsenteeStatus | null
  search: string | null
}): AbsenteeRow[] {
  const d = db()
  const sessions = new Map(
    d.studentSessions
      .filter(
        (s) =>
          s.date === params.date &&
          !isDeleted('studentSessions', s.id) &&
          s.status !== 'CANCELLED' &&
          s.status !== 'REJECTED' &&
          (!params.classId || s.classId === params.classId),
      )
      .map((s) => [s.id, s]),
  )
  if (sessions.size === 0) return []

  const rows: AbsenteeRow[] = []
  for (const r of d.studentRecords) {
    const session = sessions.get(r.sessionId)
    if (!session) continue
    if (isDeleted('studentRecords', r.id)) continue
    if (!isAbsenteeStatus(r.status)) continue
    if (params.status && r.status !== params.status) continue
    const clsName = className(session.classId)
    if (!matchesSearch(params.search, r.studentName, r.studentNis, clsName, r.reason, r.note)) continue
    rows.push({
      recordId: r.id,
      sessionId: session.id,
      date: session.date,
      shiftCode: session.shiftCode,
      classId: session.classId,
      className: clsName,
      studentId: r.studentId,
      studentName: r.studentName,
      studentNis: r.studentNis,
      status: r.status,
      reason: r.reason,
      note: r.note,
      updatedAt: r.updatedAt,
      updatedByName: r.updatedByName,
    })
  }

  return rows.sort(
    (a, b) =>
      a.className.localeCompare(b.className, 'id', { numeric: true }) ||
      a.studentName.localeCompare(b.studentName, 'id'),
  )
}

function parseListQuery(request: Request) {
  const sp = searchParams(request)
  const date = sp.get('date') || todayISO()
  const details: Record<string, string> = {}
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    details.date = 'Format tanggal tidak valid.'
  }
  const rawStatus = sp.get('status')
  let status: AbsenteeStatus | null = null
  if (rawStatus) {
    if (!isAbsenteeStatus(rawStatus)) details.status = 'Status ketidakhadiran tidak valid.'
    else status = rawStatus
  }
  if (Object.keys(details).length) throw errors.validation(details, 'Filter tidak valid.')
  return {
    date,
    classId: sp.get('classId') || null,
    status,
    search: sp.get('search') || null,
  }
}

export const absenteesHandlers: HttpHandler[] = [
  http.get(apiPath('/student-attendance/absentees/summary'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'absentees:read')
    const q = parseListQuery(request)
    const all = collectAbsentees({ ...q, status: null })
    const byStatus = Object.fromEntries(ABSENTEE_STATUSES.map((s) => [s, 0])) as Record<AbsenteeStatus, number>
    for (const row of all) byStatus[row.status] += 1
    return ok({
      date: q.date,
      byStatus,
      total: all.length,
    })
  }),

  http.get(apiPath('/student-attendance/absentees'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'absentees:read')
    const q = parseListQuery(request)
    return paginate(collectAbsentees(q), request, 10)
  }),

  /** Catat ketidakhadiran siswa (POST /student-attendance/absentees). */
  http.post(apiPath('/student-attendance/absentees'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'absentees:write')
      const body = await readJson<Record<string, unknown>>(request)
      const details: Record<string, string> = {}

      const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : todayISO()
      const classId = typeof body.classId === 'string' ? body.classId.trim() : ''
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
      const status = body.status
      const reason = cleanText(body.reason)

      const cls = classId ? getClass(classId) : undefined
      if (!classId) details.classId = 'Pilih kelas.'
      else if (!cls) details.classId = 'Kelas tidak ditemukan.'

      const student = studentId ? getStudent(studentId) : undefined
      if (!studentId) details.studentId = 'Pilih siswa.'
      else if (!student || isDeleted('students', student.id)) details.studentId = 'Siswa tidak ditemukan.'
      else if (cls && student.classId !== cls.id) details.studentId = 'Siswa bukan anggota kelas terpilih.'

      if (!isAbsenteeStatus(status)) details.status = 'Pilih status ketidakhadiran (Sakit, Izin, Alpa, Dispensasi, atau PKL).'
      if (reason && reason.length > 500) details.reason = 'Keterangan maksimal 500 karakter.'
      if (Object.keys(details).length) return errors.validation(details)

      const d = db()
      const now = nowTs()
      let session = d.studentSessions.find(
        (s) => s.date === date && s.classId === cls!.id && !isDeleted('studentSessions', s.id),
      )
      if (!session) {
        session = {
          id: newId('ses'),
          date,
          shiftCode: cls!.shiftCode,
          classId: cls!.id,
          sessionNumber: 1,
          sessionLabel: 'Harian',
          status: 'FINAL',
          createdBy: user.id,
          createdByName: user.name,
          createdAt: now,
          submittedAt: now,
          submittedBy: user.id,
          submittedByName: user.name,
          version: 1,
        }
        d.studentSessions.push(session)
      }

      let record = d.studentRecords.find(
        (r) => r.sessionId === session.id && r.studentId === student!.id && !isDeleted('studentRecords', r.id),
      )
      if (record) {
        record.status = status as AbsenteeStatus
        record.reason = reason
        record.note = null
        record.updatedAt = now
        record.updatedBy = user.id
        record.updatedByName = user.name
        record.version += 1
      } else {
        record = {
          id: newId('rec'),
          sessionId: session.id,
          studentId: student!.id,
          studentName: student!.name,
          studentNis: student!.nis,
          status: status as AbsenteeStatus,
          arrivalTime: null,
          reason,
          note: null,
          updatedAt: now,
          updatedBy: user.id,
          updatedByName: user.name,
          version: 1,
        } satisfies StudentAttendanceRecord
        d.studentRecords.push(record)
      }

      persist()
      audit({
        user,
        action: 'CREATE',
        entity: 'StudentAttendanceRecord',
        entityId: record.id,
        summary: `Mencatat ketidakhadiran ${record.studentName} (${cls!.name}) — ${status}`,
      })

      const row: AbsenteeRow = {
        recordId: record.id,
        sessionId: session.id,
        date: session.date,
        shiftCode: session.shiftCode,
        classId: session.classId,
        className: cls!.name,
        studentId: record.studentId,
        studentName: record.studentName,
        studentNis: record.studentNis,
        status: status as AbsenteeStatus,
        reason: record.reason,
        note: record.note,
        updatedAt: record.updatedAt,
        updatedByName: record.updatedByName,
      }
      return created(row)
    }),
  ),

  /** Ubah status (termasuk Hadir) & keterangan siswa (PATCH /student-attendance/absentees/:id). */
  http.patch(apiPath('/student-attendance/absentees/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'absentees:write')
    const d = db()
    const record = d.studentRecords.find((r) => r.id === params.id && !isDeleted('studentRecords', r.id))
    if (!record) return errors.notFound('Data ketidakhadiran siswa tidak ditemukan.')
    const session = d.studentSessions.find((s) => s.id === record.sessionId)
    if (!session) return errors.notFound('Sesi absensi tidak ditemukan.')

    const body = await readJson<Record<string, unknown>>(request)
    const status = body.status as AttendanceStatus
    const reason = 'reason' in body ? cleanText(body.reason) : record.reason
    const details: Record<string, string> = {}
    if (!EDITABLE_STATUSES.includes(status)) {
      details.status = 'Status harus salah satu dari Hadir, Sakit, Izin, Alpa, Dispensasi, atau PKL.'
    }
    if (reason && reason.length > 500) details.reason = 'Keterangan maksimal 500 karakter.'
    if (Object.keys(details).length) return errors.validation(details)

    const now = nowTs()
    record.status = status
    record.reason = status === 'PRESENT' ? null : reason
    record.note = null
    record.updatedAt = now
    record.updatedBy = user.id
    record.updatedByName = user.name
    record.version += 1
    persist()
    audit({
      user,
      action: 'UPDATE',
      entity: 'StudentAttendanceRecord',
      entityId: record.id,
      summary: `Mengubah status ${record.studentName} (${className(session.classId)}) menjadi ${status}`,
    })

    return ok({
      recordId: record.id,
      status: record.status,
      reason: record.reason,
      removed: record.status === 'PRESENT',
    })
  }),

  /** Hapus dari daftar tidak hadir = kembalikan status siswa menjadi Hadir (DELETE /student-attendance/absentees/:id). */
  http.delete(apiPath('/student-attendance/absentees/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'absentees:write')
    const d = db()
    const record = d.studentRecords.find((r) => r.id === params.id && !isDeleted('studentRecords', r.id))
    if (!record) return errors.notFound('Data ketidakhadiran siswa tidak ditemukan.')
    const session = d.studentSessions.find((s) => s.id === record.sessionId)
    const now = nowTs()
    record.status = 'PRESENT'
    record.reason = null
    record.note = null
    record.updatedAt = now
    record.updatedBy = user.id
    record.updatedByName = user.name
    record.version += 1
    persist()
    audit({
      user,
      action: 'DELETE',
      entity: 'StudentAttendanceRecord',
      entityId: record.id,
      summary: `Mengembalikan status ${record.studentName} (${session ? className(session.classId) : '—'}) menjadi Hadir`,
    })
    return noContent()
  }),
]
