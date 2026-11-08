import { z } from 'zod'
import {
  ATTENDANCE_STATUSES,
  TEACHER_ATTENDANCE_STATUSES,
  type SchoolSettings,
} from '@/types/entities'
import type { SettingsPatch } from './types'

const statusConfigSchema = z.object({
  code: z.enum(ATTENDANCE_STATUSES),
  label: z.string().trim().min(1, 'Label wajib diisi.').max(40, 'Maksimal 40 karakter.'),
  shortCode: z
    .string()
    .trim()
    .min(1, 'Wajib diisi.')
    .max(3, 'Maks. 3 karakter.')
    .regex(/^[A-Za-z0-9]+$/, 'Hanya huruf/angka.'),
  requiresReason: z.boolean(),
  active: z.boolean(),
})

export const settingsFormSchema = z
  .object({
    schoolName: z.string().trim().min(1, 'Nama sekolah wajib diisi.').max(120, 'Maksimal 120 karakter.'),
    schoolAddress: z.string().trim().max(200, 'Maksimal 200 karakter.'),
    city: z.string().trim().min(1, 'Kota wajib diisi (dipakai pada tanda tangan cetak).').max(60, 'Maksimal 60 karakter.'),
    principalName: z.string().trim().min(1, 'Nama kepala sekolah wajib diisi.').max(120, 'Maksimal 120 karakter.'),
    principalNip: z
      .string()
      .trim()
      .max(30, 'Maksimal 30 karakter.')
      .regex(/^[0-9 ]*$/, 'NIP hanya boleh berisi angka.'),
    letterheadLines: z
      .array(z.object({ value: z.string().trim().min(1, 'Baris kop tidak boleh kosong.').max(120, 'Maksimal 120 karakter.') }))
      .min(1, 'Kop cetak minimal berisi satu baris.')
      .max(6, 'Kop cetak maksimal 6 baris.'),
    attendanceStatuses: z.array(statusConfigSchema),
    teacherReasonRequiredStatuses: z.array(z.enum(TEACHER_ATTENDANCE_STATUSES)),
    dismissalRequiresPickup: z.boolean(),
    dutyNoteCategories: z
      .array(z.string().trim().min(1).max(30, 'Nama kategori maksimal 30 karakter.'))
      .min(1, 'Minimal satu kategori catatan.')
      .max(20, 'Maksimal 20 kategori.'),
  })
  .superRefine((v, ctx) => {
    v.attendanceStatuses.forEach((s, i) => {
      if (s.code === 'PRESENT' && !s.active) {
        ctx.addIssue({ code: 'custom', path: ['attendanceStatuses', i, 'active'], message: 'Status Hadir tidak dapat dinonaktifkan.' })
      }
      const dup = v.attendanceStatuses.findIndex(
        (o, j) => j !== i && o.shortCode.trim().toUpperCase() === s.shortCode.trim().toUpperCase(),
      )
      if (dup !== -1 && s.shortCode.trim()) {
        ctx.addIssue({ code: 'custom', path: ['attendanceStatuses', i, 'shortCode'], message: 'Kode sudah dipakai.' })
      }
    })
    const lower = v.dutyNoteCategories.map((c) => c.trim().toLowerCase())
    if (new Set(lower).size !== lower.length) {
      ctx.addIssue({ code: 'custom', path: ['dutyNoteCategories'], message: 'Kategori tidak boleh ganda.' })
    }
  })

export type SettingsFormValues = z.input<typeof settingsFormSchema>

/** Bagian form → tab, untuk menunjukkan tab yang berisi error. */
export const SECTION_FIELDS = {
  identitas: ['schoolName', 'schoolAddress', 'city', 'principalName', 'principalNip', 'letterheadLines'],
  'status-absensi': ['attendanceStatuses'],
  'aturan-guru': ['teacherReasonRequiredStatuses'],
  kepulangan: ['dismissalRequiresPickup'],
  'kategori-piket': ['dutyNoteCategories'],
} as const satisfies Record<string, readonly (keyof SettingsFormValues)[]>

export type SettingsSection = keyof typeof SECTION_FIELDS

export function toFormValues(s: SchoolSettings): SettingsFormValues {
  // Urutan status mengikuti enum agar tabel stabil.
  const statuses = ATTENDANCE_STATUSES.map((code) => s.attendanceStatuses.find((x) => x.code === code)).filter(
    (x): x is NonNullable<typeof x> => !!x,
  )
  return {
    schoolName: s.schoolName,
    schoolAddress: s.schoolAddress,
    city: s.city,
    principalName: s.principalName,
    principalNip: s.principalNip,
    letterheadLines: s.letterheadLines.map((value) => ({ value })),
    attendanceStatuses: statuses.map((x) => ({ ...x })),
    teacherReasonRequiredStatuses: [...s.teacherReasonRequiredStatuses],
    dismissalRequiresPickup: s.dismissalRequiresPickup,
    dutyNoteCategories: [...s.dutyNoteCategories],
  }
}

export function toPatch(v: SettingsFormValues, version: number): SettingsPatch {
  return {
    schoolName: v.schoolName.trim(),
    schoolAddress: v.schoolAddress.trim(),
    city: v.city.trim(),
    principalName: v.principalName.trim(),
    principalNip: v.principalNip.replace(/\s+/g, ''),
    letterheadLines: v.letterheadLines.map((l) => l.value.trim()),
    attendanceStatuses: v.attendanceStatuses.map((s) => ({
      code: s.code,
      label: s.label.trim(),
      shortCode: s.shortCode.trim().toUpperCase(),
      requiresReason: s.requiresReason,
      active: s.active,
    })),
    teacherReasonRequiredStatuses: TEACHER_ATTENDANCE_STATUSES.filter((s) => v.teacherReasonRequiredStatuses.includes(s)),
    dismissalRequiresPickup: v.dismissalRequiresPickup,
    dutyNoteCategories: v.dutyNoteCategories.map((c) => c.trim()),
    version,
  }
}
