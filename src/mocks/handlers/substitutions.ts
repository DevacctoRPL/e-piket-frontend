/**
 * Mock API jam kosong / guru pengganti (PRD §6.8 FR-SUB-01..04, §7.5, §9.2, §9.3, AC-09).
 * Meniru aturan backend Go: slot jam kosong diturunkan dari jadwal aktif + absensi guru,
 * konflik jadwal divalidasi sebelum simpan, override hanya untuk admin/guru piket dengan alasan.
 */
import { http, type HttpHandler } from 'msw'
import { ADMIN_ROLES, hasRole } from '@/lib/permissions'
import { addDays, dateRange, todayISO } from '@/lib/date'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import type {
  ID,
  ISODate,
  SubstituteCandidate,
  SubstitutionConflict,
  SubstitutionRecord,
  TimetableSlot,
} from '@/types/entities'
import { db, isDeleted, newId, persist } from '../db'
import {
  activeSubstitutionFor,
  className,
  getTeacher,
  isTeacherAbsent,
  scheduledPeriods,
  slotsOn,
  subjectName,
  substitutionSlotsOn,
  summarizeSlots,
  teacherAttendanceOn,
  teacherBusy,
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

/* ------------------------------------------------------------------ helpers */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXT = 500
const MAX_RANGE_DAYS = 366
const SUB_STATUSES = ['UNHANDLED', 'HANDLED'] as const

const isISODate = (v: unknown): v is ISODate => typeof v === 'string' && ISO_DATE.test(v)

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

/** undefined/null → undefined (pakai default); selain integer → NaN (invalid). */
function int(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isInteger(n) ? n : Number.NaN
}

function periodRangeLabel(start: number, end: number) {
  return start === end ? `jam ke-${start}` : `jam ke-${start}–${end}`
}

/** Hanya admin dan guru piket yang boleh mengabaikan konflik jadwal (PRD §7.5.3 "override berizin"). */
function canOverride(user: AuthedUser) {
  return (
    can(user, 'substitution:write') &&
    hasRole(user, ...ADMIN_ROLES, 'DUTY_TEACHER')
  )
}

/** slotId = `${date}:${timetableSlotId}` (tanggal tidak mengandung titik dua). */
function parseSlotId(raw: string): { date: ISODate; timetableSlotId: ID } | null {
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    /* biarkan apa adanya */
  }
  const idx = value.indexOf(':')
  if (idx < 0) return null
  const date = value.slice(0, idx)
  const timetableSlotId = value.slice(idx + 1)
  if (!isISODate(date) || !timetableSlotId) return null
  return { date, timetableSlotId }
}

/**
 * Pastikan slot jadwal benar-benar jam kosong pada tanggal itu (guru terjadwal berhalangan).
 * Melempar 404 bila slot tidak ada pada hari itu, 422 bila gurunya tidak berhalangan.
 */
function requireJamKosong(date: ISODate, timetableSlotId: ID): TimetableSlot {
  const slot = slotsOn(date).find((s) => s.id === timetableSlotId)
  if (!slot) throw errors.notFound('Slot jadwal tidak ditemukan pada tanggal tersebut.')
  if (!isTeacherAbsent(slot.teacherId, date)) {
    throw errors.validation(
      { timetableSlotId: 'Guru terjadwal tidak berhalangan; slot ini bukan jam kosong.' },
      'Slot ini bukan jam kosong.',
    )
  }
  return slot
}

/** Konflik calon pengganti untuk rentang periode slot (TEACHER_BUSY / TEACHER_ABSENT). */
function conflictsFor(
  teacherId: ID,
  date: ISODate,
  slot: TimetableSlot,
  periodStart: number,
  periodEnd: number,
): SubstitutionConflict[] {
  const out: SubstitutionConflict[] = []
  if (isTeacherAbsent(teacherId, date)) {
    const st = teacherAttendanceOn(teacherId, date)?.status
    out.push({
      type: 'TEACHER_ABSENT',
      message: `Guru berhalangan hadir hari ini${st ? ` (${TEACHER_ATTENDANCE_META[st].label})` : ''}.`,
    })
  }
  const busy = teacherBusy(teacherId, date, slot.shiftCode, periodStart, periodEnd, slot.id)
  if (busy.ownSlot) {
    const s = busy.ownSlot
    out.push({
      type: 'TEACHER_BUSY',
      message: `Sedang mengajar ${className(s.classId)} (${subjectName(s.subjectId)}) ${periodRangeLabel(s.periodStart, s.periodEnd)}.`,
      timetableSlotId: s.id,
    })
  }
  if (busy.substitution) {
    const r = busy.substitution
    out.push({
      type: 'TEACHER_BUSY',
      message: `Sudah menjadi guru pengganti di ${className(r.classId)} (${subjectName(r.subjectId)}) ${periodRangeLabel(r.periodStart, r.periodEnd)}.`,
      timetableSlotId: r.timetableSlotId,
    })
  }
  return out
}

/** Total jam mengajar guru pada hari itu: jadwal asli + tugas pengganti aktif. */
function loadPeriods(teacherId: ID, date: ISODate) {
  const subs = db()
    .substitutions.filter(
      (r) => r.date === date && r.status === 'ACTIVE' && r.substituteTeacherId === teacherId,
    )
    .reduce((n, r) => n + r.periodCount, 0)
  return scheduledPeriods(teacherId, date) + subs
}

function conflictDetails(conflicts: SubstitutionConflict[]) {
  const details: Record<string, string> = {}
  conflicts.forEach((c, i) => {
    details[`conflicts.${i}.type`] = c.type
    details[`conflicts.${i}.message`] = c.message
    if (c.timetableSlotId) details[`conflicts.${i}.timetableSlotId`] = c.timetableSlotId
  })
  return details
}

function findRecord(id: string) {
  const r = db().substitutions.find((x) => x.id === id && !isDeleted('substitutions', x.id))
  if (!r) throw errors.notFound('Data guru pengganti tidak ditemukan.')
  return r
}

const AUDIT_FIELDS: (keyof SubstitutionRecord)[] = [
  'date',
  'shiftCode',
  'timetableSlotId',
  'classId',
  'subjectId',
  'absentTeacherId',
  'substituteTeacherId',
  'periodStart',
  'periodEnd',
  'periodCount',
  'activity',
  'note',
  'status',
  'conflictOverridden',
]

function dateWindow(sp: URLSearchParams, defaultBackDays: number) {
  const date = sp.get('date')
  const from = date ?? sp.get('dateFrom') ?? addDays(todayISO(), -defaultBackDays)
  const to = date ?? sp.get('dateTo') ?? todayISO()
  const details: Record<string, string> = {}
  if (!isISODate(from)) details[date ? 'date' : 'dateFrom'] = 'invalid'
  if (!isISODate(to)) details[date ? 'date' : 'dateTo'] = 'invalid'
  if (Object.keys(details).length) throw errors.validation(details, 'Format tanggal tidak valid.')
  if (from > to) {
    throw errors.validation({ dateTo: 'Tanggal akhir tidak boleh sebelum tanggal awal.' })
  }
  if (dateRange(from, to).length > MAX_RANGE_DAYS) {
    throw errors.validation({ dateTo: 'Rentang tanggal maksimal satu tahun.' })
  }
  return { from, to }
}

/* ------------------------------------------------------------------ request bodies */

interface CreateBody {
  date?: unknown
  timetableSlotId?: unknown
  substituteTeacherId?: unknown
  periodStart?: unknown
  periodEnd?: unknown
  periodCount?: unknown
  activity?: unknown
  note?: unknown
  overrideConflict?: unknown
  overrideReason?: unknown
}

interface UpdateBody {
  activity?: unknown
  note?: unknown
  periodCount?: unknown
}

/* ------------------------------------------------------------------ handlers */

export const substitutionsHandlers: HttpHandler[] = [
  /** FR-SUB-01: daftar slot jam kosong. */
  http.get(apiPath('/substitution-slots'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:read')
    const sp = searchParams(request)
    const date = sp.get('date') ?? todayISO()
    if (!isISODate(date)) return errors.validation({ date: 'invalid' }, 'Format tanggal tidak valid.')
    const status = sp.get('status')
    if (status && !SUB_STATUSES.includes(status as (typeof SUB_STATUSES)[number])) {
      return errors.validation({ status: 'invalid' })
    }
    const items = substitutionSlotsOn(date, {
      shiftCode: sp.get('shiftCode'),
      classId: sp.get('classId'),
    })
      .filter((s) => !status || s.status === status)
      .sort(
        (a, b) =>
          (a.status === b.status ? 0 : a.status === 'UNHANDLED' ? -1 : 1) ||
          a.shiftCode.localeCompare(b.shiftCode) ||
          a.periodStart - b.periodStart ||
          a.className.localeCompare(b.className, 'id'),
      )
    return ok(items)
  }),

  /** FR-SUB-04: ringkasan jam terdampak / digantikan / belum tertangani — dari slot yang sama. */
  http.get(apiPath('/substitution-slots/summary'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:read')
    const sp = searchParams(request)
    const { from, to } = dateWindow(sp, 0)
    const filter = { shiftCode: sp.get('shiftCode'), classId: sp.get('classId') }
    const slots = dateRange(from, to).flatMap((d) => substitutionSlotsOn(d, filter))
    return ok(summarizeSlots(slots))
  }),

  /** Kandidat guru pengganti + konflik jadwal (PRD §9.3: konflik diperlihatkan sebelum simpan). */
  http.get(apiPath('/substitution-slots/:slotId/candidates'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:read')
    const parsed = parseSlotId(String(params.slotId ?? ''))
    if (!parsed) return errors.notFound('Slot jam kosong tidak ditemukan.')
    const slot = requireJamKosong(parsed.date, parsed.timetableSlotId)
    const sp = searchParams(request)
    const ps = int(sp.get('periodStart')) ?? slot.periodStart
    const pe = int(sp.get('periodEnd')) ?? slot.periodEnd
    if (Number.isNaN(ps) || Number.isNaN(pe) || ps < slot.periodStart || pe > slot.periodEnd || ps > pe) {
      return errors.validation({
        periodStart: `Periode harus berada dalam ${periodRangeLabel(slot.periodStart, slot.periodEnd)}.`,
      })
    }
    const candidates: SubstituteCandidate[] = db()
      .teachers.filter(
        (t) => t.status === 'ACTIVE' && !isDeleted('teachers', t.id) && t.id !== slot.teacherId,
      )
      .map((t) => ({
        teacher: { id: t.id, nip: t.nip, name: t.name, subjectIds: t.subjectIds },
        teachesSameSubject: t.subjectIds.includes(slot.subjectId),
        conflicts: conflictsFor(t.id, parsed.date, slot, ps, pe),
        loadPeriods: loadPeriods(t.id, parsed.date),
      }))
    const rank = (c: SubstituteCandidate) =>
      c.conflicts.some((x) => x.type === 'TEACHER_ABSENT') ? 2 : c.conflicts.length ? 1 : 0
    candidates.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.teachesSameSubject) - Number(a.teachesSameSubject) ||
        a.loadPeriods - b.loadPeriods ||
        a.teacher.name.localeCompare(b.teacher.name, 'id'),
    )
    return ok(candidates)
  }),

  /** FR-SUB-02/03, AC-09: tetapkan guru pengganti. */
  http.post(apiPath('/substitution-records'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    return withIdempotency(request, async () => {
      const body = await readJson<CreateBody>(request)
      const details: Record<string, string> = {}
      const date = isISODate(body.date) ? body.date : null
      const timetableSlotId = str(body.timetableSlotId)
      const substituteTeacherId = str(body.substituteTeacherId)
      if (!date) details.date = body.date ? 'invalid' : 'required'
      if (!timetableSlotId) details.timetableSlotId = 'required'
      if (!substituteTeacherId) details.substituteTeacherId = 'required'
      if (!date || !timetableSlotId || !substituteTeacherId) return errors.validation(details)

      const slot = requireJamKosong(date, timetableSlotId)
      if (activeSubstitutionFor(date, slot.id)) {
        return errors.conflict(
          'Slot ini sudah memiliki guru pengganti. Muat ulang untuk melihat data terbaru.',
          'SLOT_ALREADY_HANDLED',
        )
      }

      const teacher = getTeacher(substituteTeacherId)
      if (!teacher || teacher.status !== 'ACTIVE' || isDeleted('teachers', teacher.id)) {
        details.substituteTeacherId = 'Guru tidak ditemukan atau berstatus nonaktif.'
      } else if (teacher.id === slot.teacherId) {
        details.substituteTeacherId = 'Guru pengganti tidak boleh sama dengan guru yang berhalangan.'
      }

      const ps = int(body.periodStart) ?? slot.periodStart
      const pe = int(body.periodEnd) ?? slot.periodEnd
      const rangeOk =
        !Number.isNaN(ps) && !Number.isNaN(pe) && ps >= slot.periodStart && pe <= slot.periodEnd && ps <= pe
      if (!rangeOk) {
        const msg = `Periode harus berada dalam ${periodRangeLabel(slot.periodStart, slot.periodEnd)}.`
        details.periodStart = msg
        details.periodEnd = msg
      }
      const maxCount = rangeOk ? pe - ps + 1 : slot.periodCount
      const count = int(body.periodCount) ?? maxCount
      if (Number.isNaN(count) || count < 1) details.periodCount = 'Jumlah jam minimal 1.'
      else if (count > maxCount) details.periodCount = `Jumlah jam maksimal ${maxCount}.`

      const activity = str(body.activity)
      const note = str(body.note)
      if (activity && activity.length > MAX_TEXT) details.activity = 'too_long'
      if (note && note.length > MAX_TEXT) details.note = 'too_long'
      if (Object.keys(details).length) return errors.validation(details)

      const conflicts = conflictsFor(substituteTeacherId, date, slot, ps, pe)
      if (conflicts.some((c) => c.type === 'TEACHER_ABSENT')) {
        return errors.validation(
          { substituteTeacherId: 'Guru ini berhalangan hadir hari ini sehingga tidak dapat menjadi pengganti.' },
          'Guru pengganti berhalangan hadir.',
        )
      }
      const override = body.overrideConflict === true
      const overrideReason = str(body.overrideReason)
      if (conflicts.length && !override) {
        return errors.conflict(
          'Guru pengganti memiliki jadwal yang bentrok. Pilih guru lain atau ajukan override dengan alasan.',
          'SCHEDULE_CONFLICT',
          conflictDetails(conflicts),
        )
      }
      if (conflicts.length && override) {
        if (!canOverride(user)) {
          return errors.forbidden('Hanya admin atau guru piket yang dapat mengabaikan konflik jadwal.')
        }
        if (!overrideReason || overrideReason.length < 3) {
          return errors.validation(
            { overrideReason: 'Alasan override wajib diisi (minimal 3 karakter).' },
            'Alasan override wajib diisi.',
          )
        }
        if (overrideReason.length > MAX_TEXT) return errors.validation({ overrideReason: 'too_long' })
      }

      const record: SubstitutionRecord = {
        id: newId('subr'),
        date,
        shiftCode: slot.shiftCode,
        timetableSlotId: slot.id,
        classId: slot.classId,
        subjectId: slot.subjectId,
        absentTeacherId: slot.teacherId,
        substituteTeacherId: teacher!.id,
        substituteTeacherName: teacher!.name,
        periodStart: ps,
        periodEnd: pe,
        periodCount: count,
        activity,
        note,
        status: 'ACTIVE',
        conflictOverridden: conflicts.length > 0,
        overrideReason: conflicts.length > 0 ? overrideReason : null,
        teachingLogId: null,
        createdByName: user.name,
        createdAt: nowTs(),
      }
      db().substitutions.push(record)
      persist()
      audit({
        user,
        action: 'CREATE',
        entity: 'SubstitutionRecord',
        entityId: record.id,
        summary: `Menetapkan ${record.substituteTeacherName} sebagai guru pengganti ${className(record.classId)} ${periodRangeLabel(ps, pe)}${record.conflictOverridden ? ' (override konflik jadwal)' : ''}`,
        after: pick(record, AUDIT_FIELDS),
        reason: record.overrideReason,
      })
      return created(record)
    })
  }),

  /** Riwayat penugasan guru pengganti. */
  http.get(apiPath('/substitution-records'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:read')
    const sp = searchParams(request)
    const { from, to } = dateWindow(sp, 30)
    const classId = sp.get('classId')
    const teacherId = sp.get('teacherId')
    const status = sp.get('status')
    const items = db()
      .substitutions.filter(
        (r) =>
          !isDeleted('substitutions', r.id) &&
          r.date >= from &&
          r.date <= to &&
          (!classId || r.classId === classId) &&
          (!teacherId || r.substituteTeacherId === teacherId || r.absentTeacherId === teacherId) &&
          (!status || r.status === status),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          a.shiftCode.localeCompare(b.shiftCode) ||
          a.periodStart - b.periodStart ||
          className(a.classId).localeCompare(className(b.classId), 'id'),
      )
    return paginate(items, request)
  }),

  /** Ubah kegiatan/catatan (piket atau guru pengganti sendiri) dan jumlah jam (piket/admin). */
  http.patch(apiPath('/substitution-records/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const record = findRecord(String(params.id))
    const isWriter = can(user, 'substitution:write')
    const isSelf = !!user.teacherId && user.teacherId === record.substituteTeacherId
    if (!isWriter && !isSelf) throw errors.forbidden()
    if (record.status === 'CANCELLED') {
      return errors.conflict('Penugasan guru pengganti ini sudah dibatalkan.', 'CONFLICT')
    }
    const body = await readJson<UpdateBody>(request)
    const details: Record<string, string> = {}
    const next = { ...record }
    if ('activity' in body) {
      const v = str(body.activity)
      if (v && v.length > MAX_TEXT) details.activity = 'too_long'
      next.activity = v
    }
    if ('note' in body) {
      const v = str(body.note)
      if (v && v.length > MAX_TEXT) details.note = 'too_long'
      next.note = v
    }
    if ('periodCount' in body && body.periodCount !== undefined) {
      if (!isWriter) throw errors.forbidden('Jumlah jam hanya dapat diubah oleh guru piket atau admin.')
      const max = record.periodEnd - record.periodStart + 1
      const n = int(body.periodCount)
      if (n === undefined || Number.isNaN(n) || n < 1) details.periodCount = 'Jumlah jam minimal 1.'
      else if (n > max) details.periodCount = `Jumlah jam maksimal ${max}.`
      else next.periodCount = n
    }
    if (Object.keys(details).length) return errors.validation(details)
    const before = pick(record, ['activity', 'note', 'periodCount'])
    Object.assign(record, next)
    persist()
    audit({
      user,
      action: 'UPDATE',
      entity: 'SubstitutionRecord',
      entityId: record.id,
      summary: `Memperbarui catatan guru pengganti ${className(record.classId)} ${periodRangeLabel(record.periodStart, record.periodEnd)}`,
      before,
      after: pick(record, ['activity', 'note', 'periodCount']),
    })
    return ok(record)
  }),

  /** Batalkan penugasan → slot kembali Belum Tertangani (PRD §9.2). Soft: record tetap tersimpan. */
  http.post(apiPath('/substitution-records/:id/cancel'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    const record = findRecord(String(params.id))
    const body = await readJson<{ reason?: unknown }>(request)
    const reason = str(body.reason)
    if (!reason || reason.length < 3) {
      return errors.validation({ reason: 'Alasan pembatalan wajib diisi (minimal 3 karakter).' })
    }
    if (reason.length > MAX_TEXT) return errors.validation({ reason: 'too_long' })
    if (record.status === 'CANCELLED') {
      return errors.conflict('Penugasan guru pengganti ini sudah dibatalkan.', 'CONFLICT')
    }
    const before = pick(record, AUDIT_FIELDS)
    record.status = 'CANCELLED'
    persist()
    audit({
      user,
      action: 'CANCEL',
      entity: 'SubstitutionRecord',
      entityId: record.id,
      summary: `Membatalkan ${record.substituteTeacherName} sebagai guru pengganti ${className(record.classId)} ${periodRangeLabel(record.periodStart, record.periodEnd)}`,
      before,
      after: pick(record, AUDIT_FIELDS),
      reason,
    })
    return ok(record)
  }),
]
