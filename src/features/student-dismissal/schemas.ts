import { z } from 'zod'
import { DISMISSAL_TYPES } from '@/types/entities'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Formulir kepulangan (PRD §9.3): siswa, tanggal, waktu keluar, jenis wajib;
 * penjemput wajib bila kebijakan sekolah meminta (untuk pulang normal / lebih awal);
 * catatan wajib untuk pulang lebih awal; waktu kembali harus setelah waktu keluar.
 */
export function dismissalFormSchema({ requiresPickup }: { requiresPickup: boolean }) {
  return z
    .object({
      classId: z.string().min(1, 'Pilih kelas.'),
      studentId: z.string().min(1, 'Pilih siswa.'),
      type: z.enum(DISMISSAL_TYPES, { error: 'Pilih jenis kepulangan.' }),
      exitTime: z.string().regex(TIME_RE, 'Isi waktu keluar (JJ:MM).'),
      returnTime: z.string(),
      pickupName: z.string().trim().max(100, 'Maksimal 100 karakter.'),
      pickupRelation: z.string().trim().max(100, 'Maksimal 100 karakter.'),
      note: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    })
    .superRefine((v, ctx) => {
      const needsPickup = requiresPickup && (v.type === 'NORMAL' || v.type === 'EARLY_LEAVE')
      if (needsPickup && !v.pickupName) {
        ctx.addIssue({
          code: 'custom',
          path: ['pickupName'],
          message: 'Nama penjemput/penerima wajib diisi sesuai kebijakan sekolah.',
        })
      }
      if (v.type === 'EARLY_LEAVE' && !v.note) {
        ctx.addIssue({ code: 'custom', path: ['note'], message: 'Tuliskan alasan pulang lebih awal.' })
      }
      if (v.type === 'TEMPORARY_EXIT' && v.returnTime) {
        if (!TIME_RE.test(v.returnTime)) {
          ctx.addIssue({ code: 'custom', path: ['returnTime'], message: 'Format jam tidak valid.' })
        } else if (TIME_RE.test(v.exitTime) && v.returnTime <= v.exitTime) {
          ctx.addIssue({
            code: 'custom',
            path: ['returnTime'],
            message: 'Waktu kembali harus setelah waktu keluar.',
          })
        }
      }
    })
}

export type DismissalFormValues = z.infer<ReturnType<typeof dismissalFormSchema>>

export const DISMISSAL_FORM_FIELDS = [
  'classId',
  'studentId',
  'type',
  'exitTime',
  'returnTime',
  'pickupName',
  'pickupRelation',
  'note',
] as const
