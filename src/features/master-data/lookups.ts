/**
 * Query data master yang dipakai LINTAS fitur (dropdown kelas, guru, mapel, shift, jadwal).
 * Fitur lain WAJIB memakai hook di sini, bukan membuat query master sendiri,
 * agar cache & invalidasi konsisten (PRD §11.4).
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api-client'
import { MASTER_STALE_TIME } from '@/lib/query-client'
import type { DataResponse } from '@/types/api'
import type {
  AcademicYear,
  ClassRoom,
  DutyAssignment,
  ID,
  ISODate,
  Period,
  SchoolSettings,
  Shift,
  ShiftCode,
  Subject,
  Teacher,
  TimetableSlot,
} from '@/types/entities'

export const masterKeys = {
  all: ['master'] as const,
  academicYears: () => [...masterKeys.all, 'academic-years'] as const,
  shifts: () => [...masterKeys.all, 'shifts'] as const,
  periods: () => [...masterKeys.all, 'periods'] as const,
  subjects: () => [...masterKeys.all, 'subjects'] as const,
  classes: (params: { scope?: 'mine'; shiftCode?: string } = {}) =>
    [...masterKeys.all, 'classes', params] as const,
  teachers: () => [...masterKeys.all, 'teachers'] as const,
  students: (params: Record<string, unknown>) => [...masterKeys.all, 'students', params] as const,
  timetable: (params: Record<string, unknown>) => [...masterKeys.all, 'timetable', params] as const,
  dutyAssignments: (params: Record<string, unknown> = {}) =>
    [...masterKeys.all, 'duty-assignments', params] as const,
  settings: () => ['settings'] as const,
}

const get = <T,>(path: string, query?: Record<string, string | number | undefined | null>) =>
  ({ signal }: { signal: AbortSignal }) =>
    api.get<DataResponse<T>>(path, query, { signal }).then((r) => r.data)

export function useAcademicYears() {
  return useQuery({
    queryKey: masterKeys.academicYears(),
    queryFn: get<AcademicYear[]>('/academic-years'),
    staleTime: MASTER_STALE_TIME,
  })
}

export function useActiveAcademicYear() {
  const q = useAcademicYears()
  const year = q.data?.find((y) => y.isActive) ?? null
  const semester = year?.semesters.find((s) => s.isActive) ?? null
  return { ...q, year, semester }
}

export function useShifts() {
  return useQuery({
    queryKey: masterKeys.shifts(),
    queryFn: get<Shift[]>('/shifts'),
    staleTime: MASTER_STALE_TIME,
  })
}

export function usePeriods() {
  return useQuery({
    queryKey: masterKeys.periods(),
    queryFn: get<Period[]>('/periods'),
    staleTime: MASTER_STALE_TIME,
  })
}

export function useSubjects() {
  return useQuery({
    queryKey: masterKeys.subjects(),
    queryFn: get<Subject[]>('/subjects'),
    staleTime: MASTER_STALE_TIME,
  })
}

/** scope 'mine' = hanya kelas yang boleh diakses user (wali kelas / kelas yang diajar). */
export function useClasses(params: { scope?: 'mine'; shiftCode?: ShiftCode } = {}) {
  return useQuery({
    queryKey: masterKeys.classes(params),
    queryFn: get<ClassRoom[]>('/classes', params),
    staleTime: MASTER_STALE_TIME,
  })
}

export function useTeachers() {
  return useQuery({
    queryKey: masterKeys.teachers(),
    queryFn: get<Teacher[]>('/teachers'),
    staleTime: MASTER_STALE_TIME,
  })
}

export function useTimetable(params: {
  date?: ISODate
  dayOfWeek?: number
  classId?: ID
  teacherId?: ID
  shiftCode?: ShiftCode
}) {
  return useQuery({
    queryKey: masterKeys.timetable(params),
    queryFn: get<TimetableSlot[]>('/timetables', params),
    staleTime: MASTER_STALE_TIME,
  })
}

/**
 * Penugasan petugas piket (rutin per hari & tanggal khusus). Butuh master:read / duty_agenda:read.
 * type 'routine' = hanya rutin, 'override' = hanya tanggal khusus.
 */
export function useDutyAssignments(
  params: { type?: 'routine' | 'override'; shiftCode?: ShiftCode; dateFrom?: ISODate; dateTo?: ISODate } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: masterKeys.dutyAssignments(params),
    queryFn: get<DutyAssignment[]>('/duty-assignments', params),
    staleTime: MASTER_STALE_TIME,
    enabled: options.enabled ?? true,
  })
}

export function useSettings() {
  return useQuery({
    queryKey: masterKeys.settings(),
    queryFn: get<SchoolSettings>('/settings'),
    staleTime: MASTER_STALE_TIME,
  })
}

/** Map id → objek untuk lookup nama cepat di tabel. */
export function useLookupMaps() {
  const classes = useClasses()
  const teachers = useTeachers()
  const subjects = useSubjects()
  const shifts = useShifts()
  return useMemo(
    () => ({
      classById: new Map((classes.data ?? []).map((c) => [c.id, c])),
      teacherById: new Map((teachers.data ?? []).map((t) => [t.id, t])),
      subjectById: new Map((subjects.data ?? []).map((s) => [s.id, s])),
      shiftByCode: new Map((shifts.data ?? []).map((s) => [s.code, s])),
      shiftName: (code: string | null | undefined) =>
        (code && shifts.data?.find((s) => s.code === code)?.name) || code || '—',
      isLoading: classes.isPending || teachers.isPending || subjects.isPending || shifts.isPending,
    }),
    [classes.data, teachers.data, subjects.data, shifts.data, classes.isPending, teachers.isPending, subjects.isPending, shifts.isPending],
  )
}
