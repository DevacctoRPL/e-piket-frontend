import type { ID, ISODate, ScheduledTeacherRow, SubstitutionRecord, SubstitutionSlot } from '@/types/entities'

export type { ScheduledTeacherRow, SubstitutionRecord, SubstitutionSlot }

export interface CreateManualEmptySlotInput {
  date: ISODate
  classId: ID
  subjectId?: ID | null
  subjectName?: string | null
  periodStart: number
  periodEnd: number
  absentTeacherId?: ID | null
  absentTeacherName: string
  substituteTeacherId?: ID | null
  substituteTeacherName: string
  activity?: string | null
  note?: string | null
}

export interface UpdateManualEmptySlotInput {
  classId?: ID
  subjectId?: ID | null
  subjectName?: string | null
  periodStart?: number
  periodEnd?: number
  absentTeacherId?: ID | null
  absentTeacherName?: string
  substituteTeacherId?: ID | null
  substituteTeacherName?: string
  activity?: string | null
  note?: string | null
}

export interface AssignEmptySlotInput {
  date: ISODate
  timetableSlotId?: ID | null
  manualSlotId?: ID | null
  substituteTeacherId?: ID | null
  substituteTeacherName: string
  activity?: string | null
  note?: string | null
}

export interface UpdateSubstitutionInput {
  substituteTeacherId?: ID | null
  substituteTeacherName?: string
  activity?: string | null
  note?: string | null
}
