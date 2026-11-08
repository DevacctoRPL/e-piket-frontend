import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { addDays, todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { ClassRoom, CurrentUser, RosterRow, StudentAttendanceSession } from '@/types/entities'
import { studentAttendanceApi } from './api'
import type { StudentHistoryResponse } from './types'

const err = (p: Promise<unknown>) => p.then(() => null).catch((e: unknown) => e as ApiError)

async function openNew(classId = 'cls_1') {
  const cls = db().classes.find((c) => c.id === classId)!
  return studentAttendanceApi.openSession({ date: todayISO(), shiftCode: cls.shiftCode, classId })
}

describe('student attendance mock API', () => {
  it('creates a session once and returns the existing one afterwards (FR-STU-07)', async () => {
    await loginAs('piket')
    const before = db().studentSessions.length
    const a = await openNew()
    const b = await openNew()
    expect(b.id).toBe(a.id)
    expect(a.status).toBe('DRAFT')
    expect(a.summary.unmarked).toBe(a.summary.total)
    expect(db().studentSessions.length).toBe(before + 1)
  })

  it('rejects future dates with 422', async () => {
    await loginAs('piket')
    const e = await err(
      studentAttendanceApi.openSession({ date: addDays(todayISO(), 1), shiftCode: 'MORNING', classId: 'cls_1' }),
    )
    expect(e?.status).toBe(422)
    expect(e?.details.date).toBeTruthy()
  })

  it('bulk save hits the records:bulk handler and upserts without duplicates', async () => {
    await loginAs('piket')
    const s = await openNew()
    const roster = await studentAttendanceApi.getRoster(s.id)
    const records = roster.map((r) => ({ studentId: r.student.id, status: 'PRESENT' as const }))

    // Same idempotency key twice → replayed response, single effect.
    const key = 'idem-test-1'
    const r1 = await studentAttendanceApi.bulkSave(s.id, { records, version: s.version }, key)
    const r2 = await studentAttendanceApi.bulkSave(s.id, { records, version: s.version }, key)
    expect(r2.session.version).toBe(r1.session.version)
    expect(db().studentRecords.filter((r) => r.sessionId === s.id)).toHaveLength(roster.length)

    // Sent again without key (new version) → upsert, still one record per student.
    const r3 = await studentAttendanceApi.bulkSave(s.id, { records, version: r1.session.version })
    const saved = db().studentRecords.filter((r) => r.sessionId === s.id)
    expect(saved).toHaveLength(roster.length)
    expect(new Set(saved.map((r) => r.studentId)).size).toBe(roster.length)
    expect(r3.session.summary.PRESENT).toBe(roster.length)
    expect(r3.session.summary.unmarked).toBe(0)
  })

  it('returns per-row 422 for missing reason and saves nothing (atomic)', async () => {
    await loginAs('piket')
    const s = await openNew()
    const roster = await studentAttendanceApi.getRoster(s.id)
    const records = roster.map((r, i) => ({
      studentId: r.student.id,
      status: i === 2 ? ('SICK' as const) : ('PRESENT' as const),
    }))
    const e = await err(studentAttendanceApi.bulkSave(s.id, { records, version: s.version }))
    expect(e?.status).toBe(422)
    expect(e?.details['records.2.reason']).toBeTruthy()
    expect(Object.keys(e?.details ?? {})).toHaveLength(1)
    expect(db().studentRecords.filter((r) => r.sessionId === s.id)).toHaveLength(0)
  })

  it('returns 409 VERSION_CONFLICT for stale version', async () => {
    await loginAs('piket')
    const s = await openNew()
    const roster = await studentAttendanceApi.getRoster(s.id)
    const one = [{ studentId: roster[0]!.student.id, status: 'PRESENT' as const }]
    await studentAttendanceApi.bulkSave(s.id, { records: one, version: s.version })
    const e = await err(studentAttendanceApi.bulkSave(s.id, { records: one, version: s.version }))
    expect(e?.status).toBe(409)
    expect(e?.code).toBe('VERSION_CONFLICT')
  })

  it('finalizes with submit=true, then blocks non-correctors with ALREADY_FINAL', async () => {
    await loginAs('piket')
    const s = await openNew()
    const roster = await studentAttendanceApi.getRoster(s.id)
    const partial = [{ studentId: roster[0]!.student.id, status: 'PRESENT' as const }]
    const incomplete = await err(
      studentAttendanceApi.bulkSave(s.id, { records: partial, version: s.version, submit: true }),
    )
    expect(incomplete?.status).toBe(422)
    expect(incomplete?.details.records).toMatch(/belum diberi status/)

    const all = roster.map((r) => ({ studentId: r.student.id, status: 'PRESENT' as const }))
    const res = await studentAttendanceApi.bulkSave(s.id, { records: all, version: s.version, submit: true })
    expect(res.session.status).toBe('FINAL')
    expect(res.session.submittedByName).toBeTruthy()

    const e = await err(studentAttendanceApi.bulkSave(s.id, { records: partial, version: res.session.version }))
    expect(e?.status).toBe(409)
    expect(e?.code).toBe('ALREADY_FINAL')
  })

  it('PATCH correction on FINAL requires reason and writes audit CORRECT', async () => {
    await loginAs('admin')
    const session = db().studentSessions.find((x) => x.status === 'FINAL' && x.date === todayISO())!
    const rec = db().studentRecords.find((r) => r.sessionId === session.id)!
    const missing = await err(
      studentAttendanceApi.patchRecord(rec.id, { status: 'SICK', reason: 'Demam', version: rec.version }),
    )
    expect(missing?.status).toBe(422)
    expect(missing?.details.correctionReason).toBeTruthy()

    const auditBefore = db().auditLogs.length
    const res = await studentAttendanceApi.patchRecord(rec.id, {
      status: 'SICK',
      reason: 'Demam',
      correctionReason: 'Surat sakit diterima',
      version: rec.version,
    })
    expect(res.record.status).toBe('SICK')
    expect(db().auditLogs.length).toBe(auditBefore + 1)
    expect(db().auditLogs[0]).toMatchObject({ action: 'CORRECT', entityId: rec.id, reason: 'Surat sakit diterima' })

    // piket (no correct permission) is rejected
    await loginAs('piket')
    const e = await err(
      studentAttendanceApi.patchRecord(rec.id, { status: 'PRESENT', correctionReason: 'x y z', version: res.record.version }),
    )
    expect(e?.code).toBe('ALREADY_FINAL')
  })

  it('returns 403 for a teacher on a class they do not teach (AC-13)', async () => {
    await loginAs('guru')
    const me = (await api.get<DataResponse<CurrentUser>>('/auth/me')).data
    const all = (await api.get<DataResponse<ClassRoom[]>>('/classes')).data
    const foreign = all.find((c) => !me.teachingClassIds.includes(c.id) && !me.homeroomClassIds.includes(c.id))!
    expect(foreign).toBeDefined()
    const e1 = await err(
      studentAttendanceApi.openSession({ date: todayISO(), shiftCode: foreign.shiftCode, classId: foreign.id }),
    )
    expect(e1?.status).toBe(403)

    const foreignSession = db().studentSessions.find((s) => s.classId === foreign.id)!
    const e2 = await err(studentAttendanceApi.getRoster(foreignSession.id))
    expect(e2?.status).toBe(403)

    // list is scoped
    const list = await api.get<DataResponse<StudentAttendanceSession[]>>('/student-attendance/sessions', {
      date: foreignSession.date,
    })
    expect(list.data.every((s) => me.teachingClassIds.includes(s.classId) || me.homeroomClassIds.includes(s.classId))).toBe(true)
  })

  it('returns 403 when a read-only role (pimpinan) tries to write', async () => {
    await loginAs('kepsek')
    const e = await err(studentAttendanceApi.openSession({ date: todayISO(), shiftCode: 'MORNING', classId: 'cls_1' }))
    expect(e?.status).toBe(403)
  })

  it('serves student history with summary (FR-STU-08)', async () => {
    await loginAs('walikelas')
    const studentId = 'std_0101'
    const res = await api.get<DataResponse<StudentHistoryResponse>>('/student-attendance/history', {
      studentId,
      dateFrom: addDays(todayISO(), -30),
      dateTo: todayISO(),
    })
    expect(res.data.student.id).toBe(studentId)
    expect(res.data.records.length).toBeGreaterThan(5)
    expect(res.data.summary.total).toBe(res.data.records.length)
    expect(res.data.summary.presentRate).toBeGreaterThan(0)
    const roster: RosterRow[] = await studentAttendanceApi.getRoster(res.data.records[0]!.sessionId)
    expect(roster.some((r) => r.student.id === studentId)).toBe(true)
  })
})
