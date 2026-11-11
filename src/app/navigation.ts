import {
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  Database,
  DoorOpen,
  FileBarChart,
  GraduationCap,
  History,
  LayoutDashboard,
  NotebookPen,
  Settings,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  UsersRound,
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
  /** Nama kelompok induk opsional untuk tampilan pohon sub-menu (garis pohon) bergaya Nuvio. */
  parentGroup?: string
  /** Kategori untuk breadcrumb di topbar. */
  breadcrumbCategory?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Navigasi berbasis peran (PRD §8). Menu disembunyikan bila tidak berizin — backend tetap menegakkan akses. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Navigasi Utama',
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
        label: 'Absensi Siswa',
        to: '/absensi-siswa',
        icon: ClipboardList,
        permission: 'student_attendance:read',
        mobilePrimary: true,
        parentGroup: 'Kehadiran Harian',
        breadcrumbCategory: 'Kehadiran Harian',
      },
      {
        label: 'Siswa Tidak Hadir',
        to: '/siswa-tidak-hadir',
        icon: UserX,
        permission: 'absentees:read',
        parentGroup: 'Kehadiran Harian',
        breadcrumbCategory: 'Kehadiran Harian',
      },
      {
        label: 'Kepulangan Siswa',
        to: '/kepulangan',
        icon: DoorOpen,
        permission: 'dismissal:read',
        parentGroup: 'Kehadiran Harian',
        breadcrumbCategory: 'Kehadiran Harian',
      },
      {
        label: 'Absensi Guru',
        to: '/absensi-guru',
        icon: UserCheck,
        permission: ['teacher_attendance:self', 'teacher_attendance:read'],
        mobilePrimary: true,
        parentGroup: 'Kehadiran Harian',
        breadcrumbCategory: 'Kehadiran Harian',
      },
      {
        label: 'Agenda Piket',
        to: '/agenda-piket',
        icon: ShieldCheck,
        permission: 'duty_agenda:read',
        parentGroup: 'KBM & Operasional',
        breadcrumbCategory: 'KBM & Operasional',
      },
      {
        label: 'Jurnal Mengajar',
        to: '/jurnal-mengajar',
        icon: NotebookPen,
        permission: 'teaching_log:read',
        mobilePrimary: true,
        parentGroup: 'KBM & Operasional',
        breadcrumbCategory: 'KBM & Operasional',
      },
      {
        label: 'Jam Kosong',
        to: '/jam-kosong',
        icon: CalendarClock,
        permission: 'substitution:read',
        parentGroup: 'KBM & Operasional',
        breadcrumbCategory: 'KBM & Operasional',
      },
      {
        label: 'Kegiatan Tambahan',
        to: '/kegiatan-tambahan',
        icon: BookOpenCheck,
        permission: 'extra_activity:read',
        parentGroup: 'KBM & Operasional',
        breadcrumbCategory: 'KBM & Operasional',
      },
    ],
  },
  {
    label: 'Analitik & Jadwal',
    items: [
      {
        label: 'Laporan',
        to: '/laporan',
        icon: FileBarChart,
        permission: 'report:read',
        breadcrumbCategory: 'Analitik & Jadwal',
      },
      {
        label: 'Jadwal',
        to: '/jadwal',
        icon: GraduationCap,
        permission: 'schedule:read',
        breadcrumbCategory: 'Analitik & Jadwal',
      },
    ],
  },
  {
    label: 'Administrasi',
    items: [
      {
        label: 'Kelola Pengguna',
        to: '/pengguna',
        icon: UsersRound,
        permission: 'user:read',
        breadcrumbCategory: 'Administrasi',
      },
      {
        label: 'Data Master',
        to: '/master',
        icon: Database,
        permission: 'master:write',
        breadcrumbCategory: 'Administrasi',
      },
      {
        label: 'Audit Log',
        to: '/audit',
        icon: History,
        permission: 'audit:read',
        breadcrumbCategory: 'Administrasi',
      },
      {
        label: 'Pengaturan',
        to: '/pengaturan',
        icon: Settings,
        permission: 'settings:write',
        breadcrumbCategory: 'Administrasi',
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
