import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur Kursus / Jam Tambahan (anak dari AppShell). */
export const extraActivitiesRoutes: RouteObject[] = [
  {
    path: 'kegiatan-tambahan',
    element: <RequirePermission permission="extra_activity:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/extra-activities-page').then((m) => ({ Component: m.ExtraActivitiesPage })),
      },
      {
        path: ':id',
        lazy: () =>
          import('./pages/extra-activity-detail-page').then((m) => ({ Component: m.ExtraActivityDetailPage })),
      },
    ],
  },
]
