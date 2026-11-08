import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur audit (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const auditRoutes: RouteObject[] = [
  {
    path: 'audit',
    element: <RequirePermission permission="audit:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Audit Log" /> }],
  },
]
