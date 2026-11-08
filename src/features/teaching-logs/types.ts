import type {
  ID,
  ISODate,
  RecordStatus,
  ShiftCode,
  TeachingExecution,
  TeachingPresence,
  WallTime,
} from '@/types/entities'

/** Filter histori jurnal (GET /teaching-logs). */
export interface TeachingLogListParams {
  dateFrom?: ISODate
  dateTo?: ISODate
  teacherId?: ID
  classId?: ID
  subjectId?: ID
  shiftCode?: ShiftCode
  status?: RecordStatus
  page?: number
  pageSize?: number
}

/** Body POST /teaching-logs dan PATCH /teaching-logs/:id. */
export interface TeachingLogPayload {
  date: ISODate
  timetableSlotId?: ID | null
  classId: ID
  subjectId: ID
  shiftCode: ShiftCode
  periodStart: number
  periodEnd: number
  periodCount?: number
  periodCountOverrideReason?: string | null
  meetingNumber?: number | null
  topic: string | null
  activity: string | null
  note: string | null
  teacherPresence: TeachingPresence
  execution: TeachingExecution
  notHeldReason?: string | null
  studentSick: number
  studentPermission: number
  studentAbsent: number
  substitutionRecordId?: ID | null
  /** true = langsung final. */
  submit?: boolean
}

export interface TeachingLogPatch extends Partial<TeachingLogPayload> {
  version?: number
  /** Wajib saat mengoreksi jurnal berstatus FINAL. */
  correctionReason?: string
}

/**
 * Konteks pertemuan yang sedang diisi: dari slot jadwal (read-only) atau bebas (null slot).
 */
export interface TeachingLogContext {
  date: ISODate
  timetableSlotId: ID | null
  substitutionRecordId: ID | null
  isSubstitution: boolean
  classId: ID
  className: string
  subjectId: ID
  subjectName: string
  shiftCode: ShiftCode
  periodStart: number
  periodEnd: number
  startTime: WallTime | null
  endTime: WallTime | null
}

/** Status jurnal untuk satu slot hari ini. */
export type SlotLogState = 'EMPTY' | 'DRAFT' | 'FINAL'
