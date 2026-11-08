import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur Jurnal Mengajar (anak dari AppShell). Halaman di-lazy-load untuk code splitting. */
export const teachingLogsRoutes: RouteObject[] = [
  {
    path: 'jurnal-mengajar',
    element: <RequirePermission permission="teaching_log:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/teaching-logs-page').then((m) => ({ Component: m.TeachingLogsPage })),
      },
      {
        path: 'baru',
        element: <RequirePermission permission={['teaching_log:write', 'teaching_log:correct']} />,
        children: [
          {
            index: true,
            lazy: () =>
              import('./pages/teaching-log-new-page').then((m) => ({ Component: m.TeachingLogNewPage })),
          },
        ],
      },
      {
        path: ':id',
        lazy: () =>
          import('./pages/teaching-log-detail-page').then((m) => ({ Component: m.TeachingLogDetailPage })),
      },
    ],
  },
]
