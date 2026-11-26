import {
  Ban,
  CircleCheck,
  CircleX,
  FilePen,
  LockKeyhole,
  Send,
  ShieldUser,
  type LucideIcon,
} from 'lucide-react'
import type {
  AbsenteeStatus,
  AttendanceStatus,
  RecordStatus,
  Role,
  SubstitutionRecord,
  TeacherAttendanceStatus,
} from '@/types/entities'

/** Tone visual untuk StatusBadge. Selalu ditampilkan bersama teks. */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

export interface EnumMeta {
  label: string
  short?: string
  tone: Tone
  icon?: LucideIcon
}

export const ROLE_META: Record<Role, EnumMeta> = {
  DUTY_TEACHER: { label: 'Guru Piket', tone: 'success', icon: ShieldUser },
}

export const ATTENDANCE_META: Record<AttendanceStatus, EnumMeta> = {
  PRESENT: { label: 'Hadir', short: 'H', tone: 'success' },
  SICK: { label: 'Sakit', short: 'S', tone: 'info' },
  PERMISSION: { label: 'Izin', short: 'I', tone: 'purple' },
  ABSENT: { label: 'Alpa', short: 'A', tone: 'danger' },
  LATE: { label: 'Terlambat', short: 'T', tone: 'warning' },
  LEFT_EARLY: { label: 'Pulang Lebih Awal', short: 'PA', tone: 'neutral' },
  EXCUSED: { label: 'Dispensasi', short: 'D', tone: 'neutral' },
  PKL: { label: 'PKL', short: 'P', tone: 'warning' },
}

/** 5 status ketidakhadiran siswa (S, I, A, D, P) sesuai papan tulis Update Presensi Siswa. */
export const ABSENTEE_STATUS_LIST: AbsenteeStatus[] = [
  'SICK',
  'PERMISSION',
  'ABSENT',
  'EXCUSED',
  'PKL',
]

export const NON_PRESENT_STATUSES: AttendanceStatus[] = [...ABSENTEE_STATUS_LIST]

export const TEACHER_ATTENDANCE_META: Record<TeacherAttendanceStatus, EnumMeta> = {
  PRESENT: { label: 'Hadir', short: 'H', tone: 'success' },
  SICK: { label: 'Sakit', short: 'S', tone: 'info' },
  PERMISSION: { label: 'Izin', short: 'I', tone: 'purple' },
  ABSENT: { label: 'Alpa', short: 'A', tone: 'danger' },
  LATE: { label: 'Terlambat', short: 'T', tone: 'warning' },
  OFFICIAL_DUTY: { label: 'Dinas Luar', short: 'DL', tone: 'neutral' },
}

/** Status guru yang menyebabkan jam mengajar terdampak / jam kosong. */
export const TEACHER_ABSENT_STATUSES: TeacherAttendanceStatus[] = [
  'SICK',
  'PERMISSION',
  'ABSENT',
  'OFFICIAL_DUTY',
]

export const RECORD_STATUS_META: Record<RecordStatus, EnumMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral', icon: FilePen },
  SUBMITTED: { label: 'Dikirim', tone: 'info', icon: Send },
  FINAL: { label: 'Final', tone: 'success', icon: LockKeyhole },
  REJECTED: { label: 'Ditolak', tone: 'danger', icon: CircleX },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral', icon: Ban },
}

export const SUBSTITUTION_RECORD_META: Record<SubstitutionRecord['status'], EnumMeta> = {
  ACTIVE: { label: 'Aktif', tone: 'success', icon: CircleCheck },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral', icon: Ban },
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  DUTY_TEACHER:
    'Akses operasional piket harian: Dashboard, Absensi Guru & Jam Kosong, Agenda Guru, Siswa Tidak Hadir (Absensi Siswa), dan Jam Tambahan.',
}

/** Ambil label peran yang aman bila menerima kode peran tak dikenal atau warisan. */
export function roleLabel(role: string): string {
  return (ROLE_META as Record<string, EnumMeta | undefined>)[role]?.label ?? role
}

/** Gabungkan daftar peran menjadi teks tampil tanpa pernah melempar jika ada nilai tak dikenal. */
export function formatRoleLabels(roles: readonly string[], separator = ', '): string {
  return roles.map(roleLabel).join(separator)
}

/** Ambil opsi select dari meta map. */
export function enumOptions<K extends string>(meta: Record<K, EnumMeta>, keys?: readonly K[]) {
  return (keys ?? (Object.keys(meta) as K[])).map((value) => ({ value, label: meta[value].label }))
}
