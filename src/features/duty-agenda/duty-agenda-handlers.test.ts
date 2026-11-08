import { describe, expect, it } from 'vitest'
import { ApiError, newIdempotencyKey } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DutyAgenda } from '@/types/entities'
import { dutyAgendaApi } from './api'

const today = todayISO()

async function createMorning() {
  return dutyAgendaApi.create({ date: today, shiftCode: 'MORNING' }, newIdempotencyKey())
}

async function expectApiError(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).status).toBe(status)
  if (code) expect((err as ApiError).code).toBe(code)
  return err as ApiError
}

async function addNote(a: DutyAgenda) {
  return dutyAgendaApi.addNote(
    a.id,
    { time: `${today}T09:15:00+07:00`, category: 'Kejadian', content: 'Siswa sakit diantar ke UKS.' },
    newIdempotencyKey(),
  )
}

describe('duty agenda mock API', () => {
  it('prefills today context with duty officers and absent teachers (FR-DUTY-02/03)', async () => {
    await loginAs('piket')
    const today = await dutyAgendaApi.today()
    const morning = today.find((t) => t.shiftCode === 'MORNING')
    expect(morning?.agenda.id).toBeNull()
    expect(morning?.isDutyTeacher).toBe(true)
    expect(morning?.canCreate).toBe(true)
    expect(morning?.agenda.dutyTeacherIds).toContain('tch_2')
    const absentIds = morning?.agenda.absentTeachers.map((r) => r.teacherId) ?? []
    expect(absentIds).toEqual(expect.arrayContaining(['tch_4', 'tch_6']))
    expect(morning?.agenda.scheduledTeacherCount).toBeGreaterThan(0)
  })

  it('creates one agenda per date + shift and returns the existing one afterwards', async () => {
    await loginAs('piket')
    const first = await createMorning()
    expect(first.status).toBe('DRAFT')
    const second = await createMorning()
    expect(second.id).toBe(first.id)
    expect(db().dutyAgendas.filter((a) => a.date === today && a.shiftCode === 'MORNING')).toHaveLength(1)
  })

  it('replays the same idempotency key without creating duplicates (AC-03)', async () => {
    await loginAs('piket')
    const key = newIdempotencyKey()
    const a = await dutyAgendaApi.create({ date: today, shiftCode: 'AFTERNOON' }, key)
    const b = await dutyAgendaApi.create({ date: today, shiftCode: 'AFTERNOON' }, key)
    expect(b.id).toBe(a.id)
  })

  it('forbids a non-duty teacher from creating an agenda (403, AC-13)', async () => {
    await loginAs('guru')
    await expectApiError(createMorning(), 403, 'FORBIDDEN')
  })

  it('forbids a non-officer from editing a draft', async () => {
    await loginAs('piket')
    const a = await createMorning()
    await loginAs('kepsek')
    await expectApiError(dutyAgendaApi.update(a.id, { noImportantNotes: true, version: a.version }), 403)
  })

  it('validates create input (422)', async () => {
    await loginAs('piket')
    const err = await expectApiError(
      dutyAgendaApi.create({ date: 'kemarin', shiftCode: '' }, newIdempotencyKey()),
      422,
      'VALIDATION_ERROR',
    )
    expect(err.details).toMatchObject({ date: 'invalid', shiftCode: 'required' })
  })

  it('rejects submit when sections are incomplete (422 §9.3)', async () => {
    await loginAs('piket')
    const a = await createMorning()
    const err = await expectApiError(
      dutyAgendaApi.submit(a.id, { final: true, version: a.version }, newIdempotencyKey()),
      422,
    )
    expect(err.details.notes).toBeDefined()
    expect(err.details.absentTeachers).toBeUndefined()
  })

  it('requires a reason for every absent teacher row', async () => {
    const att = db().teacherAttendance.find((x) => x.date === today && x.teacherId === 'tch_4')
    expect(att).toBeDefined()
    att!.reason = null
    await loginAs('piket')
    const a = await createMorning()
    const withNote = await addNote(a)
    const err = await expectApiError(
      dutyAgendaApi.submit(a.id, { final: true, version: withNote.version }, newIdempotencyKey()),
      422,
    )
    const idx = withNote.absentTeachers.findIndex((r) => r.teacherId === 'tch_4')
    expect(err.details[`absentTeachers.${idx}.reason`]).toBeDefined()
  })

  it('rejects stale version on PATCH (409 VERSION_CONFLICT)', async () => {
    await loginAs('piket')
    const a = await createMorning()
    await dutyAgendaApi.update(a.id, { substitutionSummary: 'Tugas mandiri', version: a.version })
    await expectApiError(
      dutyAgendaApi.update(a.id, { substitutionSummary: 'Lain', version: a.version }),
      409,
      'VERSION_CONFLICT',
    )
  })

  it('finalizes, freezes the snapshot, then blocks PATCH with 409 ALREADY_FINAL', async () => {
    await loginAs('piket')
    const a = await createMorning()
    const withNote = await addNote(a)
    const final = await dutyAgendaApi.submit(a.id, { final: true, version: withNote.version }, newIdempotencyKey())
    expect(final.status).toBe('FINAL')
    expect(final.finalizedAt).toMatch(/\+07:00$/)
    expect(db().auditLogs.some((l) => l.entityId === a.id && l.action === 'FINALIZE')).toBe(true)

    // perubahan absensi guru setelah final tidak mengubah snapshot
    const count = final.absentTeachers.length
    db().teacherAttendance.find((x) => x.date === today && x.teacherId === 'tch_4')!.status = 'PRESENT'
    const reread = await dutyAgendaApi.get(a.id)
    expect(reread.absentTeachers).toHaveLength(count)

    await expectApiError(
      dutyAgendaApi.update(a.id, { substitutionSummary: 'Ubah', version: final.version }),
      409,
      'ALREADY_FINAL',
    )
    await expectApiError(
      dutyAgendaApi.submit(a.id, { final: true, version: final.version }, newIdempotencyKey()),
      409,
      'ALREADY_FINAL',
    )
    // petugas piket tanpa hak koreksi tidak dapat mengoreksi walau memberi alasan
    await expectApiError(
      dutyAgendaApi.update(a.id, { substitutionSummary: 'Ubah', version: final.version, correctionReason: 'Salah ketik' }),
      403,
    )
  })

  it('lets the principal correct a FINAL agenda with a reason and writes an audit CORRECT', async () => {
    await loginAs('piket')
    const a = await createMorning()
    const withNote = await addNote(a)
    const final = await dutyAgendaApi.submit(a.id, { final: true, version: withNote.version }, newIdempotencyKey())

    await loginAs('kepsek')
    const corrected = await dutyAgendaApi.update(a.id, {
      substitutionSummary: 'Jam ke-1–2 diisi tugas mandiri.',
      version: final.version,
      correctionReason: 'Melengkapi catatan penanggulangan',
    })
    expect(corrected.status).toBe('FINAL')
    expect(corrected.substitutionSummary).toBe('Jam ke-1–2 diisi tugas mandiri.')
    const log = db().auditLogs.find((l) => l.entityId === a.id && l.action === 'CORRECT')
    expect(log).toMatchObject({
      entity: 'DutyAgenda',
      reason: 'Melengkapi catatan penanggulangan',
      before: { substitutionSummary: null },
      after: { substitutionSummary: 'Jam ke-1–2 diisi tugas mandiri.' },
    })
  })

  it('manages notes and soft-deletes them with audit (FR-DUTY-04, FR-AUD-02)', async () => {
    await loginAs('piket')
    const a = await createMorning()
    const withNote = await addNote(a)
    const note = withNote.notes[0]!
    const err = await expectApiError(
      dutyAgendaApi.addNote(a.id, { time: '2020-01-01T09:00:00+07:00', category: 'Tidak ada', content: '' }, newIdempotencyKey()),
      422,
    )
    expect(Object.keys(err.details)).toEqual(expect.arrayContaining(['time', 'category', 'content']))

    const edited = await dutyAgendaApi.updateNote(a.id, note.id, {
      time: `${today}T10:00:00+07:00`,
      category: null,
      content: 'Isi diperbarui',
    })
    expect(edited.notes[0]?.content).toBe('Isi diperbarui')
    const after = await dutyAgendaApi.deleteNote(a.id, note.id)
    expect(after.notes).toHaveLength(0)
    expect(db().deleted.dutyNotes).toContain(note.id)
    expect(db().auditLogs.some((l) => l.entityId === a.id && l.action === 'DELETE')).toBe(true)
  })

  it('filters list by status and recomputes derived fields for drafts', async () => {
    await loginAs('piket')
    await createMorning()
    const drafts = await dutyAgendaApi.list({ status: 'DRAFT' })
    expect(drafts.data.length).toBeGreaterThan(0)
    expect(drafts.data.every((a) => a.status === 'DRAFT')).toBe(true)
    const finals = await dutyAgendaApi.list({ status: 'FINAL', pageSize: 5 })
    expect(finals.meta.pageSize).toBe(5)
    expect(finals.data.every((a) => a.status === 'FINAL')).toBe(true)
  })
})
