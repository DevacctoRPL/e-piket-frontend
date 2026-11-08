import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { DashboardSummary, ISODate, ShiftCode } from '@/types/entities'

export interface DashboardSummaryParams {
  date: ISODate
  shiftCode?: ShiftCode | null
}

/** Layanan API dashboard (FR-RPT-01). Komponen tidak memanggil api.* langsung. */
export const dashboardApi = {
  summary: (params: DashboardSummaryParams, signal?: AbortSignal) =>
    api
      .get<DataResponse<DashboardSummary>>(
        '/dashboard/summary',
        { date: params.date, shiftCode: params.shiftCode || undefined },
        { signal },
      )
      .then((r) => r.data),
}
