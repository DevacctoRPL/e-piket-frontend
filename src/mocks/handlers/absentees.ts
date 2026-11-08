/**
 * Mock API "Siswa Tidak Hadir" (PRD §6.3 FR-STU-05, FR-STU-06; AC-04, AC-05; §12.2).
 *
 * - GET   /student-attendance/absentees           → daftar otomatis record berstatus bukan Hadir
 * - GET   /student-attendance/absentees/summary   → jumlah per status + jumlah sudah/belum dikonfirmasi
 * - PATCH /student-attendance/records/:id/contact → simpan konfirmasi wali (TIDAK mengirim pesan)
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import { NON_PRESENT_STATUSES } from '@/lib/enums'
import type { AbsenteeRow, AttendanceStatus, GuardianContact, RecordStatus } from '@/types/entities'
import { db, isDeleted, persist } from '../db'
import { className, getStudent, phoneForUser } from '../domain'
import {
  accessibleClassIds,
  apiPath,
  audit,
  errors,
  latency,
  matchesSearch,
  nowTs,
  ok,
  paginate,
  readJson,
  requireAuth,
  requireClassAccess,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** Rentang maksimum satu permintaan (hari) agar daftar tetap ringan. */
const MAX_RANGE_DAYS = 366
/** Nomor telepon: angka, spasi, tanda hubung, +; 8–16 digit. */
const PHONE_RE = /^\+?[\d\s-]+$/

/** Sesi yang dihitung ke daftar: sudah dikirim/final; draft hanya bila diminta. */
const VISIBLE_SESSION_STATUSES: RecordStatus[] = ['SUBMITTED', 'FINAL']

interface AbsenteeFilters {
  dateFrom: string
  dateTo: string
  classId: string | null
  shiftCode: string | null
  statuses: AttendanceStatus[]
  search: string | null
  contacted: 'true' | 'false' | null
  includeDraft: boolean
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** Baca & validasi filter; melempar 422/403 (dipakai list dan summary). */
function parseFilters(request: Request, user: AuthedUser): AbsenteeFilters {
  const sp = searchParams(request)
  const today = todayISO()
  const dateFrom = sp.get('dateFrom') || sp.get('date') || today
  const dateTo = sp.get('dateTo') || sp.get('date') || dateFrom
  const details: Record<string, string> = {}
  if (!DATE_RE.test(dateFrom) || Number.isNaN(Date.parse(dateFrom))) details.dateFrom = 'invalid'
  if (!DATE_RE.test(dateTo) || Number.isNaN(Date.parse(dateTo))) details.dateTo = 'invalid'
  if (!details.dateFrom && !details.dateTo) {
    if (dateTo < dateFrom) details.dateTo = 'Tanggal akhir tidak boleh sebelum tanggal awal.'
    else if (daysBetween(dateFrom, dateTo) > MAX_RANGE_DAYS)
      details.dateTo = `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari.`
  }
  const rawStatuses = sp.getAll('status').flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean)
  const unknown = rawStatuses.filter((s) => !(NON_PRESENT_STATUSES as string[]).includes(s))
  if (unknown.length > 0) details.status = 'Status harus salah satu status tidak hadir.'
  const contacted = sp.get('contacted')
  if (contacted !== null && contacted !== '' && contacted !== 'true' && contacted !== 'false') {
    details.contacted = 'invalid'
  }
  if (Object.keys(details).length > 0) throw errors.validation(details, 'Filter tidak valid.')

  const classId = sp.get('classId') || null
  if (classId) requireClassAccess(user, classId)

  return {
    dateFrom,
    dateTo,
    classId,
    shiftCode: sp.get('shiftCode') || null,
    statuses: rawStatuses as AttendanceStatus[],
    search: sp.get('search') || null,
    contacted: contacted === 'true' || contacted === 'false' ? contacted : null,
    includeDraft: sp.get('includeDraft') === 'true',
  }
}

function maskContact(contact: GuardianContact | null, user: AuthedUser): GuardianContact | null {
  if (!contact) return null
  return { ...contact, contactedPhone: phoneForUser(contact.contactedPhone, user) }
}

/** Semua baris tidak hadir sesuai filter (tanpa filter status/kontak bila `ignore` diminta). */
function collectAbsentees(
  user: AuthedUser,
  f: AbsenteeFilters,
  ignore: { status?: boolean; contacted?: boolean } = {},
): AbsenteeRow[] {
  const d = db()
  const scope = accessibleClassIds(user)
  const sessionStatuses = f.includeDraft ? [...VISIBLE_SESSION_STATUSES, 'DRAFT'] : VISIBLE_SESSION_STATUSES
  const sessions = new Map(
    d.studentSessions
      .filter(
        (s) =>
          s.date >= f.dateFrom &&
          s.date <= f.dateTo &&
          sessionStatuses.includes(s.status) &&
          !isDeleted('studentSessions', s.id) &&
          (!f.classId || s.classId === f.classId) &&
          (!f.shiftCode || s.shiftCode === f.shiftCode) &&
          (!scope || scope.includes(s.classId)),
      )
      .map((s) => [s.id, s]),
  )
  if (sessions.size === 0) return []

  const rows: AbsenteeRow[] = []
  for (const r of d.studentRecords) {
    const session = sessions.get(r.sessionId)
    if (!session) continue
    if (isDeleted('studentRecords', r.id)) continue
    if (!NON_PRESENT_STATUSES.includes(r.status)) continue
    if (!ignore.status && f.statuses.length > 0 && !f.statuses.includes(r.status)) continue
    if (!ignore.contacted && f.contacted !== null && (r.contact !== null) !== (f.contacted === 'true')) continue
    if (!matchesSearch(f.search, r.studentName, r.studentNis)) continue
    const student = getStudent(r.studentId)
    rows.push({
      recordId: r.id,
      sessionId: session.id,
      date: session.date,
      shiftCode: session.shiftCode,
      classId: session.classId,
      className: className(session.classId),
      studentId: r.studentId,
      studentName: r.studentName,
      studentNis: r.studentNis,
      status: r.status,
      reason: r.reason,
      note: r.note,
      guardianName: student?.guardianName ?? null,
      guardianPhone: phoneForUser(student?.guardianPhone ?? null, user),
      contact: maskContact(r.contact, user),
      sessionStatus: session.status,
    })
  }
  // Urutan buku: tanggal terbaru dulu, lalu kelas, lalu nama siswa.
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.className.localeCompare(b.className, 'id', { numeric: true }) ||
      a.studentName.localeCompare(b.studentName, 'id'),
  )
}

function requireReadAccess(user: AuthedUser) {
  // Guru pengisi absensi boleh melihat daftar kelas yang diajarnya (scoped); kontak wali tetap dimask.
  requirePermission(user, 'absentees:read', 'student_attendance:read')
}

interface ContactBody {
  contactedPhone?: string | null
  receiverName?: string | null
  contactNote?: string | null
}

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? null : undefined)

export const absenteesHandlers: HttpHandler[] = [
  http.get(apiPath('/student-attendance/absentees/summary'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requireReadAccess(user)
    const f = parseFilters(request, user)
    // Chip status mengabaikan filter status (agar tiap chip tetap menampilkan angkanya);
    // hitungan konfirmasi mengabaikan filter konfirmasi. Total = baris sesuai semua filter.
    const all = collectAbsentees(user, f, { status: true, contacted: true })
    const matchStatus = (r: AbsenteeRow) => f.statuses.length === 0 || f.statuses.includes(r.status)
    const matchContacted = (r: AbsenteeRow) =>
      f.contacted === null || (r.contact !== null) === (f.contacted === 'true')
    const byStatus = Object.fromEntries(NON_PRESENT_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>
    for (const r of all) if (matchContacted(r)) byStatus[r.status] += 1
    const statusRows = all.filter(matchStatus)
    const contacted = statusRows.filter((r) => r.contact !== null).length
    return ok({
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
      byStatus,
      total: statusRows.filter(matchContacted).length,
      contacted,
      notContacted: statusRows.length - contacted,
    })
  }),

  http.get(apiPath('/student-attendance/absentees'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requireReadAccess(user)
    const f = parseFilters(request, user)
    return paginate(collectAbsentees(user, f), request, 25)
  }),

  http.patch(apiPath('/student-attendance/records/:id/contact'), async ({ request, params }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'absentees:write')
      const d = db()
      const record = d.studentRecords.find((r) => r.id === params.id && !isDeleted('studentRecords', r.id))
      if (!record) throw errors.notFound('Record absensi tidak ditemukan.')
      const session = d.studentSessions.find((s) => s.id === record.sessionId)
      if (!session) throw errors.notFound('Sesi absensi tidak ditemukan.')
      requireClassAccess(user, session.classId)
      if (!NON_PRESENT_STATUSES.includes(record.status)) {
        throw errors.conflict('Siswa ini tercatat hadir sehingga tidak perlu konfirmasi wali. Muat ulang daftar.')
      }

      const body = await readJson<ContactBody>(request)
      const phoneProvided = Object.prototype.hasOwnProperty.call(body, 'contactedPhone')
      const phone = clean(body.contactedPhone)
      const receiverName = clean(body.receiverName)
      const contactNote = clean(body.contactNote)

      const details: Record<string, string> = {}
      if (phone === undefined) details.contactedPhone = 'invalid'
      if (receiverName === undefined) details.receiverName = 'invalid'
      if (contactNote === undefined) details.contactNote = 'invalid'
      if (phone) {
        const digits = phone.replace(/\D/g, '')
        if (!PHONE_RE.test(phone) || digits.length < 8 || digits.length > 16) {
          details.contactedPhone = 'Nomor telepon tidak valid (8–16 digit).'
        }
        if (!receiverName) details.receiverName = 'Isi pihak yang menerima informasi.'
      }
      if (!phone && !receiverName && !contactNote) {
        details.receiverName = 'Isi pihak yang menerima informasi atau keterangan.'
      }
      if (receiverName && receiverName.length > 100) details.receiverName = 'too_long'
      if (contactNote && contactNote.length > 500) details.contactNote = 'too_long'
      if (Object.keys(details).length > 0) throw errors.validation(details)

      const before = record.contact
      // Tanpa field contactedPhone (mis. user tak berhak melihat nomor) → nomor lama dipertahankan.
      const nextPhone = phoneProvided ? (phone as string | null) || null : (before?.contactedPhone ?? null)
      const contact: GuardianContact = {
        contactedPhone: nextPhone,
        receiverName: (receiverName as string | null) || null,
        contactNote: (contactNote as string | null) || null,
        contactedAt: nowTs(),
        contactedBy: user.id,
        contactedByName: user.name,
      }
      record.contact = contact
      persist()
      audit({
        user,
        action: 'UPDATE',
        entity: 'StudentAttendanceRecord',
        entityId: record.id,
        summary: `Mencatat konfirmasi wali siswa (${className(session.classId)}, ${session.date})`,
        before: { contact: before },
        after: { contact },
      })

      const student = getStudent(record.studentId)
      const row: AbsenteeRow = {
        recordId: record.id,
        sessionId: session.id,
        date: session.date,
        shiftCode: session.shiftCode,
        classId: session.classId,
        className: className(session.classId),
        studentId: record.studentId,
        studentName: record.studentName,
        studentNis: record.studentNis,
        status: record.status,
        reason: record.reason,
        note: record.note,
        guardianName: student?.guardianName ?? null,
        guardianPhone: phoneForUser(student?.guardianPhone ?? null, user),
        contact: maskContact(contact, user),
        sessionStatus: session.status,
      }
      return ok(row)
    }),
  ),
]
