import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { slotsOn } from '@/mocks/domain'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import type { TeachingLog, TimetableSlot, TodayTeachingSlot } from '@/types/entities'
import type { TeachingLogPayload } from './types'

const today = () => todayISO()

function guruSlot(): TimetableSlot {
  const s = slotsOn(today(), { teacherId: 'tch_1' })[0]
  if (!s) throw new Error('seed: guru harus punya jadwal hari ini')
  return s
}

function payloadFor(slot: TimetableSlot, patch: Partial<TeachingLogPayload> = {}): TeachingLogPayload {
  return {
    date: today(),
    timetableSlotId: slot.id,
    classId: slot.classId,
    subjectId: slot.subjectId,
    shiftCode: slot.shiftCode,
    periodStart: slot.periodStart,
    periodEnd: slot.periodEnd,
    periodCount: slot.periodCount,
    topic: 'Persamaan linear',
    activity: 'Ceramah dan latihan',
    note: null,
    teacherPresence: 'PRESENT',
    execution: 'HELD',
    studentSick: 1,
    studentPermission: 0,
    studentAbsent: 0,
    ...patch,
  }
}

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.catch((x: unknown) => x)
  if (!(e instanceof ApiError)) throw new Error(`expected ApiError, got ${String(e)}`)
  return e
}

const create = (body: TeachingLogPayload, key?: string) =>
  api.post<DataResponse<TeachingLog>>('/teaching-logs', body, key ? { idempotencyKey: key } : undefined)

/** Tugaskan guru (tch_1) sebagai pengganti pada slot guru lain hari ini. */
function assignGuruAsSubstitute(): TimetableSlot {
  const own = slotsOn(today(), { teacherId: 'tch_1' })
  const slot = slotsOn(today()).find(
    (s) => s.teacherId !== 'tch_1' && !own.some((o) => o.shiftCode === s.shiftCode && o.periodStart === s.periodStart),
  )
  if (!slot) throw new Error('seed: tidak ada slot untuk pengganti')
  db().substitutions = db().substitutions.filter((r) => !(r.date === today() && r.timetableSlotId === slot.id))
  db().substitutions.push({
    id: 'subr_test_1',
    date: today(),
    shiftCode: slot.shiftCode,
    timetableSlotId: slot.id,
    classId: slot.classId,
    subjectId: slot.subjectId,
    absentTeacherId: slot.teacherId,
    substituteTeacherId: 'tch_1',
    substituteTeacherName: 'Guru',
    periodStart: slot.periodStart,
    periodEnd: slot.periodEnd,
    periodCount: slot.periodCount,
    activity: null,
    note: null,
    status: 'ACTIVE',
    conflictOverridden: false,
    overrideReason: null,
    teachingLogId: null,
    createdByName: 'Piket',
    createdAt: `${today()}T07:30:00+07:00`,
  })
  return slot
}

describe('GET /teaching-logs/today (FR-TEACH-01)', () => {
  it('returns own slots plus active substitution assignments', async () => {
    const subSlot = assignGuruAsSubstitute()
    await loginAs('guru')
    const res = await api.get<DataResponse<TodayTeachingSlot[]>>('/teaching-logs/today', { date: today() })
    const own = res.data.filter((s) => !s.isSubstitution)
    expect(own.length).toBe(slotsOn(today(), { teacherId: 'tch_1' }).length)
    expect(own.every((s) => s.slot.teacherId === 'tch_1')).toBe(true)
    const sub = res.data.find((s) => s.isSubstitution)
    expect(sub?.slot.id).toBe(subSlot.id)
    expect(sub?.substitutionRecordId).toBe('subr_test_1')
    expect(sub?.className).not.toBe('—')
    expect(sub?.startTime).toMatch(/^\d{2}:\d{2}$/)
    expect(sub?.log).toBeNull()
  })

  it('forbids roles without teaching_log:write (403)', async () => {
    await loginAs('kepsek')
    const e = await errorOf(api.get('/teaching-logs/today', { date: today() }))
    expect(e.status).toBe(403)
  })
})

describe('POST /teaching-logs validation (PRD §9.2, §9.3)', () => {
  it('creates a draft with values from the schedule', async () => {
    await loginAs('guru')
    const slot = guruSlot()
    const res = await create(payloadFor(slot))
    expect(res.data.status).toBe('DRAFT')
    expect(res.data.teacherId).toBe('tch_1')
    expect(res.data.periodCount).toBe(slot.periodCount)
    expect(res.data.createdAt).toMatch(/\+07:00$/)
  })

  it('requires notHeldReason when NOT_HELD (422)', async () => {
    await loginAs('guru')
    const e = await errorOf(create(payloadFor(guruSlot(), { execution: 'NOT_HELD', topic: null })))
    expect(e.status).toBe(422)
    expect(e.details.notHeldReason).toBeTruthy()
    expect(e.details.topic).toBeUndefined()
  })

  it('requires topic when HELD (422)', async () => {
    await loginAs('guru')
    const e = await errorOf(create(payloadFor(guruSlot(), { topic: '  ' })))
    expect(e.status).toBe(422)
    expect(e.details.topic).toBeTruthy()
  })

  it('requires a reason when JML differs from the schedule', async () => {
    await loginAs('guru')
    const slot = guruSlot()
    const e = await errorOf(create(payloadFor(slot, { periodCount: slot.periodCount - 1 })))
    expect(e.status).toBe(422)
    expect(e.details.periodCountOverrideReason).toBeTruthy()

    const neg = await errorOf(create(payloadFor(slot, { periodCount: -1 })))
    expect(neg.details.periodCount).toBe('negative')

    const ok = await create(
      payloadFor(slot, { periodCount: slot.periodCount - 1, periodCountOverrideReason: 'Satu jam untuk upacara' }),
    )
    expect(ok.data.periodCount).toBe(slot.periodCount - 1)
    expect(ok.data.periodCountOverrideReason).toBe('Satu jam untuk upacara')
  })

  it('rejects a duplicate journal for the same slot with 409 + existing id', async () => {
    await loginAs('guru')
    const slot = guruSlot()
    const first = await create(payloadFor(slot))
    const e = await errorOf(create(payloadFor(slot)))
    expect(e.status).toBe(409)
    expect(e.details.existingId).toBe(first.data.id)
  })

  it('is idempotent for the same Idempotency-Key (AC-03)', async () => {
    await loginAs('guru')
    const slot = guruSlot()
    const a = await create(payloadFor(slot), 'idem-tlog-1')
    const b = await create(payloadFor(slot), 'idem-tlog-1')
    expect(b.data.id).toBe(a.data.id)
    expect(db().teachingLogs.filter((l) => l.date === today() && l.timetableSlotId === slot.id)).toHaveLength(1)
  })

  it("forbids a teacher from filling another teacher's slot (403)", async () => {
    await loginAs('guru')
    const other = slotsOn(today()).find((s) => s.teacherId !== 'tch_1')!
    const e = await errorOf(create(payloadFor(other)))
    expect(e.status).toBe(403)
  })

  it('lets the substitute fill the substituted slot and links the record (FR-SUB-03)', async () => {
    const slot = assignGuruAsSubstitute()
    await loginAs('guru')
    const res = await create(payloadFor(slot, { teacherPresence: 'PRESENT' }))
    expect(res.data.teacherId).toBe('tch_1')
    expect(res.data.substitutionRecordId).toBe('subr_test_1')
    expect(db().substitutions.find((r) => r.id === 'subr_test_1')?.teachingLogId).toBe(res.data.id)
  })

  it('substitute covering part of a slot sees and logs only the substituted periods (FR-SUB-03)', async () => {
    const slot = assignGuruAsSubstitute()
    if (slot.periodEnd === slot.periodStart) return // slot satu jam: tidak ada penggantian sebagian
    const rec = db().substitutions.find((r) => r.id === 'subr_test_1')!
    rec.periodEnd = rec.periodStart
    rec.periodCount = 1
    await loginAs('guru')
    const todayList = await api.get<DataResponse<TodayTeachingSlot[]>>('/teaching-logs/today', { date: today() })
    const sub = todayList.data.find((s) => s.isSubstitution)!
    expect(sub.slot.periodEnd).toBe(rec.periodStart)
    expect(sub.slot.periodCount).toBe(1)
    const res = await create(payloadFor(slot, { periodCount: 1 }))
    expect(res.data.periodStart).toBe(rec.periodStart)
    expect(res.data.periodEnd).toBe(rec.periodStart)
    expect(res.data.periodCount).toBe(1)
    expect(rec.teachingLogId).toBe(res.data.id)
  })
})

describe('access scoping & corrections', () => {
  const foreignLog = () => db().teachingLogs.find((l) => l.teacherId !== 'tch_1' && l.status === 'FINAL')!

  it('lists only own logs for a teacher without read_all', async () => {
    await loginAs('guru')
    const res = await api.get<ListResponse<TeachingLog>>('/teaching-logs', { pageSize: 500, teacherId: 'tch_2' })
    expect(res.data.every((l) => l.teacherId === 'tch_1')).toBe(true)
    const all = await api.get<ListResponse<TeachingLog>>('/teaching-logs', { pageSize: 500 })
    expect(all.meta.totalItems).toBeGreaterThan(0)
    expect(all.data.every((l) => l.teacherId === 'tch_1')).toBe(true)
  })

  it("guru cannot read or edit another teacher's log (403)", async () => {
    await loginAs('guru')
    const log = foreignLog()
    expect((await errorOf(api.get(`/teaching-logs/${log.id}`))).status).toBe(403)
    const e = await errorOf(api.patch(`/teaching-logs/${log.id}`, { topic: 'Diubah' }))
    expect(e.status).toBe(403)
  })

  it('owner cannot change a FINAL log; corrector must give a reason and it is audited', async () => {
    await loginAs('guru')
    const slot = guruSlot()
    const created = await create({ ...payloadFor(slot), submit: true })
    expect(created.data.status).toBe('FINAL')
    const blocked = await errorOf(api.patch(`/teaching-logs/${created.data.id}`, { topic: 'Ubah' }))
    expect(blocked.status).toBe(409)
    expect(blocked.code).toBe('ALREADY_FINAL')

    await loginAs('admin')
    const noReason = await errorOf(api.patch(`/teaching-logs/${created.data.id}`, { topic: 'Koreksi' }))
    expect(noReason.status).toBe(422)
    expect(noReason.details.correctionReason).toBe('required')

    const fixed = await api.patch<DataResponse<TeachingLog>>(`/teaching-logs/${created.data.id}`, {
      topic: 'Materi dikoreksi',
      correctionReason: 'Salah tulis materi',
    })
    expect(fixed.data.topic).toBe('Materi dikoreksi')
    expect(fixed.data.version).toBe(created.data.version + 1)
    const entry = db().auditLogs.find((a) => a.entityId === created.data.id && a.action === 'CORRECT')
    expect(entry?.reason).toBe('Salah tulis materi')
    expect(entry?.before?.topic).toBe('Persamaan linear')
  })

  it('rejects stale version with 409 VERSION_CONFLICT', async () => {
    await loginAs('guru')
    const created = await create(payloadFor(guruSlot()))
    await api.patch(`/teaching-logs/${created.data.id}`, { topic: 'v2', version: 1 })
    const e = await errorOf(api.patch(`/teaching-logs/${created.data.id}`, { topic: 'v3', version: 1 }))
    expect(e.code).toBe('VERSION_CONFLICT')
  })

  it('approval (FR-TEACH-06): only teaching_log:correct roles, only FINAL logs', async () => {
    const log = foreignLog()
    await loginAs('guru')
    expect((await errorOf(api.post(`/teaching-logs/${log.id}/approve`))).status).toBe(403)
    await loginAs('kepsek')
    const res = await api.post<DataResponse<TeachingLog>>(`/teaching-logs/${log.id}/approve`)
    expect(res.data.approvedByName).toBe('Drs. Hartono, M.Pd.')
    expect(res.data.approvedAt).toMatch(/\+07:00$/)
    expect((await errorOf(api.post(`/teaching-logs/${log.id}/approve`))).status).toBe(409)
  })

  it('homeroom teacher may read logs of their class', async () => {
    await loginAs('walikelas')
    const res = await api.get<ListResponse<TeachingLog>>('/teaching-logs', { pageSize: 500, classId: 'cls_1' })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((l) => l.classId === 'cls_1')).toBe(true)
  })
})
