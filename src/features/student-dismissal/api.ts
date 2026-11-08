import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { ID, ISODate, ISODateTime, Student, StudentDismissal } from '@/types/entities'
import type {
  CorrectDismissalInput,
  CreateDismissalInput,
  DismissalContext,
  DismissalListParams,
} from './types'

type Opts = { signal?: AbortSignal }

export const dismissalApi = {
  list: (params: DismissalListParams, { signal }: Opts = {}) =>
    api.get<ListResponse<StudentDismissal>>(
      '/student-dismissals',
      { ...params, type: params.type || undefined },
      { signal },
    ),

  context: (studentId: ID, date: ISODate, { signal }: Opts = {}) =>
    api
      .get<DataResponse<DismissalContext>>('/student-dismissals/context', { studentId, date }, { signal })
      .then((r) => r.data),

  create: (input: CreateDismissalInput, idempotencyKey: string) =>
    api
      .post<DataResponse<StudentDismissal>>('/student-dismissals', input, { idempotencyKey })
      .then((r) => r.data),

  markReturned: (id: ID, returnTime: ISODateTime) =>
    api
      .patch<DataResponse<StudentDismissal>>(`/student-dismissals/${encodeURIComponent(id)}`, { returnTime })
      .then((r) => r.data),

  correct: (id: ID, input: CorrectDismissalInput) =>
    api
      .patch<DataResponse<StudentDismissal>>(`/student-dismissals/${encodeURIComponent(id)}`, input)
      .then((r) => r.data),

  remove: (id: ID, reason: string) =>
    api.delete<null>(`/student-dismissals/${encodeURIComponent(id)}`, { body: { reason } }),

  /** Daftar siswa aktif satu kelas untuk pemilihan di formulir. */
  studentsOfClass: (classId: ID, { signal }: Opts = {}) =>
    api
      .get<ListResponse<Student>>('/students', { classId, active: 'true', pageSize: 200, sort: 'name' }, { signal })
      .then((r) => r.data),
}
