/**
 * Util test: render komponen dengan QueryClient, router memori, dan user login (via mock API).
 *
 *   await loginAs('piket')
 *   renderWithProviders(<MyPage />, { route: '/absensi-siswa' })
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/features/auth/auth-context'
import { api } from '@/lib/api-client'
import { authToken } from '@/lib/auth-token'
import type { DataResponse } from '@/types/api'
import type { LoginResponse } from '@/types/entities'

export type DemoAccount = 'admin' | 'kepsek' | 'guru' | 'piket' | 'walikelas' | 'koordinator'

export async function loginAs(username: DemoAccount) {
  const res = await api.post<DataResponse<LoginResponse>>(
    '/auth/login',
    { username, password: 'password' },
    { skipAuthRefresh: true },
  )
  authToken.set(res.data.accessToken)
  return res.data.accessToken
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    path = '*',
    queryClient = createTestQueryClient(),
  }: { route?: string; path?: string; queryClient?: QueryClient } = {},
) {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
  return { router, queryClient, ...render(<RouterProvider router={router} />, { wrapper: Wrapper }) }
}
