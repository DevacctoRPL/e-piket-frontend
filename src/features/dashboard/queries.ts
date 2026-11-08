import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { dashboardApi, type DashboardSummaryParams } from './api'

/**
 * Root key 'dashboard' — fitur lain meng-invalidate ['dashboard'] setelah mutasi terkait
 * (absensi, kepulangan, absensi guru, agenda piket, jurnal, jam kosong).
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (params: DashboardSummaryParams) =>
    [...dashboardKeys.all, 'summary', { date: params.date, shiftCode: params.shiftCode ?? '' }] as const,
}

export function useDashboardSummary(params: DashboardSummaryParams) {
  return useQuery({
    queryKey: dashboardKeys.summary(params),
    queryFn: ({ signal }) => dashboardApi.summary(params, signal),
    // Ringkasan operasional cepat berubah: anggap basi lebih cepat dan muat ulang saat tab difokuskan.
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}
