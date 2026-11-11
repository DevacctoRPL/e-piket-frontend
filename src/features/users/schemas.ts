/** Validasi form akun (zod v4). Backend (mock) tetap memvalidasi ulang dan mengirim 422 per field. */
import { z } from 'zod'
import { TEACHER_LINK_ROLES } from '@/lib/permissions'
import { ROLES, type Role } from '@/types/entities'

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/

export function needsTeacherLink(roles: readonly Role[]) {
  return roles.some((r) => (TEACHER_LINK_ROLES as readonly Role[]).includes(r))
}

export const userFormSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Nama pengguna wajib diisi.')
      .regex(USERNAME_RE, '3-32 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.'),
    name: z.string().trim().min(1, 'Nama wajib diisi.').max(120, 'Maksimal 120 karakter.'),
    email: z
      .string()
      .trim()
      .max(120, 'Maksimal 120 karakter.')
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Format email tidak valid.'),
    roles: z.array(z.enum(ROLES)).min(1, 'Pilih minimal satu peran.'),
    teacherId: z.string(),
  })
  .superRefine((v, ctx) => {
    if (needsTeacherLink(v.roles) && !v.teacherId)
      ctx.addIssue({
        code: 'custom',
        path: ['teacherId'],
        message: 'Peran Guru, Guru Piket, dan Wali Kelas wajib ditautkan ke data guru.',
      })
  })
export type UserFormValues = z.input<typeof userFormSchema>
export type UserFormOutput = z.output<typeof userFormSchema>
