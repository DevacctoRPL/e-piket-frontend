import { z } from 'zod'

const MAX_TEXT = 500
const text = () => z.string().trim().max(MAX_TEXT, 'Maksimal 500 karakter.')

/**
 * Form penetapan guru pengganti (PRD §9.3: slot, guru pengganti, periode wajib).
 * Nilai periode berupa string (dari <select>) lalu dikonversi saat submit.
 * Aturan konflik (override + alasan) diperiksa di form karena bergantung pada kandidat terpilih.
 */
export function assignSchema(slot: { periodStart: number; periodEnd: number }) {
  return z
    .object({
      substituteTeacherId: z.string().min(1, 'Pilih guru pengganti.'),
      periodStart: z.string().min(1, 'Wajib diisi.'),
      periodEnd: z.string().min(1, 'Wajib diisi.'),
      periodCount: z.string().min(1, 'Wajib diisi.'),
      activity: text(),
      note: text(),
      overrideConflict: z.boolean(),
      overrideReason: text(),
    })
    .superRefine((v, ctx) => {
      const ps = Number(v.periodStart)
      const pe = Number(v.periodEnd)
      const pc = Number(v.periodCount)
      if (ps < slot.periodStart || pe > slot.periodEnd || ps > pe) {
        ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Jam akhir tidak boleh sebelum jam awal.' })
      } else if (!Number.isInteger(pc) || pc < 1 || pc > pe - ps + 1) {
        ctx.addIssue({ code: 'custom', path: ['periodCount'], message: `Jumlah jam antara 1 dan ${pe - ps + 1}.` })
      }
    })
}

export type AssignFormValues = z.input<ReturnType<typeof assignSchema>>

export function editSchema(maxPeriods: number) {
  return z.object({
    activity: text(),
    note: text(),
    periodCount: z
      .string()
      .refine(
        (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= maxPeriods,
        `Jumlah jam antara 1 dan ${maxPeriods}.`,
      ),
  })
}

export type EditFormValues = z.input<ReturnType<typeof editSchema>>
