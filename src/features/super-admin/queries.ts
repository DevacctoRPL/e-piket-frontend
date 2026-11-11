import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ISODate } from '@/types/entities'
import { systemApi } from './api'

/**
 * Root key 'system' — mutasi akun pengguna meng-invalidate ['system'] agar ringkasan akun ikut segar.
 */
export const systemKeys = {
  all: ['system'] as const,
  overview: (date: ISODate) => [...systemKeys.all, 'overview', date] as const,
}

export function useSystemOverview(date: ISODate) {
  return useQuery({
    queryKey: systemKeys.overview(date),
    queryFn: ({ signal }) => systemApi.overview(date, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}
