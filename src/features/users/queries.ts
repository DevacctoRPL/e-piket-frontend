/**
 * Query & mutation akun pengguna. Setiap tulis meng-invalidasi daftar akun, ringkasan sistem (dashboard
 * Super Admin), audit log, lookup guru (Teacher.userId), dan sesi sendiri bila akun yang diubah milik user.
 *
 * Kata sandi sementara dikembalikan lewat hasil mutateAsync saja — tidak pernah ditulis ke cache query.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/features/auth/auth-context'
import { authKeys } from '@/features/auth/api'
import { auditKeys } from '@/features/audit/queries'
import { masterKeys } from '@/features/master-data/lookups'
import type { ID, UserAccountInput } from '@/types/entities'
import { usersApi } from './api'
import type { UserAccountPatch, UserListParams, UserStatusInput } from './types'

export const usersKeys = {
  all: ['users'] as const,
  list: (params: UserListParams) => [...usersKeys.all, 'list', params] as const,
  detail: (id: ID) => [...usersKeys.all, 'detail', id] as const,
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: ({ signal }) => usersApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useUser(id: ID | null) {
  return useQuery({
    queryKey: usersKeys.detail(id ?? ''),
    queryFn: ({ signal }) => usersApi.detail(id ?? '', signal),
    enabled: !!id,
  })
}

export function invalidateUsers(qc: QueryClient, opts: { self?: boolean } = {}) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: usersKeys.all }),
    qc.invalidateQueries({ queryKey: ['system'] }),
    qc.invalidateQueries({ queryKey: auditKeys.all }),
    qc.invalidateQueries({ queryKey: masterKeys.teachers() }),
    opts.self ? qc.invalidateQueries({ queryKey: authKeys.me }) : Promise.resolve(),
  ])
}

export function useUserMutations() {
  const qc = useQueryClient()
  const me = useCurrentUser()
  const done = (id?: ID) => invalidateUsers(qc, { self: id === me.id })

  const create = useMutation({
    mutationFn: (vars: { body: UserAccountInput; idempotencyKey?: string }) =>
      usersApi.create(vars.body, { idempotencyKey: vars.idempotencyKey }),
    onSuccess: () => done(),
  })
  const update = useMutation({
    mutationFn: (vars: { id: ID; body: UserAccountPatch }) => usersApi.update(vars.id, vars.body),
    onSuccess: (_d, vars) => done(vars.id),
  })
  const setStatus = useMutation({
    mutationFn: (vars: { id: ID; body: UserStatusInput }) => usersApi.setStatus(vars.id, vars.body),
    onSuccess: (_d, vars) => done(vars.id),
  })
  const resetPassword = useMutation({
    mutationFn: (vars: { id: ID; reason?: string }) => usersApi.resetPassword(vars.id, { reason: vars.reason }),
    onSuccess: (_d, vars) => done(vars.id),
  })
  return { create, update, setStatus, resetPassword }
}
