import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'

/** Route fitur Agenda Guru Piket (anak dari AppShell), halaman dimuat lazy. */
export const dutyAgendaRoutes: RouteObject[] = [
  {
    path: 'agenda-piket',
    element: <RequirePermission permission="duty_agenda:read" />,
    children: [
      {
        index: true,
        lazy: () =>
          import('./pages/duty-agenda-list-page').then((m) => ({ Component: m.DutyAgendaListPage })),
      },
      {
        path: ':id',
        lazy: () =>
          import('./pages/duty-agenda-detail-page').then((m) => ({ Component: m.DutyAgendaDetailPage })),
      },
      {
        path: ':id/cetak',
        lazy: () =>
          import('./pages/duty-agenda-print-page').then((m) => ({ Component: m.DutyAgendaPrintPage })),
      },
    ],
  },
]
