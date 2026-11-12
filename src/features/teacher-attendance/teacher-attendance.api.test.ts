import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { combineDateTime, todayISO } from '@/lib/date'
import {
  computeLateMinutes,
  statusForCheckIn,
} from '@/mocks/handlers/teacher-attendance-rules'
import { db } from '@/mocks/db'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { ScheduledTeacherRow, TeacherAttendance, TimetableSlot } from '@/types/entities'
import type { MyTeacherAttendanceDay, TeacherAttendanceHistory } from './types'

const MORNING = { startTime: '07:00', lateToleranceMinutes: 10 }

async function fail(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

const scheduled = (date = todayISO()) =>
  api.get<DataResponse<ScheduledTeacherRow[]>>('/teacher-attendance', { date }).then((r) => r.data)

afterEach(() => {
  vi.useRealTimers()
})

describe('Idempotency-Key dibatasi per method + path + user', () => {
  it('kunci yang sama di endpoint lain tidak memutar ulang response sebelumnya', async () => {
    const today = todayISO()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(combineDateTime(today, '07:05')))
    await loginAs('guru')
    const inRes = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-in', {}, { idempotencyKey: 'shared-key' })
    vi.setSystemTime(new Date(combineDateTime(today, '12:30')))
    const outRes = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-out', {}, { idempotencyKey: 'shared-key' })
    expect(outRes.data.checkOutAt).toBe(combineDateTime(today, '12:30'))
    expect(inRes.data.checkOutAt).toBeNull()
  })
})

describe('aturan keterlambatan (FR-TCH-01)', () => {
  it('menghitung menit terlambat dari batas toleransi', () => {
    const d = '2026-11-09'
    expect(computeLateMinutes(MORNING, combineDateTime(d, '07:10'))).toBeNull()
    expect(computeLateMinutes(MORNING, combineDateTime(d, '06:45'))).toBeNull()
    expect(computeLateMinutes(MORNING, combineDateTime(d, '07:11'))).toBe(1)
    expect(statusForCheckIn(MORNING, combineDateTime(d, '07:35'))).toEqual({ status: 'LATE', lateMinutes: 25 })
    expect(statusForCheckIn(MORNING, combineDateTime(d, '07:05'))).toEqual({ status: 'PRESENT', lateMinutes: null })
  })
})

describe('check-in / check-out mandiri (AC-07)', () => {
  it('check-in setelah toleransi tercatat Terlambat; check-in kedua 409; replay idempoten', async () => {
    const today = todayISO()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(combineDateTime(today, '07:25')))
    await loginAs('guru')

    const me = await api.get<DataResponse<MyTeacherAttendanceDay>>('/teacher-attendance/me')
    expect(me.data.attendance).toBeNull()
    expect(me.data.shift?.code).toBe('MORNING')
    expect(me.data.slots.length).toBeGreaterThan(0)

    const r = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-in', {}, { idempotencyKey: 'k-in-1' })
    expect(r.data.status).toBe('LATE')
    expect(r.data.lateMinutes).toBe(15)
    expect(r.data.checkInAt).toBe(combineDateTime(today, '07:25'))
    expect(r.data.source).toBe('SELF')

    // Klik ganda dengan kunci yang sama → response yang sama, tanpa record baru (AC-03).
    const replay = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-in', {}, { idempotencyKey: 'k-in-1' })
    expect(replay.data.id).toBe(r.data.id)

    const again = await fail(api.post('/teacher-attendance/check-in', {}, { idempotencyKey: 'k-in-2' }))
    expect(again.status).toBe(409)

    vi.setSystemTime(new Date(combineDateTime(today, '12:20')))
    const out = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-out', {}, { idempotencyKey: 'k-out-1' })
    expect(out.data.checkOutAt).toBe(combineDateTime(today, '12:20'))
    const outAgain = await fail(api.post('/teacher-attendance/check-out', {}, { idempotencyKey: 'k-out-2' }))
    expect(outAgain.status).toBe(409)

    const hist = await api.get<DataResponse<TeacherAttendanceHistory>>('/teacher-attendance/history', {
      teacherId: 'tch_1',
      dateFrom: today,
      dateTo: today,
    })
    expect(hist.data.records).toHaveLength(1)
    expect(hist.data.summary.LATE).toBe(1)
  })

  it('check-out sebelum check-in ditolak 409', async () => {
    await loginAs('guru')
    const e = await fail(api.post('/teacher-attendance/check-out', {}, { idempotencyKey: 'k-x' }))
    expect(e.status).toBe(409)
    expect(e.code).toBe('NOT_CHECKED_IN')
  })

  it('akun tanpa data guru tidak dapat check-in (403)', async () => {
    await loginAs('kepsek')
    const e = await fail(api.post('/teacher-attendance/check-in', {}, { idempotencyKey: 'k-k' }))
    expect(e.status).toBe(403)
  })
})

describe('daftar guru terjadwal (FR-TCH-04)', () => {
  it('guru biasa mendapat 403 pada GET /teacher-attendance (AC-13)', async () => {
    await loginAs('guru')
    const e = await fail(api.get('/teacher-attendance', { date: todayISO() }))
    expect(e.status).toBe(403)
  })

  it('hanya menampilkan guru yang punya jadwal, tugas piket, atau jadwal kehadiran; guru absen seed terlihat', async () => {
    await loginAs('piket')
    const today = todayISO()
    const rows = await scheduled(today)
    const slots = await api.get<DataResponse<TimetableSlot[]>>('/timetables', { date: today }).then((r) => r.data)
    const withSlots = new Set(slots.map((s) => s.teacherId))
    for (const r of rows) expect(withSlots.has(r.teacher.id) || r.isDutyTeacher || r.isAttendanceScheduled).toBe(true)
    const sick = rows.find((r) => r.teacher.id === 'tch_4')
    expect(sick?.attendance?.status).toBe('SICK')
    expect(sick?.attendance?.affectedPeriods).toBe(sick?.scheduledPeriods)
  })

  it('filter shift membatasi daftar', async () => {
    await loginAs('piket')
    const rows = await api
      .get<DataResponse<ScheduledTeacherRow[]>>('/teacher-attendance', { date: todayISO(), shiftCode: 'AFTERNOON' })
      .then((r) => r.data)
    expect(rows.some((r) => r.teacher.id === 'tch_12')).toBe(true)
    expect(rows.some((r) => r.teacher.id === 'tch_4' && !r.isDutyTeacher)).toBe(false)
  })
})

describe('catat status oleh piket (FR-TCH-02/03, §9.3)', () => {
  it('alasan wajib untuk status Sakit (422) dan jam datang ≤ jam pulang (422)', async () => {
    await loginAs('piket')
    const today = todayISO()
    const base = { teacherId: 'tch_1', date: today, shiftCode: 'MORNING' }
    const e = await fail(api.post('/teacher-attendance', { ...base, status: 'SICK' }, { idempotencyKey: 'r-1' }))
    expect(e.status).toBe(422)
    expect(e.details.reason).toBeTruthy()

    const e2 = await fail(
      api.post(
        '/teacher-attendance',
        {
          ...base,
          status: 'PRESENT',
          checkInAt: combineDateTime(today, '10:00'),
          checkOutAt: combineDateTime(today, '08:00'),
        },
        { idempotencyKey: 'r-2' },
      ),
    )
    expect(e2.status).toBe(422)
    expect(e2.details.checkOutAt).toBeTruthy()

    const e3 = await fail(api.post('/teacher-attendance', { date: today }, { idempotencyKey: 'r-3' }))
    expect(e3.details).toMatchObject({ teacherId: 'required', shiftCode: 'required', status: 'required' })
  })

  it('jam terdampak dihitung dari jadwal; upsert tanpa duplikasi; audit tercatat', async () => {
    await loginAs('piket')
    const today = todayISO()
    const slots = await api
      .get<DataResponse<TimetableSlot[]>>('/timetables', { date: today, teacherId: 'tch_1' })
      .then((r) => r.data)
    const expected = slots.reduce((n, s) => n + s.periodCount, 0)
    expect(expected).toBeGreaterThan(0)

    const body = { teacherId: 'tch_1', date: today, shiftCode: 'MORNING', status: 'ABSENT', reason: 'Tanpa kabar' }
    const r = await api.post<DataResponse<TeacherAttendance>>('/teacher-attendance', body, { idempotencyKey: 'u-1' })
    expect(r.data.affectedPeriodsComputed).toBe(expected)
    expect(r.data.affectedPeriods).toBe(expected)
    expect(r.data.source).toBe('DUTY')

    const r2 = await api.post<DataResponse<TeacherAttendance>>(
      '/teacher-attendance',
      { ...body, status: 'PERMISSION', reason: 'Keluarga sakit' },
      { idempotencyKey: 'u-2' },
    )
    expect(r2.data.id).toBe(r.data.id)
    expect(r2.data.status).toBe('PERMISSION')
    const rows = (await scheduled(today)).filter((x) => x.teacher.id === 'tch_1')
    expect(rows).toHaveLength(1)

    // Status hadir → tidak ada jam terdampak.
    const r3 = await api.post<DataResponse<TeacherAttendance>>(
      '/teacher-attendance',
      { ...body, status: 'PRESENT', reason: null, checkInAt: combineDateTime(today, '07:00') },
      { idempotencyKey: 'u-3' },
    )
    expect(r3.data.affectedPeriods).toBe(0)

    const logs = db().auditLogs.filter((l) => l.entityId === r.data.id)
    expect(logs.map((l) => l.action).sort()).toEqual(['CREATE', 'UPDATE', 'UPDATE'])
  })

  it('guru tidak dapat mencatat status guru lain (403)', async () => {
    await loginAs('guru')
    const e = await fail(
      api.post(
        '/teacher-attendance',
        { teacherId: 'tch_5', date: todayISO(), shiftCode: 'MORNING', status: 'PRESENT' },
        { idempotencyKey: 'g-1' },
      ),
    )
    expect(e.status).toBe(403)
  })
})

describe('koreksi (PATCH) — FR-TCH-03, FR-OUT-03', () => {
  async function sickRecord() {
    const rows = await scheduled()
    const a = rows.find((r) => r.teacher.id === 'tch_4')?.attendance
    if (!a) throw new Error('seed: tch_4 seharusnya sakit hari ini')
    return a
  }

  it('override jam terdampak wajib beralasan; nilai efektif = override', async () => {
    await loginAs('piket')
    const a = await sickRecord()
    const e = await fail(api.patch(`/teacher-attendance/${a.id}`, { affectedPeriodsOverride: 2, version: a.version }))
    expect(e.status).toBe(422)
    expect(e.details.overrideReason).toBeTruthy()

    const neg = await fail(
      api.patch(`/teacher-attendance/${a.id}`, { affectedPeriodsOverride: -1, overrideReason: 'x yz', version: a.version }),
    )
    expect(neg.details.affectedPeriodsOverride).toBe('negative')

    const ok = await api.patch<DataResponse<TeacherAttendance>>(`/teacher-attendance/${a.id}`, {
      affectedPeriodsOverride: 2,
      overrideReason: 'Dua jam pertama sudah diisi tugas mandiri',
      version: a.version,
    })
    expect(ok.data.affectedPeriodsComputed).toBe(a.affectedPeriodsComputed)
    expect(ok.data.affectedPeriodsOverride).toBe(2)
    expect(ok.data.affectedPeriods).toBe(2)
    expect(ok.data.version).toBe(a.version + 1)

    // Versi lama → 409 VERSION_CONFLICT.
    const stale = await fail(
      api.patch(`/teacher-attendance/${a.id}`, { affectedPeriodsOverride: null, version: a.version }),
    )
    expect(stale.status).toBe(409)
    expect(stale.code).toBe('VERSION_CONFLICT')

    // Kembali ke hitungan sistem.
    const back = await api.patch<DataResponse<TeacherAttendance>>(`/teacher-attendance/${a.id}`, {
      affectedPeriodsOverride: null,
      version: ok.data.version,
    })
    expect(back.data.affectedPeriods).toBe(a.affectedPeriodsComputed)
  })

  it('perubahan status/jam manual wajib alasan koreksi', async () => {
    await loginAs('piket')
    const a = await sickRecord()
    const e = await fail(
      api.patch(`/teacher-attendance/${a.id}`, {
        status: 'LATE',
        checkInAt: combineDateTime(todayISO(), '08:00'),
        version: a.version,
      }),
    )
    expect(e.status).toBe(422)
    expect(e.details.correctionReason).toBeTruthy()

    const ok = await api.patch<DataResponse<TeacherAttendance>>(`/teacher-attendance/${a.id}`, {
      status: 'LATE',
      reason: 'Datang setelah kontrol dokter',
      checkInAt: combineDateTime(todayISO(), '08:00'),
      correctionReason: 'Guru ternyata datang terlambat',
      version: a.version,
    })
    expect(ok.data.status).toBe('LATE')
    expect(ok.data.affectedPeriodsComputed).toBe(0)
    expect(ok.data.lateMinutes).toBe(50)
    const audit = db().auditLogs.find((l) => l.entityId === a.id && l.action === 'CORRECT')
    expect(audit?.reason).toBe('Guru ternyata datang terlambat')
    expect(audit?.before).toMatchObject({ status: 'SICK' })
  })
})

describe('riwayat & rekap (FR-TCH-05)', () => {
  it('guru hanya boleh melihat riwayat sendiri', async () => {
    await loginAs('guru')
    const e = await fail(api.get('/teacher-attendance/history', { teacherId: 'tch_5' }))
    expect(e.status).toBe(403)
    const own = await api.get<DataResponse<TeacherAttendanceHistory>>('/teacher-attendance/history')
    expect(own.data.records.every((r) => r.teacherId === 'tch_1')).toBe(true)
  })

  it('pimpinan melihat rekap per guru dengan filter status', async () => {
    await loginAs('kepsek')
    const today = todayISO()
    const all = await api.get<DataResponse<TeacherAttendanceHistory>>('/teacher-attendance/history', {
      dateFrom: today,
      dateTo: today,
    })
    expect(all.data.summary.SICK).toBeGreaterThanOrEqual(1)
    const sumPerTeacher = all.data.byTeacher.reduce((n, r) => n + r.counts.total, 0)
    expect(sumPerTeacher).toBe(all.data.summary.total)

    const sick = await api.get<DataResponse<TeacherAttendanceHistory>>('/teacher-attendance/history', {
      dateFrom: today,
      dateTo: today,
      status: 'SICK',
    })
    expect(sick.data.records.every((r) => r.status === 'SICK')).toBe(true)

    const bad = await fail(api.get('/teacher-attendance/history', { dateFrom: today, dateTo: '2020-01-01' }))
    expect(bad.status).toBe(422)
  })
})
