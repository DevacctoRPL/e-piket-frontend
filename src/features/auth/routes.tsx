import type { RouteObject } from 'react-router'

/** Route terproteksi milik fitur auth (anak AppShell). Halaman login didaftarkan langsung di router. */
export const authRoutes: RouteObject[] = [
  {
    path: 'profil',
    lazy: () => import('./profile-page').then((m) => ({ Component: m.ProfilePage })),
  },
]
