import { nowWallTime, wallTimeToMinutes } from '@/lib/date'
import type { PendingTask } from '@/types/entities'

/** Salam sesuai jam dinding sekolah. */
export function greeting(now: Date = new Date()): string {
  const m = wallTimeToMinutes(nowWallTime(now))
  if (m < 11 * 60) return 'Selamat pagi'
  if (m < 15 * 60) return 'Selamat siang'
  if (m < 18 * 60 + 30) return 'Selamat sore'
  return 'Selamat malam'
}

export function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 100)
}

export function formatPercent(p: number | null): string {
  return p === null ? '—' : `${p}%`
}

export const TASK_PRIORITY: Record<PendingTask['kind'], number> = {
  SUBSTITUTION_UNHANDLED: 0,
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
