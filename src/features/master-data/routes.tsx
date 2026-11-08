import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur master-data (anak dari AppShell). /master = kelola (admin), /jadwal = lihat jadwal. */
export const masterDataRoutes: RouteObject[] = [
  {
    path: 'master',
    element: <RequirePermission permission="master:write" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/master-data-page').then((m) => ({ Component: m.MasterDataPage })),
      },
    ],
  },
  {
    path: 'jadwal',
    element: <RequirePermission permission="schedule:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/schedule-page').then((m) => ({ Component: m.SchedulePage })),
      },
    ],
  },
]
