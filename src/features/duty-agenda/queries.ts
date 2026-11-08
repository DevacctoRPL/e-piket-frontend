import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { DutyAgenda, ID, ISODate, ShiftCode } from '@/types/entities'
import { dutyAgendaApi } from './api'
import type { DutyAgendaListParams, DutyAgendaPatch, DutyNoteInput } from './types'

export const dutyAgendaKeys = {
  all: ['duty-agendas'] as const,
  lists: () => [...dutyAgendaKeys.all, 'list'] as const,
  list: (params: DutyAgendaListParams) => [...dutyAgendaKeys.lists(), params] as const,
  today: (shiftCode?: ShiftCode) => [...dutyAgendaKeys.all, 'today', shiftCode ?? null] as const,
  detail: (id: ID) => [...dutyAgendaKeys.all, 'detail', id] as const,
}

/** Agenda piket → duty-agendas, dashboard, reports, audit-logs. */
function invalidateDependents(qc: QueryClient) {
  for (const key of ['duty-agendas', 'dashboard', 'reports', 'audit-logs']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}

/** Setelah mutasi: tulis detail terbaru ke cache lalu invalidasi yang bergantung. */
function onAgendaSaved(qc: QueryClient, agenda: DutyAgenda) {
  qc.setQueryData(dutyAgendaKeys.detail(agenda.id), agenda)
  invalidateDependents(qc)
}

export function useDutyAgendas(params: DutyAgendaListParams) {
  return useQuery({
    queryKey: dutyAgendaKeys.list(params),
    queryFn: ({ signal }) => dutyAgendaApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useTodayDutyAgendas(shiftCode?: ShiftCode) {
  return useQuery({
    queryKey: dutyAgendaKeys.today(shiftCode),
    queryFn: ({ signal }) => dutyAgendaApi.today(shiftCode, signal),
  })
}

export function useDutyAgenda(id: ID) {
  return useQuery({
    queryKey: dutyAgendaKeys.detail(id),
    queryFn: ({ signal }) => dutyAgendaApi.get(id, signal),
  })
}

export function useCreateDutyAgenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { date: ISODate; shiftCode: ShiftCode; idempotencyKey: string }) =>
      dutyAgendaApi.create({ date: v.date, shiftCode: v.shiftCode }, v.idempotencyKey),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
  })
}

export function useUpdateDutyAgenda(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DutyAgendaPatch) => dutyAgendaApi.update(id, body),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
    meta: { silentError: true },
  })
}

export function useAddDutyNote(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { body: DutyNoteInput; idempotencyKey: string }) =>
      dutyAgendaApi.addNote(id, v.body, v.idempotencyKey),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
    meta: { silentError: true },
  })
}

export function useUpdateDutyNote(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { noteId: ID; body: DutyNoteInput }) => dutyAgendaApi.updateNote(id, v.noteId, v.body),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
    meta: { silentError: true },
  })
}

export function useDeleteDutyNote(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { noteId: ID; correctionReason?: string }) =>
      dutyAgendaApi.deleteNote(id, v.noteId, v.correctionReason),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
    meta: { silentError: true },
  })
}

export function useSubmitDutyAgenda(id: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { final: boolean; version: number; idempotencyKey: string }) =>
      dutyAgendaApi.submit(id, { final: v.final, version: v.version }, v.idempotencyKey),
    onSuccess: (agenda) => onAgendaSaved(qc, agenda),
    meta: { silentError: true },
  })
}
