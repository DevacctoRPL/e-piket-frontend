import { api, type QueryParams } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { AbsenteeRow, ID } from '@/types/entities'
import type { AbsenteeQuery, AbsenteeSummary, GuardianContactPayload } from './types'

/** Ubah query fitur menjadi parameter HTTP (status berulang: ?status=SICK&status=ABSENT). */
export function toQueryParams(q: AbsenteeQuery): QueryParams {
  return {
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    classId: q.classId,
    shiftCode: q.shiftCode,
    status: q.status && q.status.length > 0 ? q.status : undefined,
    search: q.search?.trim() || undefined,
    contacted: q.contacted,
    includeDraft: q.includeDraft ? true : undefined,
    page: q.page,
    pageSize: q.pageSize,
  }
}

export const absenteesApi = {
  list: (q: AbsenteeQuery, signal?: AbortSignal) =>
    api.get<ListResponse<AbsenteeRow>>('/student-attendance/absentees', toQueryParams(q), { signal }),

  summary: (q: Omit<AbsenteeQuery, 'page' | 'pageSize'>, signal?: AbortSignal) =>
    api
      .get<DataResponse<AbsenteeSummary>>('/student-attendance/absentees/summary', toQueryParams(q), {
        signal,
      })
      .then((r) => r.data),

  /** Catat konfirmasi wali. Tidak mengirim pesan apa pun (PRD FR-STU-06). */
  saveContact: (recordId: ID, body: GuardianContactPayload, idempotencyKey?: string) =>
    api
      .patch<DataResponse<AbsenteeRow>>(
        `/student-attendance/records/${encodeURIComponent(recordId)}/contact`,
        body,
        { idempotencyKey },
      )
      .then((r) => r.data),
}
