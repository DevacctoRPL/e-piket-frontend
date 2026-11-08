import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur teacher-attendance (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const teacherAttendanceRoutes: RouteObject[] = [
  {
    path: 'absensi-guru',
    element: <RequirePermission permission={["teacher_attendance:self", "teacher_attendance:read"]} />,
    children: [{ index: true, element: <PlaceholderPage title="Absensi Guru" /> }],
  },
]
