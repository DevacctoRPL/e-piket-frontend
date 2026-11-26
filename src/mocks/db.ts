/**
 * Store in-memory untuk mock API, dipersist ke localStorage agar data bertahan saat reload.
 * HANYA dipakai di src/mocks/** — kode aplikasi tidak boleh mengimpor file ini.
 */
import type {
  AcademicYear,
  AuditLog,
  ClassRoom,
  DutyAssignment,
  ExtraActivity,
  ID,
  ISODateTime,
  LoginEvent,
  ManualEmptySlot,
  Period,
  Role,
  SchoolSettings,
  Shift,
  Student,
  StudentAttendanceRecord,
  StudentAttendanceSession,
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
  mustChangePassword?: boolean
  version?: number
}

export type StoredSession = Omit<StudentAttendanceSession, 'summary'>

/**
 * Naikkan setiap kali bentuk data/seed berubah agar localStorage lama otomatis di-seed ulang.
 */
export const MOCK_SCHEMA_VERSION = 10

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
  teacherAttendance: TeacherAttendance[]
  dutyAssignments: DutyAssignment[]
  manualEmptySlots: ManualEmptySlot[]
  teachingLogs: TeachingLog[]
  substitutions: SubstitutionRecord[]
  extraActivities: ExtraActivity[]
  auditLogs: AuditLog[]
  loginEvents: LoginEvent[]
  settings: SchoolSettings
  deleted: Record<string, ID[]>
  idempotency: Record<string, { status: number; body: unknown }>
  tokens: Record<string, { userId: ID; exp: number }>
}

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
        if (stored.schemaVersion === MOCK_SCHEMA_VERSION) return stored
      }
    } catch {
      /* data rusak -> seed ulang */
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

let persistDirty = false
let persistScheduled = false

function persistNow(value: MockDb) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
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

export function flushPersist() {
  if (!persistDirty || !current) return
  persistDirty = false
  persistNow(current)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersist)
}

export function persist() {
  if (!current) return
  persistDirty = true
  if (persistScheduled) return
  persistScheduled = true
  queueMicrotask(() => {
    persistScheduled = false
    flushPersist()
  })
}

export function resetDb() {
  if (!seeder) throw new Error('Mock seeder belum terdaftar')
  persistDirty = false
  current = seeder()
  persistNow(current)
  if (typeof localStorage !== 'undefined') localStorage.removeItem(REFRESH_KEY)
}

export function setDbForTest(value: MockDb) {
  persistDirty = false
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
