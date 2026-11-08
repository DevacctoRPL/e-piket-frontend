import { describe, expect, it } from 'vitest'
import { loginAs } from '@/test/utils'
import { api, ApiError } from '@/lib/api-client'
import { addDays, combineDateTime, isoDayOfWeek, toISODateTime, todayISO } from '@/lib/date'
import { maskPhone, permissionsForRoles } from '@/lib/permissions'
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
})

describe('mock API foundation', () => {
  it('rejects bad login with safe message', async () => {
    await expect(
      api.post('/auth/login', { username: 'admin', password: 'x' }, { skipAuthRefresh: true }),
    ).rejects.toMatchObject({ status: 422, message: 'Nama pengguna atau kata sandi tidak sesuai.' })
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
})
