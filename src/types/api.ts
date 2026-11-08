/** Envelope response API (PRD §10.4). */
export interface DataResponse<T> {
  data: T
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ListResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode | (string & {})
    message: string
    /** Validasi per field: { fieldName: 'required' | pesan } atau per baris bulk: { 'records.3.reason': '...' } */
    details?: Record<string, string>
    requestId?: string
  }
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VERSION_CONFLICT'
  | 'SCHEDULE_CONFLICT'
  | 'ALREADY_FINAL'
  | 'INTERNAL_ERROR'

/** Parameter list standar. */
export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
}
