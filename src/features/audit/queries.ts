import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AuditLog, ID } from '@/types/entities'
import { auditApi } from './api'
import type { AuditLogFilters } from './types'

export const auditKeys = {
  all: ['audit-logs'] as const,
  list: (filters: AuditLogFilters) => [...auditKeys.all, 'list', filters] as const,
  detail: (id: ID) => [...auditKeys.all, 'detail', id] as const,
  facets: () => [...auditKeys.all, 'facets'] as const,
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: ({ signal }) => auditApi.list(filters, signal),
    placeholderData: keepPreviousData,
  })
}

/** Detail satu entri; memakai baris dari daftar sebagai data awal agar Sheet langsung terisi. */
export function useAuditLog(id: ID | null, initial?: AuditLog) {
  return useQuery({
    queryKey: auditKeys.detail(id ?? ''),
    queryFn: ({ signal }) => auditApi.detail(id ?? '', signal),
    enabled: !!id,
    initialData: initial && initial.id === id ? initial : undefined,
  })
}

export function useAuditFacets() {
  return useQuery({
    queryKey: auditKeys.facets(),
    queryFn: ({ signal }) => auditApi.facets(signal),
    staleTime: 60_000,
  })
}
