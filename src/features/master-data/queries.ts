/**
 * Query & mutation khusus halaman Data Master. Lookup master lintas fitur ada di lookups.ts.
 * Setiap tulis data master meng-invalidasi masterKeys.all + root fitur yang menampilkan nama/jadwal
 * (PRD §11.4: invalidasi setelah create/update).
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { ID } from '@/types/entities'
import { masterApi, type StudentListParams } from './api'
import { masterKeys } from './lookups'

export const masterPageKeys = {
  students: (params: StudentListParams) => masterKeys.students(params as Record<string, unknown>),
}

/** Root fitur lain yang menampilkan nama/jadwal dari data master. */
const DEPENDENT_ROOTS = [
  'dashboard',
  'student-attendance',
  'absentees',
  'dismissals',
  'teacher-attendance',
  'duty-agendas',
  'teaching-logs',
  'substitutions',
  'extra-activities',
  'reports',
  'audit-logs',
] as const

export function invalidateMaster(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: masterKeys.all }),
    qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
    ...DEPENDENT_ROOTS.map((root) => qc.invalidateQueries({ queryKey: [root] })),
  ])
}

export function useStudentsPage(params: StudentListParams) {
  return useQuery({
    queryKey: masterPageKeys.students(params),
    queryFn: ({ signal }) => masterApi.students.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

type Resource = keyof typeof masterApi

/**
 * Mutasi generik untuk resource master: create (dengan Idempotency-Key), update, remove.
 *   const m = useMasterMutations('subjects'); m.create.mutateAsync({ body, idempotencyKey })
 */
export function useMasterMutations<R extends Resource>(resource: R) {
  const qc = useQueryClient()
  const svc = masterApi[resource] as unknown as {
    create: (body: unknown, opts?: { idempotencyKey?: string }) => Promise<unknown>
    update: (id: ID, body: unknown) => Promise<unknown>
    remove: (id: ID) => Promise<unknown>
  }
  type Svc = (typeof masterApi)[R]
  type CreateBody = Parameters<Svc['create']>[0]
  type UpdateBody = Parameters<Svc['update']>[1]
  type Result = Awaited<ReturnType<Svc['create']>>
  const onSuccess = () => invalidateMaster(qc)

  const create = useMutation({
    mutationFn: (vars: { body: CreateBody; idempotencyKey?: string }) =>
      svc.create(vars.body, { idempotencyKey: vars.idempotencyKey }) as Promise<Result>,
    onSuccess,
  })
  const update = useMutation({
    mutationFn: (vars: { id: ID; body: UpdateBody }) => svc.update(vars.id, vars.body) as Promise<Result>,
    onSuccess,
  })
  const remove = useMutation({
    mutationFn: (id: ID) => svc.remove(id) as Promise<{ id: ID }>,
    onSuccess,
  })
  return { create, update, remove }
}
