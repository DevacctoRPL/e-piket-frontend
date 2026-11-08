import { z } from 'zod'
import { ATTENDANCE_STATUSES } from '@/types/entities'

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Satu baris absensi di editor (PRD §9.3). Kewajiban alasan per status dicek terpisah (konfigurasi sekolah). */
export const rowDraftSchema = z
  .object({
    status: z.enum(ATTENDANCE_STATUSES, { message: 'Status absensi wajib dipilih.' }),
    reason: z.string().max(500, 'Alasan terlalu panjang (maks. 500 karakter).'),
    note: z.string().max(500, 'Catatan terlalu panjang (maks. 500 karakter).'),
    arrivalTime: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'LATE' && v.arrivalTime && !WALL_TIME.test(v.arrivalTime)) {
      ctx.addIssue({ code: 'custom', path: ['arrivalTime'], message: 'Format jam tidak valid (JJ:MM).' })
    }
  })

/** Form koreksi satu record pada sesi final. */
export const correctionSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES, { message: 'Status absensi wajib dipilih.' }),
  reason: z.string().max(500, 'Alasan terlalu panjang.'),
  note: z.string().max(500, 'Catatan terlalu panjang.'),
  arrivalTime: z.string().refine((v) => !v || WALL_TIME.test(v), 'Format jam tidak valid (JJ:MM).'),
  correctionReason: z.string().trim().min(3, 'Alasan koreksi wajib diisi (minimal 3 karakter).'),
})
export type CorrectionValues = z.infer<typeof correctionSchema>

/** Filter histori siswa. */
export const historyFilterSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((v) => v.from <= v.to, { path: ['to'], message: 'Tanggal akhir harus setelah tanggal awal.' })
