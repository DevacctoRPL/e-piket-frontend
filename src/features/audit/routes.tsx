import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur audit (anak dari AppShell). */
export const auditRoutes: RouteObject[] = [
  {
    path: 'audit',
    element: <RequirePermission permission="audit:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/audit-log-page').then((m) => ({ Component: m.AuditLogPage })),
      },
    ],
  },
]
