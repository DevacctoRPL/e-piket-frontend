import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur substitutions (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const substitutionsRoutes: RouteObject[] = [
  {
    path: 'jam-kosong',
    element: <RequirePermission permission="substitution:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Jam Kosong / Guru Pengganti" /> }],
  },
]
