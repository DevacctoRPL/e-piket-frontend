import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { api, ApiError } from '@/lib/api-client'
import { loginAs } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { SystemOverview } from '@/types/entities'
import { db } from '../db'

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.catch((x: unknown) => x)
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

async function overview(date?: string) {
  return (await api.get<DataResponse<SystemOverview>>('/system/overview', date ? { date } : undefined)).data
}

describe('GET /system/overview', () => {
  it.each(['admin', 'kepsek'] as const)('403 untuk %s', async (who) => {
    await loginAs(who)
    expect((await errorOf(api.get('/system/overview'))).status).toBe(403)
  })

  it('422 untuk tanggal tidak valid', async () => {
    await loginAs('superadmin')
    expect((await errorOf(api.get('/system/overview', { date: '09-11-2026' }))).status).toBe(422)
    expect((await errorOf(api.get('/system/overview', { date: '2026-02-31' }))).status).toBe(422)
  })

  it('angka akun cocok dengan db().users', async () => {
    await loginAs('superadmin')
    const o = await overview()
    const users = db().users
    expect(o.date).toBe(todayISO())
    expect(o.accounts.total).toBe(users.length)
    expect(o.accounts.active).toBe(users.filter((u) => u.status === 'ACTIVE').length)
    expect(o.accounts.inactive).toBe(users.filter((u) => u.status === 'INACTIVE').length)
    expect(o.accounts.inactive).toBeGreaterThanOrEqual(1)
    const sa = o.accounts.byRole.find((r) => r.role === 'SUPER_ADMIN')
    expect(sa).toEqual({ role: 'SUPER_ADMIN', total: 1, active: 1 })
    const admin = o.accounts.byRole.find((r) => r.role === 'ADMIN')
    expect(admin).toEqual({ role: 'ADMIN', total: 2, active: 1 })
    expect(o.system?.counts.users).toBe(users.length)
    expect(o.system?.schemaVersion).toBe(db().schemaVersion)
  })

  it('login gagal menambah failedToday', async () => {
    await loginAs('superadmin')
    const before = (await overview()).security.failedToday
    await api.post('/auth/login', { username: 'kepsek', password: 'salah' }, { skipAuthRefresh: true }).catch(() => null)
    const after = await overview()
    expect(after.security.failedToday).toBe(before + 1)
    expect(after.security.series.at(-1)?.failed).toBe(after.security.failedToday)
    // seed: 3× username tak dikenal hari ini → percobaan gagal berulang
    expect(after.security.repeatedFailures.some((r) => r.username === 'administrator' && r.count >= 3)).toBe(true)
  })

  it('kesehatan data 7 hari dengan done ≤ expected dan tautan internal', async () => {
    await loginAs('superadmin')
    const o = await overview()
    expect(o.dataHealth.days).toHaveLength(7)
    for (const day of o.dataHealth.days) {
      for (const k of ['attendance', 'teachingLogs', 'dutyAgendas'] as const) {
        expect(day[k].done).toBeLessThanOrEqual(day[k].expected)
        expect(day[k].done).toBeGreaterThanOrEqual(0)
      }
    }
    expect(o.dataHealth.completenessPct).toBeGreaterThanOrEqual(0)
    expect(o.dataHealth.completenessPct).toBeLessThanOrEqual(100)
    expect(o.dataHealth.classes.length).toBeLessThanOrEqual(5)
    expect(o.dataHealth.gaps.length).toBe(8)
    for (const g of o.dataHealth.gaps) expect(g.href.startsWith('/')).toBe(true)
    for (const e of o.importantEvents) expect(e.href.startsWith('/')).toBe(true)
    expect(o.importantEvents.length).toBeLessThanOrEqual(15)
    expect(o.importantEvents.some((e) => e.action === 'ROLE_CHANGE')).toBe(true)
    // seed: guru tanpa akun ada (hanya 4 guru tertaut)
    expect(o.dataHealth.gaps.find((g) => g.key === 'TEACHER_NO_ACCOUNT')!.count).toBeGreaterThan(0)
  })

  it('tidak memuat nomor wali maupun kata sandi', async () => {
    await loginAs('superadmin')
    const json = JSON.stringify(await overview())
    for (const s of db().students.slice(0, 40)) if (s.guardianPhone) expect(json).not.toContain(s.guardianPhone)
    for (const t of db().teachers) if (t.phone) expect(json).not.toContain(t.phone)
    expect(json).not.toContain('"password"')
    expect(json).not.toMatch(/guardianPhone|"phone"/)
  })
})
