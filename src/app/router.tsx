import { createBrowserRouter, type RouteObject } from 'react-router'
import { absenteesRoutes } from '@/features/absentees/routes'
import { auditRoutes } from '@/features/audit/routes'
import { LoginPage } from '@/features/auth/login-page'
import { authRoutes } from '@/features/auth/routes'
import { dashboardRoutes } from '@/features/dashboard/routes'
import { dutyAgendaRoutes } from '@/features/duty-agenda/routes'
import { extraActivitiesRoutes } from '@/features/extra-activities/routes'
import { masterDataRoutes } from '@/features/master-data/routes'
import { reportsRoutes } from '@/features/reports/routes'
import { settingsRoutes } from '@/features/settings/routes'
import { studentAttendanceRoutes } from '@/features/student-attendance/routes'
import { studentDismissalRoutes } from '@/features/student-dismissal/routes'
import { substitutionsRoutes } from '@/features/substitutions/routes'
import { teacherAttendanceRoutes } from '@/features/teacher-attendance/routes'
import { teachingLogsRoutes } from '@/features/teaching-logs/routes'
import { usersRoutes } from '@/features/users/routes'
import { AppShell } from './app-shell'
import { RouteErrorBoundary } from './error-boundary'
import { NotFoundPage, RedirectIfAuthenticated, RequireAuth } from './guards'

/**
 * Router aplikasi. Setiap fitur mengekspor `RouteObject[]` dari features/<x>/routes.tsx
 * (relatif terhadap root) agar file ini tidak perlu disentuh saat fitur berkembang.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/login',
        element: (
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        ),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            errorElement: <RouteErrorBoundary />,
            children: [
              ...dashboardRoutes,
              ...authRoutes,
              ...masterDataRoutes,
              ...studentAttendanceRoutes,
              ...absenteesRoutes,
              ...studentDismissalRoutes,
              ...teacherAttendanceRoutes,
              ...dutyAgendaRoutes,
              ...teachingLogsRoutes,
              ...substitutionsRoutes,
              ...extraActivitiesRoutes,
              ...reportsRoutes,
              ...usersRoutes,
              ...auditRoutes,
              ...settingsRoutes,
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(routes)
}
