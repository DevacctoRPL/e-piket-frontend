/**
 * Store in-memory untuk mock API, dipersist ke localStorage agar data bertahan saat reload.
 * HANYA dipakai di src/mocks/** — kode aplikasi tidak boleh mengimpor file ini.
 */
import type {
  AcademicYear,
  AuditLog,
  ClassRoom,
  DutyAgenda,
  DutyAssignment,
  ExtraActivity,
  ID,
  ISODateTime,
  LoginEvent,
  Period,
  Role,
  SchoolSettings,
  Shift,
  Student,
  StudentAttendanceRecord,
  StudentAttendanceSession,
  StudentDismissal,
  Subject,
  SubstitutionRecord,
  Teacher,
  TeacherAttendance,
  TeachingLog,
  TimetableSlot,
} from '@/types/entities'

export interface MockUser {
  id: ID
  username: string
  password: string
  name: string
  email: string | null
  roles: Role[]
  teacherId: ID | null
  status: 'ACTIVE' | 'INACTIVE'
  lastLoginAt?: ISODateTime | null
  createdAt?: ISODateTime | null
  updatedAt?: ISODateTime | null
  /** true setelah dibuat/di-reset dengan kata sandi sementara. */
  mustChangePassword?: boolean
  /** Optimistic locking untuk PATCH/status (default 1). */
  version?: number
}

/** Sesi tanpa ringkasan (summary dihitung saat dibaca). */
export type StoredSession = Omit<StudentAttendanceSession, 'summary'>

/**
 * Naikkan setiap kali bentuk data/seed berubah. Data localStorage dengan versi lain otomatis di-seed ulang
 * agar handler baru tidak membaca data lama yang strukturnya tidak cocok (penyebab 500 di dashboard).
 */
export const MOCK_SCHEMA_VERSION = 5

export interface MockDb {
  schemaVersion?: number
  seedDate: string
  users: MockUser[]
  academicYears: AcademicYear[]
  shifts: Shift[]
  periods: Period[]
  classes: Omit<ClassRoom, 'studentCount'>[]
  students: Student[]
  subjects: Subject[]
  teachers: Teacher[]
  timetable: TimetableSlot[]
  studentSessions: StoredSession[]
  studentRecords: StudentAttendanceRecord[]
  dismissals: StudentDismissal[]
  teacherAttendance: TeacherAttendance[]
  dutyAssignments: DutyAssignment[]
  /** Disimpan tanpa field turunan; field turunan dihitung di handler duty. */
  dutyAgendas: DutyAgenda[]
  teachingLogs: TeachingLog[]
  substitutions: SubstitutionRecord[]
  extraActivities: ExtraActivity[]
  auditLogs: AuditLog[]
  /** Jejak percobaan masuk (terbaru di depan, dipangkas MAX_LOGIN_EVENTS). Tanpa kata sandi. */
  loginEvents: LoginEvent[]
  settings: SchoolSettings
  /** Soft-delete marker per koleksi: { collection: [ids] } */
  deleted: Record<string, ID[]>
  /** Idempotency-Key → response yang sudah dikirim. */
  idempotency: Record<string, { status: number; body: unknown }>
  /** accessToken → { userId, exp(ms) } */
  tokens: Record<string, { userId: ID; exp: number }>
}

/** Batas jejak login yang disimpan. */
export const MAX_LOGIN_EVENTS = 500

const STORAGE_KEY = 'epiket-mock-db-v1'
export const REFRESH_KEY = 'epiket-mock-refresh'

let current: MockDb | null = null
let seeder: (() => MockDb) | null = null

export function registerSeeder(fn: () => MockDb) {
  seeder = fn
}

function load(): MockDb {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as MockDb
        // versi lama → jatuh ke seed ulang di bawah (id user seed stabil, jadi sesi login tetap berlaku)
        if (stored.schemaVersion === MOCK_SCHEMA_VERSION) return stored
      }
    } catch {
      /* data rusak → seed ulang */
    }
  }
  if (!seeder) throw new Error('Mock seeder belum terdaftar')
  const fresh = seeder()
  persistNow(fresh)
  return fresh
}

export function db(): MockDb {
  if (!current) current = load()
  return current
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persistNow(value: MockDb) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // kuota penuh: pangkas audit & idempotency lalu coba lagi (audit terbaru di depan → simpan 300 pertama)
    value.auditLogs = value.auditLogs.slice(0, 300)
    value.loginEvents = (value.loginEvents ?? []).slice(0, 200)
    value.idempotency = {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* abaikan */
    }
  }
}

/** Tandai db berubah; ditulis ke localStorage secara debounce. */
export function persist() {
  if (!current) return
  if (persistTimer) clearTimeout(persistTimer)
  const snapshot = current
  persistTimer = setTimeout(() => persistNow(snapshot), 150)
}

/** Reset ke seed awal (dipakai tombol "Reset data demo" & test). */
export function resetDb() {
  if (!seeder) throw new Error('Mock seeder belum terdaftar')
  current = seeder()
  persistNow(current)
  if (typeof localStorage !== 'undefined') localStorage.removeItem(REFRESH_KEY)
}

/** Untuk test: pakai db in-memory tanpa localStorage. */
export function setDbForTest(value: MockDb) {
  current = value
}

let idCounter = 0
export function newId(prefix: string): ID {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function isDeleted(collection: string, id: ID): boolean {
  return db().deleted[collection]?.includes(id) ?? false
}

export function softDelete(collection: string, id: ID) {
  const d = db()
  d.deleted[collection] = [...(d.deleted[collection] ?? []), id]
  persist()
}
