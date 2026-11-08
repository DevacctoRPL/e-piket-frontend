/**
 * DTO lokal fitur absensi guru (melengkapi kontrak di src/types/entities.ts).
 * Dipakai bersama oleh UI dan mock handler (src/mocks/handlers/teacher-attendance.ts).
 */
import type {
  ID,
  ISODate,
  ISODateTime,
  Shift,
  ShiftCode,
  TeacherAttendance,
  TeacherAttendanceStatus,
  WallTime,
} from '@/types/entities'

/** Satu slot jadwal mengajar milik guru pada hari itu. */
export interface MyScheduleSlot {
  id: ID
  shiftCode: ShiftCode
  classId: ID
  className: string
  subjectId: ID
  subjectName: string
  periodStart: number
  periodEnd: number
  periodCount: number
  startTime: WallTime
  endTime: WallTime
}

/** GET /teacher-attendance/me?date */
export interface MyTeacherAttendanceDay {
  date: ISODate
  teacherId: ID
  teacherName: string
  /** Shift acuan keterlambatan (shift slot pertama hari itu, atau Pagi). */
  shift: Shift | null
  attendance: TeacherAttendance | null
  slots: MyScheduleSlot[]
  scheduledPeriods: number
  isDutyTeacher: boolean
}

/** POST /teacher-attendance (piket/admin mencatat status guru). */
export interface RecordTeacherAttendanceRequest {
  teacherId: ID
  date: ISODate
  shiftCode: ShiftCode
  status: TeacherAttendanceStatus
  reason?: string | null
  checkInAt?: ISODateTime | null
  checkOutAt?: ISODateTime | null
}

/** PATCH /teacher-attendance/:id */
export interface UpdateTeacherAttendanceRequest {
  status?: TeacherAttendanceStatus
  reason?: string | null
  checkInAt?: ISODateTime | null
  checkOutAt?: ISODateTime | null
  /** null = kembali ke hitungan sistem. */
  affectedPeriodsOverride?: number | null
  overrideReason?: string | null
  /** Wajib bila jam datang/pulang atau status diubah. */
  correctionReason?: string | null
  version: number
}

export type TeacherAttendanceCounts = Record<TeacherAttendanceStatus, number> & {
  total: number
  /** Total menit terlambat. */
  lateMinutes: number
  /** Total jam mengajar terdampak (nilai efektif). */
  affectedPeriods: number
}

export interface TeacherRecapRow {
  teacherId: ID
  teacherName: string
  teacherNip: string
  counts: TeacherAttendanceCounts
}

/** GET /teacher-attendance/history */
export interface TeacherAttendanceHistory {
  dateFrom: ISODate
  dateTo: ISODate
  records: TeacherAttendance[]
  summary: TeacherAttendanceCounts
  byTeacher: TeacherRecapRow[]
}

export interface TeacherAttendanceHistoryParams {
  teacherId?: ID
  dateFrom?: ISODate
  dateTo?: ISODate
  status?: TeacherAttendanceStatus | ''
  shiftCode?: ShiftCode
  /** Periode akademik (semester) — membatasi rentang tanggal ke semester tsb. */
  semesterId?: ID
}
