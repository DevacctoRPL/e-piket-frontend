import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { DashboardSummary } from '@/types/entities'

const ACTIVE_PREFIXES = ['/absensi-guru', '/agenda-guru', '/absensi-siswa', '/jam-tambahan']

describe('GET /dashboard/summary (5-panel Guru Piket)', () => {
  it('mengembalikan ringkasan lengkap 4 modul aktif, status TTD read-only, dan pendingTasks khusus Jam Kosong', async () => {
    await loginAs('piket')
    const res = await api.get<DataResponse<DashboardSummary>>('/dashboard/summary', { date: todayISO() })
    const s = res.data

    expect(s.teacherAttendance.scheduled).toBeGreaterThan(0)
    expect(s.teacherAttendance.absent).toBeGreaterThan(0)
    expect(s.absentees.total).toBe(
      s.absentees.SICK + s.absentees.PERMISSION + s.absentees.ABSENT + s.absentees.EXCUSED + s.absentees.PKL,
    )
    expect(s.absentees.PKL).toBeGreaterThanOrEqual(1)
    expect(s.absentees.EXCUSED).toBeGreaterThanOrEqual(1)
    expect(s.agendaGuru.total).toBeGreaterThan(0)
    expect(s.agendaGuru.signed).toBeGreaterThan(0)
    expect(s.agendaGuru.signed).toBeLessThanOrEqual(s.agendaGuru.total)
    expect(s.jamTambahan.total).toBeGreaterThan(0)
    expect(s.jamTambahan.signed).toBeGreaterThan(0)
    expect(s.jamTambahan.signed).toBeLessThanOrEqual(s.jamTambahan.total)
    expect(s.trends.days).toHaveLength(7)

    for (const t of s.pendingTasks) {
      expect(t.kind).toBe('SUBSTITUTION_UNHANDLED')
      expect(t.href.startsWith('/absensi-guru')).toBe(true)
    }
    for (const a of s.activities) {
      expect(ACTIVE_PREFIXES.some((p) => a.href.startsWith(p))).toBe(true)
    }
  })

  it('menolak format tanggal tidak valid dengan 422', async () => {
    await loginAs('piket')
    await expect(api.get('/dashboard/summary', { date: 'bukan-tanggal' })).rejects.toMatchObject({ status: 422 })
  })
})
