import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur dashboard (anak dari AppShell). Halaman dimuat lazy (code splitting). */
export const dashboardRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RequirePermission permission="dashboard:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/dashboard-page').then((m) => ({ Component: m.DashboardPage })),
      },
    ],
  },
]
