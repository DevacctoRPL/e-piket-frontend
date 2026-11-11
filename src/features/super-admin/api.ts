import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { ISODate, SystemOverview } from '@/types/entities'

/** Layanan API dashboard Super Admin. Komponen tidak memanggil api.* langsung. */
export const systemApi = {
  /** GET /system/overview — izin `security:read`; blok `system` hanya untuk `system:manage`. */
  overview: (date: ISODate, signal?: AbortSignal) =>
    api.get<DataResponse<SystemOverview>>('/system/overview', { date }, { signal }).then((r) => r.data),
  /** Kembalikan data mock ke seed awal (hanya saat mock API aktif). */
  resetDemo: () => api.post<unknown>('/__mock/reset'),
}
