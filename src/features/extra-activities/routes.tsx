import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

const ExtraActivitiesPage = lazy(() =>
  import('./pages/extra-activities-page').then((m) => ({ default: m.ExtraActivitiesPage })),
)

export const extraActivitiesRoutes: RouteObject[] = [
  {
    path: '/jam-tambahan',
    element: (
      <RequirePermission permission="extra_activity:read">
        <ExtraActivitiesPage />
      </RequirePermission>
    ),
  },
]
