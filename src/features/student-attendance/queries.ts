import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useStudents } from '@/features/master-data/lookups'
import type { ID } from '@/types/entities'
import { studentAttendanceApi, type SessionListParams } from './api'
import type {
  BulkSaveRequest,
  CreateSessionRequest,
  PatchRecordRequest,
  StudentHistoryParams,
} from './types'

export const studentAttendanceKeys = {
  all: ['student-attendance'] as const,
  sessions: (params: SessionListParams) => [...studentAttendanceKeys.all, 'sessions', params] as const,
  session: (id: ID) => [...studentAttendanceKeys.all, 'session', id] as const,
  roster: (id: ID) => [...studentAttendanceKeys.all, 'session', id, 'records'] as const,
  history: (params: StudentHistoryParams) => [...studentAttendanceKeys.all, 'history', params] as const,
}

/** Absensi siswa → absentees, dashboard, reports (+ audit-logs bila ada koreksi/finalisasi). */
export function invalidateAttendanceDependents(qc: QueryClient, opts: { audit?: boolean } = {}) {
  const roots = ['student-attendance', 'absentees', 'dashboard', 'reports']
  if (opts.audit) roots.push('audit-logs')
  return Promise.all(roots.map((r) => qc.invalidateQueries({ queryKey: [r] })))
}

export function useSessions(params: SessionListParams, enabled = true) {
  return useQuery({
    queryKey: studentAttendanceKeys.sessions(params),
    queryFn: ({ signal }) => studentAttendanceApi.listSessions(params, signal),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useSession(id: ID) {
  return useQuery({
    queryKey: studentAttendanceKeys.session(id),
    queryFn: ({ signal }) => studentAttendanceApi.getSession(id, signal),
  })
}

export function useRoster(id: ID) {
  return useQuery({
    queryKey: studentAttendanceKeys.roster(id),
    queryFn: ({ signal }) => studentAttendanceApi.getRoster(id, signal),
  })
}

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: CreateSessionRequest; idempotencyKey?: string }) =>
      studentAttendanceApi.openSession(body, idempotencyKey),
    onSuccess: (session) => {
      qc.setQueryData(studentAttendanceKeys.session(session.id), session)
      return invalidateAttendanceDependents(qc)
    },
  })
}

export function useBulkSave(sessionId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: BulkSaveRequest; idempotencyKey?: string }) =>
      studentAttendanceApi.bulkSave(sessionId, body, idempotencyKey),
    // 409/422 ditangani di halaman (pesan per baris + opsi muat ulang)
    meta: { silentError: true },
    onSuccess: (res, vars) => {
      qc.setQueryData(studentAttendanceKeys.session(sessionId), res.session)
      qc.setQueryData(studentAttendanceKeys.roster(sessionId), res.records)
      return invalidateAttendanceDependents(qc, {
        audit: !!vars.body.submit || !!vars.body.correctionReason,
      })
    },
  })
}

export function usePatchRecord(sessionId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, body }: { recordId: ID; body: PatchRecordRequest }) =>
      studentAttendanceApi.patchRecord(recordId, body),
    meta: { silentError: true },
    onSuccess: (res, vars) => {
      qc.setQueryData(studentAttendanceKeys.session(sessionId), res.session)
      return invalidateAttendanceDependents(qc, { audit: !!vars.body.correctionReason })
    },
  })
}

/** Siswa per kelas — memakai key master agar ikut ter-invalidate oleh penulisan master. */
export function useClassStudents(classId: ID) {
  return useStudents({ classId })
}

export function useStudentHistory(params: StudentHistoryParams | null) {
  return useQuery({
    queryKey: studentAttendanceKeys.history(params ?? { studentId: '' }),
    queryFn: ({ signal }) => studentAttendanceApi.history(params as StudentHistoryParams, signal),
    enabled: !!params?.studentId,
  })
}
