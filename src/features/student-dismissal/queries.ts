import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { masterKeys } from '@/features/master-data/lookups'
import { MASTER_STALE_TIME } from '@/lib/query-client'
import type { ID, ISODate, ISODateTime } from '@/types/entities'
import { dismissalApi } from './api'
import type { CorrectDismissalInput, CreateDismissalInput, DismissalListParams } from './types'

export const dismissalKeys = {
  all: ['dismissals'] as const,
  lists: () => [...dismissalKeys.all, 'list'] as const,
  list: (params: DismissalListParams) => [...dismissalKeys.lists(), params] as const,
  context: (studentId: ID, date: ISODate) => [...dismissalKeys.all, 'context', studentId, date] as const,
}

/** Kepulangan memengaruhi dashboard, laporan, dan (bila menulis audit) log audit. */
function invalidateAfterWrite(qc: QueryClient) {
  return Promise.all(
    [dismissalKeys.all, ['dashboard'], ['reports'], ['audit-logs']].map((queryKey) =>
      qc.invalidateQueries({ queryKey }),
    ),
  )
}

export function useDismissals(params: DismissalListParams, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: dismissalKeys.list(params),
    queryFn: ({ signal }) => dismissalApi.list(params, { signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useDismissalContext(studentId: ID | null, date: ISODate) {
  return useQuery({
    queryKey: dismissalKeys.context(studentId ?? '', date),
    queryFn: ({ signal }) => dismissalApi.context(studentId ?? '', date, { signal }),
    enabled: !!studentId,
  })
}

/** Siswa aktif per kelas (dicache di bawah masterKeys agar ikut ter-invalidasi saat data master berubah). */
export function useClassStudents(classId: ID | null) {
  return useQuery({
    queryKey: masterKeys.students({ classId, active: true, purpose: 'dismissal' }),
    queryFn: ({ signal }) => dismissalApi.studentsOfClass(classId ?? '', { signal }),
    enabled: !!classId,
    staleTime: MASTER_STALE_TIME,
  })
}

export function useCreateDismissal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateDismissalInput; idempotencyKey: string }) =>
      dismissalApi.create(input, idempotencyKey),
    onSuccess: () => invalidateAfterWrite(qc),
  })
}

export function useMarkReturned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, returnTime }: { id: ID; returnTime: ISODateTime }) =>
      dismissalApi.markReturned(id, returnTime),
    onSuccess: () => invalidateAfterWrite(qc),
  })
}

export function useCorrectDismissal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: ID; input: CorrectDismissalInput }) => dismissalApi.correct(id, input),
    onSuccess: () => invalidateAfterWrite(qc),
  })
}

export function useDeleteDismissal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: ID; reason: string }) => dismissalApi.remove(id, reason),
    onSuccess: () => invalidateAfterWrite(qc),
  })
}
