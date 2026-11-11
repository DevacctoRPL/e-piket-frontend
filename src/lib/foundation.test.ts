import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { loginAs } from '@/test/utils'
import { api, ApiError } from '@/lib/api-client'
import { addDays, combineDateTime, isoDayOfWeek, toISODateTime, todayISO } from '@/lib/date'
import { canGrantRole, isAdminLike, maskPhone, permissionsForRoles, ROLE_PERMISSIONS } from '@/lib/permissions'
import { createQueryClient } from '@/lib/query-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { ClassRoom, CurrentUser, Student } from '@/types/entities'

describe('date utils (Asia/Jakarta)', () => {
  it('computes school-local today and offsets', () => {
    // 2026-11-07T20:00Z = 2026-11-08 03:00 WIB
    expect(todayISO(new Date('2026-11-07T20:00:00Z'))).toBe('2026-11-08')
    expect(toISODateTime(new Date('2026-11-07T20:00:00Z'))).toBe('2026-11-08T03:00:00+07:00')
    expect(combineDateTime('2026-11-08', '07:15')).toBe('2026-11-08T07:15:00+07:00')
    expect(isoDayOfWeek('2026-11-09')).toBe(1)
    expect(isoDayOfWeek('2026-11-08')).toBe(7)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
  })
})

describe('permissions', () => {
  it('masks phone numbers', () => {
    expect(maskPhone('081234567890')).toBe('0812****90')
  })
  it('teacher cannot write master data', () => {
    expect(permissionsForRoles(['TEACHER'])).not.toContain('master:write')
  })
  it('super admin has every admin permission plus account/security permissions', () => {
    const sa = ROLE_PERMISSIONS.SUPER_ADMIN
    for (const p of ROLE_PERMISSIONS.ADMIN) expect(sa).toContain(p)
    expect(sa).toEqual(expect.arrayContaining(['user:read', 'user:write', 'security:read', 'system:manage']))
  })
  it('admin cannot read user accounts or security data', () => {
    for (const p of ['user:read', 'user:write', 'security:read', 'system:manage'] as const) {
      expect(ROLE_PERMISSIONS.ADMIN).not.toContain(p)
    }
  })
  it('isAdminLike & canGrantRole', () => {
    expect(isAdminLike({ roles: ['SUPER_ADMIN'] })).toBe(true)
    expect(isAdminLike({ roles: ['ADMIN'] })).toBe(true)
    expect(isAdminLike({ roles: ['PRINCIPAL', 'TEACHER'] })).toBe(false)
    expect(isAdminLike(null)).toBe(false)
    expect(canGrantRole(['ADMIN'], 'ADMIN')).toBe(false)
    expect(canGrantRole(['ADMIN'], 'TEACHER')).toBe(true)
    expect(canGrantRole(['SUPER_ADMIN'], 'SUPER_ADMIN')).toBe(true)
  })
})

describe('mock API foundation', () => {
  it('rejects bad login with safe message', async () => {
    await expect(
      api.post('/auth/login', { username: 'admin', password: 'x' }, { skipAuthRefresh: true }),
    ).rejects.toMatchObject({ status: 422, message: 'Nama pengguna atau kata sandi tidak sesuai.' })
  })

  it('super admin demo account logs in with full scope', async () => {
    await loginAs('superadmin')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.id).toBe('usr_superadmin')
    expect(me.data.name).toBe('Dimas Prasetyo (Super Admin)')
    expect(me.data.permissions).toContain('system:manage')
    expect(me.data.mustChangePassword).toBe(false)
  })

  it('logs in and loads /auth/me', async () => {
    await loginAs('piket')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.roles).toContain('DUTY_TEACHER')
    expect(me.data.permissions).toContain('duty_agenda:write')
  })

  it('returns 401 without token', async () => {
    const { authToken } = await import('@/lib/auth-token')
    authToken.clear()
    localStorage.clear()
    const err = await api.get('/classes').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })

  it('scopes student access for teachers (AC-13)', async () => {
    await loginAs('guru')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const classes = await api.get<DataResponse<ClassRoom[]>>('/classes')
    const foreign = classes.data.find((c) => !me.data.teachingClassIds.includes(c.id))
    expect(foreign).toBeDefined()
    const err = await api
      .get<ListResponse<Student>>('/students', { classId: foreign!.id })
      .catch((e: unknown) => e)
    expect((err as ApiError).status).toBe(403)
  })

  it('masks guardian phone for roles without contact permission', async () => {
    await loginAs('guru')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    const res = await api.get<ListResponse<Student>>('/students', {
      classId: me.data.teachingClassIds[0],
    })
    expect(res.data[0]?.guardianPhone).toMatch(/\*\*\*\*/)
  })

  it('deduplicates QueryCache error toasts with a deterministic id', async () => {
    const spy = vi.spyOn(toast, 'error').mockImplementation(() => 'id')
    const qc = createQueryClient()
    qc.setQueryData(['q1'], { ok: true })
    qc.setQueryData(['q2'], { ok: true })
    const err = new ApiError(500, null)
    await qc.fetchQuery({ queryKey: ['q1'], queryFn: () => Promise.reject(err), retry: false, staleTime: 0 }).catch(() => null)
    await qc.fetchQuery({ queryKey: ['q2'], queryFn: () => Promise.reject(err), retry: false, staleTime: 0 }).catch(() => null)
    expect(spy).toHaveBeenCalledWith('Terjadi kesalahan pada server. Coba beberapa saat lagi.', {
      id: 'query-error:Terjadi kesalahan pada server. Coba beberapa saat lagi.',
    })
    spy.mockRestore()
  })
})
