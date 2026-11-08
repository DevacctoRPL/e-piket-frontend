import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur pengaturan (anak dari AppShell). */
export const settingsRoutes: RouteObject[] = [
  {
    path: 'pengaturan',
    element: <RequirePermission permission="settings:write" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/settings-page').then((m) => ({ Component: m.SettingsPage })),
      },
    ],
  },
]
