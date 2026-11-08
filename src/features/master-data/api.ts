/**
 * Service data master (PRD §11.2). Komponen tidak memanggil api.* langsung.
 * Endpoint baca list master dipakai lewat lookups.ts; file ini untuk siswa (paginasi), piket, dan semua tulis.
 */
import { api } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type {
  AcademicYear,
  ClassRoom,
  DutyAssignment,
  ID,
  Period,
  Shift,
  Student,
  Subject,
  Teacher,
  TimetableSlot,
} from '@/types/entities'
import type {
  AcademicYearInput,
  AcademicYearPatch,
  ClassInput,
  DutyAssignmentInput,
  PeriodInput,
  ShiftInput,
  StudentInput,
  SubjectInput,
  TeacherInput,
  TimetableInput,
} from './types'

export interface StudentListParams {
  page?: number
  pageSize?: number
  search?: string
  classId?: string
  /** 'true' | 'false' | undefined (semua) */
  active?: string
  sort?: string
}

export interface DutyAssignmentParams {
  type?: 'routine' | 'override'
  shiftCode?: string
  dateFrom?: string
  dateTo?: string
}

type Opts = { idempotencyKey?: string }

const unwrap = <T,>(p: Promise<DataResponse<T>>) => p.then((r) => r.data)

/** Pabrik CRUD sederhana untuk satu resource master. */
function resource<T, TInput, TPatch = Partial<TInput>>(path: string) {
  return {
    create: (body: TInput, opts: Opts = {}) =>
      unwrap(api.post<DataResponse<T>>(path, body, { idempotencyKey: opts.idempotencyKey })),
    update: (id: ID, body: TPatch) => unwrap(api.patch<DataResponse<T>>(`${path}/${id}`, body)),
    remove: (id: ID) => unwrap(api.delete<DataResponse<{ id: ID }>>(`${path}/${id}`)),
  }
}

export const masterApi = {
  academicYears: resource<AcademicYear, AcademicYearInput, AcademicYearPatch>('/academic-years'),
  classes: resource<ClassRoom, ClassInput>('/classes'),
  students: {
    ...resource<Student, StudentInput>('/students'),
    list: (params: StudentListParams, signal?: AbortSignal) =>
      api.get<ListResponse<Student>>('/students', { ...params }, { signal }),
  },
  teachers: resource<Teacher, TeacherInput>('/teachers'),
  subjects: resource<Subject, SubjectInput>('/subjects'),
  shifts: resource<Shift, ShiftInput>('/shifts'),
  periods: resource<Period, PeriodInput>('/periods'),
  timetables: resource<TimetableSlot, TimetableInput>('/timetables'),
  dutyAssignments: {
    ...resource<DutyAssignment, DutyAssignmentInput, Partial<DutyAssignmentInput> & { reason?: string }>(
      '/duty-assignments',
    ),
    list: (params: DutyAssignmentParams, signal?: AbortSignal) =>
      unwrap(api.get<DataResponse<DutyAssignment[]>>('/duty-assignments', { ...params }, { signal })),
  },
}
