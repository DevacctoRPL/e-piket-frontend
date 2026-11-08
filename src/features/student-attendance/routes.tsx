import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur absensi siswa (anak dari AppShell), halaman di-lazy-load. */
export const studentAttendanceRoutes: RouteObject[] = [
  {
    path: 'absensi-siswa',
    element: <RequirePermission permission="student_attendance:read" />,
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/attendance-index-page').then((m) => ({ Component: m.AttendanceIndexPage })),
      },
      {
        path: 'sesi/:id',
        lazy: () => import('./pages/session-editor-page').then((m) => ({ Component: m.SessionEditorPage })),
      },
      {
        path: 'riwayat',
        lazy: () => import('./pages/student-history-page').then((m) => ({ Component: m.StudentHistoryPage })),
      },
    ],
  },
]
