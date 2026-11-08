import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useStudents } from '@/features/master-data/lookups'
import { reportsApi, type ReportEndpoint } from './api'
import type { ReportQuery } from './types'

/**
 * Root key 'reports' — modul operasional meng-invalidate ['reports'] setelah mutasi
 * sehingga semua laporan dimuat ulang dengan angka terbaru.
 */
export const reportKeys = {
  all: ['reports'] as const,
  report: (endpoint: ReportEndpoint, query: ReportQuery | null) =>
    [...reportKeys.all, endpoint, query] as const,
}

/** Laporan read-only. `query` null = filter belum siap (mis. semester aktif belum dimuat). */
export function useReport<E extends ReportEndpoint>(endpoint: E, query: ReportQuery | null) {
  return useQuery({
    queryKey: reportKeys.report(endpoint, query),
    queryFn: ({ signal }) => reportsApi.get(endpoint, query as ReportQuery, signal),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/** Siswa satu kelas (data master) untuk pilihan filter. */
export function useClassStudents(classId: string) {
  return useStudents({ classId })
}
