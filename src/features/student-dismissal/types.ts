import type {
  AttendanceStatus,
  DismissalType,
  ID,
  ISODate,
  ISODateTime,
  RecordStatus,
  ShiftCode,
  StudentDismissal,
  WallTime,
} from '@/types/entities'

/** Ringkasan absensi siswa pada satu sesi hari itu (GET /student-dismissals/context). */
export interface DismissalAttendanceEntry {
  sessionId: ID
  sessionLabel: string
  sessionStatus: RecordStatus
  /** null = siswa belum diberi status pada sesi ini. */
  status: AttendanceStatus | null
  arrivalTime: WallTime | null
  reason: string | null
}

export interface DismissalContext {
  student: {
    id: ID
    nis: string
    name: string
    classId: ID
    className: string
    shiftCode: ShiftCode | null
  }
  date: ISODate
  /** Kosong = belum ada sesi absensi untuk kelas siswa pada tanggal itu. */
  attendance: DismissalAttendanceEntry[]
  /** Kepulangan yang sudah tercatat untuk siswa pada tanggal itu. */
  dismissals: StudentDismissal[]
}

export interface CreateDismissalInput {
  studentId: ID
  date: ISODate
  exitTime: ISODateTime
  type: DismissalType
  returnTime?: ISODateTime | null
  pickupName?: string | null
  pickupRelation?: string | null
  note?: string | null
}

export interface CorrectDismissalInput {
  exitTime?: ISODateTime
  type?: DismissalType
  returnTime?: ISODateTime | null
  pickupName?: string | null
  pickupRelation?: string | null
  note?: string | null
  reason: string
}

export interface DismissalListParams {
  date?: ISODate
  dateFrom?: ISODate
  dateTo?: ISODate
  classId?: ID
  shiftCode?: ShiftCode
  studentId?: ID
  type?: DismissalType | ''
  search?: string
  page?: number
  pageSize?: number
  sort?: string
}
