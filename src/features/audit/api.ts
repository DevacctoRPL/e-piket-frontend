import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { AuditLog, ID } from '@/types/entities'
import type { AuditFacets, AuditLogFilters } from './types'

export const auditApi = {
  list: (filters: AuditLogFilters, signal?: AbortSignal) =>
    api.get<ListResponse<AuditLog>>('/audit-logs', { ...filters }, { signal }),
  detail: (id: ID, signal?: AbortSignal) =>
    api.get<DataResponse<AuditLog>>(`/audit-logs/${encodeURIComponent(id)}`, undefined, { signal }).then((r) => r.data),
  facets: (signal?: AbortSignal) =>
    api.get<DataResponse<AuditFacets>>('/audit-logs/facets', undefined, { signal }).then((r) => r.data),
}
