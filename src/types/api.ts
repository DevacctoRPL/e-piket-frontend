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
  /** 409 — data masih dipakai entitas lain (hapus/nonaktif ditolak). */
  | 'IN_USE'
  /** 409 — kelas masih memiliki siswa aktif. */
  | 'CLASS_HAS_STUDENTS'
  /** 409 — tahun ajaran aktif wajib ada. */
  | 'ACTIVE_YEAR_REQUIRED'
  /** 409 — tidak ada semester aktif. */
  | 'NO_ACTIVE_SEMESTER'
  /** 409 — slot jam kosong sudah memiliki guru pengganti aktif. */
  | 'SLOT_ALREADY_HANDLED'
  /** 409 — absensi guru sudah tercatat / check-in & check-out. */
  | 'ALREADY_RECORDED'
  | 'ALREADY_CHECKED_IN'
  | 'NOT_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  /** 409 — jurnal untuk slot yang sama sudah ada. */
  | 'DUPLICATE'
  /** 409 — pengesahan jurnal. */
  | 'NOT_FINAL'
  | 'ALREADY_APPROVED'
  | 'INTERNAL_ERROR'

/** Parameter list standar. */
export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sort?: string
}
