import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { addDays, todayISO } from '@/lib/date'
import { NON_PRESENT_STATUSES } from '@/lib/enums'
import { maskPhone } from '@/lib/permissions'
import { db } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { CurrentUser } from '@/types/entities'
import { absenteesApi } from './api'

const today = todayISO()
const range = { dateFrom: addDays(today, -14), dateTo: today }

async function expectError(p: Promise<unknown>, status: number) {
  const err = await p.catch((e: unknown) => e)
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).status).toBe(status)
  return err as ApiError
}

describe('GET /student-attendance/absentees', () => {
  it('lists only non-present records from submitted/final sessions (AC-04)', async () => {
    await loginAs('piket')
    const res = await absenteesApi.list({ ...range, pageSize: 500 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.meta.totalItems).toBeGreaterThanOrEqual(res.data.length)
    for (const r of res.data) {
      expect(r.status).not.toBe('PRESENT')
      expect(NON_PRESENT_STATUSES).toContain(r.status)
      expect(['SUBMITTED', 'FINAL']).toContain(r.sessionStatus)
      expect(r.date >= range.dateFrom && r.date <= range.dateTo).toBe(true)
    }
    // PRESENT ada di data sumber tetapi tidak muncul.
    expect(db().studentRecords.some((r) => r.status === 'PRESENT')).toBe(true)
  })

  it('includes draft sessions only when includeDraft=true', async () => {
    await loginAs('piket')
    const draftSession = db().studentSessions.find((s) => s.date === today && s.status === 'DRAFT')
    expect(draftSession).toBeDefined()
    // pastikan ada record tidak hadir di sesi draft
    const rec = db().studentRecords.find((r) => r.sessionId === draftSession!.id)!
    rec.status = 'SICK'
    const without = await absenteesApi.list({ dateFrom: today, dateTo: today, pageSize: 500 })
    expect(without.data.some((r) => r.sessionId === draftSession!.id)).toBe(false)
    const withDraft = await absenteesApi.list({ dateFrom: today, dateTo: today, includeDraft: true, pageSize: 500 })
    expect(withDraft.data.some((r) => r.recordId === rec.id && r.sessionStatus === 'DRAFT')).toBe(true)
  })

  it('filters by repeated status params and summary counts per status', async () => {
    await loginAs('piket')
    const res = await absenteesApi.list({ ...range, status: ['SICK', 'ABSENT'], pageSize: 500 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((r) => r.status === 'SICK' || r.status === 'ABSENT')).toBe(true)

    const all = await absenteesApi.list({ ...range, pageSize: 500 })
    const summary = await absenteesApi.summary({ ...range, status: ['SICK', 'ABSENT'] })
    // byStatus mengabaikan filter status → angka per chip tetap lengkap
    expect(summary.byStatus.LATE).toBe(all.data.filter((r) => r.status === 'LATE').length)
    expect(summary.byStatus.SICK).toBe(all.data.filter((r) => r.status === 'SICK').length)
    expect(summary.total).toBe(res.meta.totalItems)
    expect(summary.contacted + summary.notContacted).toBe(summary.total)
  })

  it('returns full guardian phone for piket but masked for guru (AC-05, §12.2)', async () => {
    await loginAs('piket')
    const piket = await absenteesApi.list({ ...range, pageSize: 500 })
    const sample = piket.data.find((r) => r.guardianPhone)!
    const student = db().students.find((s) => s.id === sample.studentId)!
    expect(sample.guardianPhone).toBe(student.guardianPhone)

    await loginAs('guru')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const guru = await absenteesApi.list({ ...range, pageSize: 500 })
    expect(guru.data.length).toBeGreaterThan(0)
    for (const r of guru.data) {
      // hanya kelas yang diajar (AC-13)
      expect(me.data.teachingClassIds).toContain(r.classId)
      const s = db().students.find((x) => x.id === r.studentId)!
      expect(r.guardianPhone).toBe(maskPhone(s.guardianPhone))
      if (r.contact?.contactedPhone) expect(r.contact.contactedPhone).toContain('****')
    }
  })

  it('returns 403 when filtering a class outside the user scope', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const foreign = db().classes.find(
      (c) => !me.data.homeroomClassIds.includes(c.id) && !me.data.teachingClassIds.includes(c.id),
    )!
    await expectError(absenteesApi.list({ ...range, classId: foreign.id }), 403)
  })

  it('returns 403 for roles without attendance access (koordinator murni)', async () => {
    const koor = db().users.find((u) => u.username === 'koordinator')!
    koor.roles = ['ACTIVITY_COORDINATOR']
    await loginAs('koordinator')
    await expectError(absenteesApi.list(range), 403)
    await expectError(absenteesApi.summary(range), 403)
  })

  it('returns 422 for invalid filters', async () => {
    await loginAs('piket')
    const err = await expectError(absenteesApi.list({ dateFrom: today, dateTo: addDays(today, -3) }), 422)
    expect(err.details.dateTo).toBeTruthy()
    const err2 = await expectError(
      api.get('/student-attendance/absentees', { dateFrom: today, dateTo: today, status: 'PRESENT' }),
      422,
    )
    expect(err2.details.status).toBeTruthy()
  })
})

describe('PATCH /student-attendance/records/:id/contact', () => {
  async function firstUncontacted() {
    const res = await absenteesApi.list({ ...range, contacted: 'false', pageSize: 500 })
    const row = res.data[0]
    expect(row).toBeDefined()
    return row!
  }

  it('saves contact, stamps officer & time, and writes audit (FR-STU-06)', async () => {
    await loginAs('piket')
    const row = await firstUncontacted()
    const auditBefore = db().auditLogs.length
    const saved = await absenteesApi.saveContact(row.recordId, {
      contactedPhone: '081234567890',
      receiverName: 'Ibu',
      contactNote: 'Orang tua sudah mengetahui',
    })
    expect(saved.contact).toMatchObject({ contactedPhone: '081234567890', receiverName: 'Ibu', contactedByName: expect.any(String) })
    expect(saved.contact?.contactedAt).toMatch(/\+07:00$/)
    const stored = db().studentRecords.find((r) => r.id === row.recordId)!
    expect(stored.contact?.receiverName).toBe('Ibu')
    expect(db().auditLogs.length).toBe(auditBefore + 1)
    expect(db().auditLogs[0]).toMatchObject({ action: 'UPDATE', entity: 'StudentAttendanceRecord', entityId: row.recordId })

    // muncul sebagai sudah dikonfirmasi
    const contacted = await absenteesApi.list({ ...range, contacted: 'true', pageSize: 500 })
    expect(contacted.data.some((r) => r.recordId === row.recordId)).toBe(true)
  })

  it('is idempotent with the same Idempotency-Key (AC-03)', async () => {
    await loginAs('piket')
    const row = await firstUncontacted()
    const auditBefore = db().auditLogs.length
    const body = { contactedPhone: null, receiverName: 'Ayah', contactNote: null }
    await absenteesApi.saveContact(row.recordId, body, 'idem-abs-1')
    await absenteesApi.saveContact(row.recordId, body, 'idem-abs-1')
    expect(db().auditLogs.length).toBe(auditBefore + 1)
  })

  it('returns 422 when phone is given without receiver, or everything is empty', async () => {
    await loginAs('piket')
    const row = await firstUncontacted()
    const err = await expectError(
      absenteesApi.saveContact(row.recordId, { contactedPhone: '081234567890', receiverName: '', contactNote: 'x' }),
      422,
    )
    expect(err.details.receiverName).toBeTruthy()
    const err2 = await expectError(
      absenteesApi.saveContact(row.recordId, { contactedPhone: null, receiverName: null, contactNote: null }),
      422,
    )
    expect(err2.details.receiverName).toBeTruthy()
    const err3 = await expectError(
      absenteesApi.saveContact(row.recordId, { contactedPhone: '12ab', receiverName: 'Ibu', contactNote: null }),
      422,
    )
    expect(err3.details.contactedPhone).toBeTruthy()
    expect(db().studentRecords.find((r) => r.id === row.recordId)?.contact).toBeNull()
  })

  it('returns 403 for guru (no absentees:write) and leaves the record untouched', async () => {
    await loginAs('piket')
    const row = await firstUncontacted()
    await loginAs('guru')
    await expectError(
      absenteesApi.saveContact(row.recordId, { contactedPhone: null, receiverName: 'Ibu', contactNote: null }),
      403,
    )
    expect(db().studentRecords.find((r) => r.id === row.recordId)?.contact).toBeNull()
  })

  it('returns 403 for wali kelas on a class outside their scope', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const scope = new Set([...me.data.homeroomClassIds, ...me.data.teachingClassIds])
    const session = db().studentSessions.find((s) => !scope.has(s.classId) && s.status === 'FINAL')!
    const rec = db().studentRecords.find((r) => r.sessionId === session.id && r.status !== 'PRESENT')!
    await expectError(
      absenteesApi.saveContact(rec.id, { contactedPhone: null, receiverName: 'Ibu', contactNote: null }),
      403,
    )
  })

  it('keeps the previous phone when contactedPhone is omitted', async () => {
    await loginAs('piket')
    const rec = db().studentRecords.find((r) => r.contact?.contactedPhone && r.status !== 'PRESENT')!
    const prevPhone = rec.contact!.contactedPhone
    await absenteesApi.saveContact(rec.id, { receiverName: 'Wali', contactNote: 'Diperbarui' })
    expect(db().studentRecords.find((r) => r.id === rec.id)?.contact?.contactedPhone).toBe(prevPhone)
  })

  it('returns 404 for an unknown record', async () => {
    await loginAs('piket')
    await expectError(absenteesApi.saveContact('rec_unknown', { receiverName: 'Ibu', contactNote: null }), 404)
  })
})
