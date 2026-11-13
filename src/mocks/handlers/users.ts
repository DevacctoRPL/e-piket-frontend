/**
 * Mock API Kelola Pengguna (Super Admin). Semua audit memakai entity 'User'.
 *
 * - GET    /users                    daftar akun (search/role/status/link + paginasi), izin user:read
 * - GET    /users/:id                detail + 10 percobaan masuk terakhir, izin user:read
 * - POST   /users                    buat akun (idempoten) → 201 + kata sandi sementara, izin user:write
 * - POST   /users/bulk               buat akun massal (auto-link / auto-create guru via NIP), izin user:write
 * - POST   /users/bulk-status        aktif/nonaktif massal, izin user:write
 * - POST   /users/bulk-delete        hapus akun massal, izin user:write
 * - PATCH  /users/:id                ubah nama/email/peran/tautan guru (versi), izin user:write
 * - DELETE /users/:id                hapus akun + lepas tautan guru + cabut sesi, izin user:write
 * - POST   /users/:id/status         aktif/nonaktif (alasan wajib saat nonaktif), izin user:write
 * - POST   /users/:id/reset-password kata sandi sementara baru, izin user:write
 *
 * Kata sandi (sementara) TIDAK PERNAH masuk audit log maupun log login. Aturan pengaman di users-rules.ts.
 */
import { http, type HttpHandler } from 'msw'
import { addDays, dateOf, todayISO } from '@/lib/date'
import {
  ROLES,
  type ActiveStatus,
  type BulkCreatedUserResult,
  type BulkTeacherAction,
  type ID,
  type Role,
  type Teacher,
  type UserAccount,
  type UserAccountDetail,
} from '@/types/entities'
import { db, isDeleted, newId, persist, REFRESH_KEY, type MockUser } from '../db'
import { homeroomClassForTeacher, planHomeroomChange } from '../homeroom'
import {
  apiPath,
  audit,
  created,
  errors,
  latency,
  matchesSearch,
  nowTs,
  ok,
  paginate,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  sortBy,
  withIdempotency,
  type AuthedUser,
} from '../utils'
import { asRecord, FieldErrors, normalizePhone, PHONE_RE, trimmed } from './master-write-rules'
import {
  forbiddenRoleChanges,
  generateTemporaryPassword,
  generateUniqueUsername,
  isPrivilegedAccount,
  MIN_PASSWORD_LENGTH,
  needsTeacherLink,
  normalizeUsername,
  parseRoles,
  selfProtectionError,
  teacherLinkError,
  USERNAME_RE,
  usernameError,
  wouldRemoveLastSuperAdmin,
  wouldRemoveLastSuperAdminBulk,
} from './users-rules'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const NIP_RE = /^[A-Za-z0-9.-]{1,30}$/
const AUDIT_FIELDS = ['username', 'name', 'email', 'roles', 'teacherId', 'status'] as const

/* ------------------------------------------------------------------ helpers */

function reader(request: Request): AuthedUser {
  const user = requireAuth(request)
  requirePermission(user, 'user:read')
  return user
}

function writer(request: Request): AuthedUser {
  const user = requireAuth(request)
  requirePermission(user, 'user:write')
  return user
}

function idParam(params: Record<string, string | readonly string[] | undefined>): ID {
  const v = params.id
  return typeof v === 'string' ? v : ''
}

/** Guru yang belum dihapus (soft-delete) — guru terhapus tidak boleh ditautkan. */
function liveTeachers() {
  return db().teachers.filter((t) => !isDeleted('teachers', t.id))
}

function findUser(id: ID) {
  return db().users.find((u) => u.id === id)
}

const sevenDaysFrom = () => addDays(todayISO(), -6)

function failedLogins7d(userId: ID) {
  const from = sevenDaysFrom()
  return (db().loginEvents ?? []).filter((e) => e.userId === userId && !e.success && dateOf(e.timestamp) >= from).length
}

export function toAccount(u: MockUser): UserAccount {
  const teacher = u.teacherId ? db().teachers.find((t) => t.id === u.teacherId) : undefined
  const homeroom = u.roles.includes('HOMEROOM') ? homeroomClassForTeacher(u.teacherId) : null
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    roles: u.roles,
    status: u.status,
    teacherId: u.teacherId,
    teacherName: teacher?.name ?? null,
    homeroomClassId: homeroom?.id ?? null,
    homeroomClassName: homeroom?.name ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    mustChangePassword: !!u.mustChangePassword,
    failedLogins7d: failedLogins7d(u.id),
    createdAt: u.createdAt ?? null,
    version: u.version ?? 1,
  }
}

function auditSnapshot(u: MockUser): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of AUDIT_FIELDS) out[k] = u[k]
  return out
}

/** Akhiri semua sesi akun (aturan 6). */
export function revokeSessions(userId: ID) {
  const tokens = db().tokens
  for (const [token, entry] of Object.entries(tokens)) if (entry.userId === userId) delete tokens[token]
  // mock refresh "cookie" (localStorage) milik akun tsb juga dicabut
  if (typeof localStorage !== 'undefined' && localStorage.getItem(REFRESH_KEY) === userId) {
    localStorage.removeItem(REFRESH_KEY)
  }
}

/** Sinkronkan Teacher.userId dengan tautan akun. */
function syncTeacherLink(userId: ID, before: ID | null, after: ID | null) {
  if (before === after) return
  const teachers = db().teachers
  const old = before ? teachers.find((t) => t.id === before) : undefined
  if (old && old.userId === userId) old.userId = null
  const next = after ? teachers.find((t) => t.id === after) : undefined
  if (next) next.userId = userId
}

/** Aturan 3 — pelaku non-Super Admin tidak boleh mengelola akun beperan istimewa. */
function requireCanManage(actor: AuthedUser, target: MockUser) {
  if (isPrivilegedAccount(target.roles) && !actor.roles.includes('SUPER_ADMIN')) {
    throw errors.forbidden('Hanya Super Admin yang dapat mengelola akun Super Admin dan Admin/TU.')
  }
}

function requireRoleChanges(actor: AuthedUser, before: Role[], after: Role[]) {
  const blocked = forbiddenRoleChanges(actor.roles, before, after)
  if (blocked.length) {
    throw errors.forbidden('Hanya Super Admin yang dapat memberi atau mencabut peran Super Admin dan Admin/TU.')
  }
}

function requireVersion(body: Record<string, unknown>, target: MockUser) {
  if (typeof body.version !== 'number') throw errors.validation({ version: 'required' })
  if (body.version !== (target.version ?? 1)) throw errors.versionConflict()
}

function guardSelfAndLast(
  actor: AuthedUser,
  target: MockUser,
  change: { roles?: Role[]; status?: ActiveStatus; resetPassword?: boolean; delete?: boolean },
) {
  const self = selfProtectionError(actor.id, target, change)
  if (self) throw errors.conflict(self, 'SELF_PROTECTED')
  if (wouldRemoveLastSuperAdmin(db().users, target.id, change)) {
    throw errors.conflict('Minimal satu Super Admin aktif harus tersisa.', 'LAST_SUPER_ADMIN')
  }
}

function bump(u: MockUser) {
  u.version = (u.version ?? 1) + 1
  u.updatedAt = nowTs()
}

function parseEmail(fe: FieldErrors, v: unknown): string | null {
  const email = trimmed(v)
  if (!email) return null
  if (email.length > 120) fe.add('email', 'too_long')
  else if (!EMAIL_RE.test(email)) fe.add('email', 'Format email tidak valid.')
  return email.toLowerCase()
}

function parseName(fe: FieldErrors, v: unknown): string {
  const name = trimmed(v)
  if (!name) fe.add('name', 'required')
  else if (name.length > 120) fe.add('name', 'too_long')
  return name
}

function parseRoleList(fe: FieldErrors, v: unknown): Role[] {
  const roles = parseRoles(v)
  if (roles === null) {
    fe.add('roles', v === undefined || v === null ? 'required' : 'invalid')
    return []
  }
  if (roles.length === 0) fe.add('roles', 'required')
  return roles
}

function parseTeacherId(v: unknown): ID | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/* ------------------------------------------------------------------ handlers */

export const usersHandlers: HttpHandler[] = [
  http.get(apiPath('/users'), async ({ request }) => {
    await latency()
    reader(request)
    const sp = searchParams(request)
    const search = sp.get('search') || sp.get('q')
    const role = sp.get('role')
    const status = sp.get('status')
    const link = sp.get('link')
    const details: Record<string, string> = {}
    if (role && !(ROLES as readonly string[]).includes(role)) details.role = 'invalid'
    if (status && status !== 'ACTIVE' && status !== 'INACTIVE') details.status = 'invalid'
    if (link && link !== 'linked' && link !== 'none') details.link = 'invalid'
    if (Object.keys(details).length) return errors.validation(details, 'Filter pengguna tidak valid.')

    const rows = db()
      .users.map(toAccount)
      .filter(
        (u) =>
          (!role || u.roles.includes(role as Role)) &&
          (!status || u.status === status) &&
          (!link || (link === 'linked' ? !!u.teacherId : !u.teacherId)) &&
          matchesSearch(search, u.name, u.username, u.email, u.teacherName),
      )
    const sort = sp.get('sort')
    const allowed = ['name', 'username', 'lastLoginAt', 'createdAt', 'status']
    const sorted = sortBy(rows, sort && allowed.includes(sort.replace(/^-/, '')) ? sort : null, 'name')
    return paginate(sorted, request)
  }),

  http.get(apiPath('/users/:id'), async ({ request, params }) => {
    await latency(120)
    reader(request)
    const u = findUser(idParam(params))
    if (!u) return errors.notFound('Akun tidak ditemukan.')
    const detail: UserAccountDetail = {
      ...toAccount(u),
      recentLogins: (db().loginEvents ?? [])
        .filter((e) => e.userId === u.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 10),
    }
    return ok(detail)
  }),

  http.post(apiPath('/users'), async ({ request }) => {
    await latency()
    const actor = writer(request)
    return withIdempotency(request, async () => {
      const body = asRecord(await readJson<unknown>(request))
      const d = db()
      const fe = new FieldErrors()
      const username = normalizeUsername(body.username)
      const usernameErr = usernameError(username, d.users)
      if (usernameErr) fe.add('username', usernameErr)
      const name = parseName(fe, body.name)
      const email = parseEmail(fe, body.email)
      const roles = parseRoleList(fe, body.roles)
      const teacherId = parseTeacherId(body.teacherId)
      if (roles.length) {
        const linkErr = teacherLinkError(roles, teacherId, liveTeachers(), d.users)
        if (linkErr) fe.add('teacherId', linkErr)
      }
      fe.throwIfAny()
      requireRoleChanges(actor, [], roles)

      const temporaryPassword = generateTemporaryPassword()
      const now = nowTs()
      const u: MockUser = {
        id: newId('usr'),
        username,
        password: temporaryPassword,
        name,
        email,
        roles,
        teacherId,
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        mustChangePassword: true,
        version: 1,
      }
      const plannedClasses = planHomeroomChange(u, null, body.homeroomClassId, 'homeroomClassId' in body)
      d.classes.forEach((cls, index) => Object.assign(cls, plannedClasses[index]))
      d.users.push(u)
      syncTeacherLink(u.id, null, teacherId)
      persist()
      audit({
        user: actor,
        action: 'CREATE',
        entity: 'User',
        entityId: u.id,
        summary: `Membuat akun ${u.name} (${u.username})`,
        after: auditSnapshot(u),
      })
      return created({ user: toAccount(u), temporaryPassword })
    })
  }),

  http.post(apiPath('/users/bulk'), async ({ request }) => {
    await latency()
    const actor = writer(request)
    return withIdempotency(request, async () => {
      const body = asRecord(await readJson<unknown>(request))
      const rawItems = body.items
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return errors.validation({ items: 'required' }, 'Daftar akun tidak boleh kosong.')
      }
      if (rawItems.length > 200) {
        return errors.validation({ items: 'too_many' }, 'Maksimal 200 akun dalam satu kali unggah.')
      }

      const d = db()
      const teachers = liveTeachers()
      const fe = new FieldErrors()
      const takenUsernames = new Set(d.users.map((u) => u.username.toLowerCase()))
      const claimedTeacherIds = new Set(d.users.map((u) => u.teacherId).filter((id): id is ID => !!id))
      const seenNewNips = new Set<string>()

      interface PreparedBulkRow {
        username: string
        name: string
        email: string | null
        roles: Role[]
        password: string
        teacherId: ID | null
        newTeacher: { nip: string; name: string; phone: string | null } | null
        teacherAction: BulkTeacherAction
      }

      const prepared: PreparedBulkRow[] = []

      rawItems.forEach((rawItem, i) => {
        const prefix = `items.${i}`
        const item = typeof rawItem === 'object' && rawItem !== null && !Array.isArray(rawItem)
          ? (rawItem as Record<string, unknown>)
          : {}

        const name = trimmed(item.name)
        if (!name) fe.add(`${prefix}.name`, 'required')
        else if (name.length > 120) fe.add(`${prefix}.name`, 'too_long')

        const nip = trimmed(item.nip)
        const rawUsername = normalizeUsername(item.username)
        const username = rawUsername || generateUniqueUsername(name || `user.${i + 1}`, nip, takenUsernames)
        if (!USERNAME_RE.test(username)) {
          fe.add(`${prefix}.username`, 'invalid')
        } else if (takenUsernames.has(username)) {
          fe.add(`${prefix}.username`, 'duplicate')
        } else {
          takenUsernames.add(username)
        }

        const rawEmail = trimmed(item.email)
        let email: string | null = null
        if (rawEmail) {
          if (rawEmail.length > 120) fe.add(`${prefix}.email`, 'too_long')
          else if (!EMAIL_RE.test(rawEmail)) fe.add(`${prefix}.email`, 'Format email tidak valid.')
          else email = rawEmail.toLowerCase()
        }

        const rolesInput = item.roles === undefined || item.roles === null || (Array.isArray(item.roles) && item.roles.length === 0)
          ? ['TEACHER']
          : item.roles
        const roles = parseRoles(rolesInput)
        if (!roles || roles.length === 0) {
          fe.add(`${prefix}.roles`, 'invalid')
        } else {
          requireRoleChanges(actor, [], roles)
        }

        const validRoles = roles ?? []
        const rawPassword = trimmed(item.password)
        let password = ''
        if (rawPassword) {
          if (rawPassword.length < MIN_PASSWORD_LENGTH || rawPassword.length > 128) {
            fe.add(`${prefix}.password`, `Minimal ${MIN_PASSWORD_LENGTH} karakter.`)
          } else {
            password = rawPassword
          }
        } else {
          password = generateTemporaryPassword()
        }

        const phone = normalizePhone(item.phone)
        if (phone && !PHONE_RE.test(phone)) {
          fe.add(`${prefix}.phone`, 'Nomor telepon tidak valid (8–15 digit).')
        }

        let teacherId = parseTeacherId(item.teacherId)
        let newTeacher: { nip: string; name: string; phone: string | null } | null = null
        let teacherAction: BulkTeacherAction = 'NONE'

        if (teacherId) {
          const linkErr = teacherLinkError(validRoles, teacherId, teachers, d.users)
          if (linkErr) fe.add(`${prefix}.teacherId`, linkErr)
          else if (claimedTeacherIds.has(teacherId)) fe.add(`${prefix}.teacherId`, 'Guru ini sudah ditautkan ke akun lain.')
          else {
            claimedTeacherIds.add(teacherId)
            teacherAction = 'LINKED_EXISTING'
          }
        } else if (nip) {
          if (!NIP_RE.test(nip)) {
            fe.add(`${prefix}.nip`, 'invalid')
          } else {
            const nipKey = nip.toLowerCase()
            const existingTeacher = teachers.find((t) => t.nip.toLowerCase() === nipKey)
            if (existingTeacher) {
              const linkErr = teacherLinkError(validRoles, existingTeacher.id, teachers, d.users)
              if (linkErr) fe.add(`${prefix}.nip`, linkErr)
              else if (claimedTeacherIds.has(existingTeacher.id)) {
                fe.add(`${prefix}.nip`, 'Guru ini sudah ditautkan ke akun lain.')
              } else {
                teacherId = existingTeacher.id
                claimedTeacherIds.add(existingTeacher.id)
                teacherAction = 'LINKED_EXISTING'
              }
            } else if (seenNewNips.has(nipKey)) {
              fe.add(`${prefix}.nip`, 'duplicate')
            } else {
              seenNewNips.add(nipKey)
              newTeacher = { nip, name, phone }
              teacherAction = 'CREATED_NEW'
            }
          }
        } else if (needsTeacherLink(validRoles)) {
          fe.add(`${prefix}.teacherId`, 'required')
        }

        prepared.push({
          username,
          name,
          email,
          roles: validRoles,
          password,
          teacherId,
          newTeacher,
          teacherAction,
        })
      })

      fe.throwIfAny('Terdapat baris data akun yang tidak valid.')

      const now = nowTs()
      const results: BulkCreatedUserResult[] = []

      for (const row of prepared) {
        let finalTeacherId = row.teacherId
        if (row.newTeacher) {
          const createdTeacher: Teacher = {
            id: newId('tch'),
            nip: row.newTeacher.nip,
            name: row.newTeacher.name,
            phone: row.newTeacher.phone,
            subjectIds: [],
            status: 'ACTIVE',
            userId: null,
          }
          d.teachers.push(createdTeacher)
          finalTeacherId = createdTeacher.id
          audit({
            user: actor,
            action: 'CREATE',
            entity: 'Teacher',
            entityId: createdTeacher.id,
            summary: `Menambah guru ${createdTeacher.name} (otomatis dari impor akun)`,
            after: {
              nip: createdTeacher.nip,
              name: createdTeacher.name,
              subjectIds: createdTeacher.subjectIds,
              status: createdTeacher.status,
            },
          })
        } else if (finalTeacherId && row.teacherAction === 'LINKED_EXISTING') {
          const linkedTeacher = d.teachers.find((t) => t.id === finalTeacherId)
          if (linkedTeacher && !linkedTeacher.phone && row.newTeacher === null) {
            // Biarkan data guru yang sudah ada tetap utuh
          }
        }

        const u: MockUser = {
          id: newId('usr'),
          username: row.username,
          password: row.password,
          name: row.name,
          email: row.email,
          roles: row.roles,
          teacherId: finalTeacherId,
          status: 'ACTIVE',
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
          mustChangePassword: true,
          version: 1,
        }
        d.users.push(u)
        syncTeacherLink(u.id, null, finalTeacherId)
        audit({
          user: actor,
          action: 'CREATE',
          entity: 'User',
          entityId: u.id,
          summary: `Membuat akun ${u.name} (${u.username}) melalui impor massal`,
          after: auditSnapshot(u),
        })
        results.push({
          user: toAccount(u),
          temporaryPassword: row.password,
          teacherAction: row.teacherAction,
        })
      }

      persist()
      return created({ created: results })
    })
  }),

  http.post(apiPath('/users/bulk-status'), async ({ request }) => {
    await latency()
    const actor = writer(request)
    const body = asRecord(await readJson<unknown>(request))
    const fe = new FieldErrors()
    const rawIds = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
    const ids = [...new Set(rawIds)]
    if (ids.length === 0) fe.add('ids', 'required')
    const status = body.status === 'ACTIVE' || body.status === 'INACTIVE' ? (body.status as ActiveStatus) : null
    if (!status) fe.add('status', body.status === undefined ? 'required' : 'invalid')
    const reason = trimmed(body.reason)
    if (status === 'INACTIVE' && !reason) fe.add('reason', 'required')
    else if (reason.length > 500) fe.add('reason', 'too_long')
    fe.throwIfAny()

    const d = db()
    const targets: MockUser[] = []
    for (const id of ids) {
      const u = findUser(id)
      if (!u) return errors.notFound('Salah satu akun tidak ditemukan.')
      requireCanManage(actor, u)
      const selfErr = selfProtectionError(actor.id, u, { status: status! })
      if (selfErr) throw errors.conflict(selfErr, 'SELF_PROTECTED')
      targets.push(u)
    }

    if (wouldRemoveLastSuperAdminBulk(d.users, new Set(ids), { status: status! })) {
      throw errors.conflict('Minimal satu Super Admin aktif harus tersisa.', 'LAST_SUPER_ADMIN')
    }

    const updatedIds: ID[] = []
    for (const target of targets) {
      if (target.status === status) continue
      const before = target.status
      target.status = status!
      if (status === 'INACTIVE') revokeSessions(target.id)
      bump(target)
      updatedIds.push(target.id)
      audit({
        user: actor,
        action: 'STATUS_CHANGE',
        entity: 'User',
        entityId: target.id,
        summary: status === 'INACTIVE' ? `Menonaktifkan akun ${target.name}` : `Mengaktifkan kembali akun ${target.name}`,
        before: { status: before },
        after: { status: target.status },
        reason: reason || null,
      })
    }
    if (updatedIds.length > 0) persist()
    return ok({ affected: updatedIds.length, ids: updatedIds })
  }),

  http.post(apiPath('/users/bulk-delete'), async ({ request }) => {
    await latency()
    const actor = writer(request)
    const body = asRecord(await readJson<unknown>(request))
    const rawIds = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
    const ids = [...new Set(rawIds)]
    if (ids.length === 0) return errors.validation({ ids: 'required' })
    const reason = trimmed(body.reason)
    if (reason.length > 500) return errors.validation({ reason: 'too_long' })

    const d = db()
    const targets: MockUser[] = []
    for (const id of ids) {
      const u = findUser(id)
      if (!u) return errors.notFound('Salah satu akun tidak ditemukan.')
      requireCanManage(actor, u)
      const selfErr = selfProtectionError(actor.id, u, { delete: true })
      if (selfErr) throw errors.conflict(selfErr, 'SELF_PROTECTED')
      targets.push(u)
    }

    if (wouldRemoveLastSuperAdminBulk(d.users, new Set(ids), { delete: true })) {
      throw errors.conflict('Minimal satu Super Admin aktif harus tersisa.', 'LAST_SUPER_ADMIN')
    }

    const deletedIds: ID[] = []
    for (const target of targets) {
      const before = auditSnapshot(target)
      syncTeacherLink(target.id, target.teacherId, null)
      revokeSessions(target.id)
      const idx = d.users.findIndex((u) => u.id === target.id)
      if (idx !== -1) d.users.splice(idx, 1)
      deletedIds.push(target.id)
      audit({
        user: actor,
        action: 'DELETE',
        entity: 'User',
        entityId: target.id,
        summary: `Menghapus akun ${target.name} (${target.username})`,
        before,
        reason: reason || null,
      })
    }
    persist()
    return ok({ affected: deletedIds.length, ids: deletedIds })
  }),

  http.delete(apiPath('/users/:id'), async ({ request, params }) => {
    await latency()
    const actor = writer(request)
    const target = findUser(idParam(params))
    if (!target) return errors.notFound('Akun tidak ditemukan.')
    requireCanManage(actor, target)
    const raw = await readJson<unknown>(request).catch(() => ({}))
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    const reason = trimmed(body.reason)
    if (reason.length > 500) return errors.validation({ reason: 'too_long' })
    guardSelfAndLast(actor, target, { delete: true })

    const before = auditSnapshot(target)
    syncTeacherLink(target.id, target.teacherId, null)
    revokeSessions(target.id)
    const d = db()
    const idx = d.users.findIndex((u) => u.id === target.id)
    if (idx !== -1) d.users.splice(idx, 1)
    persist()
    audit({
      user: actor,
      action: 'DELETE',
      entity: 'User',
      entityId: target.id,
      summary: `Menghapus akun ${target.name} (${target.username})`,
      before,
      reason: reason || null,
    })
    return ok({ id: target.id })
  }),

  http.patch(apiPath('/users/:id'), async ({ request, params }) => {
    await latency()
    const actor = writer(request)
    const target = findUser(idParam(params))
    if (!target) return errors.notFound('Akun tidak ditemukan.')
    const body = asRecord(await readJson<unknown>(request))
    requireCanManage(actor, target)

    const d = db()
    const fe = new FieldErrors()
    const name = body.name !== undefined ? parseName(fe, body.name) : target.name
    const email = body.email !== undefined ? parseEmail(fe, body.email) : target.email
    const roles = body.roles !== undefined ? parseRoleList(fe, body.roles) : target.roles
    const teacherId = body.teacherId !== undefined ? parseTeacherId(body.teacherId) : target.teacherId
    if (roles.length && (body.roles !== undefined || body.teacherId !== undefined)) {
      const linkErr = teacherLinkError(roles, teacherId, liveTeachers(), d.users, target.id)
      if (linkErr) fe.add('teacherId', linkErr)
    }
    fe.throwIfAny()
    requireVersion(body, target)
    requireRoleChanges(actor, target.roles, roles)
    const rolesChanged = JSON.stringify(roles) !== JSON.stringify(target.roles)
    if (rolesChanged) guardSelfAndLast(actor, target, { roles })
    const homeroomProvided = 'homeroomClassId' in body
    if (homeroomProvided && !actor.roles.includes('SUPER_ADMIN')) {
      throw errors.forbidden('Penetapan Wali Kelas hanya dapat dilakukan Super Admin.')
    }
    const projected = { ...target, roles, teacherId }
    const plannedClasses = planHomeroomChange(projected, target, body.homeroomClassId, homeroomProvided)

    const before = auditSnapshot(target)
    const prevTeacher = target.teacherId
    target.name = name
    target.email = email
    target.roles = roles
    target.teacherId = teacherId
    d.classes.forEach((cls, index) => Object.assign(cls, plannedClasses[index]))
    const after = auditSnapshot(target)
    const changed = Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    if (changed.length === 0) return ok(toAccount(target))

    syncTeacherLink(target.id, prevTeacher, teacherId)
    bump(target)
    persist()
    const diffBefore: Record<string, unknown> = {}
    const diffAfter: Record<string, unknown> = {}
    for (const k of changed) {
      diffBefore[k] = before[k] ?? null
      diffAfter[k] = after[k] ?? null
    }
    audit({
      user: actor,
      action: rolesChanged ? 'ROLE_CHANGE' : 'UPDATE',
      entity: 'User',
      entityId: target.id,
      summary: rolesChanged ? `Mengubah peran akun ${target.name}` : `Mengubah data akun ${target.name}`,
      before: diffBefore,
      after: diffAfter,
    })
    return ok(toAccount(target))
  }),

  http.post(apiPath('/users/:id/status'), async ({ request, params }) => {
    await latency()
    const actor = writer(request)
    const target = findUser(idParam(params))
    if (!target) return errors.notFound('Akun tidak ditemukan.')
    const body = asRecord(await readJson<unknown>(request))
    requireCanManage(actor, target)

    const fe = new FieldErrors()
    const status = body.status === 'ACTIVE' || body.status === 'INACTIVE' ? (body.status as ActiveStatus) : null
    if (!status) fe.add('status', body.status === undefined ? 'required' : 'invalid')
    const reason = trimmed(body.reason)
    if (status === 'INACTIVE' && !reason) fe.add('reason', 'required')
    else if (reason.length > 500) fe.add('reason', 'too_long')
    fe.throwIfAny()
    requireVersion(body, target)
    if (status === target.status) return ok(toAccount(target))
    guardSelfAndLast(actor, target, { status: status! })

    const before = target.status
    target.status = status!
    if (status === 'INACTIVE') revokeSessions(target.id)
    bump(target)
    persist()
    audit({
      user: actor,
      action: 'STATUS_CHANGE',
      entity: 'User',
      entityId: target.id,
      summary: status === 'INACTIVE' ? `Menonaktifkan akun ${target.name}` : `Mengaktifkan kembali akun ${target.name}`,
      before: { status: before },
      after: { status: target.status },
      reason: reason || null,
    })
    return ok(toAccount(target))
  }),

  http.post(apiPath('/users/:id/reset-password'), async ({ request, params }) => {
    await latency()
    const actor = writer(request)
    const target = findUser(idParam(params))
    if (!target) return errors.notFound('Akun tidak ditemukan.')
    const raw = await readJson<unknown>(request).catch(() => ({}))
    const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
    requireCanManage(actor, target)
    const reason = trimmed(body.reason)
    if (reason.length > 500) return errors.validation({ reason: 'too_long' })
    guardSelfAndLast(actor, target, { resetPassword: true })

    const temporaryPassword = generateTemporaryPassword()
    const hadFlag = !!target.mustChangePassword
    target.password = temporaryPassword
    target.mustChangePassword = true
    revokeSessions(target.id)
    bump(target)
    persist()
    // Audit TANPA nilai kata sandi (aturan 7).
    audit({
      user: actor,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: target.id,
      summary: `Me-reset kata sandi akun ${target.name}`,
      before: { mustChangePassword: hadFlag },
      after: { mustChangePassword: true },
      reason: reason || null,
    })
    return ok({ userId: target.id, temporaryPassword })
  }),
]
