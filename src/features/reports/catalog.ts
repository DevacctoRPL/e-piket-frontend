import {
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  DoorOpen,
  NotebookPen,
  ShieldCheck,
  UserCheck,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/types/entities'
import type { ReportSlug } from './types'

export type PeriodPreset = 'today' | 'week' | 'month' | 'semester' | 'custom'

export interface ReportDef {
  /** Segmen URL di bawah /laporan. */
  path: string
  /** Slug untuk GET /reports/export. */
  slug: ReportSlug
  /** Prefix nama file (PRD §13.2). */
  fileSlug: string
  title: string
  description: string
  icon: LucideIcon
  /** Permission sumber data (selain report:read). Salah satu cukup. */
  permission: Permission[]
  defaultPeriod: PeriodPreset
  /** Halaman operasional untuk penelusuran (FR-RPT-01). */
  operationalPath: string
}

/** Katalog 9 laporan PRD §13 (rekap harian & bulanan absensi siswa digabung dengan preset periode). */
export const REPORTS: ReportDef[] = [
  {
    path: 'absensi-siswa',
    slug: 'student-attendance',
    fileSlug: 'rekap-absensi-siswa',
    title: 'Rekap Absensi Siswa',
    description: 'Harian, bulanan, atau semester: jumlah tiap status dan persentase hadir per kelas, siswa, atau tanggal.',
    icon: ClipboardList,
    permission: ['student_attendance:read'],
    defaultPeriod: 'month',
    operationalPath: '/absensi-siswa',
  },
  {
    path: 'siswa-tidak-hadir',
    slug: 'absentees',
    fileSlug: 'daftar-siswa-tidak-hadir',
    title: 'Daftar Siswa Tidak Hadir',
    description: 'Nama, kelas, status, alasan, serta konfirmasi ke orang tua/wali dan pihak yang menerima.',
    icon: UserX,
    permission: ['absentees:read'],
    defaultPeriod: 'today',
    operationalPath: '/siswa-tidak-hadir',
  },
  {
    path: 'kepulangan',
    slug: 'dismissals',
    fileSlug: 'rekap-kepulangan-siswa',
    title: 'Rekap Kepulangan Siswa',
    description: 'Waktu keluar, jenis kepulangan, penjemput, dan petugas yang mencatat.',
    icon: DoorOpen,
    permission: ['dismissal:read'],
    defaultPeriod: 'month',
    operationalPath: '/kepulangan',
  },
  {
    path: 'absensi-guru',
    slug: 'teacher-attendance',
    fileSlug: 'rekap-absensi-guru',
    title: 'Rekap Absensi Guru',
    description: 'Hadir, sakit, izin, alpa, terlambat, dinas luar, total menit terlambat, dan check-in/out.',
    icon: UserCheck,
    permission: ['teacher_attendance:read', 'teacher_attendance:self'],
    defaultPeriod: 'month',
    operationalPath: '/absensi-guru',
  },
  {
    path: 'agenda-piket',
    slug: 'duty-agendas',
    fileSlug: 'rekap-agenda-piket',
    title: 'Rekap Agenda Guru Piket',
    description: 'Petugas, guru tidak hadir, jam terdampak/tertangani, catatan penting, dan status finalisasi.',
    icon: ShieldCheck,
    permission: ['duty_agenda:read'],
    defaultPeriod: 'week',
    operationalPath: '/agenda-piket',
  },
  {
    path: 'jurnal-mengajar',
    slug: 'teaching-logs',
    fileSlug: 'rekap-jurnal-mengajar',
    title: 'Rekap Agenda Kegiatan Mengajar',
    description: 'Materi, kegiatan, pertemuan, jumlah jam (JML), keterlaksanaan, dan kelengkapan jurnal.',
    icon: NotebookPen,
    permission: ['teaching_log:read'],
    defaultPeriod: 'month',
    operationalPath: '/jurnal-mengajar',
  },
  {
    path: 'jam-kosong',
    slug: 'substitutions',
    fileSlug: 'rekap-jam-kosong',
    title: 'Rekap Jam Kosong & Guru Pengganti',
    description: 'Guru berhalangan, slot kosong, guru pengganti, dan jam terdampak/tertangani per hari.',
    icon: CalendarClock,
    permission: ['substitution:read'],
    defaultPeriod: 'month',
    operationalPath: '/jam-kosong',
  },
  {
    path: 'kegiatan-tambahan',
    slug: 'extra-activities',
    fileSlug: 'rekap-kegiatan-tambahan',
    title: 'Rekap Kursus & Jam Tambahan',
    description: 'Kegiatan, kelas, pengampu, materi, keterangan, dan presensi peserta bila diaktifkan.',
    icon: BookOpenCheck,
    permission: ['extra_activity:read'],
    defaultPeriod: 'month',
    operationalPath: '/kegiatan-tambahan',
  },
]

export function reportDef(path: string): ReportDef {
  const def = REPORTS.find((r) => r.path === path)
  if (!def) throw new Error(`Laporan tidak dikenal: ${path}`)
  return def
}
