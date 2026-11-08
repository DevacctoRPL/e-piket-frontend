/**
 * Mock API absensi siswa (PRD §6.3 FR-STU-01..04, 07, 08; §7.1; §9.2; §9.3; §10.7).
 * Meniru perilaku backend Go: scoping kelas (AC-13), upsert tanpa duplikasi (FR-STU-07),
 * idempotensi (AC-03), validasi per baris (422 'records.<i>.<field>'), optimistic locking (409),
 * dan audit koreksi data final (FR-AUD-01).
 */
import { http, type HttpHandler } from 'msw'
import { addDays, todayISO } from '@/lib/date'
import { DEFAULT_REASON_REQUIRED } from '@/lib/enums'
import type {
  AttendanceStatus,
  ID,
  RosterRow,
  StudentAttendanceRecord,
  StudentAttendanceSession,
} from '@/types/entities'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import type {
  BulkSaveRequest,
  CreateSessionRequest,
  PatchRecordRequest,
  StudentHistoryRecord,
  StudentHistorySummary,
} from '@/features/student-attendance/types'
import { db, newId, persist, type StoredSession } from '../db'
import { className, getClass, getStudent, phoneForUser, rosterForClass, withSummary } from '../domain'
import {
  accessibleClassIds,
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
  requireClassAccess,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_TEXT = 500

/* ------------------------------------------------------------------ helpers */

function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === 'string' && (ATTENDANCE_STATUSES as readonly string[]).includes(v)
}

/** Status yang mewajibkan alasan menurut pengaturan sekolah (default S/I/A). */
export function reasonRequiredStatuses(): AttendanceStatus[] {
  const cfg = db().settings.attendanceStatuses
  if (!cfg?.length) return DEFAULT_REASON_REQUIRED
  return cfg.filter((s) => s.requiresReason).map((s) => s.code)
}

function activeStatuses(): AttendanceStatus[] {
  const cfg = db().settings.attendanceStatuses
  if (!cfg?.length) return [...ATTENDANCE_STATUSES]
  return cfg.filter((s) => s.active).map((s) => s.code)
}

function sessionLabel(n: number) {
  return n === 1 ? 'Harian' : `Sesi ${n}`
}

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}

/** Record untuk response: nomor kontak wali dimask sesuai permission (PRD §12.2). */
function recordDto(r: StudentAttendanceRecord, user: AuthedUser): StudentAttendanceRecord {
  return r.contact
    ? { ...r, contact: { ...r.contact, contactedPhone: phoneForUser(r.contact.contactedPhone, user) } }
    : r
}

function sessionDto(s: StoredSession): StudentAttendanceSession {
  return withSummary(s)
}

function rosterRows(session: StoredSession, user: AuthedUser): RosterRow[] {
  const records = db().studentRecords.filter((r) => r.sessionId === session.id)
  const byStudent = new Map(records.map((r) => [r.studentId, r]))
  return rosterForClass(session.classId, session.date).map((s) => {
    const rec = byStudent.get(s.id)
    return {
      student: { id: s.id, nis: s.nis, name: s.name, gender: s.gender },
      record: rec ? recordDto(rec, user) : null,
    }
  })
}

function findSession(id: unknown): StoredSession {
  const s = db().studentSessions.find((x) => x.id === id && !isSessionDeleted(x.id))
  if (!s) throw errors.notFound('Sesi absensi tidak ditemukan.')
  return s
}

function isSessionDeleted(id: ID) {
  return db().deleted.studentSessions?.includes(id) ?? false
}

/** Validasi satu baris absensi; mengembalikan pesan per field. */
function validateRow(
  row: { status?: unknown; reason?: unknown; note?: unknown; arrivalTime?: unknown },
  requiresReason: AttendanceStatus[],
  allowed: AttendanceStatus[],
): Record<string, string> {
  const out: Record<string, string> = {}
  if (row.status === undefined || row.status === null || row.status === '') {
    out.status = 'required'
  } else if (!isAttendanceStatus(row.status) || !allowed.includes(row.status)) {
    out.status = 'Status absensi tidak dikenal.'
  } else {
    if (requiresReason.includes(row.status) && !cleanText(row.reason)) {
      out.reason = 'Alasan wajib diisi untuk status ini.'
    }
    if (row.status === 'LATE' && row.arrivalTime && !(typeof row.arrivalTime === 'string' && WALL_TIME.test(row.arrivalTime))) {
      out.arrivalTime = 'Format jam tidak valid (HH:mm).'
    }
  }
  if (typeof row.reason === 'string' && row.reason.length > MAX_TEXT) out.reason = 'too_long'
  if (typeof row.note === 'string' && row.note.length > MAX_TEXT) out.note = 'too_long'
  return out
}

function snapshot(r: StudentAttendanceRecord) {
  return pick(r, ['status', 'reason', 'note', 'arrivalTime'])
}

/* ------------------------------------------------------------------ handlers */

export const studentAttendanceHandlers: HttpHandler[] = [
  /* Daftar sesi (FR-STU-01) */
  http.get(apiPath('/student-attendance/sessions'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'student_attendance:read')
    const sp = searchParams(request)
    const date = sp.get('date')
    const classId = sp.get('classId')
    const shiftCode = sp.get('shiftCode')
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    if (classId) requireClassAccess(user, classId)
    const scope = accessibleClassIds(user)
    const items = db()
      .studentSessions.filter(
        (s) =>
          !isSessionDeleted(s.id) &&
          (!date || s.date === date) &&
          (!dateFrom || s.date >= dateFrom) &&
          (!dateTo || s.date <= dateTo) &&
          (!classId || s.classId === classId) &&
          (!shiftCode || s.shiftCode === shiftCode) &&
          (!scope || scope.includes(s.classId)),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          className(a.classId).localeCompare(className(b.classId), 'id') ||
          a.sessionNumber - b.sessionNumber,
      )
      .map(sessionDto)
    return ok(items)
  }),

  /* Buat sesi atau kembalikan yang sudah ada (FR-STU-07) */
  http.post(apiPath('/student-attendance/sessions'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    return withIdempotency(request, async () => {
      requirePermission(user, 'student_attendance:write')
      const body = await readJson<Partial<CreateSessionRequest>>(request)
      const details: Record<string, string> = {}
      const date = typeof body.date === 'string' ? body.date : ''
      const shiftCode = typeof body.shiftCode === 'string' ? body.shiftCode : ''
      const classId = typeof body.classId === 'string' ? body.classId : ''
      const sessionNumber = body.sessionNumber ?? 1
      if (!date) details.date = 'required'
      else if (!ISO_DATE.test(date)) details.date = 'invalid'
      else if (date > todayISO()) details.date = 'Tanggal absensi tidak boleh di masa depan.'
      if (!shiftCode) details.shiftCode = 'required'
      if (!classId) details.classId = 'required'
      if (!Number.isInteger(sessionNumber) || sessionNumber < 1 || sessionNumber > 10) {
        details.sessionNumber = 'invalid'
      }
      if (Object.keys(details).length) throw errors.validation(details)

      const cls = getClass(classId)
      if (!cls) throw errors.validation({ classId: 'Kelas tidak ditemukan.' })
      requireClassAccess(user, classId)
      if (!db().shifts.some((s) => s.code === shiftCode)) {
        throw errors.validation({ shiftCode: 'Shift tidak dikenal.' })
      }
      if (cls.shiftCode !== shiftCode) {
        throw errors.validation({ shiftCode: 'Kelas ini tidak berada pada shift yang dipilih.' })
      }

      const existing = db().studentSessions.find(
        (s) =>
          !isSessionDeleted(s.id) &&
          s.date === date &&
          s.classId === classId &&
          s.sessionNumber === sessionNumber,
      )
      if (existing) return ok(sessionDto(existing))

      const session: StoredSession = {
        id: newId('ses'),
        date,
        shiftCode,
        classId,
        sessionNumber,
        sessionLabel: sessionLabel(sessionNumber),
        status: 'DRAFT',
        createdBy: user.id,
        createdByName: user.name,
        createdAt: nowTs(),
        submittedAt: null,
        submittedBy: null,
        submittedByName: null,
        version: 1,
      }
      db().studentSessions.push(session)
      persist()
      return created(sessionDto(session))
    })
  }),

  http.get(apiPath('/student-attendance/sessions/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'student_attendance:read')
    const session = findSession(params.id)
    requireClassAccess(user, session.classId)
    return ok(sessionDto(session))
  }),

  /* Roster: semua siswa aktif pada tanggal sesi + record (atau null) */
  http.get(apiPath('/student-attendance/sessions/:id/records'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'student_attendance:read')
    const session = findSession(params.id)
    requireClassAccess(user, session.classId)
    return ok(rosterRows(session, user))
  }),

  /* Simpan massal (upsert) + finalisasi opsional (PRD §10.7). Atomik: error apa pun → tidak ada yang tersimpan. */
  http.put(apiPath('/student-attendance/sessions/:id/records\\:bulk'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    return withIdempotency(request, async () => {
      requirePermission(user, 'student_attendance:write')
      const session = findSession(params.id)
      requireClassAccess(user, session.classId)
      const body = await readJson<Partial<BulkSaveRequest>>(request)

      if (!Array.isArray(body.records)) {
        throw errors.validation({ records: 'required' }, 'Data absensi tidak boleh kosong.')
      }
      if (typeof body.version !== 'number') {
        throw errors.validation({ version: 'required' })
      }

      const isFinal = session.status === 'FINAL'
      const canCorrect = can(user, 'student_attendance:correct')
      if (isFinal && !canCorrect) throw errors.alreadyFinal()
      if (body.version !== session.version) throw errors.versionConflict()
      const correctionReason = cleanText(body.correctionReason)
      if (isFinal && (!correctionReason || correctionReason.length < 3)) {
        throw errors.validation(
          { correctionReason: 'Alasan koreksi wajib diisi.' },
          'Koreksi data final memerlukan alasan.',
        )
      }

      const roster = rosterForClass(session.classId, session.date)
      const rosterIds = new Set(roster.map((s) => s.id))
      const requiresReason = reasonRequiredStatuses()
      const allowed = activeStatuses()
      const details: Record<string, string> = {}
      const seen = new Set<ID>()

      body.records.forEach((row: unknown, i) => {
        if (typeof row !== 'object' || row === null) {
          details[`records.${i}.status`] = 'required'
          return
        }
        const r = row as Record<string, unknown>
        const studentId = typeof r.studentId === 'string' ? r.studentId : ''
        if (!studentId) details[`records.${i}.studentId`] = 'required'
        else if (!rosterIds.has(studentId)) {
          details[`records.${i}.studentId`] = 'Siswa tidak terdaftar aktif di kelas ini pada tanggal sesi.'
        } else if (seen.has(studentId)) {
          details[`records.${i}.studentId`] = 'duplicate'
        }
        if (studentId) seen.add(studentId)
        for (const [field, msg] of Object.entries(validateRow(r, requiresReason, allowed))) {
          details[`records.${i}.${field}`] = msg
        }
      })

      const existing = db().studentRecords.filter((r) => r.sessionId === session.id)
      const byStudent = new Map(existing.map((r) => [r.studentId, r]))

      if (body.submit && Object.keys(details).length === 0) {
        const unmarked = roster.filter((s) => !seen.has(s.id) && !byStudent.has(s.id)).length
        if (unmarked > 0) {
          details.records = `${unmarked} siswa belum diberi status. Lengkapi sebelum finalisasi.`
        }
      }
      if (Object.keys(details).length) {
        throw errors.validation(details, 'Beberapa baris absensi belum valid. Periksa baris yang ditandai.')
      }

      // ---- semua valid: terapkan (upsert, satu record per siswa per sesi)
      const ts = nowTs()
      const changedForAudit: { id: ID; before: Record<string, unknown>; after: Record<string, unknown> }[] = []
      for (const raw of body.records as BulkSaveRequest['records']) {
        const status = raw.status
        const next = {
          status,
          reason: cleanText(raw.reason),
          note: cleanText(raw.note),
          arrivalTime: status === 'LATE' ? cleanText(raw.arrivalTime) : null,
        }
        const prev = byStudent.get(raw.studentId)
        if (prev) {
          const changed =
            prev.status !== next.status ||
            prev.reason !== next.reason ||
            prev.note !== next.note ||
            prev.arrivalTime !== next.arrivalTime
          if (!changed) continue
          const before = snapshot(prev)
          Object.assign(prev, next, {
            updatedAt: ts,
            updatedBy: user.id,
            updatedByName: user.name,
            version: prev.version + 1,
          })
          changedForAudit.push({ id: prev.id, before, after: snapshot(prev) })
        } else {
          const student = getStudent(raw.studentId)
          const rec: StudentAttendanceRecord = {
            id: newId('rec'),
            sessionId: session.id,
            studentId: raw.studentId,
            studentName: student?.name ?? '—',
            studentNis: student?.nis ?? '',
            ...next,
            contact: null,
            updatedAt: ts,
            updatedBy: user.id,
            updatedByName: user.name,
            version: 1,
          }
          db().studentRecords.push(rec)
          byStudent.set(rec.studentId, rec)
        }
      }

      session.version += 1
      if (isFinal) {
        for (const c of changedForAudit) {
          audit({
            user,
            action: 'CORRECT',
            entity: 'StudentAttendanceRecord',
            entityId: c.id,
            summary: `Koreksi absensi siswa ${className(session.classId)} tanggal ${session.date}`,
            before: c.before,
            after: c.after,
            reason: correctionReason,
          })
        }
      } else if (body.submit) {
        session.status = 'FINAL'
        session.submittedAt = ts
        session.submittedBy = user.id
        session.submittedByName = user.name
        audit({
          user,
          action: 'FINALIZE',
          entity: 'StudentAttendanceSession',
          entityId: session.id,
          summary: `Finalisasi absensi ${className(session.classId)} tanggal ${session.date}`,
          after: { status: 'FINAL', summary: withSummary(session).summary },
        })
      }
      persist()
      return ok({ session: sessionDto(session), records: rosterRows(session, user) })
    })
  }),

  /* Koreksi satu record (PRD §9.2: data final perlu izin + alasan, tercatat di audit) */
  http.patch(apiPath('/student-attendance/records/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'student_attendance:write', 'student_attendance:correct')
    const rec = db().studentRecords.find((r) => r.id === params.id)
    if (!rec) return errors.notFound('Record absensi tidak ditemukan.')
    const session = findSession(rec.sessionId)
    requireClassAccess(user, session.classId)
    const body = await readJson<Partial<PatchRecordRequest>>(request)

    const isFinal = session.status === 'FINAL'
    if (isFinal && !can(user, 'student_attendance:correct')) return errors.alreadyFinal()
    if (!isFinal && !can(user, 'student_attendance:write')) return errors.forbidden()
    if (typeof body.version !== 'number') return errors.validation({ version: 'required' })
    if (body.version !== rec.version) return errors.versionConflict()

    const merged = {
      status: body.status !== undefined ? body.status : rec.status,
      reason: body.reason !== undefined ? cleanText(body.reason) : rec.reason,
      note: body.note !== undefined ? cleanText(body.note) : rec.note,
      arrivalTime: body.arrivalTime !== undefined ? cleanText(body.arrivalTime) : rec.arrivalTime,
    }
    const details = validateRow(merged, reasonRequiredStatuses(), activeStatuses())
    const correctionReason = cleanText(body.correctionReason)
    if (isFinal && (!correctionReason || correctionReason.length < 3)) {
      details.correctionReason = 'Alasan koreksi wajib diisi.'
    }
    if (Object.keys(details).length) return errors.validation(details)

    const status = merged.status as AttendanceStatus
    const before = snapshot(rec)
    Object.assign(rec, {
      status,
      reason: merged.reason,
      note: merged.note,
      arrivalTime: status === 'LATE' ? merged.arrivalTime : null,
      updatedAt: nowTs(),
      updatedBy: user.id,
      updatedByName: user.name,
      version: rec.version + 1,
    })
    session.version += 1
    if (isFinal) {
      audit({
        user,
        action: 'CORRECT',
        entity: 'StudentAttendanceRecord',
        entityId: rec.id,
        summary: `Koreksi absensi ${rec.studentNis} (${className(session.classId)}, ${session.date})`,
        before,
        after: snapshot(rec),
        reason: correctionReason,
      })
    }
    persist()
    return ok({ record: recordDto(rec, user), session: sessionDto(session) })
  }),

  /* Histori absensi siswa (FR-STU-08) */
  http.get(apiPath('/student-attendance/history'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'student_attendance:read')
    const sp = searchParams(request)
    const studentId = sp.get('studentId')
    const today = todayISO()
    const dateFrom = sp.get('dateFrom') || addDays(today, -30)
    const dateTo = sp.get('dateTo') || today
    const details: Record<string, string> = {}
    if (!studentId) details.studentId = 'required'
    if (!ISO_DATE.test(dateFrom)) details.dateFrom = 'invalid'
    if (!ISO_DATE.test(dateTo)) details.dateTo = 'invalid'
    if (!details.dateFrom && !details.dateTo && dateFrom > dateTo) {
      details.dateTo = 'Tanggal akhir harus sama atau setelah tanggal awal.'
    }
    if (Object.keys(details).length) return errors.validation(details)

    const student = getStudent(studentId as string)
    if (!student || (db().deleted.students?.includes(student.id) ?? false)) {
      return errors.notFound('Siswa tidak ditemukan.')
    }
    requireClassAccess(user, student.classId)

    const sessions = new Map(
      db()
        .studentSessions.filter((s) => !isSessionDeleted(s.id) && s.date >= dateFrom && s.date <= dateTo)
        .map((s) => [s.id, s]),
    )
    const records: StudentHistoryRecord[] = db()
      .studentRecords.filter((r) => r.studentId === student.id && sessions.has(r.sessionId))
      .map((r) => {
        const s = sessions.get(r.sessionId) as StoredSession
        return {
          recordId: r.id,
          sessionId: s.id,
          date: s.date,
          shiftCode: s.shiftCode,
          sessionLabel: s.sessionLabel,
          sessionStatus: s.status,
          status: r.status,
          arrivalTime: r.arrivalTime,
          reason: r.reason,
          note: r.note,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.sessionLabel.localeCompare(b.sessionLabel))

    const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>
    for (const r of records) counts[r.status] += 1
    const present = counts.PRESENT + counts.LATE
    const summary: StudentHistorySummary = {
      ...counts,
      total: records.length,
      presentRate: records.length ? Math.round((present / records.length) * 1000) / 10 : 0,
    }
    return ok({
      student: {
        id: student.id,
        nis: student.nis,
        name: student.name,
        classId: student.classId,
        className: className(student.classId),
      },
      dateFrom,
      dateTo,
      records,
      summary,
    })
  }),
]
