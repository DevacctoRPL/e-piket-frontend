/**
 * Access token disimpan di memori saja (tidak di localStorage) — PRD §10.3.
 * Refresh token dikelola backend lewat cookie HttpOnly; saat reload, aplikasi memanggil POST /auth/refresh.
 */
let accessToken: string | null = null
const listeners = new Set<() => void>()

export const authToken = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token
    listeners.forEach((l) => l())
  },
  clear() {
    this.set(null)
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Dipanggil api-client saat refresh gagal (sesi berakhir). Didaftarkan oleh AuthProvider. */
let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}
export function notifySessionExpired() {
  onSessionExpired?.()
}
