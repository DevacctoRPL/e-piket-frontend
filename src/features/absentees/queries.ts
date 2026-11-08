import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ID } from '@/types/entities'
import { absenteesApi } from './api'
import type { AbsenteeQuery, GuardianContactPayload } from './types'

export const absenteeKeys = {
  all: ['absentees'] as const,
  lists: () => [...absenteeKeys.all, 'list'] as const,
  list: (q: AbsenteeQuery) => [...absenteeKeys.lists(), q] as const,
  summary: (q: Omit<AbsenteeQuery, 'page' | 'pageSize'>) => [...absenteeKeys.all, 'summary', q] as const,
  print: (q: AbsenteeQuery) => [...absenteeKeys.all, 'print', q] as const,
}

export function useAbsentees(q: AbsenteeQuery) {
  return useQuery({
    queryKey: absenteeKeys.list(q),
    queryFn: ({ signal }) => absenteesApi.list(q, signal),
    placeholderData: keepPreviousData,
  })
}

export function useAbsenteeSummary(q: Omit<AbsenteeQuery, 'page' | 'pageSize'>) {
  return useQuery({
    queryKey: absenteeKeys.summary(q),
    queryFn: ({ signal }) => absenteesApi.summary(q, signal),
    placeholderData: keepPreviousData,
  })
}

/** Semua baris untuk tampilan cetak (satu halaman besar). */
export const PRINT_PAGE_SIZE = 500

export function useAbsenteesForPrint(q: AbsenteeQuery) {
  const query = { ...q, page: 1, pageSize: PRINT_PAGE_SIZE }
  return useQuery({
    queryKey: absenteeKeys.print(query),
    queryFn: ({ signal }) => absenteesApi.list(query, signal),
  })
}

export function useSaveGuardianContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      body,
      idempotencyKey,
    }: {
      recordId: ID
      body: GuardianContactPayload
      idempotencyKey?: string
    }) => absenteesApi.saveContact(recordId, body, idempotencyKey),
    // 422 ditampilkan di field; error lain ditangani dialog (pesan + muat ulang).
    meta: { silentError: true },
    onSuccess: async () => {
      await Promise.all(
        [['absentees'], ['student-attendance'], ['reports'], ['audit-logs']].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      )
    },
  })
}
