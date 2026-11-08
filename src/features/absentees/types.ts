import type { AttendanceStatus, ID, ISODate, ShiftCode } from '@/types/entities'

/** Parameter query GET /student-attendance/absentees(/summary). */
export interface AbsenteeQuery {
  dateFrom: ISODate
  dateTo: ISODate
  classId?: ID
  shiftCode?: ShiftCode
  status?: AttendanceStatus[]
  /** Kata kunci nama/NIS — hanya dikirim di query API, tidak disimpan di URL halaman (PRD §12.2). */
  search?: string
  contacted?: 'true' | 'false'
  includeDraft?: boolean
  page?: number
  pageSize?: number
}

/** Response GET /student-attendance/absentees/summary. */
export interface AbsenteeSummary {
  dateFrom: ISODate
  dateTo: ISODate
  /** Jumlah per status (mengabaikan filter status, mengikuti filter lain). */
  byStatus: Partial<Record<AttendanceStatus, number>>
  /** Jumlah baris sesuai seluruh filter. */
  total: number
  contacted: number
  notContacted: number
}

/** Body PATCH /student-attendance/records/{id}/contact. */
export interface GuardianContactPayload {
  /** Dihilangkan bila pengguna tidak berhak melihat nomor wali (nomor lama dipertahankan). */
  contactedPhone?: string | null
  receiverName: string | null
  contactNote: string | null
}
