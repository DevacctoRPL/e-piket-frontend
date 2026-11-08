import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { REPORTS } from './catalog'

type ReportPage = ComponentType<{ mode?: 'screen' | 'print' }>

/** Halaman laporan dimuat lazy per laporan (code splitting). */
const LOADERS: Record<string, () => Promise<ReportPage>> = {
  'absensi-siswa': () => import('./pages/student-attendance-report-page').then((m) => m.StudentAttendanceReportPage),
  'siswa-tidak-hadir': () => import('./pages/absentees-report-page').then((m) => m.AbsenteesReportPage),
  kepulangan: () => import('./pages/dismissals-report-page').then((m) => m.DismissalsReportPage),
  'absensi-guru': () => import('./pages/teacher-attendance-report-page').then((m) => m.TeacherAttendanceReportPage),
  'agenda-piket': () => import('./pages/duty-agenda-report-page').then((m) => m.DutyAgendaReportPage),
  'jurnal-mengajar': () => import('./pages/teaching-logs-report-page').then((m) => m.TeachingLogsReportPage),
  'jam-kosong': () => import('./pages/substitutions-report-page').then((m) => m.SubstitutionsReportPage),
  'kegiatan-tambahan': () => import('./pages/extra-activities-report-page').then((m) => m.ExtraActivitiesReportPage),
}

function reportChildren(path: string): RouteObject[] {
  const load = LOADERS[path]
  if (!load) return []
  return [
    { index: true, lazy: () => load().then((Page) => ({ Component: () => <Page mode="screen" /> })) },
    { path: 'cetak', lazy: () => load().then((Page) => ({ Component: () => <Page mode="print" /> })) },
  ]
}

/** Route fitur laporan (anak dari AppShell). */
export const reportsRoutes: RouteObject[] = [
  {
    path: 'laporan',
    element: <RequirePermission permission="report:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/report-catalog-page').then((m) => ({ Component: m.ReportCatalogPage })),
      },
      ...REPORTS.map<RouteObject>((r) => ({
        path: r.path,
        element: <RequirePermission permission={r.permission} />,
        children: reportChildren(r.path),
      })),
    ],
  },
]
