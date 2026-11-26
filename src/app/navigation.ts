import {
  BookOpenCheck,
  LayoutDashboard,
  NotebookPen,
  UserCheck,
  UserRound,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/types/entities'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Tampil bila user memiliki salah satu permission. */
  permission: Permission | Permission[]
  /** Tampil di bottom nav ponsel (maks 4 item pertama yang lolos permission). */
  mobilePrimary?: boolean
  /** Kategori untuk breadcrumb di topbar. */
  breadcrumbCategory?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Navigasi datar 5 panel operasional harian Guru Piket. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Menu Utama',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        permission: 'dashboard:read',
        mobilePrimary: true,
        breadcrumbCategory: 'Ringkasan',
      },
      {
        label: 'Absensi Guru',
        to: '/absensi-guru',
        icon: UserCheck,
        permission: 'teacher_attendance:read',
        mobilePrimary: true,
        breadcrumbCategory: 'Operasional Piket',
      },
      {
        label: 'Agenda Guru',
        to: '/agenda-guru',
        icon: NotebookPen,
        permission: 'teaching_log:read',
        mobilePrimary: true,
        breadcrumbCategory: 'Operasional Piket',
      },
      {
        label: 'Absensi Siswa',
        to: '/absensi-siswa',
        icon: UserX,
        permission: 'absentees:read',
        mobilePrimary: true,
        breadcrumbCategory: 'Operasional Piket',
      },
      {
        label: 'Jam Tambahan',
        to: '/jam-tambahan',
        icon: BookOpenCheck,
        permission: 'extra_activity:read',
        breadcrumbCategory: 'Operasional Piket',
      },
    ],
  },
]

/** Rute tanpa entri menu (dibuka dari kartu profil) — tetap punya breadcrumb. */
const EXTRA_CONTEXT: { to: string; category: string; label: string; icon: LucideIcon }[] = [
  { to: '/profil', category: 'Akun', label: 'Profil Saya', icon: UserRound },
]

export function findNavContext(pathname: string): {
  category: string
  label: string
  icon: LucideIcon
} {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        return {
          category: item.breadcrumbCategory ?? group.label,
          label: item.label,
          icon: item.icon,
        }
      }
    }
  }
  const extra = EXTRA_CONTEXT.find((e) => pathname === e.to || pathname.startsWith(`${e.to}/`))
  if (extra) return { category: extra.category, label: extra.label, icon: extra.icon }
  return {
    category: 'Ringkasan',
    label: 'Dashboard',
    icon: LayoutDashboard,
  }
}
