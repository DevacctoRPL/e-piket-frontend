import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur Kepulangan Siswa (anak dari AppShell). */
export const studentDismissalRoutes: RouteObject[] = [
  {
    path: 'kepulangan',
    element: <RequirePermission permission="dismissal:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/dismissal-page').then((m) => ({ Component: m.DismissalPage })),
      },
    ],
  },
]
