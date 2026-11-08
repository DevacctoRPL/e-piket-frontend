import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { combineDateTime, todayISO } from '@/lib/date'
import { db, isDeleted } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import type { AuditLog, CurrentUser, StudentDismissal } from '@/types/entities'
import { dismissalApi } from './api'
import type { CreateDismissalInput } from './types'

const today = todayISO()

/** Siswa aktif di kelas yang memiliki sesi absensi hari ini dan belum tercatat pulang. */
function pickStudent(classId = 'cls_2') {
  const taken = new Set(db().dismissals.filter((d) => d.date === today).map((d) => d.studentId))
  const s = db().students.find((x) => x.classId === classId && x.status === 'ACTIVE' && !taken.has(x.id))
  if (!s) throw new Error('tidak ada siswa uji')
  return s
}

function earlyLeave(studentId: string, extra: Partial<CreateDismissalInput> = {}): CreateDismissalInput {
  return {
    studentId,
    date: today,
    exitTime: combineDateTime(today, '09:30'),
    type: 'EARLY_LEAVE',
    pickupName: 'Bapak Sutrisno',
    pickupRelation: 'Ayah',
    note: 'Sakit kepala, dijemput orang tua',
    ...extra,
  }
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

describe('POST /student-dismissals', () => {
  it('records an early leave with officer identity and audit (AC-06, FR-OUT-01/02)', async () => {
    await loginAs('piket')
    const s = pickStudent()
    const created = await dismissalApi.create(earlyLeave(s.id), 'key-early-1')
    expect(created).toMatchObject({
      studentId: s.id,
      classId: s.classId,
      type: 'EARLY_LEAVE',
      date: today,
      pickupName: 'Bapak Sutrisno',
      recordedBy: 'usr_piket',
      returnTime: null,
    })
    expect(created.exitTime).toBe(combineDateTime(today, '09:30'))
    expect(created.recordedAt).toMatch(/\+07:00$/)

    const list = await dismissalApi.list({ date: today, studentId: s.id })
    expect(list.data.map((d) => d.id)).toContain(created.id)

    await loginAs('admin')
    const logs = await api.get<ListResponse<AuditLog>>('/audit-logs', { entityId: created.id }).catch(() => null)
    // audit endpoint dimiliki fitur lain; verifikasi langsung ke store bila endpoint belum siap
    const audits = logs?.data ?? db().auditLogs.filter((a) => a.entityId === created.id)
    expect(audits.some((a) => a.action === 'CREATE' && a.entity === 'StudentDismissal')).toBe(true)
  })

  it('does NOT modify any student attendance record (PRD §9.2)', async () => {
    await loginAs('piket')
    const s = pickStudent()
    const before = JSON.stringify(db().studentRecords)
    const sessionsBefore = JSON.stringify(db().studentSessions)
    expect(db().studentRecords.some((r) => r.studentId === s.id)).toBe(true)
    await dismissalApi.create(earlyLeave(s.id), 'key-noattendance')
    const tmp = pickStudent()
    await dismissalApi.create(
      { studentId: tmp.id, date: today, exitTime: combineDateTime(today, '10:00'), type: 'TEMPORARY_EXIT', note: 'Fotokopi' },
      'key-noattendance-2',
    )
    expect(JSON.stringify(db().studentRecords)).toBe(before)
    expect(JSON.stringify(db().studentSessions)).toBe(sessionsBefore)
  })

  it('requires pickup name for NORMAL/EARLY_LEAVE when policy demands it (422)', async () => {
    await loginAs('piket')
    expect(db().settings.dismissalRequiresPickup).toBe(true)
    const s = pickStudent()
    const e = await failure(dismissalApi.create(earlyLeave(s.id, { pickupName: '  ' }), 'key-pickup'))
    expect(e.status).toBe(422)
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.details.pickupName).toBeTruthy()

    // izin keluar tidak wajib penjemput
    const ok = await dismissalApi.create(
      { studentId: s.id, date: today, exitTime: combineDateTime(today, '10:00'), type: 'TEMPORARY_EXIT' },
      'key-pickup-2',
    )
    expect(ok.pickupName).toBeNull()

    // kebijakan dimatikan → tidak wajib
    db().settings.dismissalRequiresPickup = false
    const s2 = pickStudent('cls_3')
    const ok2 = await dismissalApi.create(earlyLeave(s2.id, { pickupName: null }), 'key-pickup-3')
    expect(ok2.pickupName).toBeNull()
  })

  it('validates required fields, note for early leave, and returnTime after exitTime', async () => {
    await loginAs('piket')
    const e1 = await failure(api.post('/student-dismissals', {}, { idempotencyKey: 'k-empty' }))
    expect(e1.status).toBe(422)
    expect(Object.keys(e1.details)).toEqual(expect.arrayContaining(['studentId', 'date', 'exitTime', 'type']))

    const s = pickStudent()
    const e2 = await failure(dismissalApi.create(earlyLeave(s.id, { note: '' }), 'k-note'))
    expect(e2.details.note).toBeTruthy()

    const e3 = await failure(
      dismissalApi.create(
        {
          studentId: s.id,
          date: today,
          type: 'TEMPORARY_EXIT',
          exitTime: combineDateTime(today, '10:00'),
          returnTime: combineDateTime(today, '09:00'),
        },
        'k-return',
      ),
    )
    expect(e3.details.returnTime).toMatch(/setelah/)
  })

  it('is idempotent: same key returns the first response without duplicates (AC-03)', async () => {
    await loginAs('piket')
    const s = pickStudent()
    const a = await dismissalApi.create(earlyLeave(s.id), 'same-key')
    const b = await dismissalApi.create(earlyLeave(s.id), 'same-key')
    expect(b.id).toBe(a.id)
    expect(db().dismissals.filter((d) => d.studentId === s.id && d.date === today)).toHaveLength(1)
    // kunci berbeda untuk siswa yang sudah pulang → konflik
    const e = await failure(dismissalApi.create(earlyLeave(s.id), 'other-key'))
    expect(e.status).toBe(409)
  })

  it('forbids walikelas (no dismissal:write) with 403 (AC-13)', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.permissions).not.toContain('dismissal:write')
    const own = pickStudent(me.data.homeroomClassIds[0])
    const e = await failure(dismissalApi.create(earlyLeave(own.id), 'k-forbidden'))
    expect(e.status).toBe(403)
    expect(db().dismissals.some((d) => d.studentId === own.id && d.date === today && d.recordedBy === me.data.id)).toBe(false)
  })
})

describe('GET /student-dismissals & context', () => {
  it('scopes history to accessible classes and rejects foreign classId', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const scope = new Set([...me.data.homeroomClassIds, ...me.data.teachingClassIds])
    const res = await dismissalApi.list({ pageSize: 500 })
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((d) => scope.has(d.classId))).toBe(true)
    const foreign = db().classes.find((c) => !scope.has(c.id))
    expect(foreign).toBeDefined()
    const e = await failure(dismissalApi.list({ classId: foreign!.id }))
    expect(e.status).toBe(403)
  })

  it('guru (no dismissal:read) gets 403', async () => {
    await loginAs('guru')
    const e = await failure(dismissalApi.list({ date: today }))
    expect(e.status).toBe(403)
  })

  it('filters by date range, type, search and paginates', async () => {
    await loginAs('piket')
    const all = await dismissalApi.list({ pageSize: 500 })
    const res = await dismissalApi.list({ dateFrom: today, dateTo: today, type: 'EARLY_LEAVE', pageSize: 500 })
    expect(res.data.every((d) => d.date === today && d.type === 'EARLY_LEAVE')).toBe(true)
    const sample = all.data[0]!
    const search = await dismissalApi.list({ search: sample.studentNis, pageSize: 500 })
    expect(search.data.some((d) => d.id === sample.id)).toBe(true)
    const paged = await dismissalApi.list({ pageSize: 2, page: 1 })
    expect(paged.data).toHaveLength(2)
    expect(paged.meta.totalItems).toBe(all.meta.totalItems)
    const bad = await failure(dismissalApi.list({ dateFrom: today, dateTo: '2000-01-01' }))
    expect(bad.status).toBe(422)
  })

  it('context returns the student attendance of the day (hits the /context handler)', async () => {
    await loginAs('piket')
    const s = pickStudent('cls_2')
    const ctx = await dismissalApi.context(s.id, today)
    expect(ctx.student.id).toBe(s.id)
    expect(ctx.date).toBe(today)
    expect(ctx.attendance).toHaveLength(1)
    const rec = db().studentRecords.find((r) => r.studentId === s.id && r.sessionId === ctx.attendance[0]!.sessionId)
    expect(ctx.attendance[0]!.status).toBe(rec?.status ?? null)
    expect(ctx.attendance[0]!.sessionStatus).toBe('FINAL')
  })
})

describe('PATCH / DELETE /student-dismissals/:id', () => {
  async function temporaryExit() {
    await loginAs('piket')
    const s = pickStudent()
    return dismissalApi.create(
      { studentId: s.id, date: today, exitTime: combineDateTime(today, '10:00'), type: 'TEMPORARY_EXIT', note: 'Fotokopi' },
      `tmp-${s.id}`,
    )
  }

  it('marks a temporary exit as returned, then rejects a second mark (409)', async () => {
    const d = await temporaryExit()
    const e1 = await failure(dismissalApi.markReturned(d.id, combineDateTime(today, '09:00')))
    expect(e1.status).toBe(422)
    const upd = await dismissalApi.markReturned(d.id, combineDateTime(today, '10:45'))
    expect(upd.returnTime).toBe(combineDateTime(today, '10:45'))
    const e2 = await failure(dismissalApi.markReturned(d.id, combineDateTime(today, '11:00')))
    expect(e2.status).toBe(409)
  })

  it('corrections require a reason and are audited as CORRECT', async () => {
    const d = await temporaryExit()
    const e = await failure(api.patch(`/student-dismissals/${d.id}`, { note: 'ubah', reason: '' }))
    expect(e.status).toBe(422)
    expect(e.details.reason).toBeTruthy()

    const upd = await dismissalApi.correct(d.id, {
      type: 'EARLY_LEAVE',
      exitTime: combineDateTime(today, '10:05'),
      pickupName: 'Ibu Sari',
      pickupRelation: 'Ibu',
      note: 'Ternyata sakit, dijemput',
      reason: 'Salah jenis kepulangan',
    })
    expect(upd).toMatchObject({ type: 'EARLY_LEAVE', returnTime: null, pickupName: 'Ibu Sari' })
    const log = db().auditLogs.find((a) => a.entityId === d.id && a.action === 'CORRECT')
    expect(log?.reason).toBe('Salah jenis kepulangan')
    expect(log?.before).toMatchObject({ type: 'TEMPORARY_EXIT' })
  })

  it('soft-deletes with reason and audit; deleted rows disappear from the list', async () => {
    const d = await temporaryExit()
    const e = await failure(api.delete(`/student-dismissals/${d.id}`))
    expect(e.status).toBe(422)
    await dismissalApi.remove(d.id, 'Salah siswa')
    expect(isDeleted('dismissals', d.id)).toBe(true)
    expect(db().dismissals.some((x) => x.id === d.id)).toBe(true) // tetap ada (soft delete)
    const list = await dismissalApi.list({ date: today, pageSize: 500 })
    expect(list.data.some((x: StudentDismissal) => x.id === d.id)).toBe(false)
    expect(db().auditLogs.some((a) => a.entityId === d.id && a.action === 'DELETE' && a.reason === 'Salah siswa')).toBe(true)
  })

  it('walikelas cannot patch or delete (403)', async () => {
    const d = await temporaryExit()
    await loginAs('walikelas')
    expect((await failure(dismissalApi.markReturned(d.id, combineDateTime(today, '11:00')))).status).toBe(403)
    expect((await failure(dismissalApi.remove(d.id, 'coba hapus'))).status).toBe(403)
  })
})
