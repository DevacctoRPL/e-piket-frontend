import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { teachingLogsApi } from './api'
import type { AgendaGuruListParams } from './types'

export const teachingLogKeys = {
  all: ['teaching-logs'] as const,
  list: (params: AgendaGuruListParams) => [...teachingLogKeys.all, 'list', params] as const,
}

export function useAgendaGuruList(params: AgendaGuruListParams) {
  return useQuery({
    queryKey: teachingLogKeys.list(params),
    queryFn: ({ signal }) => teachingLogsApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}
