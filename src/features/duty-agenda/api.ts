import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { DutyAgenda, ID, ISODate, ShiftCode } from '@/types/entities'
import type {
  DutyAgendaListParams,
  DutyAgendaPatch,
  DutyNoteInput,
  TodayDutyAgenda,
} from './types'

const unwrap = <T,>(r: DataResponse<T>) => r.data

/** Layanan API Agenda Guru Piket (PRD §10.6). Komponen tidak memanggil api.* langsung. */
export const dutyAgendaApi = {
  list: (params: DutyAgendaListParams, signal?: AbortSignal) =>
    api.get<ListResponse<DutyAgenda>>('/duty-agendas', { ...params }, { signal }),

  today: (shiftCode?: ShiftCode, signal?: AbortSignal) =>
    api.get<DataResponse<TodayDutyAgenda[]>>('/duty-agendas/today', { shiftCode }, { signal }).then(unwrap),

  get: (id: ID, signal?: AbortSignal) =>
    api.get<DataResponse<DutyAgenda>>(`/duty-agendas/${encodeURIComponent(id)}`, undefined, { signal }).then(unwrap),

  create: (body: { date: ISODate; shiftCode: ShiftCode }, idempotencyKey: string) =>
    api.post<DataResponse<DutyAgenda>>('/duty-agendas', body, { idempotencyKey }).then(unwrap),

  update: (id: ID, body: DutyAgendaPatch) =>
    api.patch<DataResponse<DutyAgenda>>(`/duty-agendas/${encodeURIComponent(id)}`, body).then(unwrap),

  addNote: (id: ID, body: DutyNoteInput, idempotencyKey: string) =>
    api
      .post<DataResponse<DutyAgenda>>(`/duty-agendas/${encodeURIComponent(id)}/notes`, body, { idempotencyKey })
      .then(unwrap),

  updateNote: (id: ID, noteId: ID, body: DutyNoteInput) =>
    api
      .patch<DataResponse<DutyAgenda>>(
        `/duty-agendas/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
        body,
      )
      .then(unwrap),

  deleteNote: (id: ID, noteId: ID, correctionReason?: string) =>
    api
      .delete<DataResponse<DutyAgenda>>(
        `/duty-agendas/${encodeURIComponent(id)}/notes/${encodeURIComponent(noteId)}`,
        { body: correctionReason ? { correctionReason } : undefined },
      )
      .then(unwrap),

  submit: (id: ID, body: { final: boolean; version: number }, idempotencyKey: string) =>
    api
      .post<DataResponse<DutyAgenda>>(`/duty-agendas/${encodeURIComponent(id)}/submit`, body, { idempotencyKey })
      .then(unwrap),
}
