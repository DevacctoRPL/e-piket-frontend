import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route Kelola Pengguna (anak dari AppShell) — khusus pemegang user:read (Super Admin). */
export const usersRoutes: RouteObject[] = [
  {
    path: 'pengguna',
    element: <RequirePermission permission="user:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/users-page').then((m) => ({ Component: m.UsersPage })),
      },
    ],
  },
]
