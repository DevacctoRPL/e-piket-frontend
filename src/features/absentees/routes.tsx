import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur absentees (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const absenteesRoutes: RouteObject[] = [
  {
    path: 'siswa-tidak-hadir',
    element: <RequirePermission permission="absentees:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Siswa Tidak Hadir" /> }],
  },
]
