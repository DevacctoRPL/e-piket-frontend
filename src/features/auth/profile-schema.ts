import { z } from 'zod'

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi.').max(120, 'Maksimal 120 karakter.'),
  email: z
    .string()
    .trim()
    .max(120, 'Maksimal 120 karakter.')
    .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Format email tidak valid.'),
})

export type ProfileFormValues = z.input<typeof profileSchema>
