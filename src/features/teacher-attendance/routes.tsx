import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

const TeacherAttendancePage = lazy(() =>
  import('./pages/teacher-attendance-page').then((m) => ({ default: m.TeacherAttendancePage })),
)

export const teacherAttendanceRoutes: RouteObject[] = [
  {
    path: '/absensi-guru',
    element: (
      <RequirePermission permission="teacher_attendance:read">
        <TeacherAttendancePage />
      </RequirePermission>
    ),
  },
]
