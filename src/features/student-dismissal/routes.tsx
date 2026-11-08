import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur student-dismissal (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const studentDismissalRoutes: RouteObject[] = [
  {
    path: 'kepulangan',
    element: <RequirePermission permission="dismissal:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Kepulangan Siswa" /> }],
  },
]
