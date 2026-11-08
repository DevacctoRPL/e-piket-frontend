import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ID, ISODate, TeachingLog } from '@/types/entities'
import { teachingLogsApi } from './api'
import type { TeachingLogListParams, TeachingLogPatch, TeachingLogPayload } from './types'

export const teachingLogKeys = {
  all: ['teaching-logs'] as const,
  today: (date: ISODate) => [...teachingLogKeys.all, 'today', date] as const,
  lists: () => [...teachingLogKeys.all, 'list'] as const,
  list: (params: TeachingLogListParams) => [...teachingLogKeys.lists(), params] as const,
  detail: (id: ID) => [...teachingLogKeys.all, 'detail', id] as const,
}

export function useTodayTeachingSlots(date: ISODate, enabled = true) {
  return useQuery({
    queryKey: teachingLogKeys.today(date),
    queryFn: ({ signal }) => teachingLogsApi.today(date, signal),
    enabled,
  })
}

export function useTeachingLogs(params: TeachingLogListParams, enabled = true) {
  return useQuery({
    queryKey: teachingLogKeys.list(params),
    queryFn: ({ signal }) => teachingLogsApi.list(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useTeachingLog(id: ID | undefined) {
  return useQuery({
    queryKey: teachingLogKeys.detail(id ?? ''),
    queryFn: ({ signal }) => teachingLogsApi.get(id ?? '', signal),
    enabled: !!id,
  })
}

/**
 * Invalidasi lintas fitur setelah mutasi jurnal: jurnal, dashboard (kelengkapan jurnal),
 * laporan, audit (finalisasi/koreksi/pengesahan), dan substitusi (tautan jurnal pengganti).
 */
function useInvalidateAfterWrite() {
  const qc = useQueryClient()
  return (log: TeachingLog) => {
    qc.setQueryData(teachingLogKeys.detail(log.id), log)
    for (const key of ['teaching-logs', 'dashboard', 'reports', 'audit-logs', 'substitutions']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

export function useCreateTeachingLog() {
  const onDone = useInvalidateAfterWrite()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: TeachingLogPayload; idempotencyKey: string }) =>
      teachingLogsApi.create(body, idempotencyKey),
    onSuccess: onDone,
    meta: { silentError: true },
  })
}

export function useUpdateTeachingLog() {
  const onDone = useInvalidateAfterWrite()
  return useMutation({
    mutationFn: ({ id, body, idempotencyKey }: { id: ID; body: TeachingLogPatch; idempotencyKey: string }) =>
      teachingLogsApi.update(id, body, idempotencyKey),
    onSuccess: onDone,
    meta: { silentError: true },
  })
}

export function useApproveTeachingLog() {
  const onDone = useInvalidateAfterWrite()
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: ID; idempotencyKey: string }) =>
      teachingLogsApi.approve(id, idempotencyKey),
    onSuccess: onDone,
  })
}
