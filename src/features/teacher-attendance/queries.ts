import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ID, ISODate, ShiftCode } from '@/types/entities'
import { teacherAttendanceApi } from './api'
import type {
  RecordTeacherAttendanceRequest,
  TeacherAttendanceHistoryParams,
  UpdateTeacherAttendanceRequest,
} from './types'

export const teacherAttendanceKeys = {
  all: ['teacher-attendance'] as const,
  me: (date: ISODate) => [...teacherAttendanceKeys.all, 'me', date] as const,
  scheduled: (date: ISODate, shiftCode: ShiftCode | '') =>
    [...teacherAttendanceKeys.all, 'scheduled', date, shiftCode] as const,
  history: (params: TeacherAttendanceHistoryParams) =>
    [...teacherAttendanceKeys.all, 'history', params] as const,
}

/**
 * Absensi guru memengaruhi agenda piket, jam kosong, dashboard, dan laporan (PRD §11.4).
 * `withAudit` untuk mutasi yang menulis audit log (catat/koreksi oleh piket/admin).
 */
export function invalidateTeacherAttendanceDependents(qc: QueryClient, withAudit = false) {
  const roots = ['teacher-attendance', 'duty-agendas', 'substitutions', 'dashboard', 'reports']
  if (withAudit) roots.push('audit-logs')
  return Promise.all(roots.map((r) => qc.invalidateQueries({ queryKey: [r] })))
}

export function useMyTeacherAttendance(date: ISODate, enabled = true) {
  return useQuery({
    queryKey: teacherAttendanceKeys.me(date),
    queryFn: ({ signal }) => teacherAttendanceApi.me(date, { signal }),
    enabled,
  })
}

export function useScheduledTeachers(date: ISODate, shiftCode: ShiftCode | '', enabled = true) {
  return useQuery({
    queryKey: teacherAttendanceKeys.scheduled(date, shiftCode),
    queryFn: ({ signal }) =>
      teacherAttendanceApi.scheduled({ date, shiftCode: shiftCode || undefined }, { signal }),
    enabled,
  })
}

export function useTeacherAttendanceHistory(params: TeacherAttendanceHistoryParams, enabled = true) {
  return useQuery({
    queryKey: teacherAttendanceKeys.history(params),
    queryFn: ({ signal }) => teacherAttendanceApi.history(params, { signal }),
    enabled,
    placeholderData: (prev) => prev,
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idempotencyKey: string) => teacherAttendanceApi.checkIn(idempotencyKey),
    meta: { silentError: true },
    onSettled: () => invalidateTeacherAttendanceDependents(qc),
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idempotencyKey: string) => teacherAttendanceApi.checkOut(idempotencyKey),
    meta: { silentError: true },
    onSettled: () => invalidateTeacherAttendanceDependents(qc),
  })
}

export function useRecordTeacherAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: RecordTeacherAttendanceRequest; idempotencyKey: string }) =>
      teacherAttendanceApi.record(body, idempotencyKey),
    meta: { silentError: true },
    onSuccess: () => invalidateTeacherAttendanceDependents(qc, true),
  })
}

export function useUpdateTeacherAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: ID; body: UpdateTeacherAttendanceRequest }) =>
      teacherAttendanceApi.update(id, body),
    meta: { silentError: true },
    onSuccess: () => invalidateTeacherAttendanceDependents(qc, true),
  })
}
