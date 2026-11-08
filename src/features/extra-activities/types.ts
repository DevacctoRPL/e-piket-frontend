import type { AttendanceStatus, ExtraActivity, ID, ISODate, RecordStatus, ShiftCode, WallTime } from '@/types/entities'

export type ExtraActivityType = ExtraActivity['type']
export type ExtraActivityParticipant = ExtraActivity['participants'][number]

export interface ExtraActivityListParams {
  dateFrom?: ISODate
  dateTo?: ISODate
  classId?: ID
  type?: ExtraActivityType | ''
  instructorTeacherId?: ID
  shiftCode?: ShiftCode
  status?: RecordStatus | ''
  search?: string
  page?: number
  pageSize?: number
}

/** Body POST /extra-activities. Salah satu instructorTeacherId atau instructorName wajib. */
export interface ExtraActivityInput {
  name: string
  type: ExtraActivityType
  instructorTeacherId: ID | null
  instructorName: string | null
  date: ISODate
  shiftCode: ShiftCode
  startTime: WallTime | null
  endTime: WallTime | null
  classIds: ID[]
  topic: string | null
  note: string | null
  participantAttendanceEnabled: boolean
}

/** Body PATCH /extra-activities/:id. `reason` wajib bila kegiatan sudah FINAL. */
export type ExtraActivityPatch = Partial<ExtraActivityInput> & {
  version: number
  status?: 'FINAL'
  reason?: string
}

export interface ParticipantsInput {
  participants: { studentId: ID; status: AttendanceStatus }[]
  submit?: boolean
  version: number
  reason?: string
}
