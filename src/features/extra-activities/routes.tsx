import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur extra-activities (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const extraActivitiesRoutes: RouteObject[] = [
  {
    path: 'kegiatan-tambahan',
    element: <RequirePermission permission="extra_activity:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Kegiatan Tambahan" /> }],
  },
]
