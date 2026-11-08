import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ID } from '@/types/entities'
import {
  substitutionsApi,
  type CandidateRange,
  type CreateSubstitutionBody,
  type RecordListParams,
  type SlotListParams,
  type SummaryParams,
  type UpdateSubstitutionBody,
} from './api'

export const substitutionKeys = {
  all: ['substitutions'] as const,
  slots: (p: SlotListParams) => [...substitutionKeys.all, 'slots', p] as const,
  summary: (p: SummaryParams) => [...substitutionKeys.all, 'summary', p] as const,
  candidates: (slotId: ID, range: CandidateRange) =>
    [...substitutionKeys.all, 'candidates', slotId, range] as const,
  records: (p: RecordListParams) => [...substitutionKeys.all, 'records', p] as const,
}

/**
 * Substitusi memengaruhi: jam kosong, agenda piket (jam ditangani), absensi guru (affected vs handled),
 * jurnal mengajar (slot pengganti), dashboard, laporan, dan audit log.
 */
export function invalidateAfterSubstitution(qc: QueryClient) {
  return Promise.all(
    [
      ['substitutions'],
      ['duty-agendas'],
      ['teacher-attendance'],
      ['teaching-logs'],
      ['dashboard'],
      ['reports'],
      ['audit-logs'],
    ].map((queryKey) => qc.invalidateQueries({ queryKey })),
  )
}

export function useSubstitutionSlots(params: SlotListParams) {
  return useQuery({
    queryKey: substitutionKeys.slots(params),
    queryFn: ({ signal }) => substitutionsApi.slots(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useSubstitutionSummary(params: SummaryParams) {
  return useQuery({
    queryKey: substitutionKeys.summary(params),
    queryFn: ({ signal }) => substitutionsApi.summary(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useSubstituteCandidates(slotId: ID | null, range: CandidateRange) {
  return useQuery({
    queryKey: substitutionKeys.candidates(slotId ?? '', range),
    queryFn: ({ signal }) => substitutionsApi.candidates(slotId ?? '', range, signal),
    enabled: !!slotId,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
}

export function useSubstitutionRecords(params: RecordListParams) {
  return useQuery({
    queryKey: substitutionKeys.records(params),
    queryFn: ({ signal }) => substitutionsApi.records(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useCreateSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateSubstitutionBody; idempotencyKey: string }) =>
      substitutionsApi.create(body, idempotencyKey),
    // Error ditangani di form (konflik jadwal / validasi) — jangan toast ganda.
    meta: { silentError: true },
    onSettled: () => invalidateAfterSubstitution(qc),
  })
}

export function useUpdateSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: ID; body: UpdateSubstitutionBody }) => substitutionsApi.update(id, body),
    meta: { silentError: true },
    onSuccess: () => invalidateAfterSubstitution(qc),
  })
}

export function useCancelSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: ID; reason: string }) => substitutionsApi.cancel(id, reason),
    onSettled: () => invalidateAfterSubstitution(qc),
  })
}
