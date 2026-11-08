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
}

/** Sesi tanpa ringkasan (summary dihitung saat dibaca). */
export type StoredSession = Omit<StudentAttendanceSession, 'summary'>

export interface MockDb {
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
  settings: SchoolSettings
  /** Soft-delete marker per koleksi: { collection: [ids] } */
  deleted: Record<string, ID[]>
  /** Idempotency-Key → response yang sudah dikirim. */
  idempotency: Record<string, { status: number; body: unknown }>
  /** accessToken → { userId, exp(ms) } */
  tokens: Record<string, { userId: ID; exp: number }>
}

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
      if (raw) return JSON.parse(raw) as MockDb
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
    // kuota penuh: pangkas audit & idempotency lalu coba lagi
    value.auditLogs = value.auditLogs.slice(-300)
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
