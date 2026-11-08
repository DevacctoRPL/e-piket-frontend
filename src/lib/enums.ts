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
}

export const ROLE_META: Record<Role, EnumMeta> = {
  ADMIN: { label: 'Admin/TU', tone: 'purple' },
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
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Dikirim', tone: 'info' },
  FINAL: { label: 'Final', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
}

export const DISMISSAL_META: Record<DismissalType, EnumMeta> = {
  NORMAL: { label: 'Pulang Normal', tone: 'success' },
  EARLY_LEAVE: { label: 'Pulang Lebih Awal', tone: 'warning' },
  TEMPORARY_EXIT: { label: 'Izin Keluar', tone: 'info' },
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
}

export const SUBSTITUTION_SLOT_META = {
  UNHANDLED: { label: 'Belum Tertangani', tone: 'danger' },
  HANDLED: { label: 'Tertangani', tone: 'success' },
} as const satisfies Record<string, EnumMeta>

/** Status penugasan guru pengganti (SubstitutionRecord.status). */
export const SUBSTITUTION_RECORD_META: Record<SubstitutionRecord['status'], EnumMeta> = {
  ACTIVE: { label: 'Aktif', tone: 'success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
}

/** Jenis konflik calon guru pengganti. */
export const SUBSTITUTION_CONFLICT_META: Record<SubstitutionConflict['type'], EnumMeta> = {
  TEACHER_BUSY: { label: 'Bentrok jadwal', tone: 'warning' },
  TEACHER_ABSENT: { label: 'Berhalangan', tone: 'danger' },
  SLOT_ALREADY_HANDLED: { label: 'Sudah ditangani', tone: 'neutral' },
}

export const EXTRA_ACTIVITY_TYPE_META = {
  COURSE: { label: 'Kursus', tone: 'info' },
  EXTRA_HOURS: { label: 'Jam Tambahan', tone: 'purple' },
  OTHER: { label: 'Lainnya', tone: 'neutral' },
} as const satisfies Record<string, EnumMeta>

/** Ambil opsi select dari meta map. */
export function enumOptions<K extends string>(meta: Record<K, EnumMeta>, keys?: readonly K[]) {
  return (keys ?? (Object.keys(meta) as K[])).map((value) => ({ value, label: meta[value].label }))
}
