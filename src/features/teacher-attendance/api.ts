import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { ID, ISODate, ScheduledTeacherRow, ShiftCode, TeacherAttendance } from '@/types/entities'
import type {
  MyTeacherAttendanceDay,
  RecordTeacherAttendanceRequest,
  TeacherAttendanceHistory,
  TeacherAttendanceHistoryParams,
  UpdateTeacherAttendanceRequest,
} from './types'

type Opts = { signal?: AbortSignal }

export const teacherAttendanceApi = {
  me: (date: ISODate, { signal }: Opts = {}) =>
    api
      .get<DataResponse<MyTeacherAttendanceDay>>('/teacher-attendance/me', { date }, { signal })
      .then((r) => r.data),

  checkIn: (idempotencyKey: string) =>
    api
      .post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-in', {}, { idempotencyKey })
      .then((r) => r.data),

  checkOut: (idempotencyKey: string) =>
    api
      .post<DataResponse<TeacherAttendance>>('/teacher-attendance/check-out', {}, { idempotencyKey })
      .then((r) => r.data),

  scheduled: (params: { date: ISODate; shiftCode?: ShiftCode }, { signal }: Opts = {}) =>
    api
      .get<DataResponse<ScheduledTeacherRow[]>>('/teacher-attendance', params, { signal })
      .then((r) => r.data),

  record: (body: RecordTeacherAttendanceRequest, idempotencyKey: string) =>
    api
      .post<DataResponse<TeacherAttendance>>('/teacher-attendance', body, { idempotencyKey })
      .then((r) => r.data),

  update: (id: ID, body: UpdateTeacherAttendanceRequest) =>
    api
      .patch<DataResponse<TeacherAttendance>>(`/teacher-attendance/${encodeURIComponent(id)}`, body)
      .then((r) => r.data),

  history: (params: TeacherAttendanceHistoryParams, { signal }: Opts = {}) =>
    api
      .get<DataResponse<TeacherAttendanceHistory>>(
        '/teacher-attendance/history',
        { ...params },
        { signal },
      )
      .then((r) => r.data),
}
