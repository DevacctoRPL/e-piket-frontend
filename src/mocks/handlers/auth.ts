import { http } from 'msw'
import type { LoginRequest } from '@/types/entities'
import { db, newId, persist, REFRESH_KEY, resetDb } from '../db'
import {
  apiPath,
  audit,
  errors,
  latency,
  noContent,
  ok,
  readJson,
  requireAuth,
  toCurrentUser,
} from '../utils'

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
    // Pesan aman: tidak membedakan username/password yang salah (FR-AUTH-01).
    if (!user || user.password !== body.password || user.status !== 'ACTIVE') {
      return errors.validation({}, 'Nama pengguna atau kata sandi tidak sesuai.')
    }
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

  /** Khusus mock: reset data demo ke seed awal. */
  http.post(apiPath('/__mock/reset'), async () => {
    resetDb()
    return noContent()
  }),
]
