import { z } from 'zod'
import { wallTimeToMinutes } from '@/lib/date'
import type { TeacherAttendanceStatus } from '@/types/entities'
import { TEACHER_ATTENDANCE_STATUSES } from '@/types/entities'

const WALL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const optionalTime = z
  .string()
  .trim()
  .refine((v) => v === '' || WALL_TIME_RE.test(v), 'Format jam tidak valid (JJ:MM).')

/**
 * Form "Catat status" (PRD §9.3 absensi guru): status wajib; alasan wajib untuk status yang
 * ditetapkan sekolah; jam datang ≤ jam pulang; koreksi data yang sudah ada wajib beralasan.
 */
export function recordStatusSchema(opts: {
  reasonRequired: readonly TeacherAttendanceStatus[]
  /** true bila record sudah ada (perubahan status/jam = koreksi → alasan koreksi wajib). */
  isCorrection: boolean
  initial?: { status: TeacherAttendanceStatus; checkIn: string; checkOut: string }
}) {
  return z
    .object({
      status: z.enum(TEACHER_ATTENDANCE_STATUSES, { error: 'Pilih status kehadiran.' }),
      reason: z.string().trim().max(500, 'Maksimal 500 karakter.'),
      checkIn: optionalTime,
      checkOut: optionalTime,
      correctionReason: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    })
    .superRefine((v, ctx) => {
      if (opts.reasonRequired.includes(v.status) && v.reason.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Alasan wajib diisi untuk status ini.' })
      }
      if (v.status === 'LATE' && !v.checkIn) {
        ctx.addIssue({ code: 'custom', path: ['checkIn'], message: 'Jam datang wajib diisi untuk status Terlambat.' })
      }
      if (v.checkOut && !v.checkIn) {
        ctx.addIssue({ code: 'custom', path: ['checkIn'], message: 'Isi jam datang sebelum jam pulang.' })
      }
      if (
        v.checkIn &&
        v.checkOut &&
        WALL_TIME_RE.test(v.checkIn) &&
        WALL_TIME_RE.test(v.checkOut) &&
        wallTimeToMinutes(v.checkIn) > wallTimeToMinutes(v.checkOut)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['checkOut'],
          message: 'Jam pulang tidak boleh lebih awal dari jam datang.',
        })
      }
      if (opts.isCorrection && opts.initial) {
        const changed =
          v.status !== opts.initial.status ||
          v.checkIn !== opts.initial.checkIn ||
          v.checkOut !== opts.initial.checkOut
        if (changed && v.correctionReason.length < 3) {
          ctx.addIssue({
            code: 'custom',
            path: ['correctionReason'],
            message: 'Alasan koreksi wajib diisi (minimal 3 karakter).',
          })
        }
      }
    })
}
export type RecordStatusValues = z.infer<ReturnType<typeof recordStatusSchema>>

/** Form "Koreksi jam terdampak" (FR-TCH-03): nilai ≥ 0 dan alasan wajib. */
export const overrideSchema = z.object({
  useComputed: z.boolean(),
  value: z
    .number({ error: 'Isi jumlah jam.' })
    .int('Harus bilangan bulat.')
    .min(0, 'Tidak boleh negatif.')
    .max(24, 'Jumlah jam terlalu besar.'),
  reason: z.string().trim().max(500, 'Maksimal 500 karakter.'),
}).superRefine((v, ctx) => {
  if (!v.useComputed && v.reason.length < 3) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Alasan koreksi wajib diisi (minimal 3 karakter).' })
  }
})
export type OverrideValues = z.infer<typeof overrideSchema>
