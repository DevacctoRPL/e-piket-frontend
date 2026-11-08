import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { ID, ISODate, TeachingLog, TodayTeachingSlot } from '@/types/entities'
import type { TeachingLogListParams, TeachingLogPatch, TeachingLogPayload } from './types'

/** Service jurnal mengajar — komponen tidak memanggil api/fetch secara langsung (PRD §11.3). */
export const teachingLogsApi = {
  today: (date: ISODate, signal?: AbortSignal) =>
    api
      .get<DataResponse<TodayTeachingSlot[]>>('/teaching-logs/today', { date }, { signal })
      .then((r) => r.data),

  list: (params: TeachingLogListParams, signal?: AbortSignal) =>
    api.get<ListResponse<TeachingLog>>('/teaching-logs', { ...params }, { signal }),

  get: (id: ID, signal?: AbortSignal) =>
    api
      .get<DataResponse<TeachingLog>>(`/teaching-logs/${encodeURIComponent(id)}`, undefined, { signal })
      .then((r) => r.data),

  create: (body: TeachingLogPayload, idempotencyKey: string) =>
    api
      .post<DataResponse<TeachingLog>>('/teaching-logs', body, { idempotencyKey })
      .then((r) => r.data),

  update: (id: ID, body: TeachingLogPatch, idempotencyKey: string) =>
    api
      .patch<DataResponse<TeachingLog>>(`/teaching-logs/${encodeURIComponent(id)}`, body, {
        idempotencyKey,
      })
      .then((r) => r.data),

  approve: (id: ID, idempotencyKey: string) =>
    api
      .post<DataResponse<TeachingLog>>(`/teaching-logs/${encodeURIComponent(id)}/approve`, undefined, {
        idempotencyKey,
      })
      .then((r) => r.data),
}
