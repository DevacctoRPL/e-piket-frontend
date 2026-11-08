import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import type { ExtraActivity } from '@/types/entities'
import type { ExtraActivityInput } from './types'

const input = (patch: Partial<ExtraActivityInput> = {}): ExtraActivityInput => ({
  name: 'Kursus Desain Grafis',
  type: 'COURSE',
  instructorTeacherId: 'tch_10',
  instructorName: null,
  date: todayISO(),
  shiftCode: 'AFTERNOON',
  startTime: '13:00',
  endTime: '15:00',
  classIds: ['cls_3', 'cls_4'],
  topic: 'Dasar tipografi',
  note: null,
  participantAttendanceEnabled: false,
  ...patch,
})

async function catchApi(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected request to fail')
}

describe('extra-activities mock API', () => {
  it('lists activities for readers and filters by class', async () => {
    await loginAs('kepsek')
    const res = await api.get<ListResponse<ExtraActivity>>('/extra-activities', { classId: 'cls_4' })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((a) => a.classIds.includes('cls_4'))).toBe(true)
    expect(res.meta.page).toBe(1)
  })

  it('stores a multi-class agenda once (FR-EXT-02) and is idempotent (AC-03)', async () => {
    await loginAs('koordinator')
    const before = db().extraActivities.length
    const key = 'idem-ext-1'
    const a = await api.post<DataResponse<ExtraActivity>>('/extra-activities', input(), { idempotencyKey: key })
    await api.post<DataResponse<ExtraActivity>>('/extra-activities', input(), { idempotencyKey: key })
    expect(db().extraActivities.length).toBe(before + 1)
    expect(a.data.classIds).toEqual(['cls_3', 'cls_4'])
    expect(a.data.classNames).toHaveLength(2)
    expect(a.data.coordinatorUserId).toBe('usr_koordinator')
    expect(db().extraActivities.filter((x) => x.name === 'Kursus Desain Grafis')).toHaveLength(1)
  })

  it('returns 422 for empty classes and start >= end', async () => {
    await loginAs('admin')
    const err = await catchApi(api.post('/extra-activities', input({ classIds: [], startTime: '15:00', endTime: '14:00' })))
    expect(err.status).toBe(422)
    expect(err.details.classIds).toBeTruthy()
    expect(err.details.endTime).toBeTruthy()
  })

  it('returns 403 when a reader-only role creates an activity', async () => {
    await loginAs('piket')
    const err = await catchApi(api.post('/extra-activities', input()))
    expect(err.status).toBe(403)
  })

  it('returns 403 when a non-owner coordinator patches an activity', async () => {
    // ext_2 dikoordinasi usr_koordinator; buat kegiatan milik admin lalu coba ubah sebagai koordinator.
    await loginAs('admin')
    const own = await api.post<DataResponse<ExtraActivity>>('/extra-activities', input({ instructorTeacherId: 'tch_5' }))
    await loginAs('koordinator')
    const err = await catchApi(api.patch(`/extra-activities/${own.data.id}`, { note: 'x', version: own.data.version }))
    expect(err.status).toBe(403)
    // pemilik boleh
    const ok = await api.patch<DataResponse<ExtraActivity>>('/extra-activities/ext_3', { note: 'Bawa kalkulator', version: 1 })
    expect(ok.data.note).toBe('Bawa kalkulator')
    expect(ok.data.version).toBe(2)
  })

  it('returns 409 VERSION_CONFLICT on stale version and ALREADY_FINAL without reason', async () => {
    await loginAs('koordinator')
    const stale = await catchApi(api.patch('/extra-activities/ext_3', { note: 'y', version: 99 }))
    expect(stale.status).toBe(409)
    expect(stale.code).toBe('VERSION_CONFLICT')
    const final = await catchApi(api.patch('/extra-activities/ext_1', { note: 'y', version: 1 }))
    expect(final.code).toBe('ALREADY_FINAL')
    const corrected = await api.patch<DataResponse<ExtraActivity>>('/extra-activities/ext_1', {
      note: 'y',
      version: 1,
      reason: 'Salah ketik',
    })
    expect(corrected.data.note).toBe('y')
    expect(db().auditLogs[0]).toMatchObject({ action: 'CORRECT', entityId: 'ext_1', reason: 'Salah ketik' })
  })

  it('defaults participant roster from included classes when enabled', async () => {
    await loginAs('koordinator')
    const res = await api.patch<DataResponse<ExtraActivity>>('/extra-activities/ext_3', {
      participantAttendanceEnabled: true,
      version: 1,
    })
    const classIds = new Set(res.data.participants.map((p) => p.classId))
    expect(res.data.participants.length).toBeGreaterThan(0)
    expect([...classIds].every((c) => ['cls_2', 'cls_7'].includes(c))).toBe(true)
    expect(res.data.participants.every((p) => p.status === 'PRESENT')).toBe(true)
  })

  it('rejects a participant from a non-included class with 422 per row (FR-EXT-03)', async () => {
    await loginAs('koordinator')
    const outsider = db().students.find((s) => s.classId === 'cls_1' && s.status === 'ACTIVE')!
    const a = db().extraActivities.find((x) => x.id === 'ext_2')!
    const first = a.participants[0]!
    const err = await catchApi(
      api.put('/extra-activities/ext_2/participants', {
        participants: [
          { studentId: first.studentId, status: 'SICK' },
          { studentId: outsider.id, status: 'PRESENT' },
        ],
        version: a.version,
      }),
    )
    expect(err.status).toBe(422)
    expect(err.details['participants.1.studentId']).toMatch(/bukan anggota/)
    expect(err.details['participants.0.studentId']).toBeUndefined()
  })

  it('lets the instructor (guru) save participants and submit, separate from regular attendance', async () => {
    await loginAs('guru') // tch_1 = pengampu ext_2, tanpa extra_activity:write
    const a = db().extraActivities.find((x) => x.id === 'ext_2')!
    const regularBefore = db().studentRecords.length
    const res = await api.put<DataResponse<ExtraActivity>>(
      '/extra-activities/ext_2/participants',
      {
        participants: a.participants.map((p, i) => ({ studentId: p.studentId, status: i === 0 ? 'ABSENT' : 'PRESENT' })),
        submit: true,
        version: a.version,
      },
      { idempotencyKey: 'idem-part-1' },
    )
    expect(res.data.status).toBe('FINAL')
    expect(res.data.participants[0]?.status).toBe('ABSENT')
    expect(db().studentRecords.length).toBe(regularBefore)
    // namun guru tetap tidak boleh mengubah info kegiatan
    const err = await catchApi(api.patch('/extra-activities/ext_2', { note: 'x', version: res.data.version, reason: 'abc' }))
    expect(err.status).toBe(403)
  })

  it('soft-deletes an activity and writes audit', async () => {
    await loginAs('koordinator')
    await api.delete('/extra-activities/ext_3')
    expect(db().extraActivities.some((a) => a.id === 'ext_3')).toBe(true)
    const err = await catchApi(api.get('/extra-activities/ext_3'))
    expect(err.status).toBe(404)
    expect(db().auditLogs[0]).toMatchObject({ action: 'DELETE', entityId: 'ext_3' })
  })
})
