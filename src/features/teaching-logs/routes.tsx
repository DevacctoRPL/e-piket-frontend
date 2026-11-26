import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

const TeachingLogsPage = lazy(() =>
  import('./pages/teaching-logs-page').then((m) => ({ default: m.TeachingLogsPage })),
)

export const teachingLogsRoutes: RouteObject[] = [
  {
    path: '/agenda-guru',
    element: (
      <RequirePermission permission="teaching_log:read">
        <TeachingLogsPage />
      </RequirePermission>
    ),
  },
]
