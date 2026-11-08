import type { SchoolSettings, StatusConfig } from '@/types/entities'

/** Body PATCH /settings: semua field opsional kecuali version (optimistic locking). */
export type SettingsPatch = Partial<
  Pick<
    SchoolSettings,
    | 'schoolName'
    | 'schoolAddress'
    | 'letterheadLines'
    | 'principalName'
    | 'principalNip'
    | 'city'
    | 'teacherReasonRequiredStatuses'
    | 'dismissalRequiresPickup'
    | 'dutyNoteCategories'
  >
> & {
  attendanceStatuses?: StatusConfig[]
  version: number
}
