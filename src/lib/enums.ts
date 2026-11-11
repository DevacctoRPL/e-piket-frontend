import {
  Ban,
  CircleCheck,
  KeyRound,
  ShieldUser,
  UserCog,
  CircleDashed,
  CircleX,
  Clock3,
  FilePen,
  LockKeyhole,
  LogOut,
  Send,
  type LucideIcon,
} from 'lucide-react'
import type {
  AttendanceStatus,
  AuditAction,
  DismissalType,
  RecordStatus,
  Role,
  SubstitutionConflict,
  SubstitutionRecord,
  TeacherAttendanceStatus,
  TeachingExecution,
  TeachingPresence,
} from '@/types/entities'

/** Tone visual untuk StatusBadge. Selalu ditampilkan bersama teks (PRD §8.1, §12). */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'

export interface EnumMeta {
  label: string
  short?: string
  tone: Tone
  /** Ikon status (ikon + teks). Bila kosong, StatusBadge memakai ikon bawaan tone. */
  icon?: LucideIcon
}

export const ROLE_META: Record<Role, EnumMeta> = {
  SUPER_ADMIN: { label: 'Super Admin', tone: 'neutral', icon: ShieldUser },
  ADMIN: { label: 'Admin/TU', tone: 'neutral' },
  PRINCIPAL: { label: 'Pimpinan', tone: 'info' },
  TEACHER: { label: 'Guru', tone: 'neutral' },
  DUTY_TEACHER: { label: 'Guru Piket', tone: 'success' },
  HOMEROOM: { label: 'Wali Kelas', tone: 'warning' },
  ACTIVITY_COORDINATOR: { label: 'Koordinator', tone: 'info' },
}

export const ATTENDANCE_META: Record<AttendanceStatus, EnumMeta> = {
  PRESENT: { label: 'Hadir', short: 'H', tone: 'success' },
  SICK: { label: 'Sakit', short: 'S', tone: 'info' },
  PERMISSION: { label: 'Izin', short: 'I', tone: 'purple' },
  ABSENT: { label: 'Alpa', short: 'A', tone: 'danger' },
  LATE: { label: 'Terlambat', short: 'T', tone: 'warning' },
  LEFT_EARLY: { label: 'Pulang Lebih Awal', short: 'PA', tone: 'neutral' },
  EXCUSED: { label: 'Dispensasi', short: 'D', tone: 'neutral' },
}

/** Status yang dihitung sebagai "tidak hadir" untuk daftar siswa tidak hadir. */
export const NON_PRESENT_STATUSES: AttendanceStatus[] = [
  'SICK',
  'PERMISSION',
  'ABSENT',
  'LATE',
  'LEFT_EARLY',
  'EXCUSED',
]

/** Default status yang mewajibkan alasan (dapat dikonfigurasi lewat settings). */
export const DEFAULT_REASON_REQUIRED: AttendanceStatus[] = ['SICK', 'PERMISSION', 'ABSENT']

export const TEACHER_ATTENDANCE_META: Record<TeacherAttendanceStatus, EnumMeta> = {
  PRESENT: { label: 'Hadir', short: 'H', tone: 'success' },
  SICK: { label: 'Sakit', short: 'S', tone: 'info' },
  PERMISSION: { label: 'Izin', short: 'I', tone: 'purple' },
  ABSENT: { label: 'Alpa', short: 'A', tone: 'danger' },
  LATE: { label: 'Terlambat', short: 'T', tone: 'warning' },
  OFFICIAL_DUTY: { label: 'Dinas Luar', short: 'DL', tone: 'neutral' },
}

/** Status guru yang menyebabkan jam mengajar terdampak. */
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

export const DISMISSAL_META: Record<DismissalType, EnumMeta> = {
  NORMAL: { label: 'Pulang Normal', tone: 'success', icon: CircleCheck },
  EARLY_LEAVE: { label: 'Pulang Lebih Awal', tone: 'warning', icon: Clock3 },
  TEMPORARY_EXIT: { label: 'Izin Keluar', tone: 'info', icon: LogOut },
}

export const TEACHING_PRESENCE_META: Record<TeachingPresence, EnumMeta> = {
  PRESENT: { label: 'Hadir', short: 'H', tone: 'success' },
  SICK: { label: 'Sakit', short: 'S', tone: 'info' },
  PERMISSION: { label: 'Izin', short: 'I', tone: 'purple' },
  ABSENT: { label: 'Alpa', short: 'A', tone: 'danger' },
  SUBSTITUTED: { label: 'Digantikan', short: 'P', tone: 'warning' },
}

export const TEACHING_EXECUTION_META: Record<TeachingExecution, EnumMeta> = {
  HELD: { label: 'Terlaksana', tone: 'success' },
  NOT_HELD: { label: 'Tidak Terlaksana', tone: 'danger' },
}

export const AUDIT_ACTION_META: Record<AuditAction, EnumMeta> = {
  CREATE: { label: 'Buat', tone: 'success' },
  UPDATE: { label: 'Ubah', tone: 'info' },
  DELETE: { label: 'Hapus', tone: 'danger' },
  SUBMIT: { label: 'Kirim', tone: 'info' },
  FINALIZE: { label: 'Finalisasi', tone: 'success' },
  CORRECT: { label: 'Koreksi', tone: 'warning' },
  CANCEL: { label: 'Batal', tone: 'neutral' },
  LOGIN: { label: 'Masuk', tone: 'neutral' },
  ROLE_CHANGE: { label: 'Ubah peran', tone: 'warning', icon: ShieldUser },
  STATUS_CHANGE: { label: 'Ubah status akun', tone: 'info', icon: UserCog },
  PASSWORD_RESET: { label: 'Reset sandi', tone: 'warning', icon: KeyRound },
}

/** Penjelasan singkat tiap peran (dipakai pada daftar centang peran di Kelola Pengguna). */
export const ROLE_DESCRIPTION: Record<Role, string> = {
  SUPER_ADMIN: 'Pemilik sistem: semua akses Admin/TU + kelola akun, peran, keamanan, dan data demo.',
  ADMIN: 'Tata usaha: data master, pengaturan, koreksi data, laporan, dan audit.',
  PRINCIPAL: 'Pimpinan: memantau seluruh data, laporan, audit, dan koreksi agenda/jurnal.',
  TEACHER: 'Guru: absensi kelas yang diajar, jurnal mengajar, dan kehadiran pribadi.',
  DUTY_TEACHER: 'Guru piket: agenda piket, kehadiran guru, jam kosong, dan kepulangan.',
  HOMEROOM: 'Wali kelas: absensi & konfirmasi wali untuk kelas binaan.',
  ACTIVITY_COORDINATOR: 'Koordinator: mengelola kegiatan tambahan dan presensi pesertanya.',
}

/** Status akun pengguna. */
export const ACCOUNT_STATUS_META = {
  ACTIVE: { label: 'Aktif', tone: 'success', icon: CircleCheck },
  INACTIVE: { label: 'Nonaktif', tone: 'neutral', icon: Ban },
} as const satisfies Record<'ACTIVE' | 'INACTIVE', EnumMeta>

export const SUBSTITUTION_SLOT_META = {
  UNHANDLED: { label: 'Belum Tertangani', tone: 'danger', icon: CircleDashed },
  HANDLED: { label: 'Tertangani', tone: 'success', icon: CircleCheck },
} as const satisfies Record<string, EnumMeta>

/** Status penugasan guru pengganti (SubstitutionRecord.status). */
export const SUBSTITUTION_RECORD_META: Record<SubstitutionRecord['status'], EnumMeta> = {
  ACTIVE: { label: 'Aktif', tone: 'success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral', icon: Ban },
}

/** Jenis konflik calon guru pengganti. */
export const SUBSTITUTION_CONFLICT_META: Record<SubstitutionConflict['type'], EnumMeta> = {
  TEACHER_BUSY: { label: 'Bentrok jadwal', tone: 'warning' },
  TEACHER_ABSENT: { label: 'Berhalangan', tone: 'danger' },
  SLOT_ALREADY_HANDLED: { label: 'Sudah ditangani', tone: 'neutral' },
}

export const EXTRA_ACTIVITY_TYPE_META = {
  COURSE: { label: 'Kursus', tone: 'info' },
  EXTRA_HOURS: { label: 'Jam Tambahan', tone: 'neutral' },
  OTHER: { label: 'Lainnya', tone: 'neutral' },
} as const satisfies Record<string, EnumMeta>

/** Ambil opsi select dari meta map. */
export function enumOptions<K extends string>(meta: Record<K, EnumMeta>, keys?: readonly K[]) {
  return (keys ?? (Object.keys(meta) as K[])).map((value) => ({ value, label: meta[value].label }))
}
