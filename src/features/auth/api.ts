import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { CurrentUser, LoginRequest, LoginResponse } from '@/types/entities'

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<DataResponse<LoginResponse>>('/auth/login', body, { skipAuthRefresh: true }),
  logout: () => api.post<null>('/auth/logout', undefined, { skipAuthRefresh: true }),
  me: (signal?: AbortSignal) => api.get<DataResponse<CurrentUser>>('/auth/me', undefined, { signal }),
  updateMe: (body: { name?: string; email?: string | null }) =>
    api.patch<DataResponse<CurrentUser>>('/auth/me', body),
}

export const authKeys = {
  me: ['auth', 'me'] as const,
}
