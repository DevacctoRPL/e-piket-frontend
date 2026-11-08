import type {
  AttendanceStatus,
  AttendanceSummaryCounts,
  BulkAttendanceRequest,
  CreateAttendanceSessionRequest,
  ID,
  ISODate,
  PatchAttendanceRecordRequest,
  RosterRow,
  StudentAttendanceRecord,
  StudentAttendanceSession,
} from '@/types/entities'

// Kontrak request/response ada di src/types/entities.ts (dipakai bersama mock handler / backend Go).
export type {
  StudentHistoryRecord,
  StudentHistoryResponse,
  StudentHistorySummary,
} from '@/types/entities'

/** POST /student-attendance/sessions */
export type CreateSessionRequest = CreateAttendanceSessionRequest

/** PUT /student-attendance/sessions/:id/records:bulk (PRD §10.7). */
export type BulkSaveRequest = BulkAttendanceRequest

export interface BulkSaveResponse {
  session: StudentAttendanceSession
  records: RosterRow[]
}

/** PATCH /student-attendance/records/:id — koreksi satu record. */
export type PatchRecordRequest = PatchAttendanceRecordRequest

export interface PatchRecordResponse {
  record: StudentAttendanceRecord
  session: StudentAttendanceSession
}

/** GET /student-attendance/history (FR-STU-08). */
export interface StudentHistoryParams {
  studentId: ID
  dateFrom?: ISODate
  dateTo?: ISODate
}

/** Draft per baris di editor (state lokal). */
export interface RowDraft {
  status: AttendanceStatus
  reason: string
  note: string
  arrivalTime: string
}

export type SummaryCounts = AttendanceSummaryCounts
