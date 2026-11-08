import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { slotsOn } from '@/mocks/domain'
import { loginAs } from '@/test/utils'
import type { SubstitutionSlot } from '@/types/entities'
import { substitutionsApi } from './api'
import { conflictsFromError } from './utils'

const today = todayISO()
const ABSENT_TODAY = ['tch_4', 'tch_6', 'tch_12']

async function failure(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

async function firstUnhandled(): Promise<SubstitutionSlot> {
  const slots = await substitutionsApi.slots({ date: today, status: 'UNHANDLED' })
  const slot = slots[0]
  expect(slot).toBeDefined()
  return slot!
}

/** Guru aktif yang mengajar pada periode yang sama (shift sama) → pasti bentrok. */
function busyTeacherFor(slot: SubstitutionSlot) {
  const clash = slotsOn(today, { shiftCode: slot.shiftCode }).find(
    (s) =>
      s.teacherId !== slot.absentTeacherId &&
      !ABSENT_TODAY.includes(s.teacherId) &&
      s.periodStart <= slot.periodEnd &&
      s.periodEnd >= slot.periodStart,
  )
  expect(clash).toBeDefined()
  return clash!.teacherId
}

describe('substitution slots (FR-SUB-01, FR-SUB-04)', () => {
  it('derives slots from absent teachers in the active timetable', async () => {
    await loginAs('piket')
    const slots = await substitutionsApi.slots({ date: today })
    expect(slots.length).toBeGreaterThan(0)
    for (const s of slots) expect(ABSENT_TODAY).toContain(s.absentTeacherId)
    const expected = slotsOn(today).filter((s) => ABSENT_TODAY.includes(s.teacherId)).length
    expect(slots).toHaveLength(expected)
    // Belum tertangani diurutkan lebih dulu.
    const firstHandled = slots.findIndex((s) => s.status === 'HANDLED')
    if (firstHandled >= 0) expect(slots.slice(firstHandled).every((s) => s.status === 'HANDLED')).toBe(true)
  })

  it('summary totals are consistent with slot records', async () => {
    await loginAs('kepsek')
    const [slots, summary] = await Promise.all([
      substitutionsApi.slots({ date: today }),
      substitutionsApi.summary({ date: today }),
    ])
    const affected = slots.reduce((n, s) => n + s.periodCount, 0)
    const handled = slots.reduce((n, s) => n + (s.substitution?.periodCount ?? 0), 0)
    expect(summary.affectedPeriods).toBe(affected)
    expect(summary.handledPeriods).toBe(handled)
    expect(summary.unhandledPeriods).toBe(affected - handled)
    expect(summary.affectedSlots).toBe(slots.length)
    expect(summary.handledSlots + summary.unhandledSlots).toBe(summary.affectedSlots)
    expect(summary.handledSlots).toBe(slots.filter((s) => s.status === 'HANDLED').length)
  })

  it('rejects an invalid date with 422', async () => {
    await loginAs('piket')
    const e = await failure(substitutionsApi.slots({ date: '08-11-2026' }))
    expect(e.status).toBe(422)
    expect(e.details.date).toBe('invalid')
  })
})

describe('candidates', () => {
  it('excludes the absent teacher and lists conflicts with reasons', async () => {
    await loginAs('piket')
    const slot = await firstUnhandled()
    const candidates = await substitutionsApi.candidates(slot.id, {})
    expect(candidates.find((c) => c.teacher.id === slot.absentTeacherId)).toBeUndefined()
    const busyId = busyTeacherFor(slot)
    const busy = candidates.find((c) => c.teacher.id === busyId)
    expect(busy?.conflicts.some((c) => c.type === 'TEACHER_BUSY' && /Sedang mengajar/.test(c.message))).toBe(true)
    const otherAbsent = ABSENT_TODAY.find((id) => id !== slot.absentTeacherId)!
    expect(candidates.find((c) => c.teacher.id === otherAbsent)?.conflicts[0]?.type).toBe('TEACHER_ABSENT')
    // Kandidat tanpa konflik di urutan teratas.
    const firstConflict = candidates.findIndex((c) => c.conflicts.length > 0)
    expect(firstConflict).toBeGreaterThan(0)
    expect(candidates.slice(0, firstConflict).every((c) => c.conflicts.length === 0)).toBe(true)
  })
})

describe('assigning substitutes (FR-SUB-02, AC-09)', () => {
  it('assigns a free teacher, marks the slot HANDLED and writes audit', async () => {
    await loginAs('piket')
    const slot = await firstUnhandled()
    const free = (await substitutionsApi.candidates(slot.id, {})).find((c) => c.conflicts.length === 0)!
    const record = await substitutionsApi.create(
      {
        date: today,
        timetableSlotId: slot.timetableSlotId,
        substituteTeacherId: free.teacher.id,
        activity: 'Latihan soal',
      },
      'idem-1',
    )
    expect(record.status).toBe('ACTIVE')
    expect(record.periodCount).toBe(slot.periodCount)
    expect(record.conflictOverridden).toBe(false)
    const after = await substitutionsApi.slots({ date: today })
    expect(after.find((s) => s.id === slot.id)?.status).toBe('HANDLED')
    expect(db().auditLogs[0]).toMatchObject({ action: 'CREATE', entity: 'SubstitutionRecord', entityId: record.id })

    // Idempotency: kunci sama → response sama tanpa record baru.
    const replay = await substitutionsApi.create(
      { date: today, timetableSlotId: slot.timetableSlotId, substituteTeacherId: free.teacher.id },
      'idem-1',
    )
    expect(replay.id).toBe(record.id)

    // Penugasan kedua (kunci baru) → 409 SLOT_ALREADY_HANDLED.
    const e = await failure(
      substitutionsApi.create(
        { date: today, timetableSlotId: slot.timetableSlotId, substituteTeacherId: free.teacher.id },
        'idem-2',
      ),
    )
    expect(e.status).toBe(409)
    expect(e.code).toBe('SLOT_ALREADY_HANDLED')
  })

  it('returns 409 SCHEDULE_CONFLICT for a busy teacher; override with reason succeeds', async () => {
    await loginAs('piket')
    const slot = await firstUnhandled()
    const busyId = busyTeacherFor(slot)
    const base = { date: today, timetableSlotId: slot.timetableSlotId, substituteTeacherId: busyId }

    const e = await failure(substitutionsApi.create(base, 'k-1'))
    expect(e.status).toBe(409)
    expect(e.code).toBe('SCHEDULE_CONFLICT')
    const conflicts = conflictsFromError(e)
    expect(conflicts[0]?.type).toBe('TEACHER_BUSY')
    expect(conflicts[0]?.message).toMatch(/Sedang mengajar/)

    const noReason = await failure(substitutionsApi.create({ ...base, overrideConflict: true }, 'k-2'))
    expect(noReason.status).toBe(422)
    expect(noReason.details.overrideReason).toBeTruthy()

    const record = await substitutionsApi.create(
      { ...base, overrideConflict: true, overrideReason: 'Kelas digabung di aula' },
      'k-3',
    )
    expect(record.conflictOverridden).toBe(true)
    expect(record.overrideReason).toBe('Kelas digabung di aula')
  })

  it('validates input with 422 (substitute = absent teacher, periods out of range)', async () => {
    await loginAs('admin')
    const slot = await firstUnhandled()
    const e = await failure(
      substitutionsApi.create(
        {
          date: today,
          timetableSlotId: slot.timetableSlotId,
          substituteTeacherId: slot.absentTeacherId,
          periodStart: slot.periodStart,
          periodEnd: slot.periodEnd + 3,
        },
        'v-1',
      ),
    )
    expect(e.status).toBe(422)
    expect(e.details.substituteTeacherId).toBeTruthy()
    expect(e.details.periodEnd).toBeTruthy()

    const missing = await failure(substitutionsApi.create({ date: today, timetableSlotId: '', substituteTeacherId: '' }, 'v-2'))
    expect(missing.status).toBe(422)
    expect(missing.details).toMatchObject({ timetableSlotId: 'required', substituteTeacherId: 'required' })
  })

  it('forbids teachers without substitution:write (403)', async () => {
    await loginAs('guru')
    const slot = await firstUnhandled()
    const e = await failure(
      substitutionsApi.create(
        { date: today, timetableSlotId: slot.timetableSlotId, substituteTeacherId: 'tch_2' },
        'g-1',
      ),
    )
    expect(e.status).toBe(403)
  })
})

describe('updating and cancelling', () => {
  it('cancel requires reason, makes the slot UNHANDLED again and audits CANCEL', async () => {
    await loginAs('piket')
    const handled = (await substitutionsApi.slots({ date: today, status: 'HANDLED' }))[0]
    expect(handled?.substitution).toBeTruthy()
    const recordId = handled!.substitution!.id

    const noReason = await failure(substitutionsApi.cancel(recordId, ''))
    expect(noReason.status).toBe(422)

    const before = await substitutionsApi.summary({ date: today })
    const cancelled = await substitutionsApi.cancel(recordId, 'Guru pengganti dipanggil rapat')
    expect(cancelled.status).toBe('CANCELLED')
    const slots = await substitutionsApi.slots({ date: today })
    expect(slots.find((s) => s.id === handled!.id)?.status).toBe('UNHANDLED')
    const after = await substitutionsApi.summary({ date: today })
    expect(after.handledPeriods).toBe(before.handledPeriods - handled!.substitution!.periodCount)
    expect(after.unhandledSlots).toBe(before.unhandledSlots + 1)
    expect(db().auditLogs[0]).toMatchObject({ action: 'CANCEL', reason: 'Guru pengganti dipanggil rapat' })
    // Soft: record tetap ada di riwayat.
    const history = await substitutionsApi.records({ dateFrom: today, dateTo: today, status: 'CANCELLED' })
    expect(history.data.some((r) => r.id === recordId)).toBe(true)
  })

  it('patches activity and validates periodCount', async () => {
    await loginAs('piket')
    const handled = (await substitutionsApi.slots({ date: today, status: 'HANDLED' }))[0]!
    const id = handled.substitution!.id
    const updated = await substitutionsApi.update(id, { activity: 'Diskusi kelompok', periodCount: 1 })
    expect(updated.activity).toBe('Diskusi kelompok')
    expect(updated.periodCount).toBe(1)
    const e = await failure(substitutionsApi.update(id, { periodCount: 99 }))
    expect(e.status).toBe(422)
    expect(e.details.periodCount).toBeTruthy()
  })

  it('lists history within the date range', async () => {
    await loginAs('kepsek')
    const res = await substitutionsApi.records({ pageSize: 500 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.meta.totalItems).toBe(res.data.length)
    const bad = await failure(substitutionsApi.records({ dateFrom: today, dateTo: '2000-01-01' }))
    expect(bad.status).toBe(422)
  })
})
