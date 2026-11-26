import { createBrowserRouter, type RouteObject } from 'react-router'
import { absenteesRoutes } from '@/features/absentees/routes'
import { LoginPage } from '@/features/auth/login-page'
import { authRoutes } from '@/features/auth/routes'
import { dashboardRoutes } from '@/features/dashboard/routes'
import { extraActivitiesRoutes } from '@/features/extra-activities/routes'
import { teacherAttendanceRoutes } from '@/features/teacher-attendance/routes'
import { teachingLogsRoutes } from '@/features/teaching-logs/routes'
import { AppShell } from './app-shell'
import { RouteErrorBoundary } from './error-boundary'
import { NotFoundPage, RedirectIfAuthenticated, RequireAuth } from './guards'

/**
 * Router aplikasi Guru Piket (5 panel operasional + profil akun).
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
              ...teacherAttendanceRoutes,
              ...teachingLogsRoutes,
              ...absenteesRoutes,
              ...extraActivitiesRoutes,
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
