import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur student-attendance (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const studentAttendanceRoutes: RouteObject[] = [
  {
    path: 'absensi-siswa',
    element: <RequirePermission permission="student_attendance:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Absensi Siswa" /> }],
  },
]
