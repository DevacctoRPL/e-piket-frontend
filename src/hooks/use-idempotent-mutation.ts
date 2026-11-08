import { useRef } from 'react'
import { newIdempotencyKey } from '@/lib/api-client'

/**
 * Kunci idempotensi yang stabil untuk satu "niat" submit (AC-03).
 * - `key()` mengembalikan kunci yang sama sampai `reset()` dipanggil (mis. setelah sukses / data berubah),
 *   sehingga klik ganda atau retry jaringan tidak membuat record ganda.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null)
  return {
    key: () => (ref.current ??= newIdempotencyKey()),
    reset: () => {
      ref.current = null
    },
  }
}
