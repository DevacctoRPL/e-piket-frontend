import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/lib/api-client'
import { detailMessage } from '@/lib/error-mapping'

/**
 * Petakan detail 422 dari nama field API ke nama field form (mis. checkInAt → checkIn).
 * Mengembalikan true bila minimal satu field dipetakan.
 */
export function mapServerErrorsWith<T extends FieldValues>(
  fieldMap: Record<string, Path<T>>,
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false
  let mapped = false
  for (const [apiField, value] of Object.entries(error.details)) {
    const field = fieldMap[apiField]
    if (!field) continue
    setError(field, { type: 'server', message: detailMessage(value) })
    mapped = true
  }
  return mapped
}
