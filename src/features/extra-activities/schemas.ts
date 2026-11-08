import { z } from 'zod'
import type { ExtraActivity } from '@/types/entities'
import type { ExtraActivityInput } from './types'

/** Nilai khusus pada pilihan pengampu untuk pengampu dari luar sekolah. */
export const EXTERNAL_INSTRUCTOR = '__external__'

const time = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam tidak valid.')])

export const activitySchema = z
  .object({
    name: z.string().trim().min(1, 'Nama kegiatan wajib diisi.').max(150, 'Maksimal 150 karakter.'),
    type: z.enum(['COURSE', 'EXTRA_HOURS', 'OTHER'], { message: 'Pilih jenis kegiatan.' }),
    instructorTeacherId: z.string().min(1, 'Pilih pengampu.'),
    instructorName: z.string().trim().max(150, 'Maksimal 150 karakter.'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal wajib diisi.'),
    shiftCode: z.string().min(1, 'Pilih shift.'),
    startTime: time,
    endTime: time,
    classIds: z.array(z.string()).min(1, 'Pilih minimal satu kelas peserta.'),
    topic: z.string().trim().max(500, 'Maksimal 500 karakter.'),
    note: z.string().trim().max(1000, 'Maksimal 1000 karakter.'),
    participantAttendanceEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.instructorTeacherId === EXTERNAL_INSTRUCTOR && !v.instructorName) {
      ctx.addIssue({ code: 'custom', path: ['instructorName'], message: 'Nama pengampu wajib diisi.' })
    }
    if (Boolean(v.startTime) !== Boolean(v.endTime)) {
      ctx.addIssue({
        code: 'custom',
        path: [v.startTime ? 'endTime' : 'startTime'],
        message: 'Isi jam mulai dan jam selesai, atau kosongkan keduanya.',
      })
    } else if (v.startTime && v.endTime && v.startTime >= v.endTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Jam selesai harus setelah jam mulai.' })
    }
  })

export type ActivityFormValues = z.infer<typeof activitySchema>

export const ACTIVITY_FIELDS = [
  'name',
  'type',
  'instructorTeacherId',
  'instructorName',
  'date',
  'shiftCode',
  'startTime',
  'endTime',
  'classIds',
  'topic',
  'note',
  'participantAttendanceEnabled',
] as const satisfies readonly (keyof ActivityFormValues)[]

export function toFormValues(a: ExtraActivity): ActivityFormValues {
  return {
    name: a.name,
    type: a.type,
    instructorTeacherId: a.instructorTeacherId ?? EXTERNAL_INSTRUCTOR,
    instructorName: a.instructorTeacherId ? '' : a.instructorName,
    date: a.date,
    shiftCode: a.shiftCode,
    startTime: a.startTime ?? '',
    endTime: a.endTime ?? '',
    classIds: [...a.classIds],
    topic: a.topic ?? '',
    note: a.note ?? '',
    participantAttendanceEnabled: a.participantAttendanceEnabled,
  }
}

export function toInput(v: ActivityFormValues): ExtraActivityInput {
  const external = v.instructorTeacherId === EXTERNAL_INSTRUCTOR
  return {
    name: v.name,
    type: v.type,
    instructorTeacherId: external ? null : v.instructorTeacherId,
    instructorName: external ? v.instructorName : null,
    date: v.date,
    shiftCode: v.shiftCode,
    startTime: v.startTime || null,
    endTime: v.endTime || null,
    classIds: v.classIds,
    topic: v.topic || null,
    note: v.note || null,
    participantAttendanceEnabled: v.participantAttendanceEnabled,
  }
}
