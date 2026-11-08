import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { ExtraActivity, ID } from '@/types/entities'
import type { ExtraActivityInput, ExtraActivityListParams, ExtraActivityPatch, ParticipantsInput } from './types'

/** Layanan HTTP fitur Kursus / Jam Tambahan (PRD §6.9). */
export const extraActivitiesApi = {
  list: (params: ExtraActivityListParams, signal?: AbortSignal) =>
    api.get<ListResponse<ExtraActivity>>('/extra-activities', { ...params }, { signal }),

  get: (id: ID, signal?: AbortSignal) =>
    api.get<DataResponse<ExtraActivity>>(`/extra-activities/${encodeURIComponent(id)}`, undefined, { signal }).then((r) => r.data),

  create: (body: ExtraActivityInput, idempotencyKey: string) =>
    api.post<DataResponse<ExtraActivity>>('/extra-activities', body, { idempotencyKey }).then((r) => r.data),

  update: (id: ID, body: ExtraActivityPatch) =>
    api.patch<DataResponse<ExtraActivity>>(`/extra-activities/${encodeURIComponent(id)}`, body).then((r) => r.data),

  remove: (id: ID, reason?: string) =>
    api.delete<null>(`/extra-activities/${encodeURIComponent(id)}`, reason ? { body: { reason } } : undefined),

  saveParticipants: (id: ID, body: ParticipantsInput, idempotencyKey: string) =>
    api
      .put<DataResponse<ExtraActivity>>(`/extra-activities/${encodeURIComponent(id)}/participants`, body, { idempotencyKey })
      .then((r) => r.data),
}
