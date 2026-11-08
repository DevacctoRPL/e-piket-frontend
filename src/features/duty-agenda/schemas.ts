import { z } from 'zod'

/** Form catatan hal penting/kejadian (FR-DUTY-04). */
export const dutyNoteSchema = z.object({
  time: z
    .string()
    .min(1, 'Jam wajib diisi.')
    .regex(/^\d{2}:\d{2}$/, 'Format jam tidak valid.'),
  category: z.string(),
  content: z
    .string()
    .trim()
    .min(3, 'Uraian minimal 3 karakter.')
    .max(1000, 'Uraian maksimal 1000 karakter.'),
  correctionReason: z.string(),
})

export type DutyNoteFormValues = z.infer<typeof dutyNoteSchema>

/** Skema dengan alasan koreksi wajib (agenda FINAL). */
export const dutyNoteCorrectionSchema = dutyNoteSchema.extend({
  correctionReason: z.string().trim().min(3, 'Alasan koreksi wajib diisi (minimal 3 karakter).'),
})

export const SUBSTITUTION_SUMMARY_MAX = 2000
