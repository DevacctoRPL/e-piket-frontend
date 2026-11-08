/**
 * Kontrak entitas API (PRD §9.1, §10.5). Field JSON camelCase.
 * Tanggal: 'YYYY-MM-DD'. Timestamp: RFC 3339 dengan offset, mis. '2026-11-08T07:15:00+07:00'.
 * Jam dinding (tanpa tanggal): 'HH:mm'.
 *
 * File ini adalah sumber kebenaran bentuk data bersama antara fitur dan mock API.
 * Fitur boleh membuat view-model sendiri di features/<x>/types.ts, tetapi jangan mengubah bentuk di sini
 * tanpa memperbarui mock (src/mocks) — backend Go akan mengikuti kontrak ini lewat OpenAPI.
 */

export type ID = string
export type ISODate = string // YYYY-MM-DD
export type ISODateTime = string // RFC 3339
export type WallTime = string // HH:mm

/* ------------------------------------------------------------------ enums */

export const ROLES = [
  'ADMIN',
  'PRINCIPAL',
  'TEACHER',
  'DUTY_TEACHER',
  'HOMEROOM',
  'ACTIVITY_COORDINATOR',
] as const
export type Role = (typeof ROLES)[number]

/** Kode shift bersifat konfigurasi (data master), default MORNING/AFTERNOON. */
export type ShiftCode = string

export const ATTENDANCE_STATUSES = [
  'PRESENT',
  'SICK',
  'PERMISSION',
  'ABSENT',
  'LATE',
  'LEFT_EARLY',
  'EXCUSED',
] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

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

export const DISMISSAL_TYPES = ['NORMAL', 'EARLY_LEAVE', 'TEMPORARY_EXIT'] as const
export type DismissalType = (typeof DISMISSAL_TYPES)[number]

/** Status kehadiran guru pada satu pertemuan (jurnal). Berbeda konteks dari absensi harian guru. */
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
  /** Terisi bila user adalah guru. */
  teacherId: ID | null
  /** Kelas yang diampu sebagai wali kelas. */
  homeroomClassIds: ID[]
  /** Kelas yang diajar (dari jadwal) — untuk scoping UI; backend tetap otoritas. */
  teachingClassIds: ID[]
  /** Kegiatan tambahan yang dikoordinasikan. */
  coordinatedActivityIds: ID[]
}

export interface LoginRequest {
  username: string
  password: string
}
export interface LoginResponse {
  accessToken: string
  expiresIn: number // detik
}

/** Daftar permission (string). Backend mengirim yang berlaku untuk user lewat GET /auth/me. */
export const PERMISSIONS = [
  'dashboard:read',
  'master:read',
  'master:write',
  'schedule:read',
  'student_attendance:read',
  'student_attendance:write',
  'student_attendance:correct',
  'student_contact:read',
  'absentees:read',
  'absentees:write',
  'dismissal:read',
  'dismissal:write',
  'teacher_attendance:self',
  'teacher_attendance:read',
  'teacher_attendance:write',
  'duty_assignment:write',
  'duty_agenda:read',
  'duty_agenda:write',
  'duty_agenda:correct',
  'teaching_log:read',
  'teaching_log:write',
  'teaching_log:read_all',
  'teaching_log:correct',
  'substitution:read',
  'substitution:write',
  'extra_activity:read',
  'extra_activity:write',
  'report:read',
  'report:export',
  'audit:read',
  'settings:write',
] as const
export type Permission = (typeof PERMISSIONS)[number]

/* ------------------------------------------------------------------ master */

export interface Semester {
  id: ID
  academicYearId: ID
  number: 1 | 2
  name: string // 'Ganjil' | 'Genap'
  startDate: ISODate
  endDate: ISODate
  isActive: boolean
}

export interface AcademicYear {
  id: ID
  name: string // '2026/2027'
  startDate: ISODate
  endDate: ISODate
  isActive: boolean
  semesters: Semester[]
}

export interface Shift {
  id: ID
  code: ShiftCode
  name: string // 'Pagi'
  startTime: WallTime
  endTime: WallTime
  /** Toleransi keterlambatan (menit) setelah startTime. */
  lateToleranceMinutes: number
  isActive: boolean
}

export interface Period {
  id: ID
  shiftCode: ShiftCode
  number: number // jam ke-
  startTime: WallTime
  endTime: WallTime
  durationMinutes: number
}

export interface ClassRoom {
  id: ID
  name: string // 'X TKJ 1'
  grade: number // 10 | 11 | 12
  program: string // 'Teknik Komputer dan Jaringan'
  shiftCode: ShiftCode
  homeroomTeacherId: ID | null
  academicYearId: ID
  status: ActiveStatus
  /** Turunan untuk tampilan. */
  studentCount?: number
}

export interface Student {
  id: ID
  nis: string
  name: string
  gender: 'L' | 'P'
  classId: ID
  status: ActiveStatus
  /** Tanggal efektif nonaktif (siswa tidak muncul di roster mulai tanggal ini). */
  inactiveFrom: ISODate | null
  guardianName: string | null
  /** Dimask ('0812****89') bila user tidak memiliki permission student_contact:read. */
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
  name: string
  phone: string | null
  subjectIds: ID[]
  status: ActiveStatus
  userId: ID | null
}

/** Satu slot jadwal: kelas × guru × mapel pada hari & rentang jam ke-. */
export interface TimetableSlot {
  id: ID
  academicYearId: ID
  semesterId: ID
  /** ISO day of week: 1 = Senin … 7 = Minggu. */
  dayOfWeek: number
  shiftCode: ShiftCode
  classId: ID
  teacherId: ID
  subjectId: ID
  periodStart: number
  periodEnd: number
  /** = periodEnd - periodStart + 1 */
  periodCount: number
}

/* ------------------------------------------------------------------ student attendance */

export interface StudentAttendanceSession {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  /** Nomor sesi dalam hari (1 = absensi harian; >1 bila sekolah memakai beberapa sesi). */
  sessionNumber: number
  sessionLabel: string // 'Harian' | 'Sesi 2'
  status: RecordStatus
  createdBy: ID
  createdByName: string
  createdAt: ISODateTime
  submittedAt: ISODateTime | null
  submittedBy: ID | null
  submittedByName: string | null
  version: number
  /** Ringkasan jumlah per status (dari backend). */
  summary: AttendanceSummaryCounts
}

export type AttendanceSummaryCounts = Record<AttendanceStatus, number> & {
  total: number
  /** Siswa yang belum diberi status (record belum ada). */
  unmarked: number
}

export interface GuardianContact {
  contactedPhone: string | null
  receiverName: string | null // pihak yang menerima informasi
  contactNote: string | null
  contactedAt: ISODateTime | null
  contactedBy: ID | null
  contactedByName: string | null
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
  contact: GuardianContact | null
  updatedAt: ISODateTime
  updatedBy: ID
  updatedByName: string
  version: number
}

/** Baris roster: record bisa null bila siswa belum diberi status pada sesi tersebut. */
export interface RosterRow {
  student: Pick<Student, 'id' | 'nis' | 'name' | 'gender'>
  record: StudentAttendanceRecord | null
}

export interface BulkAttendanceRequest {
  records: {
    studentId: ID
    status: AttendanceStatus
    reason?: string | null
    note?: string | null
    arrivalTime?: WallTime | null
  }[]
  /** Versi sesi yang dilihat klien — 409 VERSION_CONFLICT bila berbeda. */
  version: number
  /** true = simpan lalu finalisasi sesi (status FINAL) (PRD §10.7). */
  submit?: boolean
  /** Wajib bila sesi sudah FINAL dan pengguna memiliki hak koreksi (PRD §9.2). */
  correctionReason?: string | null
}

/** POST /student-attendance/sessions */
export interface CreateAttendanceSessionRequest {
  date: ISODate
  shiftCode: ShiftCode
  classId: ID
  sessionNumber?: number
}

/** PATCH /student-attendance/records/:id — koreksi satu record. */
export interface PatchAttendanceRecordRequest {
  status?: AttendanceStatus
  reason?: string | null
  note?: string | null
  arrivalTime?: WallTime | null
  /** Wajib bila sesi FINAL (PRD §9.2). */
  correctionReason?: string | null
  /** Versi record yang dilihat klien. */
  version: number
}

/** Baris riwayat absensi per siswa (GET /student-attendance/history, FR-STU-08). */
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
  status: AttendanceStatus
  reason: string | null
  note: string | null
  guardianName: string | null
  guardianPhone: string | null // dimask sesuai permission
  contact: GuardianContact | null
  sessionStatus: RecordStatus
}

/* ------------------------------------------------------------------ dismissal */

export interface StudentDismissal {
  id: ID
  studentId: ID
  studentName: string
  studentNis: string
  classId: ID
  className: string
  date: ISODate
  shiftCode: ShiftCode
  exitTime: ISODateTime
  /** Untuk TEMPORARY_EXIT: waktu kembali (opsional). */
  returnTime: ISODateTime | null
  type: DismissalType
  pickupName: string | null
  pickupRelation: string | null
  note: string | null
  recordedBy: ID
  recordedByName: string
  recordedAt: ISODateTime
}

/* ------------------------------------------------------------------ teacher attendance */

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
  /** Hitungan sistem dari jadwal aktif. */
  affectedPeriodsComputed: number
  /** Koreksi manual piket (null = pakai hitungan sistem). */
  affectedPeriodsOverride: number | null
  overrideReason: string | null
  /** Nilai efektif = override ?? computed. */
  affectedPeriods: number
  /** Menit terlambat dari batas toleransi (null bila tidak terlambat / belum check-in). */
  lateMinutes: number | null
  source: 'SELF' | 'DUTY' | 'ADMIN'
  updatedAt: ISODateTime
  updatedByName: string
  version: number
}

/** Baris daftar guru terjadwal hari itu (GET /teacher-attendance?date&shiftCode). */
export interface ScheduledTeacherRow {
  teacher: Pick<Teacher, 'id' | 'nip' | 'name'>
  /** Jumlah jam mengajar terjadwal hari itu. */
  scheduledPeriods: number
  slots: Pick<TimetableSlot, 'id' | 'classId' | 'subjectId' | 'periodStart' | 'periodEnd'>[]
  isDutyTeacher: boolean
  attendance: TeacherAttendance | null
}

/* ------------------------------------------------------------------ duty */

export interface DutyAssignment {
  id: ID
  /** Jadwal rutin per hari (dayOfWeek) atau tanggal khusus (date). Salah satu terisi. */
  dayOfWeek: number | null
  date: ISODate | null
  shiftCode: ShiftCode
  teacherIds: ID[]
  note: string | null
}

export interface DutyNote {
  id: ID
  time: ISODateTime
  category: string | null // 'Kejadian' | 'Tamu' | 'Kedisiplinan' | 'Lainnya'
  content: string
  createdBy: ID
  createdByName: string
}

/** Baris rekap guru tidak hadir di agenda piket. */
export interface DutyAbsentTeacherRow {
  teacherId: ID
  teacherName: string
  status: TeacherAttendanceStatus
  reason: string | null
  affectedPeriods: number
  /** Jam yang sudah ditangani guru pengganti. */
  handledPeriods: number
}

export interface DutyAgenda {
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  dutyTeacherIds: ID[]
  dutyTeacherNames: string[]
  status: RecordStatus
  /** Snapshot/turunan dari absensi guru + jam kosong (dihitung backend). */
  scheduledTeacherCount: number
  presentTeacherCount: number
  absentTeachers: DutyAbsentTeacherRow[]
  /** Piket menandai "tidak ada" untuk bagian kosong sebelum finalisasi. */
  noAbsentTeachers: boolean
  notes: DutyNote[]
  noImportantNotes: boolean
  /** Catatan penanggulangan jam kosong (teks bebas tambahan). */
  substitutionSummary: string | null
  createdBy: ID
  createdAt: ISODateTime
  submittedAt: ISODateTime | null
  submittedByName: string | null
  finalizedAt: ISODateTime | null
  finalizedByName: string | null
  version: number
}

/* ------------------------------------------------------------------ teaching log */

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
  /** JML — dari jadwal; koreksi wajib alasan. */
  periodCount: number
  periodCountOverrideReason: string | null
  meetingNumber: number | null
  topic: string | null // materi
  activity: string | null // kegiatan
  note: string | null
  teacherPresence: TeachingPresence
  execution: TeachingExecution
  /** Wajib bila execution = NOT_HELD. */
  notHeldReason: string | null
  /** Ringkasan siswa S/I/A pada pertemuan (opsional). */
  studentSick: number
  studentPermission: number
  studentAbsent: number
  substitutionRecordId: ID | null
  status: RecordStatus
  submittedAt: ISODateTime | null
  approvedAt: ISODateTime | null
  approvedByName: string | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  version: number
}

/** Jadwal hari ini milik guru + jurnal yang sudah ada (GET /teaching-logs/today). */
export interface TodayTeachingSlot {
  slot: TimetableSlot
  className: string
  subjectName: string
  startTime: WallTime
  endTime: WallTime
  /** Slot ini adalah tugas pengganti (bukan jadwal asli guru). */
  isSubstitution: boolean
  substitutionRecordId: ID | null
  log: TeachingLog | null
}

/* ------------------------------------------------------------------ substitutions */

export interface SubstitutionSlot {
  /** `${date}:${timetableSlotId}` */
  id: ID
  date: ISODate
  shiftCode: ShiftCode
  timetableSlotId: ID
  classId: ID
  className: string
  subjectId: ID
  subjectName: string
  absentTeacherId: ID
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
  timetableSlotId: ID
  classId: ID
  subjectId: ID
  absentTeacherId: ID
  substituteTeacherId: ID
  substituteTeacherName: string
  periodStart: number
  periodEnd: number
  /** Jam yang benar-benar ditangani. */
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

export interface SubstitutionConflict {
  type: 'TEACHER_BUSY' | 'TEACHER_ABSENT' | 'SLOT_ALREADY_HANDLED'
  message: string
  timetableSlotId?: ID
}

/** Kandidat guru pengganti untuk satu slot (GET /substitution-slots/{id}/candidates). */
export interface SubstituteCandidate {
  teacher: Pick<Teacher, 'id' | 'nip' | 'name' | 'subjectIds'>
  teachesSameSubject: boolean
  conflicts: SubstitutionConflict[]
  /** Total jam mengajar (asli + pengganti) pada hari itu. */
  loadPeriods: number
}

export interface SubstitutionSummary {
  affectedPeriods: number
  handledPeriods: number
  unhandledPeriods: number
  affectedSlots: number
  handledSlots: number
  unhandledSlots: number
}

/* ------------------------------------------------------------------ extra activities */

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
  participantAttendanceEnabled: boolean
  participants: { studentId: ID; studentName: string; classId: ID; status: AttendanceStatus }[]
  status: RecordStatus
  createdAt: ISODateTime
  version: number
}

/* ------------------------------------------------------------------ audit & settings */

export interface AuditLog {
  id: ID
  timestamp: ISODateTime
  actorId: ID
  actorName: string
  action: AuditAction
  entity: string // 'StudentAttendanceRecord' | 'DutyAgenda' | ...
  entityId: ID
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  reason: string | null
  requestId: string
}

export interface StatusConfig {
  code: AttendanceStatus
  label: string
  /** Kode singkat untuk ekspor/print (S/I/A). */
  shortCode: string
  requiresReason: boolean
  active: boolean
}

export interface SchoolSettings {
  schoolName: string
  schoolAddress: string
  letterheadLines: string[] // baris kop surat
  principalName: string
  principalNip: string
  city: string
  timezone: string
  /** Hari sekolah (ISO day of week). */
  schoolDays: number[]
  attendanceStatuses: StatusConfig[]
  teacherReasonRequiredStatuses: TeacherAttendanceStatus[]
  dismissalRequiresPickup: boolean
  dutyNoteCategories: string[]
  version: number
}

/* ------------------------------------------------------------------ dashboard */

export interface DashboardSummary {
  date: ISODate
  shiftCode: ShiftCode | null
  studentAttendance: {
    classesScheduled: number
    sessionsSubmitted: number
    sessionsDraft: number
    counts: AttendanceSummaryCounts
  }
  teacherAttendance: {
    scheduled: number
    present: number
    absent: number
    late: number
    notCheckedIn: number
  }
  substitutions: SubstitutionSummary
  dutyAgenda: { id: ID | null; status: RecordStatus | null; shiftCode: ShiftCode }[]
  teachingLogs: { expected: number; filled: number }
  dismissals: { total: number; earlyLeave: number; temporaryExit: number }
  /** Untuk guru: ringkasan pribadi. */
  me: {
    teacherAttendance: TeacherAttendance | null
    todaySlots: number
    logsFilled: number
    isDutyToday: boolean
  } | null
  pendingTasks: PendingTask[]
}

export interface PendingTask {
  id: string
  kind:
    | 'ATTENDANCE_NOT_SUBMITTED'
    | 'DUTY_AGENDA_DRAFT'
    | 'SUBSTITUTION_UNHANDLED'
    | 'TEACHING_LOG_MISSING'
    | 'CHECK_OUT_MISSING'
  title: string
  description: string
  /** Path frontend yang menelusuri ke record pembentuk angka. */
  href: string
}
