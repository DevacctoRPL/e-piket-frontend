import type { RouteObject } from 'react-router'
import { PlaceholderPage } from '@/components/placeholder-page'

/** Route terproteksi milik fitur auth (anak AppShell). Halaman login didaftarkan langsung di router. */
export const authRoutes: RouteObject[] = [
  { path: 'profil', element: <PlaceholderPage title="Profil Saya" /> },
]
