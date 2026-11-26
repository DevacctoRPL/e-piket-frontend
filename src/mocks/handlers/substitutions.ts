/**
 * Mock API Jam Kosong & Penugasan Guru Piket/Pengganti pada panel Absensi Guru.
 * Mendukung slot otomatis (dari guru tidak hadir), tambah slot manual, edit, dan hapus penugasan/slot.
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import type { ID, ISODate, ManualEmptySlot, SubstitutionRecord, SubstitutionSlot } from '@/types/entities'
import { db, isDeleted, newId, persist, softDelete } from '../db'
import {
  activeSubstitutionFor,
  activeSubstitutionForManual,
  className,
  getClass,
  getTeacher,
  isTeacherAbsent,
  slotsOn,
  subjectName,
  substitutionSlotsOn,
} from '../domain'
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
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
} from '../utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXT = 500

const isISODate = (v: unknown): v is ISODate => typeof v === 'string' && ISO_DATE.test(v)

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

function int(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isInteger(n) ? n : Number.NaN
}

function findRecord(id: string) {
  const r = db().substitutions.find((x) => x.id === id && !isDeleted('substitutions', x.id))
  if (!r) throw errors.notFound('Data penugasan guru piket tidak ditemukan.')
  return r
}

function findManualSlot(id: string) {
  const m = (db().manualEmptySlots ?? []).find((x) => x.id === id && !isDeleted('manualEmptySlots', x.id))
  if (!m) throw errors.notFound('Data jam kosong manual tidak ditemukan.')
  return m
}

type ResolveSubstituteResult =
  | { ok: false; error: string }
  | { ok: true; teacherId: ID | null; teacherName: string }

function resolveSubstitute(body: {
  substituteTeacherId?: unknown
  substituteTeacherName?: unknown
}): ResolveSubstituteResult {
  const teacherId = str(body.substituteTeacherId)
  const rawName = str(body.substituteTeacherName)
  if (teacherId) {
    const t = getTeacher(teacherId)
    if (!t || isDeleted('teachers', t.id)) {
      return { ok: false, error: 'Guru tidak ditemukan.' }
    }
    return { ok: true, teacherId: t.id, teacherName: t.name }
  }
  if (!rawName) return { ok: false, error: 'Nama guru piket/pengganti wajib diisi.' }
  if (rawName.length > 120) return { ok: false, error: 'Nama terlalu panjang.' }
  const matched = db().teachers.find(
    (t) => !isDeleted('teachers', t.id) && t.name.toLowerCase() === rawName.toLowerCase(),
  )
  return { ok: true, teacherId: matched?.id ?? null, teacherName: matched?.name ?? rawName }
}

export const substitutionsHandlers: HttpHandler[] = [
  http.get(apiPath('/substitution-slots'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:read')
    const sp = searchParams(request)
    const date = sp.get('date') ?? todayISO()
    if (!isISODate(date)) return errors.validation({ date: 'invalid' }, 'Format tanggal tidak valid.')
    const q = sp.get('search')
    const items = substitutionSlotsOn(date, {
      shiftCode: sp.get('shiftCode'),
      classId: sp.get('classId'),
    })
      .filter((s) =>
        matchesSearch(
          q,
          s.className,
          s.subjectName,
          `jam ${s.periodStart}-${s.periodEnd}`,
          `jam ke ${s.periodStart} - ${s.periodEnd}`,
          s.absentTeacherName,
          s.substitution?.substituteTeacherName,
        ),
      )
      .sort(
        (a, b) =>
          (a.status === b.status ? 0 : a.status === 'UNHANDLED' ? -1 : 1) ||
          a.periodStart - b.periodStart ||
          a.className.localeCompare(b.className, 'id', { numeric: true }),
      )
    return ok(items)
  }),

  /** Tambah Jam Kosong manual (wajib disertai guru piket/pengganti). */
  http.post(apiPath('/substitution-slots/manual'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'substitution:write')
      const body = await readJson<Record<string, unknown>>(request)
      const details: Record<string, string> = {}

      const date = isISODate(body.date) ? body.date : todayISO()
      const classId = str(body.classId)
      const cls = classId ? getClass(classId) : undefined
      if (!classId) details.classId = 'Pilih kelas.'
      else if (!cls) details.classId = 'Kelas tidak ditemukan.'

      const subjectId = str(body.subjectId)
      const subjectLabel = subjectId ? subjectName(subjectId) : str(body.subjectName) ?? 'Pelajaran Umum'

      const periodStart = int(body.periodStart)
      const periodEnd = int(body.periodEnd)
      if (periodStart === undefined || Number.isNaN(periodStart) || periodStart < 1 || periodStart > 12) {
        details.periodStart = 'Jam mulai antara 1–12.'
      }
      if (periodEnd === undefined || Number.isNaN(periodEnd) || periodEnd < 1 || periodEnd > 12) {
        details.periodEnd = 'Jam selesai antara 1–12.'
      }
      if (
        !details.periodStart &&
        !details.periodEnd &&
        periodStart !== undefined &&
        periodEnd !== undefined &&
        periodEnd < periodStart
      ) {
        details.periodEnd = 'Jam selesai tidak boleh sebelum jam mulai.'
      }

      const absentTeacherId = str(body.absentTeacherId)
      const absentTeacherRaw = str(body.absentTeacherName)
      const absentTeacher = absentTeacherId ? getTeacher(absentTeacherId) : undefined
      const absentTeacherName = absentTeacher?.name ?? absentTeacherRaw ?? ''
      if (!absentTeacherName) details.absentTeacherName = 'Nama guru tidak hadir wajib diisi.'

      const subRes = resolveSubstitute({
        substituteTeacherId: body.substituteTeacherId,
        substituteTeacherName: body.substituteTeacherName,
      })
      if (!subRes.ok) details.substituteTeacherName = subRes.error

      const activity = str(body.activity)
      const note = str(body.note)
      if (activity && activity.length > MAX_TEXT) details.activity = 'too_long'
      if (note && note.length > MAX_TEXT) details.note = 'too_long'
      if (Object.keys(details).length || !subRes.ok) return errors.validation(details)

      const ps = periodStart as number
      const pe = periodEnd as number
      const periodCount = pe - ps + 1
      const shiftCode = cls!.shiftCode
      const now = nowTs()

      const manual: ManualEmptySlot = {
        id: newId('mslot'),
        date,
        shiftCode,
        classId: cls!.id,
        subjectId: subjectId ?? null,
        subjectName: subjectLabel,
        absentTeacherId: absentTeacher?.id ?? null,
        absentTeacherName,
        periodStart: ps,
        periodEnd: pe,
        periodCount,
        createdByName: user.name,
        createdAt: now,
      }
      db().manualEmptySlots ??= []
      db().manualEmptySlots.push(manual)

      const subRecord: SubstitutionRecord = {
        id: newId('subr'),
        date,
        shiftCode,
        timetableSlotId: null,
        manualSlotId: manual.id,
        classId: cls!.id,
        subjectId: subjectId ?? null,
        absentTeacherId: absentTeacher?.id ?? null,
        substituteTeacherId: subRes.teacherId,
        substituteTeacherName: subRes.teacherName,
        periodStart: ps,
        periodEnd: pe,
        periodCount,
        activity,
        note,
        status: 'ACTIVE',
        conflictOverridden: false,
        overrideReason: null,
        teachingLogId: null,
        createdByName: user.name,
        createdAt: now,
      }
      db().substitutions.push(subRecord)

      persist()
      audit({
        user,
        action: 'CREATE',
        entity: 'ManualEmptySlot',
        entityId: manual.id,
        summary: `Menambah jam kosong manual ${cls!.name} jam ke-${ps}–${pe} (${subRecord.substituteTeacherName})`,
      })

      const slot: SubstitutionSlot = {
        id: `manual:${manual.id}`,
        date: manual.date,
        shiftCode: manual.shiftCode,
        timetableSlotId: null,
        manualSlotId: manual.id,
        isManual: true,
        classId: manual.classId,
        className: cls!.name,
        subjectId: manual.subjectId,
        subjectName: manual.subjectName,
        absentTeacherId: manual.absentTeacherId,
        absentTeacherName: manual.absentTeacherName,
        absentTeacherStatus: 'ABSENT',
        periodStart: manual.periodStart,
        periodEnd: manual.periodEnd,
        periodCount: manual.periodCount,
        status: 'HANDLED',
        substitution: subRecord,
      }
      return created(slot)
    }),
  ),

  /** Edit detail jam kosong manual (kelas, jam, mapel, guru tidak hadir, serta guru piket). */
  http.patch(apiPath('/substitution-slots/manual/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    const manual = findManualSlot(String(params.id))
    const body = await readJson<Record<string, unknown>>(request)
    const details: Record<string, string> = {}

    if ('classId' in body) {
      const cid = str(body.classId)
      const cls = cid ? getClass(cid) : undefined
      if (!cls) details.classId = 'Kelas tidak ditemukan.'
      else {
        manual.classId = cls.id
        manual.shiftCode = cls.shiftCode
      }
    }
    if ('subjectId' in body || 'subjectName' in body) {
      const sid = str(body.subjectId)
      manual.subjectId = sid ?? null
      manual.subjectName = sid ? subjectName(sid) : str(body.subjectName) ?? manual.subjectName
    }
    if ('periodStart' in body || 'periodEnd' in body) {
      const ps = int(body.periodStart) ?? manual.periodStart
      const pe = int(body.periodEnd) ?? manual.periodEnd
      if (Number.isNaN(ps) || ps < 1 || ps > 12) details.periodStart = 'Jam mulai antara 1–12.'
      if (Number.isNaN(pe) || pe < 1 || pe > 12) details.periodEnd = 'Jam selesai antara 1–12.'
      if (!details.periodStart && !details.periodEnd && pe < ps) {
        details.periodEnd = 'Jam selesai tidak boleh sebelum jam mulai.'
      } else if (!details.periodStart && !details.periodEnd) {
        manual.periodStart = ps
        manual.periodEnd = pe
        manual.periodCount = pe - ps + 1
      }
    }
    if ('absentTeacherId' in body || 'absentTeacherName' in body) {
      const tid = str(body.absentTeacherId)
      const t = tid ? getTeacher(tid) : undefined
      const name = t?.name ?? str(body.absentTeacherName) ?? ''
      if (!name) details.absentTeacherName = 'Nama guru tidak hadir wajib diisi.'
      else {
        manual.absentTeacherId = t?.id ?? null
        manual.absentTeacherName = name
      }
    }
    if (Object.keys(details).length) return errors.validation(details)

    const existingSub = activeSubstitutionForManual(manual.id)
    if ('substituteTeacherName' in body || 'substituteTeacherId' in body) {
      const res = resolveSubstitute({
        substituteTeacherId: body.substituteTeacherId,
        substituteTeacherName: body.substituteTeacherName,
      })
      if (!res.ok) return errors.validation({ substituteTeacherName: res.error })
      const activity = 'activity' in body ? str(body.activity) : existingSub?.activity ?? null
      const note = 'note' in body ? str(body.note) : existingSub?.note ?? null
      if (existingSub) {
        existingSub.substituteTeacherId = res.teacherId
        existingSub.substituteTeacherName = res.teacherName
        existingSub.classId = manual.classId
        existingSub.subjectId = manual.subjectId
        existingSub.periodStart = manual.periodStart
        existingSub.periodEnd = manual.periodEnd
        existingSub.periodCount = manual.periodCount
        existingSub.activity = activity
        existingSub.note = note
      } else {
        db().substitutions.push({
          id: newId('subr'),
          date: manual.date,
          shiftCode: manual.shiftCode,
          timetableSlotId: null,
          manualSlotId: manual.id,
          classId: manual.classId,
          subjectId: manual.subjectId,
          absentTeacherId: manual.absentTeacherId,
          substituteTeacherId: res.teacherId,
          substituteTeacherName: res.teacherName,
          periodStart: manual.periodStart,
          periodEnd: manual.periodEnd,
          periodCount: manual.periodCount,
          activity,
          note,
          status: 'ACTIVE',
          conflictOverridden: false,
          overrideReason: null,
          teachingLogId: null,
          createdByName: user.name,
          createdAt: nowTs(),
        })
      }
    } else if (existingSub) {
      existingSub.classId = manual.classId
      existingSub.subjectId = manual.subjectId
      existingSub.periodStart = manual.periodStart
      existingSub.periodEnd = manual.periodEnd
      existingSub.periodCount = manual.periodCount
    }

    persist()
    const sub = activeSubstitutionForManual(manual.id) ?? null
    return ok<SubstitutionSlot>({
      id: `manual:${manual.id}`,
      date: manual.date,
      shiftCode: manual.shiftCode,
      timetableSlotId: null,
      manualSlotId: manual.id,
      isManual: true,
      classId: manual.classId,
      className: className(manual.classId),
      subjectId: manual.subjectId,
      subjectName: manual.subjectName,
      absentTeacherId: manual.absentTeacherId,
      absentTeacherName: manual.absentTeacherName,
      absentTeacherStatus: 'ABSENT',
      periodStart: manual.periodStart,
      periodEnd: manual.periodEnd,
      periodCount: manual.periodCount,
      status: sub ? 'HANDLED' : 'UNHANDLED',
      substitution: sub,
    })
  }),

  /** Hapus jam kosong manual beserta penugasannya. */
  http.delete(apiPath('/substitution-slots/manual/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    const manual = findManualSlot(String(params.id))
    const sub = activeSubstitutionForManual(manual.id)
    if (sub) sub.status = 'CANCELLED'
    softDelete('manualEmptySlots', manual.id)
    audit({
      user,
      action: 'DELETE',
      entity: 'ManualEmptySlot',
      entityId: manual.id,
      summary: `Menghapus jam kosong manual ${className(manual.classId)}`,
    })
    return noContent()
  }),

  /** Tetapkan guru piket/pengganti (pilih dari daftar guru atau ketik bebas). */
  http.post(apiPath('/substitution-records'), async ({ request }) =>
    withIdempotency(request, async () => {
      await latency()
      const user = requireAuth(request)
      requirePermission(user, 'substitution:write')
      const body = await readJson<Record<string, unknown>>(request)
      const details: Record<string, string> = {}

      const date = isISODate(body.date) ? body.date : null
      const timetableSlotId = str(body.timetableSlotId)
      const manualSlotId = str(body.manualSlotId)
      if (!date) details.date = 'required'
      if (!timetableSlotId && !manualSlotId) details.timetableSlotId = 'Pilih slot jam kosong.'

      const resolved = resolveSubstitute({
        substituteTeacherId: body.substituteTeacherId,
        substituteTeacherName: body.substituteTeacherName,
      })
      if (!resolved.ok) details.substituteTeacherName = resolved.error
      if (Object.keys(details).length || !resolved.ok) return errors.validation(details)

      const subRes = { teacherId: resolved.teacherId, teacherName: resolved.teacherName }
      const activity = str(body.activity)
      const note = str(body.note)

      if (manualSlotId) {
        const manual = findManualSlot(manualSlotId)
        const existing = activeSubstitutionForManual(manual.id)
        if (existing) {
          existing.substituteTeacherId = subRes.teacherId
          existing.substituteTeacherName = subRes.teacherName
          existing.activity = activity ?? existing.activity
          existing.note = note ?? existing.note
          persist()
          return ok(existing)
        }
        const record: SubstitutionRecord = {
          id: newId('subr'),
          date: manual.date,
          shiftCode: manual.shiftCode,
          timetableSlotId: null,
          manualSlotId: manual.id,
          classId: manual.classId,
          subjectId: manual.subjectId,
          absentTeacherId: manual.absentTeacherId,
          substituteTeacherId: subRes.teacherId,
          substituteTeacherName: subRes.teacherName,
          periodStart: manual.periodStart,
          periodEnd: manual.periodEnd,
          periodCount: manual.periodCount,
          activity,
          note,
          status: 'ACTIVE',
          conflictOverridden: false,
          overrideReason: null,
          teachingLogId: null,
          createdByName: user.name,
          createdAt: nowTs(),
        }
        db().substitutions.push(record)
        persist()
        return created(record)
      }

      const slot = slotsOn(date!).find((s) => s.id === timetableSlotId)
      if (!slot) return errors.notFound('Slot jadwal tidak ditemukan pada tanggal tersebut.')
      if (!isTeacherAbsent(slot.teacherId, date!)) {
        return errors.validation({ timetableSlotId: 'Guru terjadwal tidak berhalangan pada tanggal ini.' })
      }
      if (subRes.teacherId && subRes.teacherId === slot.teacherId) {
        return errors.validation({
          substituteTeacherName: 'Guru piket/pengganti tidak boleh sama dengan guru yang tidak hadir.',
        })
      }

      const existing = activeSubstitutionFor(date!, slot.id)
      if (existing) {
        existing.substituteTeacherId = subRes.teacherId
        existing.substituteTeacherName = subRes.teacherName
        existing.activity = activity ?? existing.activity
        existing.note = note ?? existing.note
        persist()
        return ok(existing)
      }

      const record: SubstitutionRecord = {
        id: newId('subr'),
        date: date!,
        shiftCode: slot.shiftCode,
        timetableSlotId: slot.id,
        manualSlotId: null,
        classId: slot.classId,
        subjectId: slot.subjectId,
        absentTeacherId: slot.teacherId,
        substituteTeacherId: subRes.teacherId,
        substituteTeacherName: subRes.teacherName,
        periodStart: slot.periodStart,
        periodEnd: slot.periodEnd,
        periodCount: slot.periodCount,
        activity,
        note,
        status: 'ACTIVE',
        conflictOverridden: false,
        overrideReason: null,
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
        summary: `Menugaskan ${record.substituteTeacherName} pada jam kosong ${className(record.classId)}`,
      })
      return created(record)
    }),
  ),

  /** Edit guru piket / kegiatan pada penugasan yang sudah ada. */
  http.patch(apiPath('/substitution-records/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    const record = findRecord(String(params.id))
    if (record.status === 'CANCELLED') {
      return errors.conflict('Penugasan ini sudah dihapus.')
    }
    const body = await readJson<Record<string, unknown>>(request)
    if ('substituteTeacherName' in body || 'substituteTeacherId' in body) {
      const res = resolveSubstitute({
        substituteTeacherId: body.substituteTeacherId,
        substituteTeacherName: body.substituteTeacherName,
      })
      if (!res.ok) return errors.validation({ substituteTeacherName: res.error })
      if (res.teacherId && record.absentTeacherId && res.teacherId === record.absentTeacherId) {
        return errors.validation({
          substituteTeacherName: 'Guru piket/pengganti tidak boleh sama dengan guru yang tidak hadir.',
        })
      }
      record.substituteTeacherId = res.teacherId
      record.substituteTeacherName = res.teacherName
    }
    if ('activity' in body) record.activity = str(body.activity)
    if ('note' in body) record.note = str(body.note)
    persist()
    audit({
      user,
      action: 'UPDATE',
      entity: 'SubstitutionRecord',
      entityId: record.id,
      summary: `Memperbarui guru piket ${className(record.classId)} menjadi ${record.substituteTeacherName}`,
    })
    return ok(record)
  }),

  /** Hapus penugasan guru piket (slot otomatis kembali Belum ditugaskan). */
  http.delete(apiPath('/substitution-records/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'substitution:write')
    const record = findRecord(String(params.id))
    record.status = 'CANCELLED'
    persist()
    audit({
      user,
      action: 'DELETE',
      entity: 'SubstitutionRecord',
      entityId: record.id,
      summary: `Menghapus penugasan ${record.substituteTeacherName} di ${className(record.classId)}`,
    })
    return noContent()
  }),
]
