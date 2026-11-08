import type { RouteObject } from 'react-router'
import { RequirePermission } from '@/app/guards'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route fitur duty-agenda (anak dari AppShell). Ganti placeholder dengan halaman sebenarnya (lazy). */
export const dutyAgendaRoutes: RouteObject[] = [
  {
    path: 'agenda-piket',
    element: <RequirePermission permission="duty_agenda:read" />,
    children: [{ index: true, element: <PlaceholderPage title="Agenda Guru Piket" /> }],
  },
]
