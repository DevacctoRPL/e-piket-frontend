import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { AbsenteeRow, ID } from '@/types/entities'
import type {
  AbsenteeListParams,
  AbsenteeSummary,
  CreateAbsenteeInput,
  UpdateAbsenteeInput,
} from './types'

export const absenteesApi = {
  list: (params: AbsenteeListParams, signal?: AbortSignal) =>
    api.get<ListResponse<AbsenteeRow>>(
      '/student-attendance/absentees',
      {
        date: params.date,
        classId: params.classId || undefined,
        status: params.status || undefined,
        search: params.search || undefined,
        page: params.page,
        pageSize: params.pageSize,
      },
      { signal },
    ),

  summary: (params: Pick<AbsenteeListParams, 'date' | 'classId' | 'search'>, signal?: AbortSignal) =>
    api
      .get<DataResponse<AbsenteeSummary>>(
        '/student-attendance/absentees/summary',
        {
          date: params.date,
          classId: params.classId || undefined,
          search: params.search || undefined,
        },
        { signal },
      )
      .then((r) => r.data),

  create: (body: CreateAbsenteeInput, idempotencyKey?: string) =>
    api
      .post<DataResponse<AbsenteeRow>>('/student-attendance/absentees', body, { idempotencyKey })
      .then((r) => r.data),

  update: (recordId: ID, body: UpdateAbsenteeInput) =>
    api
      .patch<DataResponse<{ recordId: ID; status: string; reason: string | null; removed: boolean }>>(
        `/student-attendance/absentees/${encodeURIComponent(recordId)}`,
        body,
      )
      .then((r) => r.data),

  remove: (recordId: ID) =>
    api.delete<void>(`/student-attendance/absentees/${encodeURIComponent(recordId)}`),
}
