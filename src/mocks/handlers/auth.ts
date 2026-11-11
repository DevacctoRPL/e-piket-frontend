import { http } from 'msw'
import type { LoginEvent, LoginRequest } from '@/types/entities'
import { db, MAX_LOGIN_EVENTS, newId, persist, REFRESH_KEY, resetDb, type MockUser } from '../db'
import {
  apiPath,
  audit,
  errors,
  latency,
  noContent,
  nowTs,
  ok,
  readJson,
  requireAuth,
  toCurrentUser,
} from '../utils'
import { asRecord } from './master-write-rules'
import { newPasswordError } from './users-rules'

const ACCESS_TTL_MS = 15 * 60_000

function issueToken(userId: string) {
  const token = newId('at')
  db().tokens[token] = { userId, exp: Date.now() + ACCESS_TTL_MS }
  persist()
  return { accessToken: token, expiresIn: ACCESS_TTL_MS / 1000 }
}

/** Mock mensimulasikan refresh cookie HttpOnly dengan localStorage (hanya untuk dev). */
function setRefreshCookie(userId: string | null) {
  if (userId) localStorage.setItem(REFRESH_KEY, userId)
  else localStorage.removeItem(REFRESH_KEY)
}

/**
 * Catat percobaan masuk. Username dipangkas & dibatasi panjangnya; kata sandi TIDAK PERNAH dicatat.
 */
export function recordLoginEvent(
  username: string,
  user: MockUser | undefined,
  reason: LoginEvent['reason'],
): LoginEvent {
  const d = db()
  d.loginEvents ??= []
  const event: LoginEvent = {
    id: newId('lgn'),
    timestamp: nowTs(),
    userId: user?.id ?? null,
    username: (user?.username ?? username.trim().toLowerCase()).slice(0, 64),
    success: reason === 'OK',
    reason,
  }
  d.loginEvents.unshift(event)
  if (d.loginEvents.length > MAX_LOGIN_EVENTS) d.loginEvents.length = MAX_LOGIN_EVENTS
  persist()
  return event
}

export const authHandlers = [
  http.post(apiPath('/auth/login'), async ({ request }) => {
    await latency(400)
    const body = await readJson<Partial<LoginRequest>>(request)
    const details: Record<string, string> = {}
    if (!body.username?.trim()) details.username = 'required'
    if (!body.password) details.password = 'required'
    if (Object.keys(details).length) return errors.validation(details)
    const user = db().users.find(
      (u) => u.username.toLowerCase() === body.username!.trim().toLowerCase(),
    )
    // Pesan aman: tidak membedakan username/password yang salah maupun akun nonaktif (FR-AUTH-01).
    if (!user || user.password !== body.password || user.status !== 'ACTIVE') {
      const reason = user && user.password === body.password ? 'INACTIVE' : 'BAD_CREDENTIALS'
      recordLoginEvent(body.username!, user, reason)
      return errors.validation({}, 'Nama pengguna atau kata sandi tidak sesuai.')
    }
    const event = recordLoginEvent(body.username!, user, 'OK')
    user.lastLoginAt = event.timestamp
    setRefreshCookie(user.id)
    audit({ user, action: 'LOGIN', entity: 'User', entityId: user.id, summary: 'Masuk ke aplikasi' })
    return ok(issueToken(user.id))
  }),

  http.post(apiPath('/auth/refresh'), async () => {
    await latency(120)
    const userId = localStorage.getItem(REFRESH_KEY)
    const user = userId ? db().users.find((u) => u.id === userId && u.status === 'ACTIVE') : null
    if (!user) return errors.unauthenticated()
    return ok(issueToken(user.id))
  }),

  http.post(apiPath('/auth/logout'), async ({ request }) => {
    await latency(100)
    const header = request.headers.get('Authorization') ?? ''
    const token = header.replace(/^Bearer /, '')
    delete db().tokens[token]
    persist()
    setRefreshCookie(null)
    return noContent()
  }),

  http.get(apiPath('/auth/me'), async ({ request }) => {
    await latency(120)
    const user = requireAuth(request)
    return ok(toCurrentUser(user))
  }),

  http.patch(apiPath('/auth/me'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    const body = await readJson<{ name?: string; email?: string | null }>(request)
    const target = db().users.find((u) => u.id === user.id)!
    if (body.name !== undefined) {
      if (!body.name.trim()) return errors.validation({ name: 'required' })
      target.name = body.name.trim()
    }
    if (body.email !== undefined) {
      if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email))
        return errors.validation({ email: 'Format email tidak valid.' })
      target.email = body.email || null
    }
    persist()
    return ok(toCurrentUser(target))
  }),

  /** Ganti kata sandi sendiri (juga menghapus tanda wajib-ganti setelah sandi sementara). */
  http.post(apiPath('/auth/me/password'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    const body = asRecord(await readJson<unknown>(request))
    const target = db().users.find((u) => u.id === user.id)!
    const details: Record<string, string> = {}
    if (typeof body.currentPassword !== 'string' || !body.currentPassword) details.currentPassword = 'required'
    else if (body.currentPassword !== target.password) details.currentPassword = 'Kata sandi saat ini tidak sesuai.'
    const nextError = newPasswordError(target.password, body.newPassword)
    if (nextError) details.newPassword = nextError
    if (Object.keys(details).length) return errors.validation(details)
    target.password = body.newPassword as string
    target.mustChangePassword = false
    target.updatedAt = nowTs()
    target.version = (target.version ?? 1) + 1
    persist()
    // Audit tanpa nilai kata sandi.
    audit({ user, action: 'UPDATE', entity: 'User', entityId: target.id, summary: 'Mengganti kata sandi sendiri' })
    return noContent()
  }),

  /** Khusus mock: reset data demo ke seed awal. */
  http.post(apiPath('/__mock/reset'), async () => {
    resetDb()
    return noContent()
  }),
]
