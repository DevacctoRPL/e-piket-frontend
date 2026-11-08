import type { AuditAction, ID, ISODate } from '@/types/entities'

/** Filter daftar audit (GET /audit-logs). */
export interface AuditLogFilters {
  entity?: string
  actorId?: ID
  action?: AuditAction
  dateFrom?: ISODate
  dateTo?: ISODate
  search?: string
  page?: number
  pageSize?: number
}

/** Opsi dropdown filter (GET /audit-logs/facets). */
export interface AuditFacets {
  entities: string[]
  actors: { id: ID; name: string }[]
}
