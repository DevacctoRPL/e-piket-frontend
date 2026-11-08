import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur settings (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const settingsRoutes: RouteObject[] = [
  {
    path: 'pengaturan',
    element: <RequirePermission permission="settings:write" />,
    children: [{ index: true, element: <PlaceholderPage title="Pengaturan" /> }],
  },
]
