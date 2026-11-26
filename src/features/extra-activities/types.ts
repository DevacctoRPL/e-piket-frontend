import type { ID, ISODate } from '@/types/entities'

export interface ExtraActivityListParams {
  date: ISODate
  classId?: ID
  search?: string
  page?: number
  pageSize?: number
}
