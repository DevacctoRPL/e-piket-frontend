/**
 * Service akun pengguna (Kelola Pengguna, khusus Super Admin). Komponen tidak memanggil api.* langsung.
 * Kata sandi sementara hanya ada di respons create/reset — JANGAN disimpan ke cache query.
 */
import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type {
  ID,
  TemporaryPasswordResult,
  UserAccount,
  UserAccountDetail,
  UserAccountInput,
} from '@/types/entities'
import type { UserAccountPatch, UserListParams, UserStatusInput } from './types'

const unwrap = <T,>(p: Promise<DataResponse<T>>) => p.then((r) => r.data)
const path = (id: ID) => `/users/${encodeURIComponent(id)}`

export const usersApi = {
  list: (params: UserListParams, signal?: AbortSignal) =>
    api.get<ListResponse<UserAccount>>('/users', { ...params }, { signal }),
  detail: (id: ID, signal?: AbortSignal) =>
    unwrap(api.get<DataResponse<UserAccountDetail>>(path(id), undefined, { signal })),
  create: (body: UserAccountInput, opts: { idempotencyKey?: string } = {}) =>
    unwrap(
      api.post<DataResponse<{ user: UserAccount; temporaryPassword: string }>>('/users', body, {
        idempotencyKey: opts.idempotencyKey,
      }),
    ),
  update: (id: ID, body: UserAccountPatch) => unwrap(api.patch<DataResponse<UserAccount>>(path(id), body)),
  setStatus: (id: ID, body: UserStatusInput) =>
    unwrap(api.post<DataResponse<UserAccount>>(`${path(id)}/status`, body)),
  resetPassword: (id: ID, body: { reason?: string }) =>
    unwrap(api.post<DataResponse<TemporaryPasswordResult>>(`${path(id)}/reset-password`, body)),
}
