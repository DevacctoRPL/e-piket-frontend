/**
 * DTO input untuk endpoint tulis data master. Dipakai oleh api.ts (frontend) dan handler mock
 * master-write.ts agar bentuk payload konsisten.
 */
import type {
  ActiveStatus,
  ClassRoom,
  DutyAssignment,
  ID,
  ISODate,
  Period,
  Shift,
  Student,
  Subject,
  Teacher,
  TimetableSlot,
} from '@/types/entities'

export interface SemesterInput {
  /** Diisi saat mengubah tahun ajaran yang sudah ada. */
  id?: ID
  startDate: ISODate
  endDate: ISODate
}

export interface AcademicYearInput {
  name: string
  startDate: ISODate
  endDate: ISODate
  /** Tepat dua semester: [Ganjil, Genap]. */
  semesters: [SemesterInput, SemesterInput]
}

/** PATCH /academic-years/:id — mendukung pengaktifan tahun ajaran + semester (hanya satu yang aktif). */
export type AcademicYearPatch = Partial<AcademicYearInput> & {
  isActive?: boolean
  activeSemesterId?: ID
}

export type ClassInput = Omit<ClassRoom, 'id' | 'studentCount'>
export type StudentInput = Omit<Student, 'id'>
export type TeacherInput = Omit<Teacher, 'id' | 'userId'>

export interface PresenceMatrixImportItem {
  code: string
  name: string
  nip?: string
  attendanceDays: number[]
  attendanceOrder?: Partial<Record<number, number>>
}

export interface PresenceMatrixImportInput {
  items: PresenceMatrixImportItem[]
  replaceSchedule?: boolean
  createAccounts?: boolean
}

export interface PresenceMatrixImportResult {
  updatedCount: number
  createdCount: number
  accountsCreatedCount: number
  totalScheduledTeachers: number
}
export type SubjectInput = Omit<Subject, 'id'>
export type ShiftInput = Omit<Shift, 'id'>
export type PeriodInput = Omit<Period, 'id' | 'durationMinutes'>
export type TimetableInput = Pick<
  TimetableSlot,
  'dayOfWeek' | 'shiftCode' | 'classId' | 'teacherId' | 'subjectId' | 'periodStart' | 'periodEnd'
>
export type DutyAssignmentInput = Omit<DutyAssignment, 'id'>

export type { ActiveStatus }
