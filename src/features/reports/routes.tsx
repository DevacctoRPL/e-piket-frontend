import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur reports (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const reportsRoutes: RouteObject[] = [
  {
    path: 'laporan',
    element: <RequirePermission permission="report:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Laporan" /> }],
  },
]
