import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { extraActivitiesApi } from './api'
import type { ExtraActivityListParams } from './types'

export const extraActivityKeys = {
  all: ['extra-activities'] as const,
  list: (params: ExtraActivityListParams) => [...extraActivityKeys.all, 'list', params] as const,
}

export function useExtraActivities(params: ExtraActivityListParams) {
  return useQuery({
    queryKey: extraActivityKeys.list(params),
    queryFn: ({ signal }) => extraActivitiesApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}
