import { api } from '@/lib/api-client'
import type { DataResponse } from '@/types/api'
import type {
  ID,
  ISODate,
  RosterRow,
  ShiftCode,
  StudentAttendanceSession,
} from '@/types/entities'
import type {
  BulkSaveRequest,
  BulkSaveResponse,
  CreateSessionRequest,
  PatchRecordRequest,
  PatchRecordResponse,
  StudentHistoryParams,
  StudentHistoryResponse,
} from './types'

export interface SessionListParams {
  date?: ISODate
  classId?: ID
  shiftCode?: ShiftCode
}

const base = '/student-attendance'

/** Service absensi siswa. Komponen tidak memanggil api.* langsung (PRD §11.3). */
export const studentAttendanceApi = {
  listSessions: (params: SessionListParams, signal?: AbortSignal) =>
    api
      .get<DataResponse<StudentAttendanceSession[]>>(`${base}/sessions`, { ...params }, { signal })
      .then((r) => r.data),

  getSession: (id: ID, signal?: AbortSignal) =>
    api
      .get<DataResponse<StudentAttendanceSession>>(`${base}/sessions/${encodeURIComponent(id)}`, undefined, { signal })
      .then((r) => r.data),

  getRoster: (id: ID, signal?: AbortSignal) =>
    api
      .get<DataResponse<RosterRow[]>>(`${base}/sessions/${encodeURIComponent(id)}/records`, undefined, { signal })
      .then((r) => r.data),

  /** Membuat sesi baru (201) atau mengembalikan sesi yang sudah ada (200) — FR-STU-07. */
  openSession: (body: CreateSessionRequest, idempotencyKey?: string) =>
    api
      .post<DataResponse<StudentAttendanceSession>>(`${base}/sessions`, body, { idempotencyKey })
      .then((r) => r.data),

  bulkSave: (id: ID, body: BulkSaveRequest, idempotencyKey?: string) =>
    api
      .put<DataResponse<BulkSaveResponse>>(`${base}/sessions/${encodeURIComponent(id)}/records:bulk`, body, {
        idempotencyKey,
      })
      .then((r) => r.data),

  patchRecord: (id: ID, body: PatchRecordRequest) =>
    api
      .patch<DataResponse<PatchRecordResponse>>(`${base}/records/${encodeURIComponent(id)}`, body)
      .then((r) => r.data),

  history: (params: StudentHistoryParams, signal?: AbortSignal) =>
    api
      .get<DataResponse<StudentHistoryResponse>>(`${base}/history`, { ...params }, { signal })
      .then((r) => r.data),
}
