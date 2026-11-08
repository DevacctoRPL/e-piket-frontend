import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur dashboard (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const dashboardRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RequirePermission permission="dashboard:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Dashboard" /> }],
  },
]
