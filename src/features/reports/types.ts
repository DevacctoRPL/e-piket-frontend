/**
 * Kontrak DTO laporan (GET /reports/*). Dipakai bersama oleh UI dan mock API (import type saja)
 * agar bentuk respons satu sumber. Angka resmi dihitung backend — UI hanya menampilkan
 * (PRD §11.3 "jangan menghitung ulang angka laporan").
 */
import type {
  AbsenteeRow,
  AttendanceStatus,
  DismissalType,
  ExtraActivity,
  ID,
  ISODate,
  ISODateTime,
  RecordStatus,
  ShiftCode,
  StudentDismissal,
  SubstitutionSlot,
  SubstitutionSummary,
  TeacherAttendance,
  TeacherAttendanceStatus,
  TeachingLog,
  WallTime,
} from '@/types/entities'

/** Slug laporan untuk GET /reports/export?report=<slug>. */
export const REPORT_SLUGS = [
  'student-attendance',
  'absentees',
  'dismissals',
  'teacher-attendance',
  'duty-agendas',
  'teaching-logs',
  'substitutions',
  'extra-activities',
] as const
export type ReportSlug = (typeof REPORT_SLUGS)[number]

export interface ReportPeriod {
  dateFrom: ISODate
  dateTo: ISODate
}

interface ReportBase {
  period: ReportPeriod
  generatedAt: ISODateTime
}

/** Filter umum laporan (dikirim sebagai query string). */
export type ReportQuery = ReportPeriod & {
  classId?: ID
  shiftCode?: ShiftCode
  studentId?: ID
  teacherId?: ID
  subjectId?: ID
  status?: string
  type?: string
  groupBy?: AttendanceGroupBy
}

/* ------------------------------------------------------------------ absensi siswa */

export type AttendanceGroupBy = 'class' | 'student' | 'date'
export type AttendanceStatusCounts = Record<AttendanceStatus, number>

export interface AttendanceReportRow {
  key: string
  label: string
  /** Info tambahan: NIS (per siswa), nama kelas, atau hari. */
  sublabel: string | null
  classId: ID | null
  studentId: ID | null
  date: ISODate | null
  counts: AttendanceStatusCounts
  /** Jumlah record status (bukan jumlah siswa). */
  total: number
  /** PRESENT + LATE. */
  present: number
  /** present ÷ total × 100 (1 desimal); null bila total 0. */
  percentPresent: number | null
  /** Jumlah sesi absensi yang dihitung. */
  sessions: number
}

export interface AttendanceReport extends ReportBase {
  groupBy: AttendanceGroupBy
  rows: AttendanceReportRow[]
  totals: Omit<AttendanceReportRow, 'key' | 'label' | 'sublabel' | 'classId' | 'studentId' | 'date'>
  /** Sesi berstatus Dikirim/Final yang dihitung. */
  sessionsCounted: number
  /** Sesi Draft dalam rentang yang TIDAK dihitung (belum dikirim). */
  sessionsExcluded: number
}

/* ------------------------------------------------------------------ siswa tidak hadir */

export interface AbsenteesReport extends ReportBase {
  rows: AbsenteeRow[]
  counts: AttendanceStatusCounts
  total: number
  contacted: number
  notContacted: number
}

/* ------------------------------------------------------------------ kepulangan */

export interface DismissalsReport extends ReportBase {
  rows: StudentDismissal[]
  counts: Record<DismissalType, number>
  total: number
}

/* ------------------------------------------------------------------ absensi guru */

export type TeacherStatusCounts = Record<TeacherAttendanceStatus, number>

export interface TeacherAttendanceReportRow {
  teacherId: ID
  teacherName: string
  nip: string
  counts: TeacherStatusCounts
  records: number
  lateMinutes: number
  affectedPeriods: number
}

export interface TeacherAttendanceReport extends ReportBase {
  teachers: TeacherAttendanceReportRow[]
  records: TeacherAttendance[]
  totals: { counts: TeacherStatusCounts; records: number; lateMinutes: number; affectedPeriods: number }
}

/* ------------------------------------------------------------------ agenda piket */

export interface DutyAgendaReportRow {
  key: string
  agendaId: ID | null
  date: ISODate
  shiftCode: ShiftCode
  shiftName: string
  dutyTeacherNames: string[]
  /** null = agenda belum dibuat. */
  status: RecordStatus | null
  scheduledTeacherCount: number
  presentTeacherCount: number
  absentTeacherCount: number
  absentTeacherNames: string[]
  affectedPeriods: number
  handledPeriods: number
  notesCount: number
}

export interface DutyAgendaReport extends ReportBase {
  rows: DutyAgendaReportRow[]
  totals: {
    rows: number
    final: number
    notFinal: number
    notCreated: number
    absentTeacherCount: number
    affectedPeriods: number
    handledPeriods: number
    notesCount: number
  }
}

/* ------------------------------------------------------------------ jurnal mengajar */

export interface TeachingLogReport extends ReportBase {
  rows: TeachingLog[]
  totals: {
    logs: number
    held: number
    notHeld: number
    /** Jumlah JML (jam pelajaran) dari jurnal terlaksana. */
    periods: number
    /** Slot jadwal pada hari efektif s.d. hari ini, tidak termasuk jam kosong yang tidak tertangani. */
    expectedSlots: number
    filledSlots: number
    /** filledSlots ÷ expectedSlots × 100; null bila expectedSlots 0. */
    fillRate: number | null
    /** Jurnal Draft yang tidak dihitung. */
    draftExcluded: number
  }
}

/* ------------------------------------------------------------------ jam kosong */

export interface SubstitutionDayRow {
  date: ISODate
  summary: SubstitutionSummary
}

export interface SubstitutionReport extends ReportBase {
  days: SubstitutionDayRow[]
  slots: SubstitutionSlot[]
  totals: SubstitutionSummary
}

/* ------------------------------------------------------------------ kegiatan tambahan */

export interface ExtraActivityReportRow
  extends Pick<
    ExtraActivity,
    | 'id'
    | 'name'
    | 'type'
    | 'date'
    | 'shiftCode'
    | 'classIds'
    | 'classNames'
    | 'instructorName'
    | 'topic'
    | 'note'
    | 'status'
    | 'participantAttendanceEnabled'
  > {
  startTime: WallTime | null
  endTime: WallTime | null
  participantCount: number
  presentCount: number
}

export interface ExtraActivityReport extends ReportBase {
  rows: ExtraActivityReportRow[]
  totals: {
    activities: number
    byType: Record<ExtraActivity['type'], number>
    participants: number
    present: number
  }
}
