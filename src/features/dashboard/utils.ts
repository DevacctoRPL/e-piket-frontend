import type { AttendanceSummaryCounts, PendingTask } from '@/types/entities'
import { nowWallTime, wallTimeToMinutes } from '@/lib/date'

/** Salam sesuai jam dinding sekolah. */
export function greeting(now: Date = new Date()): string {
  const m = wallTimeToMinutes(nowWallTime(now))
  if (m < 11 * 60) return 'Selamat pagi'
  if (m < 15 * 60) return 'Selamat siang'
  if (m < 18 * 60 + 30) return 'Selamat sore'
  return 'Selamat malam'
}

/** Persentase bulat; null bila penyebut 0 (ditampilkan "—", bukan 0%). */
export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 100)
}

export function formatPercent(p: number | null): string {
  return p === null ? '—' : `${p}%`
}

/** Siswa hadir = Hadir + Terlambat (tetap hadir di kelas). */
export function presentCount(c: AttendanceSummaryCounts) {
  return c.PRESENT + c.LATE
}

/** Siswa yang sudah diberi status (dasar persentase kehadiran). */
export function markedCount(c: AttendanceSummaryCounts) {
  return Math.max(0, c.total - c.unmarked)
}

/** Urutan prioritas tugas: hal yang berdampak ke kelas berjalan ditampilkan lebih dulu. */
export const TASK_PRIORITY: Record<PendingTask['kind'], number> = {
  SUBSTITUTION_UNHANDLED: 0,
  DUTY_AGENDA_DRAFT: 1,
  ATTENDANCE_NOT_SUBMITTED: 2,
  CHECK_OUT_MISSING: 3,
  TEACHING_LOG_MISSING: 4,
}

export function sortTasks(tasks: PendingTask[]): PendingTask[] {
  return [...tasks].sort((a, b) => TASK_PRIORITY[a.kind] - TASK_PRIORITY[b.kind])
}

export function withQuery(path: string, params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `${path}?${s}` : path
}
