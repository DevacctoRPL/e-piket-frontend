import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type { ID, ISODate, ScheduledTeacherRow, SubstitutionRecord, SubstitutionSlot } from '@/types/entities'
import type {
  AssignEmptySlotInput,
  CreateManualEmptySlotInput,
  UpdateManualEmptySlotInput,
  UpdateSubstitutionInput,
} from './types'

export const teacherAttendanceApi = {
  /** Data kehadiran guru harian (read-only dari Presensi Guru). */
  scheduled: (params: { date: ISODate }, signal?: AbortSignal) =>
    api
      .get<DataResponse<ScheduledTeacherRow[]>>('/teacher-attendance', { date: params.date }, { signal })
      .then((r) => r.data),

  /** Daftar slot jam kosong (otomatis dari guru tidak hadir + manual). */
  emptySlots: (params: { date: ISODate; search?: string }, signal?: AbortSignal) =>
    api
      .get<DataResponse<SubstitutionSlot[]>>(
        '/substitution-slots',
        { date: params.date, search: params.search || undefined },
        { signal },
      )
      .then((r) => r.data),

  createManualSlot: (body: CreateManualEmptySlotInput, idempotencyKey?: string) =>
    api
      .post<DataResponse<SubstitutionSlot>>('/substitution-slots/manual', body, { idempotencyKey })
      .then((r) => r.data),

  updateManualSlot: (id: ID, body: UpdateManualEmptySlotInput) =>
    api
      .patch<DataResponse<SubstitutionSlot>>(`/substitution-slots/manual/${encodeURIComponent(id)}`, body)
      .then((r) => r.data),

  deleteManualSlot: (id: ID) =>
    api.delete<void>(`/substitution-slots/manual/${encodeURIComponent(id)}`),

  assignSubstitute: (body: AssignEmptySlotInput, idempotencyKey?: string) =>
    api
      .post<DataResponse<SubstitutionRecord>>('/substitution-records', body, { idempotencyKey })
      .then((r) => r.data),

  updateSubstitute: (id: ID, body: UpdateSubstitutionInput) =>
    api
      .patch<DataResponse<SubstitutionRecord>>(`/substitution-records/${encodeURIComponent(id)}`, body)
      .then((r) => r.data),

  deleteSubstitute: (id: ID) =>
    api.delete<void>(`/substitution-records/${encodeURIComponent(id)}`),
}
