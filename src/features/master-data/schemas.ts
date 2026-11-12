/**
 * Validasi form data master (zod v4). Backend (mock) tetap memvalidasi ulang dan mengirim 422 per field.
 */
import { z } from 'zod'
import { wallTimeToMinutes } from '@/lib/date'

const req = (label: string) => z.string().trim().min(1, `${label} wajib diisi.`)
const date = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} wajib diisi.`)
const time = (label: string) =>
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} wajib diisi (format JJ:MM).`)
const int = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} wajib diisi.` })
    .int(`${label} harus bilangan bulat.`)
    .min(min, `${label} minimal ${min}.`)
    .max(max, `${label} maksimal ${max}.`)
const phone = z
  .string()
  .trim()
  .refine((v) => v === '' || v.includes('*') || /^\+?[\d\s-]{8,18}$/.test(v), 'Nomor telepon tidak valid.')

/* ------------------------------------------------------------------ tahun ajaran */

export const academicYearSchema = z
  .object({
    name: req('Nama tahun ajaran').regex(/^\d{4}\/\d{4}$/, 'Gunakan format 2026/2027.'),
    startDate: date('Tanggal mulai'),
    endDate: date('Tanggal selesai'),
    sem1Start: date('Mulai Ganjil'),
    sem1End: date('Selesai Ganjil'),
    sem2Start: date('Mulai Genap'),
    sem2End: date('Selesai Genap'),
  })
  .superRefine((v, ctx) => {
    if (v.endDate <= v.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Tanggal selesai harus setelah tanggal mulai.' })
    if (v.sem1End <= v.sem1Start)
      ctx.addIssue({ code: 'custom', path: ['sem1End'], message: 'Harus setelah tanggal mulai semester.' })
    if (v.sem2End <= v.sem2Start)
      ctx.addIssue({ code: 'custom', path: ['sem2End'], message: 'Harus setelah tanggal mulai semester.' })
    if (v.sem2Start <= v.sem1End)
      ctx.addIssue({ code: 'custom', path: ['sem2Start'], message: 'Genap dimulai setelah Ganjil berakhir.' })
    if (v.sem1Start < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['sem1Start'], message: 'Di luar rentang tahun ajaran.' })
    if (v.sem2End > v.endDate)
      ctx.addIssue({ code: 'custom', path: ['sem2End'], message: 'Di luar rentang tahun ajaran.' })
  })
export type AcademicYearForm = z.infer<typeof academicYearSchema>

/* ------------------------------------------------------------------ kelas */

export const classSchema = z.object({
  name: req('Nama kelas').max(40, 'Maksimal 40 karakter.'),
  grade: int('Tingkat', 1, 13),
  program: req('Program/kompetensi').max(120, 'Maksimal 120 karakter.'),
  shiftCode: req('Shift'),
  homeroomTeacherId: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})
export type ClassForm = z.infer<typeof classSchema>

/* ------------------------------------------------------------------ siswa */

export const studentSchema = z
  .object({
    nis: req('NIS')
      .max(20, 'Maksimal 20 karakter.')
      .regex(/^[A-Za-z0-9.-]+$/, 'NIS hanya huruf, angka, titik, atau tanda hubung.'),
    name: req('Nama siswa').max(120, 'Maksimal 120 karakter.'),
    gender: z.enum(['L', 'P'], { error: 'Pilih jenis kelamin.' }),
    classId: req('Kelas'),
    status: z.enum(['ACTIVE', 'INACTIVE']),
    inactiveFrom: z.string(),
    guardianName: z.string().trim().max(120, 'Maksimal 120 karakter.'),
    guardianPhone: phone,
  })
  .superRefine((v, ctx) => {
    if (v.status === 'INACTIVE' && !/^\d{4}-\d{2}-\d{2}$/.test(v.inactiveFrom)) {
      ctx.addIssue({ code: 'custom', path: ['inactiveFrom'], message: 'Tanggal efektif nonaktif wajib diisi.' })
    }
  })
export type StudentForm = z.infer<typeof studentSchema>

/* ------------------------------------------------------------------ guru */

export const teacherSchema = z.object({
  nip: req('NIP/nomor pegawai')
    .max(30, 'Maksimal 30 karakter.')
    .regex(/^[A-Za-z0-9.-]+$/, 'Hanya huruf, angka, titik, atau tanda hubung.'),
  code: z
    .string()
    .trim()
    .max(16, 'Maksimal 16 karakter.')
    .refine((v) => v === '' || /^[A-Za-z0-9.-]+$/.test(v), 'Kode hanya huruf, angka, titik, atau tanda hubung.'),
  name: req('Nama guru').max(120, 'Maksimal 120 karakter.'),
  phone,
  subjectIds: z.array(z.string()),
  attendanceDays: z.array(z.number().int().min(1).max(6)),
  status: z.enum(['ACTIVE', 'INACTIVE']),
})
export type TeacherForm = z.infer<typeof teacherSchema>

/* ------------------------------------------------------------------ mapel */

export const subjectSchema = z.object({
  code: req('Kode')
    .max(12, 'Maksimal 12 karakter.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Kode hanya huruf/angka tanpa spasi.'),
  name: req('Nama mata pelajaran').max(80, 'Maksimal 80 karakter.'),
})
export type SubjectForm = z.infer<typeof subjectSchema>

/* ------------------------------------------------------------------ shift & periode */

const timeOrder = (v: { startTime: string; endTime: string }, ctx: z.RefinementCtx) => {
  if (wallTimeToMinutes(v.endTime) <= wallTimeToMinutes(v.startTime)) {
    ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'Jam selesai harus setelah jam mulai.' })
  }
}

export const shiftSchema = z
  .object({
    code: req('Kode shift')
      .max(20, 'Maksimal 20 karakter.')
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Diawali huruf; hanya huruf, angka, garis bawah.'),
    name: req('Nama shift').max(40, 'Maksimal 40 karakter.'),
    startTime: time('Jam mulai'),
    endTime: time('Jam selesai'),
    lateToleranceMinutes: int('Toleransi', 0, 120),
    isActive: z.boolean(),
  })
  .superRefine(timeOrder)
export type ShiftForm = z.infer<typeof shiftSchema>

export const periodSchema = z
  .object({
    shiftCode: req('Shift'),
    number: int('Jam ke-', 1, 20),
    startTime: time('Jam mulai'),
    endTime: time('Jam selesai'),
  })
  .superRefine(timeOrder)
export type PeriodForm = z.infer<typeof periodSchema>

/* ------------------------------------------------------------------ jadwal */

export const timetableSchema = z
  .object({
    dayOfWeek: int('Hari', 1, 7),
    shiftCode: req('Shift'),
    classId: req('Kelas'),
    subjectId: req('Mata pelajaran'),
    teacherId: req('Guru'),
    periodStart: int('Jam awal', 1, 20),
    periodEnd: int('Jam akhir', 1, 20),
  })
  .superRefine((v, ctx) => {
    if (v.periodEnd < v.periodStart) {
      ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Jam akhir tidak boleh sebelum jam awal.' })
    }
  })
export type TimetableForm = z.infer<typeof timetableSchema>

/* ------------------------------------------------------------------ piket */

export const dutySchema = z
  .object({
    kind: z.enum(['routine', 'override']),
    dayOfWeek: z.number(),
    date: z.string(),
    shiftCode: req('Shift'),
    teacherIds: z.array(z.string()).min(1, 'Pilih minimal satu guru piket.').max(10, 'Maksimal 10 guru.'),
    note: z.string().trim().max(300, 'Maksimal 300 karakter.'),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'routine' && !(v.dayOfWeek >= 1 && v.dayOfWeek <= 7)) {
      ctx.addIssue({ code: 'custom', path: ['dayOfWeek'], message: 'Pilih hari.' })
    }
    if (v.kind === 'override' && !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Tanggal wajib diisi.' })
    }
  })
export type DutyForm = z.infer<typeof dutySchema>
