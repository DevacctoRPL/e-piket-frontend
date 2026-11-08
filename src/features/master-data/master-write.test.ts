import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { addDays, todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { dutyTeacherIds, rosterForClass } from '@/mocks/domain'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { AcademicYear, AuditLog, ClassRoom, DutyAssignment, Student, Subject, TimetableSlot } from '@/types/entities'

const fail = (p: Promise<unknown>) => p.then(() => null).catch((e: unknown) => e as ApiError)

const baseStudent = {
  nis: 'NEW-0001',
  name: 'Siswa Uji',
  gender: 'L',
  classId: 'cls_1',
  status: 'ACTIVE',
  inactiveFrom: null,
  guardianName: 'Wali Uji',
  guardianPhone: '081234567890',
}

describe('master-write: otorisasi (AC-13)', () => {
  it('guru mendapat 403 saat membuat kelas', async () => {
    await loginAs('guru')
    const err = await fail(
      api.post('/classes', { name: 'X UJI', grade: 10, program: 'Uji', shiftCode: 'MORNING', status: 'ACTIVE' }),
    )
    expect(err).toBeInstanceOf(ApiError)
    expect(err?.status).toBe(403)
  })

  it('pimpinan (master:read) dapat membaca penugasan piket tetapi tidak dapat mengubahnya', async () => {
    await loginAs('kepsek')
    const res = await api.get<DataResponse<DutyAssignment[]>>('/duty-assignments', { type: 'routine' })
    expect(res.data.length).toBeGreaterThan(0)
    const err = await fail(api.delete(`/duty-assignments/${res.data[0]!.id}`))
    expect(err?.status).toBe(403)
  })
})

describe('master-write: siswa', () => {
  it('NIS duplikat ditolak 422 dengan detail field', async () => {
    await loginAs('admin')
    const existing = db().students[0]!
    const err = await fail(api.post('/students', { ...baseStudent, nis: existing.nis }))
    expect(err?.status).toBe(422)
    expect(err?.details.nis).toBe('duplicate')
  })

  it('field wajib kosong → 422 per field', async () => {
    await loginAs('admin')
    const err = await fail(api.post('/students', { nis: '', name: '', gender: 'X', classId: '' }))
    expect(err?.status).toBe(422)
    expect(err?.details).toMatchObject({ nis: 'required', name: 'required', gender: 'invalid', classId: 'required' })
  })

  it('status nonaktif wajib tanggal efektif', async () => {
    await loginAs('admin')
    const err = await fail(api.post('/students', { ...baseStudent, status: 'INACTIVE', inactiveFrom: null }))
    expect(err?.details.inactiveFrom).toBeTruthy()
  })

  it('siswa nonaktif tidak muncul di roster mulai tanggal efektif (FR-MST-03)', async () => {
    await loginAs('admin')
    const created = await api.post<DataResponse<Student>>('/students', baseStudent)
    const today = todayISO()
    expect(rosterForClass('cls_1', today).some((s) => s.id === created.data.id)).toBe(true)

    await api.patch(`/students/${created.data.id}`, { status: 'INACTIVE', inactiveFrom: today })
    expect(rosterForClass('cls_1', addDays(today, -1)).some((s) => s.id === created.data.id)).toBe(true)
    expect(rosterForClass('cls_1', today).some((s) => s.id === created.data.id)).toBe(false)
    expect(rosterForClass('cls_1', addDays(today, 5)).some((s) => s.id === created.data.id)).toBe(false)
  })

  it('POST dengan Idempotency-Key yang sama tidak membuat data ganda (AC-03)', async () => {
    await loginAs('admin')
    const before = db().students.length
    const key = 'idem-student-1'
    const a = await api.post<DataResponse<Student>>('/students', baseStudent, { idempotencyKey: key })
    const b = await api.post<DataResponse<Student>>('/students', baseStudent, { idempotencyKey: key })
    expect(a.data.id).toBe(b.data.id)
    expect(db().students.length).toBe(before + 1)
  })
})

describe('master-write: kelas', () => {
  it('kelas yang masih memiliki siswa aktif tidak dapat dihapus (409)', async () => {
    await loginAs('admin')
    const err = await fail(api.delete('/classes/cls_1'))
    expect(err?.status).toBe(409)
    expect(err?.code).toBe('CLASS_HAS_STUDENTS')
    expect(err?.message).toMatch(/siswa aktif/)
  })

  it('kelas kosong dihapus secara soft delete + audit', async () => {
    await loginAs('admin')
    const c = await api.post<DataResponse<ClassRoom>>('/classes', {
      name: 'XII UJI 9',
      grade: 12,
      program: 'Program Uji',
      shiftCode: 'MORNING',
      homeroomTeacherId: null,
      status: 'ACTIVE',
    })
    await api.delete(`/classes/${c.data.id}`)
    const list = await api.get<DataResponse<ClassRoom[]>>('/classes')
    expect(list.data.some((x) => x.id === c.data.id)).toBe(false)
    expect(db().classes.some((x) => x.id === c.data.id)).toBe(true) // data tetap ada (soft delete)
    const log = db().auditLogs.find((l: AuditLog) => l.entityId === c.data.id && l.action === 'DELETE')
    expect(log).toBeDefined()
  })
})

describe('master-write: mata pelajaran & shift', () => {
  it('kode mapel unik (tanpa membedakan huruf besar/kecil)', async () => {
    await loginAs('admin')
    const err = await fail(api.post('/subjects', { code: 'mtk', name: 'Matematika Lanjut' }))
    expect(err?.status).toBe(422)
    expect(err?.details.code).toBe('duplicate')
    const ok = await api.post<DataResponse<Subject>>('/subjects', { code: 'kim', name: 'Kimia' })
    expect(ok.data.code).toBe('KIM')
  })

  it('periode jam: jam selesai harus setelah jam mulai', async () => {
    await loginAs('admin')
    const err = await fail(api.post('/periods', { shiftCode: 'MORNING', number: 9, startTime: '13:00', endTime: '12:00' }))
    expect(err?.details.endTime).toBeTruthy()
  })
})

describe('master-write: jadwal (FR-MST-05)', () => {
  const slotOf = (id: string) => db().timetable.find((s) => s.id === id)!

  it('guru yang sama pada jam beririsan → 409 SCHEDULE_CONFLICT dengan detail', async () => {
    await loginAs('admin')
    const existing = slotOf('tt_1_cls_1_1') // Senin, MORNING, jam 1–2
    const otherClass = db().classes.find((c) => c.shiftCode === 'MORNING' && c.id !== existing.classId)!
    // kosongkan slot kelas lain pada jam itu agar yang diuji hanya bentrok guru
    const blocking = db().timetable.filter(
      (s) => s.classId === otherClass.id && s.dayOfWeek === 1 && s.periodStart <= 2 && s.periodEnd >= 1,
    )
    for (const s of blocking) await api.delete(`/timetables/${s.id}`)

    const err = await fail(
      api.post('/timetables', {
        dayOfWeek: 1,
        shiftCode: 'MORNING',
        classId: otherClass.id,
        teacherId: existing.teacherId,
        subjectId: existing.subjectId,
        periodStart: 2,
        periodEnd: 3,
      }),
    )
    expect(err?.status).toBe(409)
    expect(err?.code).toBe('SCHEDULE_CONFLICT')
    expect(err?.details.teacherId).toBeTruthy()
    expect(err?.details.conflictSlotIds).toContain(existing.id)
    expect(err?.details['conflicts.0']).toMatch(/sudah mengajar/)
  })

  it('kelas yang sama pada jam beririsan → 409 (bentrok kelas)', async () => {
    await loginAs('admin')
    const existing = slotOf('tt_1_cls_1_1')
    const freeTeacher = db().teachers.find(
      (t) => !db().timetable.some((s) => s.teacherId === t.id && s.dayOfWeek === 1 && s.shiftCode === 'MORNING'),
    )!
    const err = await fail(
      api.post('/timetables', {
        dayOfWeek: 1,
        shiftCode: 'MORNING',
        classId: existing.classId,
        teacherId: freeTeacher.id,
        subjectId: existing.subjectId,
        periodStart: 1,
        periodEnd: 1,
      }),
    )
    expect(err?.code).toBe('SCHEDULE_CONFLICT')
    expect(err?.details.classId).toBeTruthy()
    expect(err?.details.teacherId).toBeUndefined()
  })

  it('slot valid tersimpan dengan periodCount = end - start + 1; edit dirinya sendiri tidak bentrok', async () => {
    await loginAs('admin')
    const existing = slotOf('tt_1_cls_1_1')
    const res = await api.patch<DataResponse<TimetableSlot>>(`/timetables/${existing.id}`, { periodStart: 1, periodEnd: 1 })
    expect(res.data.periodCount).toBe(1)
    const res2 = await api.patch<DataResponse<TimetableSlot>>(`/timetables/${existing.id}`, { periodEnd: 2 })
    expect(res2.data.periodCount).toBe(2)
  })
})

describe('master-write: tahun ajaran', () => {
  it('hanya satu tahun ajaran & semester yang aktif', async () => {
    await loginAs('admin')
    const y = await api.get<DataResponse<AcademicYear[]>>('/academic-years')
    const inactive = y.data.find((x) => !x.isActive)!
    const sem = inactive.semesters[1]!
    await api.patch(`/academic-years/${inactive.id}`, { isActive: true, activeSemesterId: sem.id })
    const after = await api.get<DataResponse<AcademicYear[]>>('/academic-years')
    expect(after.data.filter((x) => x.isActive).map((x) => x.id)).toEqual([inactive.id])
    expect(after.data.flatMap((x) => x.semesters).filter((s) => s.isActive).map((s) => s.id)).toEqual([sem.id])
  })

  it('tahun ajaran aktif tidak dapat dihapus', async () => {
    await loginAs('admin')
    const err = await fail(api.delete('/academic-years/ay_1'))
    expect(err?.status).toBe(409)
  })
})

describe('master-write: petugas piket (FR-DUTY-01)', () => {
  it('penugasan tanggal khusus menimpa jadwal rutin dan tercatat di audit', async () => {
    await loginAs('admin')
    const date = addDays(todayISO(), 3)
    const res = await api.post<DataResponse<DutyAssignment>>('/duty-assignments', {
      date,
      dayOfWeek: null,
      shiftCode: 'MORNING',
      teacherIds: ['tch_7'],
      note: 'Tukar jadwal',
    })
    expect(dutyTeacherIds(date, 'MORNING')).toEqual(['tch_7'])
    await api.patch(`/duty-assignments/${res.data.id}`, { teacherIds: ['tch_7', 'tch_8'] })
    const logs = db().auditLogs.filter((l) => l.entity === 'DutyAssignment' && l.entityId === res.data.id)
    expect(logs.map((l) => l.action).sort()).toEqual(['CREATE', 'UPDATE'])
    expect(logs.find((l) => l.action === 'UPDATE')?.before).toMatchObject({ teacherIds: ['tch_7'] })
  })

  it('tanpa guru → 422; duplikat hari/shift rutin → 422', async () => {
    await loginAs('admin')
    const e1 = await fail(api.post('/duty-assignments', { dayOfWeek: 1, date: null, shiftCode: 'MORNING', teacherIds: [] }))
    expect(e1?.status).toBe(422)
    expect(e1?.details.teacherIds).toBeTruthy()
    const e2 = await fail(api.post('/duty-assignments', { dayOfWeek: 1, date: null, shiftCode: 'MORNING', teacherIds: ['tch_5'] }))
    expect(e2?.status).toBe(422)
    expect(e2?.details.dayOfWeek).toBeTruthy()
  })
})
