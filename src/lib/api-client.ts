import { env } from '@/config/env'
import { authToken, notifySessionExpired } from '@/lib/auth-token'
import type { ApiErrorBody } from '@/types/api'

/**
 * Satu-satunya pintu HTTP aplikasi (PRD §11.1.1). Komponen tidak boleh memanggil fetch() langsung.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, string>
  readonly requestId: string | undefined

  constructor(status: number, body: unknown, fallbackMessage?: string) {
    const parsed = isApiErrorBody(body) ? body.error : null
    super(parsed?.message ?? fallbackMessage ?? defaultMessageForStatus(status))
    this.name = 'ApiError'
    this.status = status
    this.code = parsed?.code ?? codeForStatus(status)
    this.details = parsed?.details ?? {}
    this.requestId = parsed?.requestId
  }

  get isNetworkError() {
    return this.status === 0
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'object' &&
    (value as { error: { message?: unknown } }).error !== null &&
    typeof (value as { error: { message?: unknown } }).error.message === 'string'
  )
}

function codeForStatus(status: number): string {
  if (status === 0) return 'NETWORK_ERROR'
  if (status === 401) return 'UNAUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'VALIDATION_ERROR'
  return 'INTERNAL_ERROR'
}

export function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 0:
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.'
    case 401:
      return 'Sesi Anda telah berakhir. Silakan masuk kembali.'
    case 403:
      return 'Anda tidak memiliki akses untuk tindakan ini.'
    case 404:
      return 'Data tidak ditemukan.'
    case 409:
      return 'Data telah diubah oleh pengguna lain. Muat ulang lalu coba lagi.'
    case 422:
      return 'Periksa kembali isian formulir.'
    default:
      return 'Terjadi kesalahan pada server. Coba beberapa saat lagi.'
  }
}

type QueryValue = string | number | boolean | null | undefined | (string | number)[]
export type QueryParams = Record<string, QueryValue>

export function buildQuery(params?: QueryParams): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, String(v)))
    else sp.set(key, String(value))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** Objek akan di-JSON-kan; FormData/Blob/string dikirim apa adanya. */
  body?: unknown
  query?: QueryParams
  /** Kirim header Idempotency-Key (untuk POST/PUT yang tidak boleh terduplikasi). */
  idempotencyKey?: string
  /** Lewati alur refresh token (dipakai oleh endpoint auth sendiri). */
  skipAuthRefresh?: boolean
  /** Kembalikan Response mentah (untuk unduhan file). */
  raw?: boolean
}

let refreshPromise: Promise<boolean> | null = null

/** Memanggil POST /auth/refresh sekali untuk semua request yang menunggu. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return false
        const payload = (await res.json().catch(() => null)) as {
          data?: { accessToken?: string }
        } | null
        const token = payload?.data?.accessToken
        if (!token) return false
        authToken.set(token)
        return true
      } catch {
        return false
      } finally {
        // dilepas setelah microtask agar pemanggil paralel berbagi hasil
        queueMicrotask(() => {
          refreshPromise = null
        })
      }
    })()
  }
  return refreshPromise
}

function isBodyInit(body: unknown): body is BodyInit {
  return (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    typeof body === 'string'
  )
}

async function doFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  const { body, query, idempotencyKey, headers: initHeaders, signal: rawSignal, ...init } = options
  if (rawSignal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  // Di Vitest (jsdom + Node 26), AbortSignal milik jsdom ditolak oleh undici RequestInit.
  const signal = import.meta.env.MODE === 'test' ? undefined : rawSignal
  const headers = new Headers(initHeaders)
  headers.set('Accept', 'application/json')
  const token = authToken.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)

  let requestBody: BodyInit | undefined
  if (body !== undefined && body !== null) {
    if (isBodyInit(body)) {
      requestBody = body
      // FormData: biarkan browser menentukan multipart boundary.
    } else {
      requestBody = JSON.stringify(body)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    }
  }

  try {
    return await fetch(`${env.apiBaseUrl}${path}${buildQuery(query)}`, {
      ...init,
      headers,
      body: requestBody,
      ...(signal ? { signal } : {}),
      credentials: 'include',
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, null)
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let response = await doFetch(path, options)

  if (response.status === 401 && !options.skipAuthRefresh) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await doFetch(path, options)
    } else {
      authToken.clear()
      notifySessionExpired()
    }
  }

  if (options.raw) {
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new ApiError(response.status, payload)
    }
    return response as unknown as T
  }

  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, payload)
  }

  return payload as T
}

/** Helper ringkas. Mengembalikan envelope apa adanya ({ data } / { data, meta }). */
export const api = {
  get: <T>(path: string, query?: QueryParams, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'GET', query }),
  post: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'PATCH', body }),
  delete: <T>(path: string, init?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...init, method: 'DELETE' }),
}

/** Kunci idempotensi baru per aksi submit (dibuat saat user menekan tombol, dipakai ulang saat retry). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
