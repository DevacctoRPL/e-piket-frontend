import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur Siswa Tidak Hadir (anak dari AppShell). Halaman dimuat lazy (code splitting). */
export const absenteesRoutes: RouteObject[] = [
  {
    path: 'siswa-tidak-hadir',
    element: <RequirePermission permission="absentees:read" />,
    children: [
      {
        index: true,
        lazy: () => import('./pages/absentees-page').then((m) => ({ Component: m.AbsenteesPage })),
      },
      {
        path: 'cetak',
        lazy: () =>
          import('./pages/absentees-print-page').then((m) => ({ Component: m.AbsenteesPrintPage })),
      },
    ],
  },
]
