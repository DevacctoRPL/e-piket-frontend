import { z } from 'zod'

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} maksimal ${max} karakter.`)

/** Form "Catat konfirmasi" (FR-STU-06). Validasi akhir tetap di backend. */
export const contactSchema = z
  .object({
    contactedPhone: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\+?[\d\s-]+$/.test(v), 'Nomor hanya boleh berisi angka, spasi, -, atau +.')
      .refine((v) => {
        if (v === '') return true
        const digits = v.replace(/\D/g, '').length
        return digits >= 8 && digits <= 16
      }, 'Nomor telepon harus 8–16 digit.'),
    receiverName: optionalText(100, 'Pihak yang menerima'),
    contactNote: optionalText(500, 'Keterangan'),
  })
  .superRefine((v, ctx) => {
    if (v.contactedPhone && !v.receiverName) {
      ctx.addIssue({
        code: 'custom',
        path: ['receiverName'],
        message: 'Isi siapa yang menerima informasi dari nomor tersebut.',
      })
    }
    if (!v.contactedPhone && !v.receiverName && !v.contactNote) {
      ctx.addIssue({
        code: 'custom',
        path: ['receiverName'],
        message: 'Isi pihak yang menerima informasi atau keterangan.',
      })
    }
  })

export type ContactFormValues = z.infer<typeof contactSchema>

export const CONTACT_FIELDS = ['contactedPhone', 'receiverName', 'contactNote'] as const
