import type { ID, ISODate } from '@/types/entities'

export interface AgendaGuruListParams {
  date: ISODate
  classId?: ID
  search?: string
  page?: number
  pageSize?: number
}
