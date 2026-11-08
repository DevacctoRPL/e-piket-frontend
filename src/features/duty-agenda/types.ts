import type { DutyAgenda, ID, ISODate, ISODateTime, RecordStatus, ShiftCode } from '@/types/entities'

/** Agenda pratinjau (belum dibuat) dari GET /duty-agendas/today: id = null. */
export type DutyAgendaPreview = Omit<DutyAgenda, 'id'> & { id: ID | null }

/** Satu entri per shift dari GET /duty-agendas/today (FR-DUTY-02). */
export interface TodayDutyAgenda {
  date: ISODate
  shiftCode: ShiftCode
  agenda: DutyAgendaPreview
  /** User adalah petugas piket shift ini hari ini. */
  isDutyTeacher: boolean
  /** User boleh membuat agenda (belum ada & berwenang). */
  canCreate: boolean
}

export interface DutyAgendaListParams {
  dateFrom?: ISODate
  dateTo?: ISODate
  shiftCode?: ShiftCode
  status?: RecordStatus | ''
  page?: number
  pageSize?: number
}

export interface DutyAgendaPatch {
  noAbsentTeachers?: boolean
  noImportantNotes?: boolean
  substitutionSummary?: string | null
  version: number
  /** Wajib bila agenda FINAL (koreksi, hak duty_agenda:correct). */
  correctionReason?: string
  /** Koreksi: perbarui snapshot guru tidak hadir dari data absensi terbaru. */
  refreshSnapshot?: boolean
}

export interface DutyNoteInput {
  time: ISODateTime
  category: string | null
  content: string
  correctionReason?: string
}

/** Item checklist kelengkapan sebelum finalisasi (PRD §9.3). */
export interface CompletenessItem {
  key: string
  label: string
  done: boolean
  hint?: string
}
