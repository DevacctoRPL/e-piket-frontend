import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import type { AuditLog, SchoolSettings } from '@/types/entities'
import type { AuditFacets } from '@/features/audit/types'

async function getSettings() {
  return (await api.get<DataResponse<SchoolSettings>>('/settings')).data
}

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.catch((x: unknown) => x)
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

describe('PATCH /settings', () => {
  it('updates settings, bumps version, and writes an UPDATE audit entry with a before/after diff', async () => {
    await loginAs('admin')
    const s = await getSettings()
    const statuses = s.attendanceStatuses.map((x) => (x.code === 'SICK' ? { ...x, label: 'Sakit (surat)' } : x))
    const res = await api.patch<DataResponse<SchoolSettings>>('/settings', {
      schoolName: 'SMK Negeri Contoh Satu',
      attendanceStatuses: statuses,
      dutyNoteCategories: [...s.dutyNoteCategories, 'Kebersihan'],
      version: s.version,
    })
    expect(res.data.version).toBe(s.version + 1)
    expect(res.data.schoolName).toBe('SMK Negeri Contoh Satu')
    expect(res.data.attendanceStatuses.find((x) => x.code === 'SICK')?.label).toBe('Sakit (surat)')

    const logs = await api.get<ListResponse<AuditLog>>('/audit-logs', { entity: 'SchoolSettings' })
    const entry = logs.data[0]
    expect(entry).toBeDefined()
    expect(entry!.action).toBe('UPDATE')
    expect(entry!.before).toMatchObject({
      schoolName: s.schoolName,
      'attendanceStatuses.SICK.label': 'Sakit',
    })
    expect(entry!.after).toMatchObject({
      schoolName: 'SMK Negeri Contoh Satu',
      'attendanceStatuses.SICK.label': 'Sakit (surat)',
    })
    // Field yang tidak berubah tidak ikut dalam diff.
    expect(entry!.after).not.toHaveProperty('city')
    expect(entry!.after?.dutyNoteCategories).toContain('Kebersihan')
  })

  it('returns 409 VERSION_CONFLICT on a stale version and leaves data untouched', async () => {
    await loginAs('admin')
    const s = await getSettings()
    await api.patch('/settings', { city: 'Kota Baru', version: s.version })
    const err = await errorOf(api.patch('/settings', { city: 'Kota Lain', version: s.version }))
    expect(err.status).toBe(409)
    expect(err.code).toBe('VERSION_CONFLICT')
    expect((await getSettings()).city).toBe('Kota Baru')
  })

  it('returns 422 when PRESENT is deactivated or required fields are empty', async () => {
    await loginAs('admin')
    const s = await getSettings()
    const statuses = s.attendanceStatuses.map((x) => (x.code === 'PRESENT' ? { ...x, active: false } : x))
    const presentIdx = statuses.findIndex((x) => x.code === 'PRESENT')
    const err = await errorOf(
      api.patch('/settings', { schoolName: '  ', attendanceStatuses: statuses, version: s.version }),
    )
    expect(err.status).toBe(422)
    expect(err.details.schoolName).toBe('required')
    expect(err.details[`attendanceStatuses.${presentIdx}.active`]).toMatch(/Hadir/)
    expect((await getSettings()).version).toBe(s.version)
  })

  it('rejects duplicate short codes and duplicate duty categories', async () => {
    await loginAs('admin')
    const s = await getSettings()
    const statuses = s.attendanceStatuses.map((x) => (x.code === 'ABSENT' ? { ...x, shortCode: 'S' } : x))
    const err = await errorOf(
      api.patch('/settings', { attendanceStatuses: statuses, dutyNoteCategories: ['Tamu', 'tamu'], version: s.version }),
    )
    expect(err.status).toBe(422)
    expect(Object.keys(err.details).some((k) => k.endsWith('.shortCode'))).toBe(true)
    expect(err.details.dutyNoteCategories).toBeDefined()
  })

  it('requires version', async () => {
    await loginAs('admin')
    const err = await errorOf(api.patch('/settings', { city: 'X' }))
    expect(err.status).toBe(422)
    expect(err.details.version).toBe('required')
  })

  it('forbids users without settings:write (403)', async () => {
    await loginAs('piket')
    const s = await getSettings()
    const err = await errorOf(api.patch('/settings', { city: 'X', version: s.version }))
    expect(err.status).toBe(403)
  })
})

describe('GET /audit-logs', () => {
  it('returns 403 for guru (no audit:read)', async () => {
    await loginAs('guru')
    expect((await errorOf(api.get('/audit-logs'))).status).toBe(403)
    expect((await errorOf(api.get('/audit-logs/facets'))).status).toBe(403)
    expect((await errorOf(api.get('/audit-logs/aud_seed_1'))).status).toBe(403)
  })

  it('lists newest first with filters, facets, and detail for principal', async () => {
    await loginAs('kepsek')
    const all = await api.get<ListResponse<AuditLog>>('/audit-logs')
    expect(all.meta.totalItems).toBeGreaterThanOrEqual(3)
    const ts = all.data.map((a) => a.timestamp)
    expect([...ts].sort().reverse()).toEqual(ts)

    const corrections = await api.get<ListResponse<AuditLog>>('/audit-logs', { action: 'CORRECT' })
    expect(corrections.data.length).toBeGreaterThan(0)
    expect(corrections.data.every((a) => a.action === 'CORRECT')).toBe(true)

    const bySearch = await api.get<ListResponse<AuditLog>>('/audit-logs', { search: 'surat keterangan dokter' })
    expect(bySearch.data.map((a) => a.id)).toContain('aud_seed_1')

    const future = await api.get<ListResponse<AuditLog>>('/audit-logs', { dateFrom: '2999-01-01' })
    expect(future.data).toHaveLength(0)

    const facets = await api.get<DataResponse<AuditFacets>>('/audit-logs/facets')
    expect(facets.data.entities).toEqual(expect.arrayContaining(['StudentAttendanceRecord', 'DutyAgenda']))
    expect(facets.data.actors.some((a) => a.id === 'usr_admin')).toBe(true)

    const detail = await api.get<DataResponse<AuditLog>>('/audit-logs/aud_seed_1')
    expect(detail.data.reason).toMatch(/dokter/)
    expect((await errorOf(api.get('/audit-logs/missing'))).status).toBe(404)
  })

  it('returns 422 for an invalid date range', async () => {
    await loginAs('admin')
    const err = await errorOf(api.get('/audit-logs', { dateFrom: '2026-11-08', dateTo: '2026-11-01' }))
    expect(err.status).toBe(422)
    expect(err.details.dateTo).toBeDefined()
  })
})
