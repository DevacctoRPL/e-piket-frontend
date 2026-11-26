import { api } from '@/lib/api-client'
import type { ListResponse } from '@/types/api'
import type { TeachingLog } from '@/types/entities'
import type { AgendaGuruListParams } from './types'

export const teachingLogsApi = {
  list: (params: AgendaGuruListParams, signal?: AbortSignal) =>
    api.get<ListResponse<TeachingLog>>(
      '/teaching-logs',
      {
        date: params.date,
        classId: params.classId || undefined,
        search: params.search || undefined,
        page: params.page,
        pageSize: params.pageSize,
      },
      { signal },
    ),
}
