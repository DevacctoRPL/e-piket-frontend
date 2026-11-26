import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

const AbsenteesPage = lazy(() =>
  import('./pages/absentees-page').then((m) => ({ default: m.AbsenteesPage })),
)

export const absenteesRoutes: RouteObject[] = [
  {
    path: '/absensi-siswa',
    element: (
      <RequirePermission permission="absentees:read">
        <AbsenteesPage />
      </RequirePermission>
    ),
  },
]
