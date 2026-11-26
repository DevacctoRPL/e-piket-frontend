import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKeys } from '@/features/dashboard/queries'
import type { ID } from '@/types/entities'
import { absenteesApi } from './api'
import type { AbsenteeListParams, CreateAbsenteeInput, UpdateAbsenteeInput } from './types'

export const absenteeKeys = {
  all: ['absentees'] as const,
  list: (params: AbsenteeListParams) => [...absenteeKeys.all, 'list', params] as const,
  summary: (params: Pick<AbsenteeListParams, 'date' | 'classId' | 'search'>) =>
    [...absenteeKeys.all, 'summary', params] as const,
}

export function useAbsentees(params: AbsenteeListParams) {
  return useQuery({
    queryKey: absenteeKeys.list(params),
    queryFn: ({ signal }) => absenteesApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAbsenteeSummary(params: Pick<AbsenteeListParams, 'date' | 'classId' | 'search'>) {
  return useQuery({
    queryKey: absenteeKeys.summary(params),
    queryFn: ({ signal }) => absenteesApi.summary(params, signal),
    placeholderData: keepPreviousData,
  })
}

function useInvalidateAbsentees() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: absenteeKeys.all })
    void qc.invalidateQueries({ queryKey: dashboardKeys.all })
  }
}

export function useCreateAbsentee() {
  const invalidate = useInvalidateAbsentees()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateAbsenteeInput; idempotencyKey?: string }) =>
      absenteesApi.create(body, idempotencyKey),
    onSuccess: invalidate,
  })
}

export function useUpdateAbsentee() {
  const invalidate = useInvalidateAbsentees()
  return useMutation({
    mutationFn: ({ recordId, body }: { recordId: ID; body: UpdateAbsenteeInput }) =>
      absenteesApi.update(recordId, body),
    onSuccess: invalidate,
  })
}

export function useDeleteAbsentee() {
  const invalidate = useInvalidateAbsentees()
  return useMutation({
    mutationFn: (recordId: ID) => absenteesApi.remove(recordId),
    onSuccess: invalidate,
  })
}
