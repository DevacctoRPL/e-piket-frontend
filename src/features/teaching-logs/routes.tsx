import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur teaching-logs (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const teachingLogsRoutes: RouteObject[] = [
  {
    path: 'jurnal-mengajar',
    element: <RequirePermission permission="teaching_log:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Jurnal Mengajar" /> }],
  },
]
