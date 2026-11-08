 
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refreshAccessToken } from '@/lib/api-client'
import { authToken, setSessionExpiredHandler } from '@/lib/auth-token'
import { hasPermission, hasRole } from '@/lib/permissions'
import type { CurrentUser, LoginRequest, Permission, Role } from '@/types/entities'
import { authApi, authKeys } from './api'

type AuthStatus = 'booting' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  status: AuthStatus
  user: CurrentUser | null
  /** true bila sesi berakhir paksa (401 setelah refresh gagal) — untuk pesan di halaman login. */
  sessionExpired: boolean
  login: (body: LoginRequest) => Promise<CurrentUser>
  logout: () => Promise<void>
  can: (permission: Permission | readonly Permission[], mode?: 'any' | 'all') => boolean
  is: (...roles: Role[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(() => authToken.get())
  const [booting, setBooting] = useState(() => !authToken.get())
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => authToken.subscribe(() => setToken(authToken.get())), [])

  // Saat aplikasi dimuat: coba pulihkan sesi via refresh cookie (PRD §10.3).
  useEffect(() => {
    if (authToken.get()) return
    let cancelled = false
    refreshAccessToken().finally(() => {
      if (!cancelled) setBooting(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setSessionExpired(true)
      queryClient.clear()
    })
    return () => setSessionExpiredHandler(null)
  }, [queryClient])

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => authApi.me(signal).then((r) => r.data),
    enabled: !!token,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const login = useCallback(
    async (body: LoginRequest) => {
      const res = await authApi.login(body)
      queryClient.clear()
      authToken.set(res.data.accessToken)
      setSessionExpired(false)
      const me = await queryClient.fetchQuery({
        queryKey: authKeys.me,
        queryFn: ({ signal }) => authApi.me(signal).then((r) => r.data),
      })
      return me
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* tetap bersihkan sesi lokal */
    }
    authToken.clear()
    queryClient.clear()
  }, [queryClient])

  const user = token ? (meQuery.data ?? null) : null
  const status: AuthStatus =
    booting || (token && meQuery.isPending) ? 'booting' : user ? 'authenticated' : 'anonymous'

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      login,
      logout,
      can: (permission, mode) => hasPermission(user, permission, mode),
      is: (...roles) => hasRole(user, ...roles),
    }),
    [status, user, sessionExpired, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}

/** User yang pasti sudah login (dipakai di dalam route terproteksi). */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser dipanggil tanpa sesi aktif')
  return user
}

/** Render children hanya bila user memiliki permission (PRD §14.1: permission pada aksi). */
export function Can({
  permission,
  mode,
  children,
  fallback = null,
}: {
  permission: Permission | readonly Permission[]
  mode?: 'any' | 'all'
  children: ReactNode
  fallback?: ReactNode
}) {
  const { can } = useAuth()
  return <>{can(permission, mode) ? children : fallback}</>
}
