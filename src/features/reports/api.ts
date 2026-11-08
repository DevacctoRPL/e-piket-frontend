import { api, type QueryParams } from '@/lib/api-client'
import type { DataResponse, ListResponse } from '@/types/api'
import type { Student } from '@/types/entities'
import type {
  AbsenteesReport,
  AttendanceReport,
  DismissalsReport,
  DutyAgendaReport,
  ExtraActivityReport,
  ReportQuery,
  SubstitutionReport,
  TeacherAttendanceReport,
  TeachingLogReport,
} from './types'

/** Endpoint GET /reports/<endpoint> → tipe respons. */
export interface ReportResponses {
  'attendance-summary': AttendanceReport
  absentees: AbsenteesReport
  dismissals: DismissalsReport
  'teacher-attendance': TeacherAttendanceReport
  'duty-agendas': DutyAgendaReport
  'teaching-logs': TeachingLogReport
  substitutions: SubstitutionReport
  'extra-activities': ExtraActivityReport
}
export type ReportEndpoint = keyof ReportResponses

export function toQueryParams(q: ReportQuery): QueryParams {
  return { ...q }
}

export const reportsApi = {
  get<E extends ReportEndpoint>(endpoint: E, query: ReportQuery, signal?: AbortSignal) {
    return api
      .get<DataResponse<ReportResponses[E]>>(`/reports/${endpoint}`, toQueryParams(query), { signal })
      .then((r) => r.data)
  },
  /** Daftar siswa per kelas untuk filter "Siswa" (ID saja yang masuk URL, bukan nama). */
  studentsOfClass(classId: string, signal?: AbortSignal) {
    return api
      .get<ListResponse<Student>>('/students', { classId, pageSize: 200, sort: 'name' }, { signal })
      .then((r) => r.data)
  },
}
