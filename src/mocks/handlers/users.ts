/**
 * Mock API Kelola Pengguna (Super Admin). Semua audit memakai entity 'User'.
 *
 * - GET  /users                      daftar akun (search/role/status/link + paginasi), izin user:read
 * - GET  /users/:id                  detail + 10 percobaan masuk terakhir, izin user:read
 * - POST /users                      buat akun (idempoten) → 201 + kata sandi sementara, izin user:write
 * - PATCH /users/:id                 ubah nama/email/peran/tautan guru (versi), izin user:write
 * - POST /users/:id/status           aktif/nonaktif (alasan wajib saat nonaktif), izin user:write
 * - POST /users/:id/reset-password   kata sandi sementara baru, izin user:write
 *
 * Kata sandi (sementara) TIDAK PERNAH masuk audit log maupun log login. Aturan pengaman di users-rules.ts.
 */
import { http, type HttpHandler } from 'msw'
import { addDays, dateOf, todayISO } from '@/lib/date'
import { ROLES, type ActiveStatus, type ID, type Role, type UserAccount, type UserAccountDetail } from '@/types/entities'
import { db, isDeleted, newId, persist, REFRESH_KEY, type MockUser } from '../db'
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
import { asRecord, FieldErrors, trimmed } from './master-write-rules'
import {
  forbiddenRoleChanges,
  generateTemporaryPassword,
  isPrivilegedAccount,
  normalizeUsername,
  parseRoles,
  selfProtectionError,
  teacherLinkError,
  usernameError,
  wouldRemoveLastSuperAdmin,
} from './users-rules'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
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
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    roles: u.roles,
    status: u.status,
    teacherId: u.teacherId,
    teacherName: teacher?.name ?? null,
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
  change: { roles?: Role[]; status?: ActiveStatus; resetPassword?: boolean },
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

    const before = auditSnapshot(target)
    const prevTeacher = target.teacherId
    target.name = name
    target.email = email
    target.roles = roles
    target.teacherId = teacherId
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
