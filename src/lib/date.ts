import { env } from '@/config/env'
import type { ISODate, ISODateTime, WallTime } from '@/types/entities'

/**
 * Semua tanggal operasional mengikuti zona waktu sekolah (default Asia/Jakarta) — PRD §9.2, §11.3.
 * Jangan gunakan `new Date().toISOString().slice(0,10)` untuk "hari ini" (itu UTC).
 */
export const SCHOOL_TZ = env.timezone
const LOCALE = 'id-ID'

function partsInTz(date: Date, tz = SCHOOL_TZ) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value
  return map as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>
}

/** Tanggal hari ini (YYYY-MM-DD) di zona waktu sekolah. */
export function todayISO(now: Date = new Date()): ISODate {
  const p = partsInTz(now)
  return `${p.year}-${p.month}-${p.day}`
}

/** Jam dinding sekarang (HH:mm) di zona sekolah. */
export function nowWallTime(now: Date = new Date()): WallTime {
  const p = partsInTz(now)
  return `${p.hour}:${p.minute}`
}

/** Offset zona waktu sekolah dalam format ±HH:mm untuk sebuah instant. */
export function tzOffset(date: Date = new Date(), tz = SCHOOL_TZ): string {
  const p = partsInTz(date, tz)
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  const diffMin = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
  const sign = diffMin >= 0 ? '+' : '-'
  const abs = Math.abs(diffMin)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/** Instant → RFC 3339 dengan offset sekolah, mis. 2026-11-08T07:15:00+07:00. */
export function toISODateTime(date: Date = new Date()): ISODateTime {
  const p = partsInTz(date)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${tzOffset(date)}`
}

/** Gabungkan tanggal + jam dinding sekolah menjadi RFC 3339. */
export function combineDateTime(date: ISODate, time: WallTime): ISODateTime {
  const probe = new Date(`${date}T12:00:00Z`)
  return `${date}T${time}:00${tzOffset(probe)}`
}

/** Parse 'YYYY-MM-DD' sebagai tanggal kalender (tanpa pergeseran zona). */
function parseISODate(d: ISODate): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, day ?? 1, 12))
}

/** ISO day of week (1 = Senin … 7 = Minggu) untuk tanggal kalender. */
export function isoDayOfWeek(d: ISODate): number {
  const wd = parseISODate(d).getUTCDay()
  return wd === 0 ? 7 : wd
}

export function addDays(d: ISODate, days: number): ISODate {
  const dt = parseISODate(d)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`
}

export function endOfMonth(d: ISODate): ISODate {
  const dt = parseISODate(startOfMonth(d))
  dt.setUTCMonth(dt.getUTCMonth() + 1)
  dt.setUTCDate(0)
  return dt.toISOString().slice(0, 10)
}

/** Daftar tanggal inklusif. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(opts: Intl.DateTimeFormatOptions, tz: string) {
  const key = JSON.stringify(opts) + tz
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: tz })
    fmtCache.set(key, f)
  }
  return f
}

/** 'Sabtu, 8 November 2026' */
export function formatDateLong(d: ISODate): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, 'UTC').format(
    parseISODate(d),
  )
}

/** '8 Nov 2026' */
export function formatDate(d: ISODate | null | undefined): string {
  if (!d) return '—'
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }, 'UTC').format(parseISODate(d))
}

/** 'Sab, 8 Nov' */
export function formatDateShort(d: ISODate): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'short' }, 'UTC').format(parseISODate(d))
}

/** 'November 2026' */
export function formatMonth(d: ISODate): string {
  return fmt({ month: 'long', year: 'numeric' }, 'UTC').format(parseISODate(d))
}

export function dayName(isoDow: number): string {
  return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][isoDow - 1] ?? '—'
}

/** Timestamp → Date, atau null bila kosong/tidak valid (Intl.format melempar RangeError untuk Invalid Date). */
function toValidDate(ts: ISODateTime | null | undefined): Date | null {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Timestamp RFC 3339 → '07.15' di zona sekolah. */
export function formatTime(ts: ISODateTime | null | undefined): string {
  const d = toValidDate(ts)
  if (!d) return '—'
  return fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, SCHOOL_TZ).format(d)
}

/** Timestamp → '8 Nov 2026, 07.15' */
export function formatDateTime(ts: ISODateTime | null | undefined): string {
  const d = toValidDate(ts)
  if (!d) return '—'
  return fmt(
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
    SCHOOL_TZ,
  ).format(d)
}

/** Timestamp → 'YYYY-MM-DD' di zona sekolah. */
export function dateOf(ts: ISODateTime): ISODate {
  return todayISO(new Date(ts))
}

/** Timestamp → 'HH:mm' di zona sekolah (untuk value <input type="time">). */
export function wallTimeOf(ts: ISODateTime): WallTime {
  return nowWallTime(new Date(ts))
}

/** '07:00' → menit sejak tengah malam. */
export function wallTimeToMinutes(t: WallTime): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function formatWallTime(t: WallTime | null | undefined): string {
  return t ? t.replace(':', '.') : '—'
}
