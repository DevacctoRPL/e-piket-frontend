import type { AbsenteeRow, AbsenteeStatus, AttendanceStatus, ID, ISODate } from '@/types/entities'

export type { AbsenteeRow, AbsenteeStatus }

export interface AbsenteeListParams {
  date: ISODate
  classId?: ID
  status?: AbsenteeStatus
  search?: string
  page?: number
  pageSize?: number
}

export interface AbsenteeSummary {
  date: ISODate
  byStatus: Record<AbsenteeStatus, number>
  total: number
}

export interface CreateAbsenteeInput {
  date: ISODate
  classId: ID
  studentId: ID
  status: AbsenteeStatus
  reason?: string | null
}

export interface UpdateAbsenteeInput {
  status: AttendanceStatus
  reason?: string | null
}
