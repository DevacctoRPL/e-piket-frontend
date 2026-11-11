/**
 * Mock API Agenda Guru Piket (PRD §6.6 FR-DUTY-02..06, §9.3, AC-11).
 *
 * - Agenda unik per tanggal + shift.
 * - Agenda non-FINAL: field turunan (petugas, jumlah guru terjadwal/hadir, guru tidak hadir) dihitung ulang
 *   setiap dibaca dari absensi guru + jam kosong. Agenda FINAL = snapshot beku.
 * - Hanya petugas piket yang ditugaskan (atau pemegang duty_agenda:correct) yang boleh mengisi.
 * - Perubahan agenda FINAL memerlukan duty_agenda:correct + alasan → audit CORRECT.
 */
import { http, type HttpHandler } from 'msw'
import { isAdminLike } from '@/lib/permissions'
import { dateOf, todayISO } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES } from '@/lib/enums'
import type {
  DutyAbsentTeacherRow,
  DutyAgenda,
  DutyNote,
  ISODate,
  RecordStatus,
  ShiftCode,
} from '@/types/entities'
import { db, isDeleted, newId, persist, softDelete } from '../db'
import {
  dutyTeacherIds,
  handledPeriodsFor,
  isDutyTeacher,
  scheduledTeacherIds,
  teacherAttendanceOn,
  teacherName,
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
  paginate,
  pick,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'

const ENTITY = 'DutyAgenda'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/
const MAX_SUMMARY = 2000
const MAX_NOTE = 1000

/* ------------------------------------------------------------------ derivation */

const shiftName = (code: ShiftCode) => db().shifts.find((s) => s.code === code)?.name ?? code

function deriveAbsentRows(date: ISODate, shiftCode: ShiftCode): DutyAbsentTeacherRow[] {
  const rows: DutyAbsentTeacherRow[] = []
  for (const tid of scheduledTeacherIds(date, shiftCode)) {
    const att = teacherAttendanceOn(tid, date)
    if (!att || !TEACHER_ABSENT_STATUSES.includes(att.status)) continue
    rows.push({
      teacherId: tid,
      teacherName: att.teacherName || teacherName(tid),
      status: att.status,
      reason: att.reason?.trim() ? att.reason : null,
      affectedPeriods: att.affectedPeriodsOverride ?? att.affectedPeriods,
      handledPeriods: handledPeriodsFor(tid, date),
    })
  }
  return rows.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'id'))
}

/** Field turunan dari konteks hari itu (dipakai untuk preview, agenda non-final, dan snapshot finalisasi). */
function deriveFields(date: ISODate, shiftCode: ShiftCode) {
  const scheduled = scheduledTeacherIds(date, shiftCode)
  const officers = dutyTeacherIds(date, shiftCode)
  const presentTeacherCount = scheduled.filter((tid) => {
    const st = teacherAttendanceOn(tid, date)?.status
    return st === 'PRESENT' || st === 'LATE'
  }).length
  return {
    dutyTeacherIds: officers,
    dutyTeacherNames: officers.map(teacherName),
    scheduledTeacherCount: scheduled.length,
    presentTeacherCount,
    absentTeachers: deriveAbsentRows(date, shiftCode),
  }
}

const activeNotes = (notes: DutyNote[]) =>
  notes
    .filter((n) => !isDeleted('dutyNotes', n.id))
    .sort((a, b) => a.time.localeCompare(b.time))

/** Bentuk agenda untuk response: non-final dihitung ulang, final apa adanya. */
function view(a: DutyAgenda): DutyAgenda {
  const base = { ...a, notes: activeNotes(a.notes) }
  if (a.status === 'FINAL') return base
  return { ...base, ...deriveFields(a.date, a.shiftCode) }
}

function findAgenda(id: unknown): DutyAgenda {
  const a = db().dutyAgendas.find((x) => x.id === id && !isDeleted('dutyAgendas', x.id))
  if (!a) throw errors.notFound('Agenda piket tidak ditemukan.')
  return a
}

function findByDateShift(date: ISODate, shiftCode: ShiftCode) {
  return db().dutyAgendas.find(
    (x) => x.date === date && x.shiftCode === shiftCode && !isDeleted('dutyAgendas', x.id),
  )
}

/* ------------------------------------------------------------------ authorization */

const isAdmin = (user: AuthedUser) => isAdminLike(user)

/** Boleh membuat agenda: petugas piket yang ditugaskan pada tanggal/shift, atau admin. */
function canCreate(user: AuthedUser, date: ISODate, shiftCode: ShiftCode) {
  if (isAdmin(user)) return true
  return can(user, 'duty_agenda:write') && isDutyTeacher(user.teacherId, date, shiftCode)
}

/** Boleh mengisi agenda: petugas piket agenda tersebut, atau pemegang hak koreksi. */
function canEditAgenda(user: AuthedUser, a: DutyAgenda) {
  // agenda final hanya dapat dikoreksi pemegang hak koreksi (admin/pimpinan)
  if (a.status === 'FINAL') return can(user, 'duty_agenda:correct')
  if (isAdmin(user)) return true
  if (!can(user, 'duty_agenda:write') || !user.teacherId) return false
  return (
    dutyTeacherIds(a.date, a.shiftCode).includes(user.teacherId) ||
    a.dutyTeacherIds.includes(user.teacherId)
  )
}

/**
 * Pastikan agenda boleh diubah. Mengembalikan alasan koreksi bila agenda FINAL (wajib audit CORRECT).
 * FINAL tanpa alasan → 409 ALREADY_FINAL; dengan alasan tapi tanpa hak koreksi → 403.
 */
function assertWritable(user: AuthedUser, a: DutyAgenda, correctionReason: unknown): string | null {
  requirePermission(user, 'duty_agenda:write', 'duty_agenda:correct')
  if (a.status !== 'FINAL') {
    if (!canEditAgenda(user, a)) {
      throw errors.forbidden('Hanya petugas piket yang ditugaskan yang dapat mengisi agenda ini.')
    }
    return null
  }
  const reason = typeof correctionReason === 'string' ? correctionReason.trim() : ''
  if (!reason) throw errors.alreadyFinal()
  if (!canEditAgenda(user, a)) {
    throw errors.forbidden('Koreksi agenda final memerlukan hak koreksi.')
  }
  if (reason.length < 3) throw errors.validation({ correctionReason: 'Alasan koreksi minimal 3 karakter.' })
  return reason
}

/* ------------------------------------------------------------------ completeness (§9.3) */

export function agendaCompletenessErrors(a: DutyAgenda): Record<string, string> {
  const details: Record<string, string> = {}
  if (a.dutyTeacherIds.length === 0) details.dutyTeacherIds = 'Petugas piket belum ditetapkan untuk tanggal/shift ini.'
  if (a.absentTeachers.length === 0 && !a.noAbsentTeachers) {
    details.absentTeachers = 'Daftar guru tidak hadir kosong. Catat guru yang tidak hadir atau tandai "Tidak ada guru yang tidak hadir".'
  }
  a.absentTeachers.forEach((row, i) => {
    if (!row.reason?.trim()) details[`absentTeachers.${i}.reason`] = `Alasan ketidakhadiran ${row.teacherName} belum diisi.`
  })
  if (a.notes.length === 0 && !a.noImportantNotes) {
    details.notes = 'Tambahkan minimal satu catatan hal penting atau tandai "Tidak ada catatan".'
  }
  return details
}

/* ------------------------------------------------------------------ helpers */

function bump(a: DutyAgenda) {
  a.version += 1
  persist()
}

interface PatchBody {
  noAbsentTeachers?: unknown
  noImportantNotes?: unknown
  substitutionSummary?: unknown
  version?: unknown
  correctionReason?: unknown
  refreshSnapshot?: unknown
}

interface NoteBody {
  time?: unknown
  category?: unknown
  content?: unknown
  correctionReason?: unknown
}

function parseNote(body: NoteBody, a: DutyAgenda) {
  const details: Record<string, string> = {}
  const time = typeof body.time === 'string' ? body.time : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const rawCategory = typeof body.category === 'string' ? body.category.trim() : ''
  if (!time) details.time = 'required'
  else if (!TS_RE.test(time) || Number.isNaN(Date.parse(time))) details.time = 'invalid'
  else if (dateOf(time) !== a.date) details.time = 'Waktu catatan harus pada tanggal agenda.'
  if (!content) details.content = 'required'
  else if (content.length < 3) details.content = 'Uraian minimal 3 karakter.'
  else if (content.length > MAX_NOTE) details.content = 'too_long'
  const categories = db().settings.dutyNoteCategories
  if (rawCategory && !categories.includes(rawCategory)) details.category = 'Kategori tidak dikenal.'
  if (Object.keys(details).length) throw errors.validation(details)
  return { time, content, category: rawCategory || null }
}

/* ------------------------------------------------------------------ handlers */

export const dutyAgendaHandlers: HttpHandler[] = [
  /** Agenda hari ini per shift: agenda yang ada atau preview (id null) terisi dari konteks (FR-DUTY-02). */
  http.get(apiPath('/duty-agendas/today'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'duty_agenda:read')
    const shiftFilter = searchParams(request).get('shiftCode')
    const date = todayISO()
    const shifts = db().shifts.filter(
      (s) => s.isActive && !isDeleted('shifts', s.id) && (!shiftFilter || s.code === shiftFilter),
    )
    return ok(
      shifts.map((s) => {
        const existing = findByDateShift(date, s.code)
        const agenda = existing
          ? view(existing)
          : {
              id: null,
              date,
              shiftCode: s.code,
              status: 'DRAFT' as RecordStatus,
              ...deriveFields(date, s.code),
              noAbsentTeachers: false,
              notes: [],
              noImportantNotes: false,
              substitutionSummary: null,
              createdBy: '',
              createdAt: '',
              submittedAt: null,
              submittedByName: null,
              finalizedAt: null,
              finalizedByName: null,
              version: 0,
            }
        return {
          date,
          shiftCode: s.code,
          agenda,
          isDutyTeacher: isDutyTeacher(user.teacherId, date, s.code),
          canCreate: !existing && canCreate(user, date, s.code) && dutyTeacherIds(date, s.code).length > 0,
        }
      }),
    )
  }),

  http.get(apiPath('/duty-agendas'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'duty_agenda:read')
    const sp = searchParams(request)
    const date = sp.get('date')
    const from = sp.get('dateFrom')
    const to = sp.get('dateTo')
    const shiftCode = sp.get('shiftCode')
    const status = sp.get('status')
    const items = db()
      .dutyAgendas.filter(
        (a) =>
          !isDeleted('dutyAgendas', a.id) &&
          (!date || a.date === date) &&
          (!from || a.date >= from) &&
          (!to || a.date <= to) &&
          (!shiftCode || a.shiftCode === shiftCode) &&
          (!status || a.status === status),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || a.shiftCode.localeCompare(b.shiftCode) * -1)
      .map(view)
    return paginate(items, request)
  }),

  /** Buat agenda (atau kembalikan yang sudah ada — unik per tanggal + shift). */
  http.post(apiPath('/duty-agendas'), ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'duty_agenda:write', 'duty_agenda:correct')
      const body = await readJson<{ date?: unknown; shiftCode?: unknown }>(request)
      const details: Record<string, string> = {}
      const date = typeof body.date === 'string' ? body.date : ''
      const shiftCode = typeof body.shiftCode === 'string' ? body.shiftCode : ''
      if (!date) details.date = 'required'
      else if (!DATE_RE.test(date)) details.date = 'invalid'
      else if (date > todayISO()) details.date = 'Agenda tidak dapat dibuat untuk tanggal yang akan datang.'
      if (!shiftCode) details.shiftCode = 'required'
      else if (!db().shifts.some((s) => s.code === shiftCode && !isDeleted('shifts', s.id))) details.shiftCode = 'invalid'
      if (Object.keys(details).length) throw errors.validation(details)

      if (!canCreate(user, date, shiftCode)) {
        throw errors.forbidden('Anda tidak terjadwal sebagai guru piket pada tanggal dan shift ini.')
      }
      const existing = findByDateShift(date, shiftCode)
      if (existing) return ok(view(existing))

      const derived = deriveFields(date, shiftCode)
      if (derived.dutyTeacherIds.length === 0) {
        throw errors.validation(
          { dutyTeacherIds: 'Petugas piket belum ditetapkan untuk tanggal/shift ini. Hubungi admin.' },
          'Petugas piket belum ditetapkan.',
        )
      }
      const agenda: DutyAgenda = {
        id: newId('dag'),
        date,
        shiftCode,
        status: 'DRAFT',
        ...derived,
        noAbsentTeachers: false,
        notes: [],
        noImportantNotes: false,
        substitutionSummary: null,
        createdBy: user.id,
        createdAt: nowTs(),
        submittedAt: null,
        submittedByName: null,
        finalizedAt: null,
        finalizedByName: null,
        version: 1,
      }
      db().dutyAgendas.push(agenda)
      persist()
      return created(view(agenda))
    }),
  ),

  http.get(apiPath('/duty-agendas/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'duty_agenda:read')
    return ok(view(findAgenda(params.id)))
  }),

  /** Simpan draft / koreksi (FR-DUTY-05). */
  http.patch(apiPath('/duty-agendas/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findAgenda(params.id)
    const body = await readJson<PatchBody>(request)
    const reason = assertWritable(user, a, body.correctionReason)
    if (typeof body.version !== 'number') throw errors.validation({ version: 'required' })
    if (body.version !== a.version) throw errors.versionConflict()

    const current = view(a)
    const details: Record<string, string> = {}
    const patch: Partial<DutyAgenda> = {}
    if (body.noAbsentTeachers !== undefined) {
      if (typeof body.noAbsentTeachers !== 'boolean') details.noAbsentTeachers = 'invalid'
      else if (body.noAbsentTeachers && current.absentTeachers.length > 0) {
        details.noAbsentTeachers = 'Ada guru tidak hadir yang tercatat; penanda "tidak ada" tidak dapat dipakai.'
      } else patch.noAbsentTeachers = body.noAbsentTeachers
    }
    if (body.noImportantNotes !== undefined) {
      if (typeof body.noImportantNotes !== 'boolean') details.noImportantNotes = 'invalid'
      else if (body.noImportantNotes && current.notes.length > 0) {
        details.noImportantNotes = 'Sudah ada catatan; hapus catatan bila memang tidak ada hal penting.'
      } else patch.noImportantNotes = body.noImportantNotes
    }
    if (body.substitutionSummary !== undefined) {
      if (body.substitutionSummary !== null && typeof body.substitutionSummary !== 'string') {
        details.substitutionSummary = 'invalid'
      } else {
        const text = (body.substitutionSummary ?? '').trim()
        if (text.length > MAX_SUMMARY) details.substitutionSummary = 'too_long'
        else patch.substitutionSummary = text || null
      }
    }
    if (Object.keys(details).length) throw errors.validation(details)

    const keys = Object.keys(patch) as (keyof DutyAgenda)[]
    const before = pick(a, keys)
    Object.assign(a, patch)
    if (reason && body.refreshSnapshot === true) {
      // koreksi: perbarui snapshot dari data absensi guru/jam kosong terbaru
      const snapBefore = pick(a, ['scheduledTeacherCount', 'presentTeacherCount', 'absentTeachers'])
      Object.assign(a, deriveFields(a.date, a.shiftCode))
      Object.assign(before, snapBefore)
      keys.push('scheduledTeacherCount', 'presentTeacherCount', 'absentTeachers')
    }
    bump(a)
    if (reason) {
      audit({
        user,
        action: 'CORRECT',
        entity: ENTITY,
        entityId: a.id,
        summary: `Koreksi agenda piket shift ${shiftName(a.shiftCode)} ${a.date}`,
        before,
        after: pick(a, keys),
        reason,
      })
    }
    return ok(view(a))
  }),

  /** Catatan hal penting/kejadian (FR-DUTY-04). */
  http.post(apiPath('/duty-agendas/:id/notes'), ({ request, params }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      const a = findAgenda(params.id)
      const body = await readJson<NoteBody>(request)
      const reason = assertWritable(user, a, body.correctionReason)
      const parsed = parseNote(body, a)
      const note: DutyNote = { id: newId('dn'), ...parsed, createdBy: user.id, createdByName: user.name }
      a.notes.push(note)
      a.noImportantNotes = false
      bump(a)
      if (reason) {
        audit({
          user,
          action: 'CORRECT',
          entity: ENTITY,
          entityId: a.id,
          summary: `Koreksi agenda piket: tambah catatan (${a.date})`,
          before: null,
          after: { note },
          reason,
        })
      }
      return created(view(a))
    }),
  ),

  http.patch(apiPath('/duty-agendas/:id/notes/:noteId'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findAgenda(params.id)
    const note = a.notes.find((n) => n.id === params.noteId && !isDeleted('dutyNotes', n.id))
    if (!note) throw errors.notFound('Catatan tidak ditemukan.')
    const body = await readJson<NoteBody>(request)
    const reason = assertWritable(user, a, body.correctionReason)
    const parsed = parseNote(body, a)
    const before = pick(note, ['time', 'category', 'content'])
    Object.assign(note, parsed)
    bump(a)
    if (reason) {
      audit({
        user,
        action: 'CORRECT',
        entity: ENTITY,
        entityId: a.id,
        summary: `Koreksi agenda piket: ubah catatan (${a.date})`,
        before,
        after: pick(note, ['time', 'category', 'content']),
        reason,
      })
    }
    return ok(view(a))
  }),

  http.delete(apiPath('/duty-agendas/:id/notes/:noteId'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const a = findAgenda(params.id)
    const note = a.notes.find((n) => n.id === params.noteId && !isDeleted('dutyNotes', n.id))
    if (!note) throw errors.notFound('Catatan tidak ditemukan.')
    const text = await request.text()
    let body: NoteBody = {}
    try {
      body = text ? (JSON.parse(text) as NoteBody) : {}
    } catch {
      body = {}
    }
    const reason = assertWritable(user, a, body.correctionReason)
    softDelete('dutyNotes', note.id)
    bump(a)
    audit({
      user,
      action: reason ? 'CORRECT' : 'DELETE',
      entity: ENTITY,
      entityId: a.id,
      summary: `${reason ? 'Koreksi agenda piket: hapus' : 'Hapus'} catatan agenda piket (${a.date})`,
      before: { note: pick(note, ['id', 'time', 'category', 'content']) },
      after: null,
      reason,
    })
    return ok(view(a))
  }),

  /** Kirim / finalisasi (FR-DUTY-05, §9.3, AC-11). */
  http.post(apiPath('/duty-agendas/:id/submit'), ({ request, params }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'duty_agenda:write', 'duty_agenda:correct')
      const a = findAgenda(params.id)
      if (a.status === 'FINAL') throw errors.alreadyFinal()
      if (!canEditAgenda(user, a)) {
        throw errors.forbidden('Hanya petugas piket yang ditugaskan yang dapat mengirim agenda ini.')
      }
      const body = await readJson<{ final?: unknown; version?: unknown }>(request)
      if (typeof body.version === 'number' && body.version !== a.version) throw errors.versionConflict()
      const final = body.final === true

      const current = view(a)
      const details = agendaCompletenessErrors(current)
      if (Object.keys(details).length) {
        throw errors.validation(details, 'Agenda belum lengkap. Lengkapi bagian yang ditandai sebelum dikirim.')
      }

      const before = { status: a.status }
      const ts = nowTs()
      if (a.status === 'DRAFT') {
        a.status = 'SUBMITTED'
        a.submittedAt = ts
        a.submittedByName = user.name
        if (!final) {
          audit({
            user,
            action: 'SUBMIT',
            entity: ENTITY,
            entityId: a.id,
            summary: `Kirim agenda piket shift ${shiftName(a.shiftCode)} ${a.date}`,
            before,
            after: { status: 'SUBMITTED' },
          })
        }
      } else if (!final) {
        return ok(current) // sudah dikirim; tidak ada perubahan
      }
      if (final) {
        // snapshot field turunan saat finalisasi
        Object.assign(a, deriveFields(a.date, a.shiftCode), {
          notes: activeNotes(a.notes),
          status: 'FINAL' as RecordStatus,
          finalizedAt: ts,
          finalizedByName: user.name,
        })
        audit({
          user,
          action: 'FINALIZE',
          entity: ENTITY,
          entityId: a.id,
          summary: `Finalisasi agenda piket shift ${shiftName(a.shiftCode)} ${a.date}`,
          before,
          after: { status: 'FINAL' },
        })
      }
      bump(a)
      return ok(view(a))
    }),
  ),
]

