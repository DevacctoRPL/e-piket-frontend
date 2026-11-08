import type {
  AttendanceStatus,
  AttendanceSummaryCounts,
  BulkAttendanceRequest,
  ID,
  ISODate,
  RecordStatus,
  RosterRow,
  ShiftCode,
  StudentAttendanceRecord,
  StudentAttendanceSession,
  WallTime,
} from '@/types/entities'

/** POST /student-attendance/sessions */
export interface CreateSessionRequest {
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  sessionNumber?: number
}

/** PUT /student-attendance/sessions/:id/records:bulk (PRD §10.7). */
export interface BulkSaveRequest extends BulkAttendanceRequest {
  /** true = simpan lalu finalisasi sesi (status FINAL). */
  submit?: boolean
  /** Wajib bila sesi sudah FINAL dan pengguna memiliki hak koreksi. */
  correctionReason?: string | null
}

export interface BulkSaveResponse {
  session: StudentAttendanceSession
  records: RosterRow[]
}

/** PATCH /student-attendance/records/:id — koreksi satu record. */
export interface PatchRecordRequest {
  status?: AttendanceStatus
  reason?: string | null
  note?: string | null
  arrivalTime?: WallTime | null
  /** Wajib bila sesi FINAL (PRD §9.2). */
  correctionReason?: string | null
  /** Versi record yang dilihat klien. */
  version: number
}

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

export interface StudentHistoryRecord {
  recordId: ID
  sessionId: ID
  date: ISODate
  shiftCode: ShiftCode
  sessionLabel: string
  sessionStatus: RecordStatus
  status: AttendanceStatus
  arrivalTime: WallTime | null
  reason: string | null
  note: string | null
}

export interface StudentHistorySummary extends Record<AttendanceStatus, number> {
  total: number
  /** Persentase kehadiran (Hadir + Terlambat) terhadap total record, 0–100, 1 desimal. */
  presentRate: number
}

export interface StudentHistoryResponse {
  student: { id: ID; nis: string; name: string; classId: ID; className: string }
  dateFrom: ISODate
  dateTo: ISODate
  records: StudentHistoryRecord[]
  summary: StudentHistorySummary
}

/** Draft per baris di editor (state lokal). */
export interface RowDraft {
  status: AttendanceStatus
  reason: string
  note: string
  arrivalTime: string
}

export type SummaryCounts = AttendanceSummaryCounts
