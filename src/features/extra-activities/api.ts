import { api } from '@/lib/api-client'
import type { ListResponse } from '@/types/api'
import type { ExtraActivity } from '@/types/entities'
import type { ExtraActivityListParams } from './types'

export const extraActivitiesApi = {
  list: (params: ExtraActivityListParams, signal?: AbortSignal) =>
    api.get<ListResponse<ExtraActivity>>(
      '/extra-activities',
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
