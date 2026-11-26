import { describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api-client'
import { addDays, combineDateTime, isoDayOfWeek, toISODateTime, todayISO } from '@/lib/date'
import { formatRoleLabels, roleLabel } from '@/lib/enums'
import { canGrantRole, isAdminLike, maskPhone, permissionsForRoles, ROLE_PERMISSIONS } from '@/lib/permissions'
import { createQueryClient } from '@/lib/query-client'
import { safeNextPath } from '@/lib/utils'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import { PERMISSIONS, type ClassRoom, type CurrentUser, type Student } from '@/types/entities'

describe('date utils (Asia/Jakarta)', () => {
  it('computes school-local today and offsets', () => {
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
  it('Guru Piket holds every permission in PERMISSIONS', () => {
    const duty = ROLE_PERMISSIONS.DUTY_TEACHER
    for (const p of PERMISSIONS) expect(duty).toContain(p)
    expect(permissionsForRoles(['DUTY_TEACHER'])).toEqual(duty)
  })
  it('isAdminLike & canGrantRole', () => {
    expect(isAdminLike({ roles: ['DUTY_TEACHER'] })).toBe(true)
    expect(isAdminLike(null)).toBe(false)
    expect(canGrantRole(['DUTY_TEACHER'], 'DUTY_TEACHER')).toBe(true)
  })
})

describe('mock API foundation', () => {
  it('rejects bad login with safe message', async () => {
    await expect(
      api.post('/auth/login', { username: 'piket', password: 'x' }, { skipAuthRefresh: true }),
    ).rejects.toMatchObject({ status: 422, message: 'Nama pengguna atau kata sandi tidak sesuai.' })
  })

  it('guru piket demo account logs in with 5-panel operational permissions', async () => {
    await loginAs('piket')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.id).toBe('usr_piket')
    expect(me.data.roles).toEqual(['DUTY_TEACHER'])
    expect(me.data.permissions).toContain('dashboard:read')
    expect(me.data.permissions).toContain('teacher_attendance:read')
    expect(me.data.permissions).toContain('substitution:write')
    expect(me.data.permissions).toContain('teaching_log:read')
    expect(me.data.permissions).toContain('absentees:write')
    expect(me.data.permissions).toContain('extra_activity:read')
    expect(me.data.permissions).not.toContain('teaching_log:verify')
    expect(me.data.permissions).not.toContain('extra_activity:verify')
    expect(me.data.mustChangePassword).toBe(false)
  })

  it('operator piket without teacherId logs in cleanly', async () => {
    await loginAs('operator')
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.roles).toEqual(['DUTY_TEACHER'])
    expect(me.data.teacherId).toBeNull()
    expect(me.data.permissions).toContain('absentees:write')
  })

  it('returns 401 without token', async () => {
    const { authToken } = await import('@/lib/auth-token')
    authToken.clear()
    localStorage.clear()
    const err = await api.get('/classes').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })

  it('allows guru piket to read classes and students lookup', async () => {
    await loginAs('piket')
    const classes = await api.get<DataResponse<ClassRoom[]>>('/classes')
    expect(classes.data.length).toBeGreaterThan(0)
    const res = await api.get<ListResponse<Student>>('/students', {
      classId: classes.data[0]!.id,
    })
    expect(res.data.length).toBeGreaterThan(0)
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

describe('safeNextPath', () => {
  it('menerima path internal yang valid dan menolak open redirect / loop login', () => {
    expect(safeNextPath('/absensi-siswa?date=2026-11-13')).toBe('/absensi-siswa?date=2026-11-13')
    expect(safeNextPath('/')).toBe('/')
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('https://evil.example')).toBe('/')
    expect(safeNextPath('//evil.example')).toBe('/')
    expect(safeNextPath('/\\evil.example')).toBe('/')
    expect(safeNextPath('/login')).toBe('/')
    expect(safeNextPath('/login?next=/')).toBe('/')
  })
})

describe('roleLabel & formatRoleLabels', () => {
  it('mengembalikan label Guru Piket dan fallback aman untuk peran warisan/asing', () => {
    expect(roleLabel('DUTY_TEACHER')).toBe('Guru Piket')
    expect(roleLabel('SUPER_ADMIN')).toBe('SUPER_ADMIN')
    expect(formatRoleLabels(['DUTY_TEACHER', 'SUPER_ADMIN'], ' · ')).toBe('Guru Piket · SUPER_ADMIN')
  })
})
