import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur absensi guru (anak dari AppShell). Halaman di-lazy-load (code splitting). */
export const teacherAttendanceRoutes: RouteObject[] = [
  {
    path: 'absensi-guru',
    element: <RequirePermission permission={['teacher_attendance:self', 'teacher_attendance:read']} />,
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/teacher-attendance-page').then((m) => ({ Component: m.TeacherAttendancePage })),
      },
    ],
  },
]
