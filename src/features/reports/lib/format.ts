import { endOfMonth, formatDate, formatDateLong, formatMonth, startOfMonth } from '@/lib/date'

const numberFmt = new Intl.NumberFormat('id-ID')
const pctFmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const formatNumber = (n: number) => numberFmt.format(n)

/** Angka persen dari server (sudah dibulatkan) → '95,2%'. null → '—'. */
export const formatPercent = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${pctFmt.format(v)}%`

/** Periode untuk nama file: tanggal tunggal, YYYY-MM (bulan penuh), atau rentang. */
export function periodSlug(from: string, to: string): string {
  if (from === to) return from
  if (from === startOfMonth(from) && to === endOfMonth(from)) return from.slice(0, 7)
  return `${from}_${to}`
}

/** Label periode untuk tampilan & cetak. */
export function periodLabel(from: string, to: string): string {
  if (from === to) return formatDateLong(from)
  if (from === startOfMonth(from) && to === endOfMonth(from)) return formatMonth(from)
  return `${formatDate(from)} – ${formatDate(to)}`
}

/** 'Jam ke-1–2' */
export const periodRange = (start: number, end: number) => (start === end ? `${start}` : `${start}–${end}`)
