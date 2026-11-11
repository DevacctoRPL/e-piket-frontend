/**
 * Format tampilan audit: label entitas, label field, dan nilai diff sebelum/sesudah.
 */
import {
  ACCOUNT_STATUS_META,
  ATTENDANCE_META,
  DISMISSAL_META,
  RECORD_STATUS_META,
  ROLE_META,
  TEACHER_ATTENDANCE_META,
  TEACHING_EXECUTION_META,
  TEACHING_PRESENCE_META,
  type EnumMeta,
} from '@/lib/enums'
import type { AuditLog } from '@/types/entities'

export const ENTITY_LABEL: Record<string, string> = {
  StudentAttendanceSession: 'Sesi Absensi Siswa',
  StudentAttendanceRecord: 'Absensi Siswa',
  StudentDismissal: 'Kepulangan Siswa',
  GuardianContact: 'Kontak Wali',
  TeacherAttendance: 'Absensi Guru',
  DutyAgenda: 'Agenda Piket',
  DutyNote: 'Catatan Piket',
  DutyAssignment: 'Jadwal Piket',
  TeachingLog: 'Jurnal Mengajar',
  SubstitutionRecord: 'Guru Pengganti',
  ExtraActivity: 'Kegiatan Tambahan',
  SchoolSettings: 'Pengaturan Sekolah',
  User: 'Akun Pengguna',
  Student: 'Siswa',
  Teacher: 'Guru',
  ClassRoom: 'Kelas',
  Subject: 'Mata Pelajaran',
  Shift: 'Shift',
  Period: 'Jam Pelajaran',
  TimetableSlot: 'Jadwal Pelajaran',
  AcademicYear: 'Tahun Ajaran',
  Semester: 'Semester',
}

export function entityLabel(entity: string): string {
  return ENTITY_LABEL[entity] ?? entity.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const FIELD_LABEL: Record<string, string> = {
  status: 'Status',
  reason: 'Alasan',
  note: 'Catatan',
  arrivalTime: 'Jam datang',
  schoolName: 'Nama sekolah',
  schoolAddress: 'Alamat sekolah',
  letterheadLines: 'Baris kop cetak',
  principalName: 'Nama kepala sekolah',
  principalNip: 'NIP kepala sekolah',
  city: 'Kota',
  teacherReasonRequiredStatuses: 'Status guru wajib alasan',
  dismissalRequiresPickup: 'Penjemput wajib diisi',
  dutyNoteCategories: 'Kategori catatan piket',
  label: 'Label',
  shortCode: 'Kode singkat',
  requiresReason: 'Wajib alasan',
  active: 'Aktif',
  name: 'Nama',
  email: 'Email',
  topic: 'Materi',
  activity: 'Kegiatan',
  periodCount: 'Jumlah jam',
  affectedPeriodsOverride: 'Koreksi jam terdampak',
  overrideReason: 'Alasan koreksi',
  checkInAt: 'Waktu datang',
  checkOutAt: 'Waktu pulang',
  execution: 'Pelaksanaan',
  teacherPresence: 'Kehadiran guru',
  notHeldReason: 'Alasan tidak terlaksana',
  substituteTeacherId: 'Guru pengganti',
  pickupName: 'Nama penjemput',
  pickupRelation: 'Hubungan penjemput',
  exitTime: 'Waktu keluar',
  returnTime: 'Waktu kembali',
  type: 'Jenis',
  version: 'Versi',
  roles: 'Peran',
  username: 'Nama pengguna',
  teacherId: 'Guru tertaut',
  mustChangePassword: 'Wajib ganti kata sandi',
}

/** 'attendanceStatuses.SICK.label' → 'Status absensi Sakit › Label' */
export function fieldLabel(field: string): string {
  const parts = field.split('.')
  if (parts[0] === 'attendanceStatuses' && parts.length === 3) {
    const code = parts[1] as keyof typeof ATTENDANCE_META
    const status = ATTENDANCE_META[code]?.label ?? parts[1]
    return `Status absensi ${status} › ${FIELD_LABEL[parts[2] ?? ''] ?? parts[2]}`
  }
  return parts.map((p) => FIELD_LABEL[p] ?? p).join(' › ')
}

const ENUM_LOOKUPS: Record<string, EnumMeta>[] = [
  RECORD_STATUS_META,
  ATTENDANCE_META,
  TEACHER_ATTENDANCE_META,
  DISMISSAL_META,
  TEACHING_PRESENCE_META,
  TEACHING_EXECUTION_META,
  ACCOUNT_STATUS_META,
]

function enumLabel(value: string, field: string): string | null {
  // Daftar peran akun → label peran ('ADMIN' → 'Admin/TU').
  if (field === 'roles' || field === 'role') return ROLE_META[value as keyof typeof ROLE_META]?.label ?? null
  // Field status/jenis/daftar status → terjemahkan kode enum ke label Indonesia.
  if (!/status|type|presence|execution|statuses/i.test(field)) return null
  for (const meta of ENUM_LOOKUPS) {
    const m = meta[value]
    if (m) return m.label
  }
  return null
}

/** Nilai diff → teks tampilan. Tidak pernah melempar untuk tipe tak terduga. */
export function formatAuditValue(value: unknown, field = ''): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return enumLabel(value, field) ?? value
  if (Array.isArray(value)) {
    if (value.length === 0) return '(kosong)'
    return value.map((v) => formatAuditValue(v, field)).join(', ')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export interface DiffRow {
  field: string
  label: string
  before: string
  after: string
  changed: boolean
}

/** Gabungkan kunci before/after menjadi baris diff; field yang berubah ditandai. */
export function buildDiffRows(log: Pick<AuditLog, 'before' | 'after'>): DiffRow[] {
  const before = log.before ?? {}
  const after = log.after ?? {}
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  return keys.map((field) => {
    const b = before[field]
    const a = after[field]
    const changed =
      log.before === null || log.after === null ? true : JSON.stringify(b) !== JSON.stringify(a)
    return {
      field,
      label: fieldLabel(field),
      before: log.before === null ? '—' : formatAuditValue(b, field),
      after: log.after === null ? '—' : formatAuditValue(a, field),
      changed,
    }
  })
}
