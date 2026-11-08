import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur jam kosong / guru pengganti (anak dari AppShell). Halaman dimuat lazy. */
export const substitutionsRoutes: RouteObject[] = [
  {
    path: 'jam-kosong',
    element: <RequirePermission permission="substitution:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/substitutions-page').then((m) => ({ Component: m.SubstitutionsPage })),
      },
    ],
  },
]
