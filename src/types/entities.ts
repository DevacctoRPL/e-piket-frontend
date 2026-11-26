/**
 * Kontrak entitas API untuk 5 panel operasional Guru Piket (Dashboard, Absensi Guru & Jam Kosong,
 * Agenda Guru, Absensi Siswa / Siswa Tidak Hadir, Jam Tambahan).
 * Tanggal: 'YYYY-MM-DD'. Timestamp: RFC 3339 dengan offset, mis. '2026-11-08T07:15:00+07:00'.
 * Jam dinding (tanpa tanggal): 'HH:mm'.
 */

export type ID = string
export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string // RFC 3339
export type WallTime = string // HH:mm

/* ------------------------------------------------------------------ enums */

export const ROLES = ['DUTY_TEACHER'] as const
export type Role = (typeof ROLES)[number]

export type ShiftCode = string

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'SICK',
  'PERMISSION',
  'ABSENT',
  'LATE',
  'LEFT_EARLY',
  'EXCUSED',
  'PKL',
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

/** 5 status ketidakhadiran siswa (papan tulis Update Presensi Siswa: S, I, A, D, P). */
export const ABSENTEE_STATUSES = ['SICK', 'PERMISSION', 'ABSENT', 'EXCUSED', 'PKL'] as const
export type AbsenteeStatus = (typeof ABSENTEE_STATUSES)[number]

export const TEACHER_ATTENDANCE_STATUSES = [
  'PRESENT',
  'SICK',
  'PERMISSION',
  'ABSENT',
  'LATE',
  'OFFICIAL_DUTY',
] as const
export type TeacherAttendanceStatus = (typeof TEACHER_ATTENDANCE_STATUSES)[number]

export const RECORD_STATUSES = ['DRAFT', 'SUBMITTED', 'FINAL', 'REJECTED', 'CANCELLED'] as const
export type RecordStatus = (typeof RECORD_STATUSES)[number]

export const TEACHING_PRESENCES = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'SUBSTITUTED'] as const
export type TeachingPresence = (typeof TEACHING_PRESENCES)[number]

export const TEACHING_EXECUTIONS = ['HELD', 'NOT_HELD'] as const
export type TeachingExecution = (typeof TEACHING_EXECUTIONS)[number]

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SUBMIT',
  'FINALIZE',
  'CORRECT',
  'CANCEL',
  'LOGIN',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export type ActiveStatus = 'ACTIVE' | 'INACTIVE'

/* ------------------------------------------------------------------ auth */

export interface CurrentUser {
  id: ID
  username: string
  name: string
  email: string | null
  roles: Role[]
  permissions: Permission[]
  teacherId: ID | null
  homeroomClassIds: ID[]
  teachingClassIds: ID[]
  coordinatedActivityIds: ID[]
  mustChangePassword?: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  expiresIn: number // detik
}

/** Daftar permission aktif khusus 5 panel akun Guru Piket. */
export const PERMISSIONS = [
  'dashboard:read',
  'master:read',
  'teacher_attendance:read',
  'substitution:read',
  'substitution:write',
  'teaching_log:read',
  'absentees:read',
  'absentees:write',
  'extra_activity:read',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/* ------------------------------------------------------------------ master (read-only lookup) */

export interface Semester {
  id: ID
  academicYearId: ID
  number: 1 | 2
  name: string
  startDate: ISODate
  endDate: ISODate
  isActive: boolean
}

export interface AcademicYear {
  id: ID
  name: string
  startDate: ISODate
  endDate: ISODate
  isActive: boolean
  semesters: Semester[]
}

export interface Shift {
  id: ID
  code: ShiftCode
  name: string
  startTime: WallTime
  endTime: WallTime
  lateToleranceMinutes: number
  isActive: boolean
}

export interface Period {
  id: ID
  shiftCode: ShiftCode
  number: number
  startTime: WallTime
  endTime: WallTime
  durationMinutes: number
}

export interface ClassRoom {
  id: ID
  name: string
  grade: number
  program: string
  shiftCode: ShiftCode
  homeroomTeacherId: ID | null
  academicYearId: ID
  status: ActiveStatus
  studentCount?: number
}

export interface Student {
  id: ID
  nis: string
  name: string
  gender: 'L' | 'P'
  classId: ID
  status: ActiveStatus
  inactiveFrom: ISODate | null
  guardianName: string | null
  guardianPhone: string | null
}

export interface Subject {
  id: ID
  code: string
  name: string
}

export interface Teacher {
  id: ID
  nip: string
  code?: string | null
  name: string
  phone: string | null
  subjectIds: ID[]
  attendanceDays?: number[]
  attendanceOrder?: Partial<Record<number, number>>
  status: ActiveStatus
  userId: ID | null
}

export interface TimetableSlot {
  id: ID
  academicYearId: ID
  semesterId: ID
  dayOfWeek: number
  shiftCode: ShiftCode
  classId: ID
  teacherId: ID
  subjectId: ID
  periodStart: number
  periodEnd: number
  periodCount: number
}

/* ------------------------------------------------------------------ student attendance / absentees */

export interface StudentAttendanceSession {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  sessionNumber: number
  sessionLabel: string
  status: RecordStatus
  createdBy: ID
  createdByName: string
  createdAt: ISODateTime
  submittedAt: ISODateTime | null
  submittedBy: ID | null
  submittedByName: string | null
  version: number
  summary: AttendanceSummaryCounts
}

export type AttendanceSummaryCounts = Record<AttendanceStatus, number> & {
  total: number
  unmarked: number
}

export interface StudentAttendanceRecord {
  id: ID
  sessionId: ID
  studentId: ID
  studentName: string
  studentNis: string
  status: AttendanceStatus
  arrivalTime: WallTime | null
  reason: string | null
  note: string | null
  updatedAt: ISODateTime
  updatedBy: ID
  updatedByName: string
  version: number
}

/** Baris daftar siswa tidak hadir (GET /student-attendance/absentees). */
export interface AbsenteeRow {
  recordId: ID
  sessionId: ID
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  className: string
  studentId: ID
  studentName: string
  studentNis: string
  status: AbsenteeStatus
  reason: string | null
  note: string | null
  updatedAt: ISODateTime
  updatedByName: string
}

/* ------------------------------------------------------------------ teacher attendance & jam kosong */

export interface TeacherAttendance {
  id: ID
  teacherId: ID
  teacherName: string
  date: ISODate
  shiftCode: ShiftCode
  checkInAt: ISODateTime | null
  checkOutAt: ISODateTime | null
  status: TeacherAttendanceStatus
  reason: string | null
  affectedPeriodsComputed: number
  affectedPeriodsOverride: number | null
  overrideReason: string | null
  affectedPeriods: number
  lateMinutes: number | null
  source: 'SELF' | 'DUTY' | 'ADMIN'
  updatedAt: ISODateTime
  updatedByName: string
  version: number
}

/** Baris daftar guru terjadwal hari itu (GET /teacher-attendance?date) — Read-only dari Presensi Guru. */
export interface ScheduledTeacherRow {
  teacher: Pick<Teacher, 'id' | 'nip' | 'name' | 'code'>
  scheduledPeriods: number
  slots: Pick<TimetableSlot, 'id' | 'classId' | 'subjectId' | 'periodStart' | 'periodEnd'>[]
  isDutyTeacher: boolean
  isAttendanceScheduled?: boolean
  attendance: TeacherAttendance | null
}

export interface DutyAssignment {
  id: ID
  dayOfWeek: number | null
  date: ISODate | null
  shiftCode: ShiftCode
  teacherIds: ID[]
  note: string | null
}

/** Slot jam kosong yang ditambahkan secara manual oleh Guru Piket (Papan Tulis: Manual Add). */
export interface ManualEmptySlot {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  subjectId: ID | null
  subjectName: string
  absentTeacherId: ID | null
  absentTeacherName: string
  periodStart: number
  periodEnd: number
  periodCount: number
  createdByName: string
  createdAt: ISODateTime
}

export interface SubstitutionSlot {
  /** Otomatis: `${date}:${timetableSlotId}`, Manual: `manual:${manualSlotId}` */
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  timetableSlotId: ID | null
  manualSlotId?: ID | null
  isManual?: boolean
  classId: ID
  className: string
  subjectId: ID | null
  subjectName: string
  absentTeacherId: ID | null
  absentTeacherName: string
  absentTeacherStatus: TeacherAttendanceStatus
  periodStart: number
  periodEnd: number
  periodCount: number
  status: 'UNHANDLED' | 'HANDLED'
  substitution: SubstitutionRecord | null
}

export interface SubstitutionRecord {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  timetableSlotId: ID | null
  manualSlotId?: ID | null
  classId: ID
  subjectId: ID | null
  absentTeacherId: ID | null
  /** null bila guru piket diketik sebagai nama bebas pada combobox. */
  substituteTeacherId: ID | null
  substituteTeacherName: string
  periodStart: number
  periodEnd: number
  periodCount: number
  activity: string | null
  note: string | null
  status: 'ACTIVE' | 'CANCELLED'
  conflictOverridden: boolean
  overrideReason: string | null
  teachingLogId: ID | null
  createdByName: string
  createdAt: ISODateTime
}

export interface SubstitutionSummary {
  affectedPeriods: number
  handledPeriods: number
  unhandledPeriods: number
  affectedSlots: number
  handledSlots: number
  unhandledSlots: number
}

/* ------------------------------------------------------------------ agenda guru (kegiatan mengajar) */

export interface TeachingLog {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  timetableSlotId: ID | null
  teacherId: ID
  teacherName: string
  classId: ID
  className: string
  subjectId: ID
  subjectName: string
  periodStart: number
  periodEnd: number
  periodCount: number
  periodCountOverrideReason: string | null
  meetingNumber: number | null
  topic: string | null
  activity: string | null
  note: string | null
  teacherPresence: TeachingPresence
  execution: TeachingExecution
  notHeldReason: string | null
  studentSick: number
  studentPermission: number
  studentAbsent: number
  substitutionRecordId: ID | null
  status: RecordStatus
  /** URL / data-URL tanda tangan guru read-only dari Presensi Guru. */
  signatureUrl: string | null
  signedAt: ISODateTime | null
  submittedAt: ISODateTime | null
  approvedAt: ISODateTime | null
  approvedByName: string | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  version: number
}

/* ------------------------------------------------------------------ jam tambahan */

export interface ExtraActivity {
  id: ID
  name: string
  type: 'COURSE' | 'EXTRA_HOURS' | 'OTHER'
  instructorTeacherId: ID | null
  instructorName: string
  coordinatorUserId: ID | null
  date: ISODate
  shiftCode: ShiftCode
  startTime: WallTime | null
  endTime: WallTime | null
  classIds: ID[]
  classNames: string[]
  topic: string | null
  note: string | null
  status: RecordStatus
  /** URL / data-URL tanda tangan guru read-only dari Presensi Guru. */
  signatureUrl: string | null
  signedAt: ISODateTime | null
  createdAt: ISODateTime
  version: number
}

/* ------------------------------------------------------------------ audit & login events (internal mock) */

export interface AuditLog {
  id: ID
  timestamp: ISODateTime
  actorId: ID
  actorName: string
  action: AuditAction
  entity: string
  entityId: ID
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  requestId: string
}

export interface LoginEvent {
  id: ID
  timestamp: ISODateTime
  userId: ID | null
  username: string
  success: boolean
  reason: 'OK' | 'BAD_CREDENTIALS' | 'INACTIVE'
}

export interface StatusConfig {
  code: AttendanceStatus
  label: string
  shortCode: string
  requiresReason: boolean
  active: boolean
}

export interface SchoolSettings {
  schoolName: string
  schoolAddress: string
  letterheadLines: string[]
  principalName: string
  principalNip: string
  city: string
  timezone: string
  schoolDays: number[]
  attendanceStatuses: StatusConfig[]
  teacherReasonRequiredStatuses: TeacherAttendanceStatus[]
  dismissalRequiresPickup: boolean
  dutyNoteCategories: string[]
  version: number
}

/* ------------------------------------------------------------------ dashboard */

export interface DashboardTrendPoint {
  date: ISODate
  dayShort: string
  absentStudents: number
  prevAbsentStudents: number
  agendaTotal: number
  agendaSigned: number
  emptySlots: number
  emptySlotsHandled: number
}

export interface DashboardTrends {
  days: DashboardTrendPoint[]
  absentDeltaPct: number
  agendaSignedDeltaPct: number
  emptySlotsDeltaPct: number
}

export interface DashboardActivityItem {
  id: string
  bucket: 'today' | 'yesterday' | 'week'
  kind: 'ABSENTEE' | 'TEACHER' | 'SUBSTITUTION' | 'AGENDA' | 'EXTRA'
  title: string
  description: string
  timeLabel: string
  timestamp: ISODateTime
  href: string
}

export interface AbsenteeStatusCounts {
  SICK: number
  PERMISSION: number
  ABSENT: number
  EXCUSED: number
  PKL: number
  total: number
}

export interface DashboardSummary {
  date: ISODate
  teacherAttendance: {
    scheduled: number
    present: number
    absent: number
    late: number
    notCheckedIn: number
  }
  substitutions: SubstitutionSummary
  absentees: AbsenteeStatusCounts
  agendaGuru: {
    total: number
    signed: number
  }
  jamTambahan: {
    total: number
    signed: number
  }
  pendingTasks: PendingTask[]
  trends: DashboardTrends
  activities: DashboardActivityItem[]
}

export interface PendingTask {
  id: string
  kind: 'SUBSTITUTION_UNHANDLED'
  title: string
  description: string
  href: string
}
