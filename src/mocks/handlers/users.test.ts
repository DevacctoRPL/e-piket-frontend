import { describe, expect, it } from 'vitest'
import { api, ApiError } from '@/lib/api-client'
import { authToken } from '@/lib/auth-token'
import { loginAs } from '@/test/utils'
import type { DataResponse, ListResponse } from '@/types/api'
import type {
  AuditLog,
  BulkUserActionResult,
  BulkUserCreateResponse,
  CurrentUser,
  LoginResponse,
  TemporaryPasswordResult,
  UserAccount,
  UserAccountDetail,
} from '@/types/entities'
import { db } from '../db'
import {
  forbiddenRoleChanges,
  generateTemporaryPassword,
  newPasswordError,
  parseRoles,
  selfProtectionError,
  teacherLinkError,
  TEMP_PASSWORD_RE,
  usernameError,
  wouldRemoveLastSuperAdmin,
} from './users-rules'

async function errorOf(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.catch((x: unknown) => x)
  expect(e).toBeInstanceOf(ApiError)
  return e as ApiError
}

async function rawLogin(username: string, password: string) {
  const res = await api.post<DataResponse<LoginResponse>>('/auth/login', { username, password }, { skipAuthRefresh: true })
  return res.data.accessToken
}

async function getAccount(id: string) {
  return (await api.get<DataResponse<UserAccountDetail>>(`/users/${id}`)).data
}

async function createAccount(body: Record<string, unknown>, idempotencyKey?: string) {
  return (
    await api.post<DataResponse<{ user: UserAccount; temporaryPassword: string }>>('/users', body, { idempotencyKey })
  ).data
}

/** Guru aktif yang belum ditautkan ke akun. */
function freeTeacherId() {
  const t = db().teachers.find((x) => x.status === 'ACTIVE' && !x.userId)
  expect(t).toBeDefined()
  return t!.id
}

function latestAudit(entityId: string): AuditLog | undefined {
  return db().auditLogs.find((a) => a.entityId === entityId)
}

describe('akses /users', () => {
  it.each(['admin', 'kepsek', 'guru'] as const)('403 untuk %s', async (who) => {
    await loginAs(who)
    expect((await errorOf(api.get('/users'))).status).toBe(403)
    expect((await errorOf(api.get('/users/usr_guru'))).status).toBe(403)
    expect((await errorOf(api.post('/users', { username: 'x.y', name: 'X', roles: ['PRINCIPAL'] }))).status).toBe(403)
    expect((await errorOf(api.post('/users/usr_guru/reset-password', {}))).status).toBe(403)
  })

  it('401 tanpa token', async () => {
    authToken.clear()
    expect((await errorOf(api.get('/users', undefined, { skipAuthRefresh: true }))).status).toBe(401)
  })
})

describe('GET /users', () => {
  it('menampilkan semua akun tanpa kata sandi dan mendukung filter', async () => {
    await loginAs('superadmin')
    const all = await api.get<ListResponse<UserAccount>>('/users', { pageSize: 100 })
    expect(all.meta.totalItems).toBe(db().users.length)
    // "mustChangePassword" boleh; field "password" tidak.
    expect(JSON.stringify(all)).not.toContain('"password"')
    expect(all.data.every((u) => !('password' in u))).toBe(true)

    const inactive = await api.get<ListResponse<UserAccount>>('/users', { status: 'INACTIVE' })
    expect(inactive.data.map((u) => u.id)).toEqual(['usr_tu_lama'])

    const admins = await api.get<ListResponse<UserAccount>>('/users', { role: 'ADMIN' })
    expect(admins.data.every((u) => u.roles.includes('ADMIN'))).toBe(true)
    expect(admins.data.map((u) => u.id)).toEqual(expect.arrayContaining(['usr_admin', 'usr_tu_lama']))

    const linked = await api.get<ListResponse<UserAccount>>('/users', { link: 'linked', pageSize: 100 })
    expect(linked.data.length).toBeGreaterThan(0)
    expect(linked.data.every((u) => !!u.teacherId && !!u.teacherName)).toBe(true)
    const none = await api.get<ListResponse<UserAccount>>('/users', { link: 'none', pageSize: 100 })
    expect(none.data.every((u) => !u.teacherId)).toBe(true)
    expect(linked.meta.totalItems + none.meta.totalItems).toBe(all.meta.totalItems)

    const search = await api.get<ListResponse<UserAccount>>('/users', { search: 'PIKET' })
    expect(search.data.map((u) => u.username)).toContain('piket')

    const paged = await api.get<ListResponse<UserAccount>>('/users', { pageSize: 2, page: 2 })
    expect(paged.data).toHaveLength(2)
    expect(paged.meta.page).toBe(2)

    expect((await errorOf(api.get('/users', { role: 'ROOT' }))).status).toBe(422)
  })

  it('detail memuat login terakhir (maks. 10) tanpa kata sandi', async () => {
    await loginAs('superadmin')
    const detail = await getAccount('usr_superadmin')
    expect(detail.recentLogins.length).toBeGreaterThan(0)
    expect(detail.recentLogins.length).toBeLessThanOrEqual(10)
    expect(detail.lastLoginAt).toBeTruthy()
    expect(JSON.stringify(detail)).not.toContain('"password"')
    expect((await errorOf(api.get('/users/missing'))).status).toBe(404)
  })
})

describe('POST /users — validasi', () => {
  it('422 untuk field wajib yang kosong', async () => {
    await loginAs('superadmin')
    const err = await errorOf(api.post('/users', {}))
    expect(err.status).toBe(422)
    expect(err.details).toMatchObject({ username: 'required', name: 'required', roles: 'required' })
  })

  it('422 untuk username tidak valid', async () => {
    await loginAs('superadmin')
    for (const username of ['ab', 'nama dengan spasi', 'a'.repeat(33), 'tanda!seru']) {
      const err = await errorOf(api.post('/users', { username, name: 'Uji', roles: ['PRINCIPAL'] }))
      expect(err.details?.username).toBe('invalid')
    }
  })

  it('422 duplicate untuk username yang sama walau beda huruf besar/kecil', async () => {
    await loginAs('superadmin')
    const err = await errorOf(api.post('/users', { username: 'PIKET', name: 'Uji', roles: ['PRINCIPAL'] }))
    expect(err.status).toBe(422)
    expect(err.details?.username).toBe('duplicate')
  })

  it('422 bila peran guru tanpa tautan data guru', async () => {
    await loginAs('superadmin')
    const err = await errorOf(api.post('/users', { username: 'guru.baru', name: 'Guru Baru', roles: ['TEACHER'] }))
    expect(err.status).toBe(422)
    expect(err.details?.teacherId).toBe('required')
  })

  it('422 bila guru sudah ditautkan ke akun lain', async () => {
    await loginAs('superadmin')
    const err = await errorOf(
      api.post('/users', { username: 'guru.dobel', name: 'Dobel', roles: ['TEACHER'], teacherId: 'tch_1' }),
    )
    expect(err.status).toBe(422)
    expect(err.details?.teacherId).toMatch(/sudah ditautkan/)
  })

  it('422 bila guru sudah dihapus (soft-delete)', async () => {
    await loginAs('superadmin')
    const tid = freeTeacherId()
    const d = db()
    d.deleted.teachers = [...(d.deleted.teachers ?? []), tid]
    try {
      const err = await errorOf(
        api.post('/users', { username: 'guru.hapus', name: 'Terhapus', roles: ['TEACHER'], teacherId: tid }),
      )
      expect(err.status).toBe(422)
      expect(err.details?.teacherId).toMatch(/tidak ditemukan/)
    } finally {
      d.deleted.teachers = (d.deleted.teachers ?? []).filter((x) => x !== tid)
    }
  })
})

describe('POST /users — sukses', () => {
  it('201 + sandi sementara, tautan guru tersinkron, bisa login, audit tanpa sandi, idempoten', async () => {
    await loginAs('superadmin')
    const teacherId = freeTeacherId()
    const body = { username: '  Guru.Baru ', name: 'Guru Baru', email: 'Guru@Sekolah.Example.id', roles: ['TEACHER'], teacherId }

    const res = await api.post<DataResponse<{ user: UserAccount; temporaryPassword: string }>>('/users', body, {
      idempotencyKey: 'create-guru-baru',
    })
    const { user, temporaryPassword } = res.data
    expect(user.username).toBe('guru.baru')
    expect(user.email).toBe('guru@sekolah.example.id')
    expect(user.mustChangePassword).toBe(true)
    expect(user.status).toBe('ACTIVE')
    expect(user.teacherName).toBeTruthy()
    expect(temporaryPassword).toMatch(TEMP_PASSWORD_RE)
    expect(db().teachers.find((t) => t.id === teacherId)?.userId).toBe(user.id)

    const entry = latestAudit(user.id)
    expect(entry?.action).toBe('CREATE')
    expect(entry?.entity).toBe('User')
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword)
    expect(JSON.stringify(db().auditLogs)).not.toContain(temporaryPassword)

    // replay dengan kunci yang sama → response sama, tidak ada akun ganda
    const before = db().users.length
    const replay = await createAccount(body, 'create-guru-baru')
    expect(replay.user.id).toBe(user.id)
    expect(db().users.length).toBe(before)

    // akun baru bisa login dengan sandi sementara dan wajib ganti
    const token = await rawLogin('guru.baru', temporaryPassword)
    authToken.set(token)
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.mustChangePassword).toBe(true)
    expect(me.data.teacherId).toBe(teacherId)
    expect(JSON.stringify(db().loginEvents)).not.toContain(temporaryPassword)
  })

  it('403 bila memberi peran istimewa tanpa Super Admin (aturan 3)', () => {
    expect(forbiddenRoleChanges(['ADMIN'], [], ['ADMIN'])).toEqual(['ADMIN'])
    expect(forbiddenRoleChanges(['ADMIN'], ['TEACHER'], ['TEACHER', 'HOMEROOM'])).toEqual([])
    expect(forbiddenRoleChanges(['SUPER_ADMIN'], ['ADMIN'], ['SUPER_ADMIN'])).toEqual([])
  })
})

describe('PATCH /users/:id', () => {
  it('ubah peran → audit ROLE_CHANGE dengan before/after', async () => {
    await loginAs('superadmin')
    const guru = await getAccount('usr_guru')
    const res = await api.patch<DataResponse<UserAccount>>('/users/usr_guru', {
      roles: ['TEACHER', 'HOMEROOM'],
      version: guru.version,
    })
    expect(res.data.roles).toEqual(['TEACHER', 'HOMEROOM'])
    expect(res.data.version).toBe(guru.version + 1)
    const entry = latestAudit('usr_guru')
    expect(entry?.action).toBe('ROLE_CHANGE')
    expect(entry?.before).toEqual({ roles: ['TEACHER'] })
    expect(entry?.after).toEqual({ roles: ['TEACHER', 'HOMEROOM'] })
  })

  it('ubah nama → audit UPDATE; username diabaikan', async () => {
    await loginAs('superadmin')
    const k = await getAccount('usr_kepsek')
    const res = await api.patch<DataResponse<UserAccount>>('/users/usr_kepsek', {
      name: 'Drs. Hartono',
      username: 'bos',
      version: k.version,
    })
    expect(res.data.name).toBe('Drs. Hartono')
    expect(res.data.username).toBe('kepsek')
    expect(latestAudit('usr_kepsek')?.action).toBe('UPDATE')
  })

  it('409 SELF_PROTECTED saat mencabut Super Admin dari diri sendiri', async () => {
    await loginAs('superadmin')
    const me = await getAccount('usr_superadmin')
    const err = await errorOf(api.patch('/users/usr_superadmin', { roles: ['ADMIN'], version: me.version }))
    expect(err.status).toBe(409)
    expect(err.code).toBe('SELF_PROTECTED')
  })

  it('409 VERSION_CONFLICT untuk versi usang', async () => {
    await loginAs('superadmin')
    const k = await getAccount('usr_kepsek')
    await api.patch('/users/usr_kepsek', { name: 'Nama A', version: k.version })
    const err = await errorOf(api.patch('/users/usr_kepsek', { name: 'Nama B', version: k.version }))
    expect(err.status).toBe(409)
    expect(err.code).toBe('VERSION_CONFLICT')
  })

  it('ganti tautan guru menyinkronkan Teacher.userId', async () => {
    await loginAs('superadmin')
    const guru = await getAccount('usr_guru')
    const target = freeTeacherId()
    await api.patch('/users/usr_guru', { teacherId: target, version: guru.version })
    expect(db().teachers.find((t) => t.id === 'tch_1')?.userId).toBeNull()
    expect(db().teachers.find((t) => t.id === target)?.userId).toBe('usr_guru')
  })
})

describe('POST /users/:id/status', () => {
  it('422 tanpa alasan saat menonaktifkan', async () => {
    await loginAs('superadmin')
    const g = await getAccount('usr_guru')
    const err = await errorOf(api.post('/users/usr_guru/status', { status: 'INACTIVE', version: g.version }))
    expect(err.status).toBe(422)
    expect(err.details?.reason).toBe('required')
  })

  it('nonaktif → token lama 401, login ditolak generik, event INACTIVE, audit STATUS_CHANGE', async () => {
    const guruToken = await loginAs('guru')
    await loginAs('superadmin')
    const g = await getAccount('usr_guru')
    const res = await api.post<DataResponse<UserAccount>>('/users/usr_guru/status', {
      status: 'INACTIVE',
      reason: 'Mutasi',
      version: g.version,
    })
    expect(res.data.status).toBe('INACTIVE')

    authToken.set(guruToken)
    const err = await errorOf(api.get('/auth/me', undefined, { skipAuthRefresh: true }))
    expect(err.status).toBe(401)

    const loginErr = await errorOf(rawLogin('guru', 'password'))
    expect(loginErr.status).toBe(422)
    expect(loginErr.message).toBe('Nama pengguna atau kata sandi tidak sesuai.')
    expect(db().loginEvents[0]).toMatchObject({ userId: 'usr_guru', success: false, reason: 'INACTIVE' })

    const entry = latestAudit('usr_guru')
    expect(entry?.action).toBe('STATUS_CHANGE')
    expect(entry?.reason).toBe('Mutasi')
    expect(entry?.before).toEqual({ status: 'ACTIVE' })
    expect(entry?.after).toEqual({ status: 'INACTIVE' })
  })

  it('409 SELF_PROTECTED saat menonaktifkan diri sendiri', async () => {
    await loginAs('superadmin')
    const me = await getAccount('usr_superadmin')
    const err = await errorOf(
      api.post('/users/usr_superadmin/status', { status: 'INACTIVE', reason: 'x', version: me.version }),
    )
    expect(err.code).toBe('SELF_PROTECTED')
  })
})

describe('POST /users/:id/reset-password', () => {
  it('sandi lama gagal, sandi baru berhasil, sesi dicabut, audit tanpa sandi', async () => {
    const piketToken = await loginAs('piket')
    await loginAs('superadmin')
    const res = await api.post<DataResponse<TemporaryPasswordResult>>('/users/usr_piket/reset-password', {
      reason: 'Lupa sandi',
    })
    const pw = res.data.temporaryPassword
    expect(res.data.userId).toBe('usr_piket')
    expect(pw).toMatch(TEMP_PASSWORD_RE)

    const entry = latestAudit('usr_piket')
    expect(entry?.action).toBe('PASSWORD_RESET')
    expect(JSON.stringify(entry)).not.toContain(pw)
    expect(JSON.stringify(db().auditLogs)).not.toContain(pw)

    authToken.set(piketToken)
    expect((await errorOf(api.get('/auth/me', undefined, { skipAuthRefresh: true }))).status).toBe(401)

    expect((await errorOf(rawLogin('piket', 'password'))).status).toBe(422)
    const token = await rawLogin('piket', pw)
    authToken.set(token)
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.mustChangePassword).toBe(true)
    expect(JSON.stringify(db().loginEvents)).not.toContain(pw)
  })

  it('409 SELF_PROTECTED untuk diri sendiri', async () => {
    await loginAs('superadmin')
    const err = await errorOf(api.post('/users/usr_superadmin/reset-password', {}))
    expect(err.status).toBe(409)
    expect(err.code).toBe('SELF_PROTECTED')
  })
})

describe('POST /auth/me/password', () => {
  it('validasi dan ganti sandi menghapus tanda wajib-ganti', async () => {
    await loginAs('superadmin')
    const { temporaryPassword } = (
      await api.post<DataResponse<TemporaryPasswordResult>>('/users/usr_kepsek/reset-password', {})
    ).data
    authToken.set(await rawLogin('kepsek', temporaryPassword))

    let err = await errorOf(api.post('/auth/me/password', { currentPassword: 'salah', newPassword: 'rahasia123' }))
    expect(err.status).toBe(422)
    expect(err.details?.currentPassword).toBeTruthy()

    err = await errorOf(api.post('/auth/me/password', { currentPassword: temporaryPassword, newPassword: 'pendek' }))
    expect(err.details?.newPassword).toBeTruthy()

    err = await errorOf(
      api.post('/auth/me/password', { currentPassword: temporaryPassword, newPassword: temporaryPassword }),
    )
    expect(err.details?.newPassword).toMatch(/berbeda/)

    await api.post('/auth/me/password', { currentPassword: temporaryPassword, newPassword: 'rahasia-baru-1' })
    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.mustChangePassword).toBe(false)
    expect(JSON.stringify(db().auditLogs)).not.toContain('rahasia-baru-1')

    authToken.set(await rawLogin('kepsek', 'rahasia-baru-1'))
    expect((await errorOf(rawLogin('kepsek', temporaryPassword))).status).toBe(422)
  })
})

describe('login tracking', () => {
  it('login sukses memperbarui lastLoginAt; gagal tercatat tanpa sandi', async () => {
    const before = db().loginEvents.length
    await errorOf(rawLogin('  Admin ', 'sandi-rahasia-salah'))
    expect(db().loginEvents[0]).toMatchObject({ username: 'admin', userId: 'usr_admin', success: false, reason: 'BAD_CREDENTIALS' })
    await errorOf(rawLogin('tidak.ada', 'x'))
    expect(db().loginEvents[0]).toMatchObject({ username: 'tidak.ada', userId: null, success: false })
    await loginAs('admin')
    expect(db().loginEvents[0]).toMatchObject({ userId: 'usr_admin', success: true, reason: 'OK' })
    expect(db().users.find((u) => u.id === 'usr_admin')?.lastLoginAt).toBe(db().loginEvents[0]!.timestamp)
    expect(db().loginEvents.length).toBe(before + 3)
    expect(JSON.stringify(db().loginEvents)).not.toContain('sandi-rahasia-salah')
  })
})

describe('users-rules (fungsi murni)', () => {
  const users = [
    { id: 'a', username: 'sa', roles: ['SUPER_ADMIN' as const], status: 'ACTIVE' as const, teacherId: null },
    { id: 'b', username: 'guru', roles: ['TEACHER' as const], status: 'ACTIVE' as const, teacherId: 't1' },
  ]

  it('usernameError', () => {
    expect(usernameError('', users)).toBe('required')
    expect(usernameError('A B', users)).toBe('invalid')
    expect(usernameError('guru', users)).toBe('duplicate')
    expect(usernameError('guru', users, 'b')).toBeNull()
    expect(usernameError('guru.baru_1-x', users)).toBeNull()
  })

  it('parseRoles', () => {
    expect(parseRoles(['HOMEROOM', 'TEACHER'])).toEqual(['TEACHER', 'HOMEROOM'])
    expect(parseRoles(['ROOT'])).toBeNull()
    expect(parseRoles('TEACHER')).toBeNull()
  })

  it('selfProtectionError', () => {
    expect(selfProtectionError('a', users[0]!, { roles: ['ADMIN'] })).toMatch(/menurunkan/)
    expect(selfProtectionError('a', users[0]!, { roles: ['SUPER_ADMIN', 'ADMIN'] })).toBeNull()
    expect(selfProtectionError('a', users[0]!, { status: 'INACTIVE' })).toMatch(/menonaktifkan/)
    expect(selfProtectionError('a', users[0]!, { resetPassword: true })).toMatch(/reset/)
    expect(selfProtectionError('a', users[1]!, { status: 'INACTIVE' })).toBeNull()
  })

  it('wouldRemoveLastSuperAdmin', () => {
    expect(wouldRemoveLastSuperAdmin(users, 'a', { status: 'INACTIVE' })).toBe(true)
    expect(wouldRemoveLastSuperAdmin(users, 'a', { roles: ['ADMIN'] })).toBe(true)
    expect(wouldRemoveLastSuperAdmin(users, 'b', { status: 'INACTIVE' })).toBe(false)
    const two = [...users, { id: 'c', username: 'sa2', roles: ['SUPER_ADMIN' as const], status: 'ACTIVE' as const, teacherId: null }]
    expect(wouldRemoveLastSuperAdmin(two, 'a', { status: 'INACTIVE' })).toBe(false)
  })

  it('teacherLinkError', () => {
    const teachers = [
      { id: 't1', status: 'ACTIVE' as const, userId: 'b' },
      { id: 't2', status: 'ACTIVE' as const, userId: null },
      { id: 't3', status: 'INACTIVE' as const, userId: null },
    ]
    expect(teacherLinkError(['TEACHER'], null, teachers, users)).toBe('required')
    expect(teacherLinkError(['PRINCIPAL'], null, teachers, users)).toBeNull()
    expect(teacherLinkError(['TEACHER'], 't1', teachers, users)).toMatch(/sudah ditautkan/)
    expect(teacherLinkError(['TEACHER'], 't1', teachers, users, 'b')).toBeNull()
    expect(teacherLinkError(['TEACHER'], 't2', teachers, users)).toBeNull()
    expect(teacherLinkError(['TEACHER'], 't3', teachers, users)).toMatch(/tidak aktif/)
    expect(teacherLinkError(['TEACHER'], 'tx', teachers, users)).toMatch(/tidak ditemukan/)
  })

  it('newPasswordError & generateTemporaryPassword', () => {
    expect(newPasswordError('lama', '')).toBe('required')
    expect(newPasswordError('lama', 'pendek')).toMatch(/Minimal/)
    expect(newPasswordError('panjang-sekali', 'panjang-sekali')).toMatch(/berbeda/)
    expect(newPasswordError('lama', 'baru-panjang')).toBeNull()
    const seen = new Set(Array.from({ length: 50 }, generateTemporaryPassword))
    for (const pw of seen) expect(pw).toMatch(TEMP_PASSWORD_RE)
    expect(seen.size).toBeGreaterThan(45)
  })
})

describe('POST /users/bulk — tambah akun massal & auto-link/auto-create guru', () => {
  it('menautkan guru yang sudah ada berdasarkan NIP & membuat guru baru otomatis bila NIP belum ada', async () => {
    await loginAs('superadmin')
    const unlinkedTeacher = db().teachers.find((t) => t.status === 'ACTIVE' && !t.userId)!
    expect(unlinkedTeacher).toBeDefined()

    const payload = {
      items: [
        {
          username: 'guru.tertaut',
          name: unlinkedTeacher.name,
          nip: unlinkedTeacher.nip,
          roles: ['TEACHER'],
        },
        {
          // username dikosongkan -> dibuat otomatis
          name: 'Drs. Wahyu Pratama, M.Pd.',
          nip: '199408192020121009',
          roles: ['TEACHER', 'DUTY_TEACHER'],
          phone: '081298765432',
        },
        {
          username: 'staf.tu.massal',
          name: 'Nadia Putri (TU)',
          roles: ['ADMIN'],
        },
      ],
    }

    const res = await api.post<DataResponse<BulkUserCreateResponse>>('/users/bulk', payload, {
      idempotencyKey: 'bulk-create-test-1',
    })
    expect(res.data.created).toHaveLength(3)

    const [first, second, third] = res.data.created
    expect(first!.teacherAction).toBe('LINKED_EXISTING')
    expect(first!.user.teacherId).toBe(unlinkedTeacher.id)
    expect(db().teachers.find((t) => t.id === unlinkedTeacher.id)?.userId).toBe(first!.user.id)

    expect(second!.teacherAction).toBe('CREATED_NEW')
    expect(second!.user.username).toBe('wahyu.pratama')
    expect(second!.user.teacherId).toBeTruthy()
    const createdTeacher = db().teachers.find((t) => t.id === second!.user.teacherId)
    expect(createdTeacher).toMatchObject({
      nip: '199408192020121009',
      name: 'Drs. Wahyu Pratama, M.Pd.',
      phone: '081298765432',
      status: 'ACTIVE',
      userId: second!.user.id,
    })

    expect(third!.teacherAction).toBe('NONE')
    expect(third!.user.teacherId).toBeNull()

    // Kata sandi sementara valid dan tidak pernah bocor ke audit log
    for (const c of res.data.created) {
      expect(c.temporaryPassword).toMatch(TEMP_PASSWORD_RE)
      expect(JSON.stringify(db().auditLogs)).not.toContain(c.temporaryPassword)
    }
  })
})

describe('DELETE /users/:id, POST /users/bulk-status, POST /users/bulk-delete', () => {
  it('DELETE /users/:id melepas tautan guru, mencabut sesi, dan menolak hapus diri sendiri', async () => {
    await loginAs('superadmin')
    expect((await errorOf(api.delete('/users/usr_superadmin'))).code).toBe('SELF_PROTECTED')

    const guru = db().users.find((u) => u.id === 'usr_guru')!
    const linkedTeacherId = guru.teacherId!
    expect(linkedTeacherId).toBeTruthy()

    await api.delete<DataResponse<{ id: string }>>('/users/usr_guru')
    expect(db().users.find((u) => u.id === 'usr_guru')).toBeUndefined()
    expect(db().teachers.find((t) => t.id === linkedTeacherId)?.userId).toBeNull()
    expect(latestAudit('usr_guru')?.action).toBe('DELETE')
  })

  it('bulk-status & bulk-delete mengelola beberapa akun sekaligus dan melindungi akun sendiri', async () => {
    await loginAs('superadmin')
    expect(
      (
        await errorOf(
          api.post('/users/bulk-status', {
            ids: ['usr_superadmin', 'usr_kepsek'],
            status: 'INACTIVE',
            reason: 'Uji',
          }),
        )
      ).code,
    ).toBe('SELF_PROTECTED')

    const statusRes = await api.post<DataResponse<BulkUserActionResult>>('/users/bulk-status', {
      ids: ['usr_kepsek', 'usr_admin'],
      status: 'INACTIVE',
      reason: 'Reorganisasi',
    })
    expect(statusRes.data.affected).toBe(2)
    expect(db().users.find((u) => u.id === 'usr_kepsek')?.status).toBe('INACTIVE')

    const delRes = await api.post<DataResponse<BulkUserActionResult>>('/users/bulk-delete', {
      ids: ['usr_kepsek', 'usr_tu_lama'],
      reason: 'Pembersihan akun',
    })
    expect(delRes.data.affected).toBe(2)
    expect(db().users.find((u) => u.id === 'usr_kepsek')).toBeUndefined()
    expect(db().users.find((u) => u.id === 'usr_tu_lama')).toBeUndefined()
  })
})
