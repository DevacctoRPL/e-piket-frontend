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
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

/** Navigasi berbasis peran (PRD §8). Menu disembunyikan bila tidak berizin — backend tetap menegakkan akses. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Utama',
    items: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard, permission: 'dashboard:read', mobilePrimary: true },
    ],
  },
  {
    label: 'Harian',
    items: [
      { label: 'Absensi Siswa', to: '/absensi-siswa', icon: ClipboardList, permission: 'student_attendance:read', mobilePrimary: true },
      { label: 'Siswa Tidak Hadir', to: '/siswa-tidak-hadir', icon: UserX, permission: 'absentees:read' },
      { label: 'Kepulangan Siswa', to: '/kepulangan', icon: DoorOpen, permission: 'dismissal:read' },
      { label: 'Absensi Guru', to: '/absensi-guru', icon: UserCheck, permission: ['teacher_attendance:self', 'teacher_attendance:read'], mobilePrimary: true },
      { label: 'Agenda Piket', to: '/agenda-piket', icon: ShieldCheck, permission: 'duty_agenda:read' },
      { label: 'Jurnal Mengajar', to: '/jurnal-mengajar', icon: NotebookPen, permission: 'teaching_log:read', mobilePrimary: true },
      { label: 'Jam Kosong', to: '/jam-kosong', icon: CalendarClock, permission: 'substitution:read' },
      { label: 'Kegiatan Tambahan', to: '/kegiatan-tambahan', icon: BookOpenCheck, permission: 'extra_activity:read' },
    ],
  },
  {
    label: 'Rekap & Administrasi',
    items: [
      { label: 'Laporan', to: '/laporan', icon: FileBarChart, permission: 'report:read' },
      { label: 'Data Master', to: '/master', icon: Database, permission: 'master:write' },
      { label: 'Jadwal', to: '/jadwal', icon: GraduationCap, permission: 'schedule:read' },
      { label: 'Audit Log', to: '/audit', icon: History, permission: 'audit:read' },
      { label: 'Pengaturan', to: '/pengaturan', icon: Settings, permission: 'settings:write' },
    ],
  },
]
