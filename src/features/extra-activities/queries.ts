import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ExtraActivity, ID } from '@/types/entities'
import { extraActivitiesApi } from './api'
import type { ExtraActivityInput, ExtraActivityListParams, ExtraActivityPatch, ParticipantsInput } from './types'

export const extraActivityKeys = {
  all: ['extra-activities'] as const,
  lists: () => [...extraActivityKeys.all, 'list'] as const,
  list: (params: ExtraActivityListParams) => [...extraActivityKeys.lists(), params] as const,
  detail: (id: ID) => [...extraActivityKeys.all, 'detail', id] as const,
}

/** Kegiatan tambahan → extra-activities, reports, audit-logs (mutasi menulis audit). */
function invalidateDependents(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: extraActivityKeys.all }),
    qc.invalidateQueries({ queryKey: ['reports'] }),
    qc.invalidateQueries({ queryKey: ['audit-logs'] }),
  ])
}

export function useExtraActivities(params: ExtraActivityListParams) {
  return useQuery({
    queryKey: extraActivityKeys.list(params),
    queryFn: ({ signal }) => extraActivitiesApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useExtraActivity(id: ID) {
  return useQuery({
    queryKey: extraActivityKeys.detail(id),
    queryFn: ({ signal }) => extraActivitiesApi.get(id, signal),
  })
}

function useSetDetail() {
  const qc = useQueryClient()
  return (a: ExtraActivity) => {
    qc.setQueryData(extraActivityKeys.detail(a.id), a)
    return invalidateDependents(qc)
  }
}

export function useCreateExtraActivity() {
  const setDetail = useSetDetail()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: ExtraActivityInput; idempotencyKey: string }) =>
      extraActivitiesApi.create(body, idempotencyKey),
    onSuccess: setDetail,
  })
}

export function useUpdateExtraActivity(id: ID) {
  const setDetail = useSetDetail()
  return useMutation({
    mutationFn: (body: ExtraActivityPatch) => extraActivitiesApi.update(id, body),
    onSuccess: setDetail,
  })
}

export function useDeleteExtraActivity(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason?: string) => extraActivitiesApi.remove(id, reason),
    onSuccess: () => {
      qc.removeQueries({ queryKey: extraActivityKeys.detail(id) })
      return invalidateDependents(qc)
    },
  })
}

export function useSaveParticipants(id: ID) {
  const setDetail = useSetDetail()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: ParticipantsInput; idempotencyKey: string }) =>
      extraActivitiesApi.saveParticipants(id, body, idempotencyKey),
    onSuccess: setDetail,
  })
}
