import { z } from 'zod'
import { TEACHING_EXECUTIONS, TEACHING_PRESENCES, type TeachingLog } from '@/types/entities'
import type { TeachingLogContext, TeachingLogPayload } from './types'

const intString = /^\d+$/

/** Nilai form jurnal. Input angka disimpan sebagai string agar kosong ≠ 0 dan tidak muncul NaN. */
export const teachingLogFormSchema = z
  .object({
    // konteks (hanya diedit pada mode tanpa jadwal)
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal.'),
    classId: z.string(),
    subjectId: z.string(),
    shiftCode: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    // isi jurnal
    meetingNumber: z
      .string()
      .trim()
      .refine((v) => v === '' || (intString.test(v) && Number(v) >= 1), 'Isi angka pertemuan ≥ 1.'),
    topic: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    activity: z.string().trim().max(1000, 'Maksimal 1000 karakter.'),
    note: z.string().trim().max(1000, 'Maksimal 1000 karakter.'),
    teacherPresence: z.enum(TEACHING_PRESENCES),
    execution: z.enum(TEACHING_EXECUTIONS),
    notHeldReason: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    studentSick: z.string().trim().regex(intString, 'Isi angka 0 atau lebih.'),
    studentPermission: z.string().trim().regex(intString, 'Isi angka 0 atau lebih.'),
    studentAbsent: z.string().trim().regex(intString, 'Isi angka 0 atau lebih.'),
    overridePeriodCount: z.boolean(),
    periodCount: z.string().trim(),
    periodCountOverrideReason: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    /** Jumlah periode dari jadwal (tidak diedit; dipakai untuk validasi koreksi JML). */
    scheduledPeriodCount: z.number(),
    freeMode: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.freeMode) {
      if (!v.classId) issue('classId', 'Pilih kelas.')
      if (!v.subjectId) issue('subjectId', 'Pilih mata pelajaran.')
      if (!v.shiftCode) issue('shiftCode', 'Pilih shift.')
      if (!intString.test(v.periodStart) || Number(v.periodStart) < 1) issue('periodStart', 'Pilih jam mulai.')
      if (!intString.test(v.periodEnd) || Number(v.periodEnd) < 1) issue('periodEnd', 'Pilih jam selesai.')
      else if (Number(v.periodEnd) < Number(v.periodStart))
        issue('periodEnd', 'Jam selesai tidak boleh sebelum jam mulai.')
    }
    // PRD §9.2 & §9.3: materi atau alasan tidak mengajar wajib.
    if (v.execution === 'HELD' && !v.topic) issue('topic', 'Materi wajib diisi bila pertemuan terlaksana.')
    if (v.execution === 'NOT_HELD' && !v.notHeldReason)
      issue('notHeldReason', 'Alasan wajib diisi bila pertemuan tidak terlaksana.')
    // FR-TEACH-04: koreksi JML wajib alasan.
    if (v.overridePeriodCount) {
      if (!intString.test(v.periodCount)) issue('periodCount', 'Isi angka 0 atau lebih.')
      else if (Number(v.periodCount) !== scheduledCount(v) && v.periodCountOverrideReason.length < 3)
        issue('periodCountOverrideReason', 'Alasan koreksi JML wajib diisi (minimal 3 karakter).')
    }
  })

export type TeachingLogFormValues = z.infer<typeof teachingLogFormSchema>

/** JML menurut jadwal; untuk mode bebas dihitung dari rentang jam ke-. */
export function scheduledCount(v: Pick<TeachingLogFormValues, 'freeMode' | 'periodStart' | 'periodEnd' | 'scheduledPeriodCount'>) {
  if (!v.freeMode) return v.scheduledPeriodCount
  const s = Number(v.periodStart)
  const e = Number(v.periodEnd)
  return s >= 1 && e >= s ? e - s + 1 : 0
}

export function effectivePeriodCount(v: TeachingLogFormValues) {
  return v.overridePeriodCount && intString.test(v.periodCount) ? Number(v.periodCount) : scheduledCount(v)
}

export function defaultFormValues(
  ctx: TeachingLogContext | null,
  log: TeachingLog | null,
  options: { date: string; freeMode: boolean },
): TeachingLogFormValues {
  const scheduled = ctx ? ctx.periodEnd - ctx.periodStart + 1 : 0
  const base = log
  const overridden = !!base?.periodCountOverrideReason
  return {
    date: ctx?.date ?? options.date,
    classId: ctx?.classId ?? '',
    subjectId: ctx?.subjectId ?? '',
    shiftCode: ctx?.shiftCode ?? '',
    periodStart: ctx ? String(ctx.periodStart) : '',
    periodEnd: ctx ? String(ctx.periodEnd) : '',
    meetingNumber: base?.meetingNumber != null ? String(base.meetingNumber) : '',
    topic: base?.topic ?? '',
    activity: base?.activity ?? '',
    note: base?.note ?? '',
    teacherPresence: base?.teacherPresence ?? 'PRESENT',
    execution: base?.execution ?? 'HELD',
    notHeldReason: base?.notHeldReason ?? '',
    studentSick: String(base?.studentSick ?? 0),
    studentPermission: String(base?.studentPermission ?? 0),
    studentAbsent: String(base?.studentAbsent ?? 0),
    overridePeriodCount: overridden,
    periodCount: String(base?.periodCount ?? scheduled),
    periodCountOverrideReason: base?.periodCountOverrideReason ?? '',
    scheduledPeriodCount: scheduled,
    freeMode: options.freeMode,
  }
}

const orNull = (s: string) => (s.trim() ? s.trim() : null)

export function toPayload(v: TeachingLogFormValues, ctx: TeachingLogContext | null): TeachingLogPayload {
  const periodCount = effectivePeriodCount(v)
  const overridden = periodCount !== scheduledCount(v)
  return {
    date: v.freeMode ? v.date : (ctx?.date ?? v.date),
    timetableSlotId: ctx?.timetableSlotId ?? null,
    substitutionRecordId: ctx?.substitutionRecordId ?? null,
    classId: v.freeMode ? v.classId : (ctx?.classId ?? v.classId),
    subjectId: v.freeMode ? v.subjectId : (ctx?.subjectId ?? v.subjectId),
    shiftCode: v.freeMode ? v.shiftCode : (ctx?.shiftCode ?? v.shiftCode),
    periodStart: Number(v.periodStart),
    periodEnd: Number(v.periodEnd),
    periodCount,
    periodCountOverrideReason: overridden ? orNull(v.periodCountOverrideReason) : null,
    meetingNumber: v.meetingNumber ? Number(v.meetingNumber) : null,
    topic: orNull(v.topic),
    activity: orNull(v.activity),
    note: orNull(v.note),
    teacherPresence: v.teacherPresence,
    execution: v.execution,
    notHeldReason: v.execution === 'NOT_HELD' ? orNull(v.notHeldReason) : null,
    studentSick: Number(v.studentSick),
    studentPermission: Number(v.studentPermission),
    studentAbsent: Number(v.studentAbsent),
  }
}

/** Field form yang dapat menerima error 422 dari server. */
export const SERVER_FIELDS = [
  'classId',
  'subjectId',
  'shiftCode',
  'periodStart',
  'periodEnd',
  'meetingNumber',
  'topic',
  'activity',
  'note',
  'teacherPresence',
  'execution',
  'notHeldReason',
  'studentSick',
  'studentPermission',
  'studentAbsent',
  'periodCount',
  'periodCountOverrideReason',
] as const
