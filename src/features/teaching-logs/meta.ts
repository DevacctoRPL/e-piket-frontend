import type { EnumMeta } from '@/lib/enums'
import type { TeachingLog, TodayTeachingSlot } from '@/types/entities'
import type { SlotLogState, TeachingLogContext } from './types'

/** Status jurnal per slot jadwal hari ini (teks + warna). */
export const SLOT_LOG_META: Record<SlotLogState, EnumMeta> = {
  EMPTY: { label: 'Belum diisi', tone: 'warning' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  FINAL: { label: 'Final', tone: 'success' },
}

export function slotLogState(log: TeachingLog | null): SlotLogState {
  if (!log) return 'EMPTY'
  return log.status === 'FINAL' ? 'FINAL' : 'DRAFT'
}

export function periodLabel(start: number, end: number) {
  return start === end ? `Jam ke-${start}` : `Jam ke-${start}–${end}`
}

export function periodRange(start: number, end: number) {
  return start === end ? String(start) : `${start}–${end}`
}

/** Ringkasan kemajuan pengisian jurnal hari ini. */
export function todayProgress(slots: TodayTeachingSlot[]) {
  const total = slots.length
  const filled = slots.filter((s) => s.log !== null).length
  const final = slots.filter((s) => s.log?.status === 'FINAL').length
  return { total, filled, final, draft: filled - final }
}

/** Tautan untuk mengisi / membuka jurnal slot. */
export function slotHref(s: TodayTeachingSlot, date: string) {
  if (s.log) return `/jurnal-mengajar/${encodeURIComponent(s.log.id)}`
  const sp = new URLSearchParams({ slot: s.slot.id, date })
  return `/jurnal-mengajar/baru?${sp.toString()}`
}

/** Konteks form dari slot jadwal hari ini. */
export function contextFromSlot(s: TodayTeachingSlot, date: string): TeachingLogContext {
  return {
    date,
    timetableSlotId: s.slot.id,
    substitutionRecordId: s.substitutionRecordId,
    isSubstitution: s.isSubstitution,
    classId: s.slot.classId,
    className: s.className,
    subjectId: s.slot.subjectId,
    subjectName: s.subjectName,
    shiftCode: s.slot.shiftCode,
    periodStart: s.slot.periodStart,
    periodEnd: s.slot.periodEnd,
    startTime: s.startTime,
    endTime: s.endTime,
  }
}
