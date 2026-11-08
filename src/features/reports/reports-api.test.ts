import { describe, expect, it } from 'vitest'
import { api, apiFetch, ApiError } from '@/lib/api-client'
import { addDays, dateRange, todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { substitutionSlotsOn, summarizeSlots } from '@/mocks/domain'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { CurrentUser } from '@/types/entities'
import type {
  AttendanceReport,
  SubstitutionReport,
  TeacherAttendanceReport,
  TeachingLogReport,
} from './types'

const today = todayISO()
const from = addDays(today, -14)

const get = <T,>(path: string, query: Record<string, string>) =>
  api.get<DataResponse<T>>(path, query).then((r) => r.data)

async function exportRaw(query: Record<string, string>) {
  const res = await apiFetch<Response>('/reports/export', { method: 'GET', query, raw: true })
  // Blob.text() di jsdom membuang BOM; baca byte mentah.
  const bytes = new Uint8Array(await res.arrayBuffer())
  return { res, bytes, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) }
}

const err = (p: Promise<unknown>) => p.then(() => null).catch((e: unknown) => e as ApiError)

describe('GET /reports/attendance-summary', () => {
  it('total sama dengan jumlah record pada sesi Dikirim/Final dalam rentang', async () => {
    await loginAs('admin')
    const r = await get<AttendanceReport>('/reports/attendance-summary', { dateFrom: from, dateTo: today })
    const d = db()
    const sessions = new Set(
      d.studentSessions
        .filter((s) => s.date >= from && s.date <= today && (s.status === 'FINAL' || s.status === 'SUBMITTED'))
        .map((s) => s.id),
    )
    const expected = d.studentRecords.filter((x) => sessions.has(x.sessionId)).length
    expect(r.totals.total).toBe(expected)
    expect(r.rows.reduce((n, x) => n + x.total, 0)).toBe(expected)
    const sumCounts = Object.values(r.totals.counts).reduce((n, v) => n + v, 0)
    expect(sumCounts).toBe(expected)
    expect(r.totals.present).toBe(r.totals.counts.PRESENT + r.totals.counts.LATE)
    expect(r.sessionsExcluded).toBeGreaterThanOrEqual(1) // sesi Draft hari ini tidak dihitung
  })

  it('mendukung groupBy siswa dan tanggal dengan total yang sama', async () => {
    await loginAs('admin')
    const q = { dateFrom: from, dateTo: today, classId: 'cls_1' }
    const byClass = await get<AttendanceReport>('/reports/attendance-summary', q)
    const byStudent = await get<AttendanceReport>('/reports/attendance-summary', { ...q, groupBy: 'student' })
    const byDate = await get<AttendanceReport>('/reports/attendance-summary', { ...q, groupBy: 'date' })
    expect(byClass.rows).toHaveLength(1)
    expect(byStudent.totals.total).toBe(byClass.totals.total)
    expect(byDate.totals.total).toBe(byClass.totals.total)
    expect(byStudent.rows.every((x) => x.studentId)).toBe(true)
  })

  it('422 untuk tanggal tidak valid / rentang terbalik', async () => {
    await loginAs('admin')
    const e1 = await err(get('/reports/attendance-summary', { dateTo: today }))
    expect(e1?.status).toBe(422)
    expect(e1?.details.dateFrom).toBe('required')
    const e2 = await err(get('/reports/attendance-summary', { dateFrom: today, dateTo: from }))
    expect(e2?.status).toBe(422)
    expect(e2?.details.dateTo).toBeDefined()
    const e3 = await err(get('/reports/attendance-summary', { dateFrom: from, dateTo: today, groupBy: 'x' }))
    expect(e3?.details.groupBy).toBe('invalid')
  })

  it('wali kelas hanya melihat kelas binaan/yang diajar dan 403 untuk kelas lain', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me').then((r) => r.data)
    const scope = new Set([...me.homeroomClassIds, ...me.teachingClassIds])
    const r = await get<AttendanceReport>('/reports/attendance-summary', { dateFrom: from, dateTo: today })
    expect(r.rows.length).toBeGreaterThan(0)
    expect(r.rows.every((x) => x.classId && scope.has(x.classId))).toBe(true)
    const foreign = db().classes.find((c) => !scope.has(c.id))!
    const e = await err(get('/reports/attendance-summary', { dateFrom: from, dateTo: today, classId: foreign.id }))
    expect(e?.status).toBe(403)
  })
})

describe('GET /reports/export', () => {
  it('CSV ber-BOM, berisi judul/periode/waktu, header, dan menghormati filter kelas', async () => {
    await loginAs('admin')
    const { res, bytes, text } = await exportRaw({
      report: 'absentees',
      format: 'csv',
      dateFrom: from,
      dateTo: today,
      classId: 'cls_2',
    })
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain(
      `daftar-siswa-tidak-hadir-${from}_${today}_dibuat-${today}.csv`,
    )
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
    const lines = text.slice(1).split('\r\n')
    expect(lines[0]).toBe('Daftar Siswa Tidak Hadir')
    expect(text).toContain(`Periode,${from} s.d. ${today}`)
    expect(text).toContain('Dibuat pada')
    expect(text).toContain('Filter,Kelas: X AKL 1')
    const headerIdx = lines.findIndex((l) => l.startsWith('No,Tanggal,Shift,Kelas'))
    expect(headerIdx).toBeGreaterThan(0)
    const dataLines = lines.slice(headerIdx + 1).filter((l) => /^\d+,/.test(l))
    expect(dataLines.length).toBeGreaterThan(0)
    expect(dataLines.every((l) => l.includes(',X AKL 1,'))).toBe(true)
    expect(text).not.toContain(',X TKJ 1,')
  })

  it('angka ekspor sama dengan angka laporan di layar (AC-12)', async () => {
    await loginAs('kepsek')
    const q = { dateFrom: from, dateTo: today }
    const r = await get<AttendanceReport>('/reports/attendance-summary', q)
    const { text } = await exportRaw({ ...q, report: 'student-attendance', format: 'csv' })
    const total = text.split('\r\n').find((l) => l.startsWith(',TOTAL,'))
    expect(total).toContain(`,${r.totals.total},${r.totals.present},`)
  })

  it('format xlsx menghasilkan berkas Excel (.xls) yang mengikuti filter', async () => {
    await loginAs('admin')
    const { res, text } = await exportRaw({ report: 'dismissals', format: 'xlsx', dateFrom: from, dateTo: today })
    expect(res.headers.get('Content-Type')).toContain('application/vnd.ms-excel')
    expect(res.headers.get('Content-Disposition')).toMatch(/\.xls"/)
    expect(text).toContain('<table>')
    expect(text).toContain('Rekap Kepulangan Siswa')
  })

  it('guru tanpa report:export mendapat 403', async () => {
    await loginAs('guru')
    const e = await err(exportRaw({ report: 'student-attendance', format: 'csv', dateFrom: from, dateTo: today }))
    expect(e).toBeInstanceOf(ApiError)
    expect(e?.status).toBe(403)
  })

  it('wali kelas: ekspor hanya kelas binaan, 403 untuk kelas lain', async () => {
    await loginAs('walikelas')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me').then((r) => r.data)
    const scope = new Set([...me.homeroomClassIds, ...me.teachingClassIds])
    const allowedNames = db().classes.filter((c) => scope.has(c.id)).map((c) => c.name)
    const { text } = await exportRaw({ report: 'absentees', format: 'csv', dateFrom: from, dateTo: today })
    const lines = text.split('\r\n').filter((l) => /^\d+,\d{4}-/.test(l))
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => allowedNames.some((n) => l.includes(`,${n},`)))).toBe(true)
    const foreign = db().classes.find((c) => !scope.has(c.id))!
    const e = await err(
      exportRaw({ report: 'absentees', format: 'csv', dateFrom: from, dateTo: today, classId: foreign.id }),
    )
    expect(e?.status).toBe(403)
  })

  it('siswa tidak hadir: multi-status (status berulang), contacted, dan nama file sesuai PRD §13.2', async () => {
    await loginAs('admin')
    const rows = (t: string) => t.split('\r\n').filter((l) => /^\d+,\d{4}-/.test(l))
    const all = rows((await exportRaw({ report: 'absentees', format: 'csv', dateFrom: from, dateTo: today })).text)
    const res = await apiFetch<Response>('/reports/export', {
      method: 'GET',
      query: { report: 'absentees', format: 'csv', dateFrom: from, dateTo: today, status: ['SICK', 'ABSENT'] },
      raw: true,
    })
    const multi = rows(new TextDecoder().decode(await res.arrayBuffer()))
    expect(multi.length).toBeGreaterThan(0)
    expect(multi.length).toBeLessThanOrEqual(all.length)
    expect(multi.every((l) => l.includes(',Sakit,') || l.includes(',Alpa,'))).toBe(true)
    expect(res.headers.get('Content-Disposition')).toMatch(/daftar-siswa-tidak-hadir-.+_dibuat-\d{4}-\d{2}-\d{2}\.csv/)

    const contacted = rows((await exportRaw({ report: 'absentees', format: 'csv', dateFrom: from, dateTo: today, contacted: 'true' })).text)
    const notContacted = rows((await exportRaw({ report: 'absentees', format: 'csv', dateFrom: from, dateTo: today, contacted: 'false' })).text)
    expect(contacted.length + notContacted.length).toBe(all.length)
  })

  it('kegiatan tambahan: menghormati filter jenis & pengampu dari halaman daftar', async () => {
    await loginAs('admin')
    const range = { dateFrom: addDays(today, -60), dateTo: addDays(today, 60) }
    const act = db().extraActivities.find((a) => a.status !== 'CANCELLED' && a.instructorTeacherId)!
    const { text } = await exportRaw({
      report: 'extra-activities',
      format: 'csv',
      ...range,
      type: act.type,
      instructorTeacherId: act.instructorTeacherId!,
    })
    const lines = text.split('\r\n').filter((l) => /^\d+,\d{4}-/.test(l))
    const expected = db().extraActivities.filter(
      (a) =>
        a.status !== 'CANCELLED' &&
        a.date >= range.dateFrom &&
        a.date <= range.dateTo &&
        a.type === act.type &&
        a.instructorTeacherId === act.instructorTeacherId,
    )
    expect(lines).toHaveLength(expected.length)
    const e = await err(exportRaw({ report: 'extra-activities', format: 'csv', ...range, type: 'NOPE' }))
    expect(e?.status).toBe(422)
  })

  it('422 untuk report/format tidak dikenal', async () => {
    await loginAs('admin')
    const e = await err(exportRaw({ report: 'nope', format: 'pdf', dateFrom: from, dateTo: today }))
    expect(e?.status).toBe(422)
    expect(e?.details.report).toBe('invalid')
    expect(e?.details.format).toBeDefined()
  })
})

describe('laporan operasional lain', () => {
  it('jam kosong: total = ringkasan domain.substitutionSlotsOn per tanggal', async () => {
    await loginAs('piket')
    const r = await get<SubstitutionReport>('/reports/substitutions', { dateFrom: from, dateTo: today })
    const all = dateRange(from, today).flatMap((d) => substitutionSlotsOn(d))
    expect(r.totals).toEqual(summarizeSlots(all))
    const todayRow = r.days.find((x) => x.date === today)
    expect(todayRow?.summary).toEqual(summarizeSlots(substitutionSlotsOn(today)))
    expect(r.totals.unhandledSlots).toBeGreaterThan(0)
    const sumDays = r.days.reduce((n, x) => n + x.summary.affectedPeriods, 0)
    expect(sumDays).toBe(r.totals.affectedPeriods)
  })

  it('absensi guru: guru hanya melihat data sendiri, 403 untuk guru lain', async () => {
    await loginAs('guru')
    const r = await get<TeacherAttendanceReport>('/reports/teacher-attendance', { dateFrom: from, dateTo: today })
    expect(r.teachers.every((t) => t.teacherId === 'tch_1')).toBe(true)
    const e = await err(
      get('/reports/teacher-attendance', { dateFrom: from, dateTo: today, teacherId: 'tch_2' }),
    )
    expect(e?.status).toBe(403)
  })

  it('absensi guru: total jumlah status = jumlah record', async () => {
    await loginAs('admin')
    const r = await get<TeacherAttendanceReport>('/reports/teacher-attendance', { dateFrom: from, dateTo: today })
    expect(Object.values(r.totals.counts).reduce((n, v) => n + v, 0)).toBe(r.records.length)
    expect(r.totals.counts.SICK).toBeGreaterThan(0)
  })

  it('jurnal mengajar: kelengkapan dihitung dari slot terjadwal', async () => {
    await loginAs('admin')
    const r = await get<TeachingLogReport>('/reports/teaching-logs', { dateFrom: from, dateTo: today })
    expect(r.totals.logs).toBe(r.rows.length)
    expect(r.totals.held + r.totals.notHeld).toBe(r.totals.logs)
    expect(r.totals.filledSlots).toBeLessThanOrEqual(r.totals.expectedSlots)
    expect(r.totals.fillRate).toBeGreaterThan(50)
  })

  it('guru: rekap absensi siswa hanya kelas yang diajar, 403 untuk kelas lain', async () => {
    await loginAs('guru')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me').then((r) => r.data)
    const r = await get<AttendanceReport>('/reports/attendance-summary', { dateFrom: from, dateTo: today })
    expect(r.rows.every((x) => x.classId && me.teachingClassIds.includes(x.classId))).toBe(true)
    const foreign = db().classes.find((c) => !me.teachingClassIds.includes(c.id))
    if (foreign) {
      const e = await err(get('/reports/absentees', { dateFrom: from, dateTo: today, classId: foreign.id }))
      expect(e?.status).toBe(403)
    }
  })

  it('tanpa token: 401', async () => {
    const { authToken } = await import('@/lib/auth-token')
    authToken.clear()
    const e = await err(get('/reports/dismissals', { dateFrom: from, dateTo: today }))
    expect(e?.status).toBe(401)
  })
})
