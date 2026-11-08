import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { SchoolSettings } from '@/types/entities'
import type { SettingsPatch } from './types'

/** GET /settings dibaca lewat useSettings() di master-data/lookups (cache bersama). */
export const settingsApi = {
  update: (body: SettingsPatch) =>
    api.patch<DataResponse<SchoolSettings>>('/settings', body).then((r) => r.data),
}
