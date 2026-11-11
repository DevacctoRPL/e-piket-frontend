import { HttpResponse, delay as mswDelay } from 'msw'
import { toISODateTime } from '@/lib/date'
import { FULL_SCOPE_ROLES, hasRole, permissionsForRoles } from '@/lib/permissions'
import type { ApiErrorBody, PaginationMeta } from '@/types/api'
import type { AuditAction, CurrentUser, ID, Permission } from '@/types/entities'
import { db, newId, persist, type MockUser } from './db'

/** Prefix API mock. Handler memakai path relatif: apiPath('/students'). */
export const API = '*/api/v1'
export const apiPath = (p: string) => `${API}${p}`

export function nowTs() {
  return toISODateTime(new Date())
}

export function requestId() {
  return `req_${Math.random().toString(36).slice(2, 10)}`
}

/* ------------------------------------------------------------------ responses */

export function ok<T>(data: T, init?: ResponseInit) {
  return HttpResponse.json({ data }, init)
}

export function created<T>(data: T) {
  return HttpResponse.json({ data }, { status: 201 })
}

export function noContent() {
  return new HttpResponse(null, { status: 204 })
}

export function list<T>(items: T[], meta: PaginationMeta) {
  return HttpResponse.json({ data: items, meta })
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string>,
) {
  const body: ApiErrorBody = { error: { code, message, details, requestId: requestId() } }
  return HttpResponse.json(body, { status })
}

export const errors = {
  validation: (details: Record<string, string>, message = 'Periksa kembali isian formulir.') =>
    apiError(422, 'VALIDATION_ERROR', message, details),
  unauthenticated: () =>
    apiError(401, 'UNAUTHENTICATED', 'Sesi Anda telah berakhir. Silakan masuk kembali.'),
  forbidden: (message = 'Anda tidak memiliki akses untuk data atau tindakan ini.') =>
    apiError(403, 'FORBIDDEN', message),
  notFound: (message = 'Data tidak ditemukan.') => apiError(404, 'NOT_FOUND', message),
  conflict: (message: string, code = 'CONFLICT', details?: Record<string, string>) =>
    apiError(409, code, message, details),
  versionConflict: () =>
    apiError(
      409,
      'VERSION_CONFLICT',
      'Data telah diubah oleh pengguna lain. Muat ulang halaman untuk melihat versi terbaru.',
    ),
  alreadyFinal: () =>
    apiError(
      409,
      'ALREADY_FINAL',
      'Data sudah final. Perubahan memerlukan hak koreksi dan alasan.',
    ),
}

/* ------------------------------------------------------------------ auth */

export interface AuthedUser extends MockUser {
  permissions: Permission[]
}

export function toCurrentUser(u: MockUser): CurrentUser {
  const d = db()
  const teacherId = u.teacherId
  const homeroomClassIds = teacherId
    ? d.classes.filter((c) => c.homeroomTeacherId === teacherId).map((c) => c.id)
    : []
  const teachingClassIds = teacherId
    ? [...new Set(d.timetable.filter((s) => s.teacherId === teacherId).map((s) => s.classId))]
    : []
  const coordinatedActivityIds = d.extraActivities
    .filter((a) => a.coordinatorUserId === u.id || (teacherId && a.instructorTeacherId === teacherId))
    .map((a) => a.id)
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    roles: u.roles,
    permissions: permissionsForRoles(u.roles),
    teacherId,
    homeroomClassIds,
    teachingClassIds,
    coordinatedActivityIds,
    mustChangePassword: !!u.mustChangePassword,
  }
}

/**
 * Ambil user dari header Authorization. Melempar Response 401 bila tidak valid
 * (MSW v2 mendukung `throw HttpResponse` di resolver).
 */
export function requireAuth(request: Request): AuthedUser {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const entry = token ? db().tokens[token] : undefined
  if (!entry || entry.exp < Date.now()) throw errors.unauthenticated()
  const user = db().users.find((u) => u.id === entry.userId && u.status === 'ACTIVE')
  if (!user) throw errors.unauthenticated()
  return { ...user, permissions: permissionsForRoles(user.roles) }
}

export function can(user: AuthedUser, ...perms: Permission[]) {
  return perms.some((p) => user.permissions.includes(p))
}

/** Lempar 403 bila user tidak punya salah satu permission. */
export function requirePermission(user: AuthedUser, ...perms: Permission[]) {
  if (!can(user, ...perms)) throw errors.forbidden()
}

/**
 * Scope kelas yang boleh diakses user untuk data siswa (PRD §4.1, AC-13).
 * null = semua kelas.
 */
export function accessibleClassIds(user: AuthedUser): ID[] | null {
  if (hasRole(user, ...FULL_SCOPE_ROLES)) return null
  const cu = toCurrentUser(user)
  return [...new Set([...cu.homeroomClassIds, ...cu.teachingClassIds])]
}

export function requireClassAccess(user: AuthedUser, classId: ID) {
  const scope = accessibleClassIds(user)
  if (scope && !scope.includes(classId)) {
    throw errors.forbidden('Anda tidak memiliki akses ke data kelas ini.')
  }
}

/* ------------------------------------------------------------------ request helpers */

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw errors.validation({ body: 'invalid' }, 'Format permintaan tidak valid.')
  }
}

export function searchParams(request: Request) {
  return new URL(request.url).searchParams
}

export function paginate<T>(items: T[], request: Request, defaultPageSize = 20) {
  const sp = searchParams(request)
  const pageSize = Math.min(Math.max(Number(sp.get('pageSize')) || defaultPageSize, 1), 500)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(Math.max(Number(sp.get('page')) || 1, 1), totalPages)
  const slice = items.slice((page - 1) * pageSize, page * pageSize)
  return list(slice, { page, pageSize, totalItems, totalPages })
}

/** Filter teks sederhana tanpa membedakan huruf besar/kecil. */
export function matchesSearch(q: string | null, ...fields: (string | null | undefined)[]) {
  if (!q) return true
  const needle = q.toLowerCase().trim()
  return fields.some((f) => f?.toLowerCase().includes(needle))
}

/** Sort generik: ?sort=name atau ?sort=-date */
export function sortBy<T>(items: T[], sort: string | null, fallback?: keyof T): T[] {
  const key = (sort?.replace(/^-/, '') || (fallback as string | undefined)) as keyof T | undefined
  if (!key) return items
  const dir = sort?.startsWith('-') ? -1 : 1
  return [...items].sort((a, b) => {
    const av = a[key] as unknown
    const bv = b[key] as unknown
    if (av === bv) return 0
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    return (av as number | string) > (bv as number | string) ? dir : -dir
  })
}

function idempotencyScope(request: Request, key: string) {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const userId = (token && db().tokens[token]?.userId) || 'anon'
  return `${request.method} ${new URL(request.url).pathname} ${userId} ${key}`
}

/**
 * Bungkus handler mutasi dengan Idempotency-Key (PRD §10.8, AC-03):
 * request ulang dengan kunci yang sama mengembalikan response pertama tanpa efek samping baru.
 */
export async function withIdempotency(
  request: Request,
  fn: () => Promise<Response> | Response,
): Promise<Response> {
  const rawKey = request.headers.get('Idempotency-Key')
  // Kunci dibatasi per method + path + user: kunci yang sama di endpoint/user lain tidak memutar ulang response.
  const key = rawKey ? idempotencyScope(request, rawKey) : null
  if (key) {
    const cached = db().idempotency[key]
    if (cached) {
      return HttpResponse.json(cached.body as Record<string, unknown>, {
        status: cached.status,
        headers: { 'Idempotent-Replayed': 'true' },
      })
    }
  }
  let res: Response
  try {
    res = await fn()
  } catch (thrown) {
    if (thrown instanceof Response) return thrown
    throw thrown
  }
  if (key && res.status < 300 && res.status !== 204) {
    const body = (await res.clone().json().catch(() => null)) as unknown
    db().idempotency[key] = { status: res.status, body }
    persist()
  }
  return res
}

/* ------------------------------------------------------------------ audit */

export function audit(params: {
  user: Pick<MockUser, 'id' | 'name'>
  action: AuditAction
  entity: string
  entityId: ID
  summary: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  reason?: string | null
}) {
  db().auditLogs.unshift({
    id: newId('aud'),
    timestamp: nowTs(),
    actorId: params.user.id,
    actorName: params.user.name,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    summary: params.summary,
    before: params.before ?? null,
    after: params.after ?? null,
    reason: params.reason ?? null,
    requestId: requestId(),
  })
  persist()
}

/** Ambil subset field untuk audit diff. */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k as string] = obj[k]
  return out
}

/**
 * Latensi realistis untuk mock. Di Vitest (MODE=test) langsung kembali agar test komponen cepat;
 * timeout eksplisit di test tetap aman (hanya batas atas).
 */
export async function latency(ms?: number) {
  if (import.meta.env.MODE === 'test') return
  await mswDelay(ms ?? 150 + Math.floor(Math.random() * 250))
}
