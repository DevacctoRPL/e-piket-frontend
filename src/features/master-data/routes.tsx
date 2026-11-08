import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur master-data (anak dari AppShell). /master = kelola (admin), /jadwal = lihat jadwal. */
export const masterDataRoutes: RouteObject[] = [
  {
    path: 'master',
    element: <RequirePermission permission="master:write" />,
    children: [{ index: true, element: <PlaceholderPage title="Data Master" /> }],
  },
  {
    path: 'jadwal',
    element: <RequirePermission permission="schedule:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Jadwal" /> }],
  },
]
