import type { DutyAgenda } from '@/types/entities'
import type { CompletenessItem } from './types'

/**
 * Checklist kelengkapan agenda sebelum dikirim/finalisasi (PRD §9.3) — cermin validasi backend.
 * Backend tetap otoritas akhir (422 dengan detail).
 */
export function agendaChecklist(
  agenda: Pick<DutyAgenda, 'dutyTeacherIds' | 'absentTeachers' | 'notes' | 'noAbsentTeachers' | 'noImportantNotes'>,
): CompletenessItem[] {
  const missingReasons = agenda.absentTeachers.filter((r) => !r.reason?.trim())
  return [
    {
      key: 'dutyTeacherIds',
      label: 'Petugas piket tercatat',
      done: agenda.dutyTeacherIds.length > 0,
      hint: 'Petugas piket belum ditetapkan — hubungi admin untuk mengatur jadwal piket.',
    },
    {
      key: 'absentTeachers',
      label: 'Rekap guru tidak hadir',
      done: agenda.absentTeachers.length > 0 || agenda.noAbsentTeachers,
      hint: 'Catat status guru di Absensi Guru, atau tandai "Tidak ada guru yang tidak hadir".',
    },
    {
      key: 'absentReasons',
      label: 'Alasan setiap guru tidak hadir',
      done: missingReasons.length === 0,
      hint:
        missingReasons.length > 0
          ? `Alasan belum diisi: ${missingReasons.map((r) => r.teacherName).join(', ')}. Lengkapi di Absensi Guru.`
          : undefined,
    },
    {
      key: 'notes',
      label: 'Hal penting / kejadian',
      done: agenda.notes.length > 0 || agenda.noImportantNotes,
      hint: 'Tambahkan minimal satu catatan, atau tandai "Tidak ada catatan".',
    },
  ]
}

export const isAgendaComplete = (items: CompletenessItem[]) => items.every((i) => i.done)
