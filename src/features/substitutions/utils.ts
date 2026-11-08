import { ApiError } from '@/lib/api-client'
import { SUBSTITUTION_CONFLICT_META, SUBSTITUTION_RECORD_META } from '@/lib/enums'
import type { SubstitutionConflict } from '@/types/entities'

/** Alias lokal untuk meta bersama di lib/enums. */
export const RECORD_META = SUBSTITUTION_RECORD_META
export const CONFLICT_META = SUBSTITUTION_CONFLICT_META

/** 'jam ke-1–2' / 'jam ke-3' */
export function periodLabel(start: number, end: number) {
  return start === end ? `Jam ke-${start}` : `Jam ke-${start}–${end}`
}

/** Daftar angka inklusif [from..to]. */
export function rangeOf(from: number, to: number): number[] {
  const out: number[] = []
  for (let n = from; n <= to; n++) out.push(n)
  return out
}

const CONFLICT_TYPES = new Set<string>(['TEACHER_BUSY', 'TEACHER_ABSENT', 'SLOT_ALREADY_HANDLED'])

/**
 * Konflik dari 409 SCHEDULE_CONFLICT. Backend mengirim details datar:
 * { 'conflicts.0.type': 'TEACHER_BUSY', 'conflicts.0.message': '…', 'conflicts.0.timetableSlotId': '…' }.
 */
export function conflictsFromError(error: unknown): SubstitutionConflict[] {
  if (!(error instanceof ApiError) || error.code !== 'SCHEDULE_CONFLICT') return []
  const byIndex = new Map<number, Partial<SubstitutionConflict>>()
  for (const [key, value] of Object.entries(error.details)) {
    const m = /^conflicts\.(\d+)\.(type|message|timetableSlotId)$/.exec(key)
    if (!m) continue
    const idx = Number(m[1])
    const entry = byIndex.get(idx) ?? {}
    if (m[2] === 'type' && CONFLICT_TYPES.has(value)) entry.type = value as SubstitutionConflict['type']
    else if (m[2] === 'message') entry.message = value
    else if (m[2] === 'timetableSlotId') entry.timetableSlotId = value
    byIndex.set(idx, entry)
  }
  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, c]) => ({ type: c.type ?? 'TEACHER_BUSY', message: c.message ?? 'Jadwal bentrok.', timetableSlotId: c.timetableSlotId }))
}

export function isApiCode(error: unknown, ...codes: string[]) {
  return error instanceof ApiError && codes.includes(error.code)
}
