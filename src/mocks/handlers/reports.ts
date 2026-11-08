/**
 * Endpoint laporan (PRD §6.10 FR-RPT-02..04, §13). Semua memerlukan report:read;
 * ekspor memerlukan report:export. Scope role ditegakkan di reports-data.ts (AC-13).
 */
import { http, HttpResponse } from 'msw'
import { todayISO } from '@/lib/date'
import { REPORT_SLUGS, type ReportSlug } from '@/features/reports/types'
import type { ReportParams } from './reports-data'
import {
  buildAbsenteesReport,
  buildAttendanceReport,
  buildDismissalsReport,
  buildDutyAgendaReport,
  buildExtraActivityReport,
  buildSubstitutionReport,
  buildTeacherAttendanceReport,
  buildTeachingLogReport,
  parseReportParams,
} from './reports-data'
import { buildExportTable, periodSlug, renderCSV, renderExcelHtml, REPORT_FILE_SLUG } from './reports-export'
import type { AuthedUser } from '../utils'
import { apiPath, errors, latency, ok, requireAuth, requirePermission, searchParams } from '../utils'

function reportRoute<T>(path: string, build: (user: AuthedUser, p: ReportParams) => T) {
  return http.get(apiPath(`/reports/${path}`), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'report:read')
    const params = parseReportParams(searchParams(request))
    return ok(build(user, params))
  })
}

export const reportsHandlers = [
  reportRoute('attendance-summary', buildAttendanceReport),
  reportRoute('absentees', buildAbsenteesReport),
  reportRoute('dismissals', buildDismissalsReport),
  reportRoute('teacher-attendance', buildTeacherAttendanceReport),
  reportRoute('duty-agendas', buildDutyAgendaReport),
  reportRoute('teaching-logs', buildTeachingLogReport),
  reportRoute('substitutions', buildSubstitutionReport),
  reportRoute('extra-activities', buildExtraActivityReport),

  http.get(apiPath('/reports/export'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'report:export')
    const sp = searchParams(request)
    const report = sp.get('report') ?? ''
    const format = sp.get('format') ?? ''
    const details: Record<string, string> = {}
    if (!report) details.report = 'required'
    else if (!REPORT_SLUGS.includes(report as ReportSlug)) details.report = 'invalid'
    if (!format) details.format = 'required'
    else if (format !== 'csv' && format !== 'xlsx') details.format = 'Format ekspor harus csv atau xlsx.'
    if (Object.keys(details).length > 0) throw errors.validation(details, 'Parameter ekspor tidak valid.')

    const params = parseReportParams(sp)
    const slug = report as ReportSlug
    const table = buildExportTable(slug, user, params)
    const ext = format === 'csv' ? 'csv' : 'xls'
    const filename = `${REPORT_FILE_SLUG[slug]}-${periodSlug(params)}_dibuat-${todayISO()}.${ext}`
    const body = format === 'csv' ? renderCSV(table, params) : renderExcelHtml(table, params)
    return new HttpResponse(body, {
      status: 200,
      headers: {
        'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  }),
]
