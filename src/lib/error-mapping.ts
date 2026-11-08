import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, defaultMessageForStatus } from '@/lib/api-client'

const DETAIL_MESSAGES: Record<string, string> = {
  required: 'Wajib diisi.',
  invalid: 'Format tidak valid.',
  duplicate: 'Data sudah ada.',
  too_long: 'Terlalu panjang.',
  negative: 'Tidak boleh negatif.',
}

export function detailMessage(value: string): string {
  return DETAIL_MESSAGES[value] ?? value
}

/** Pesan aman untuk ditampilkan ke pengguna (tanpa stack trace). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof DOMException && error.name === 'AbortError') return 'Permintaan dibatalkan.'
  return defaultMessageForStatus(500)
}

export function getRequestId(error: unknown): string | undefined {
  return error instanceof ApiError ? error.requestId : undefined
}

/**
 * Petakan error validasi 422 ke field react-hook-form.
 * Mengembalikan true bila minimal satu field berhasil dipetakan.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames?: readonly string[],
): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  let mapped = false
  for (const [field, value] of Object.entries(error.details)) {
    if (fieldNames && !fieldNames.includes(field)) continue
    setError(field as Path<T>, { type: 'server', message: detailMessage(value) })
    mapped = true
  }
  return mapped
}

/** Error per baris untuk operasi bulk: 'records.3.reason' → { 3: { reason: '...' } } */
export function rowErrors(error: unknown, prefix = 'records'): Record<number, Record<string, string>> {
  const out: Record<number, Record<string, string>> = {}
  if (!(error instanceof ApiError)) return out
  const re = new RegExp(`^${prefix}\\.(\\d+)\\.(.+)$`)
  for (const [key, value] of Object.entries(error.details)) {
    const m = re.exec(key)
    if (!m) continue
    const idx = Number(m[1])
    const field = m[2] ?? ''
    out[idx] = { ...(out[idx] ?? {}), [field]: detailMessage(value) }
  }
  return out
}
