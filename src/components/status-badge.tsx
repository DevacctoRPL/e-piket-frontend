import type { EnumMeta, Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-tone-success-bg text-tone-success border-tone-success/25',
  warning: 'bg-tone-warning-bg text-tone-warning border-tone-warning/25',
  danger: 'bg-tone-danger-bg text-tone-danger border-tone-danger/25',
  info: 'bg-tone-info-bg text-tone-info border-tone-info/25',
  neutral: 'bg-tone-neutral-bg text-tone-neutral border-tone-neutral/20',
  purple: 'bg-tone-purple-bg text-tone-purple border-tone-purple/25',
}

const DOT_CLASS: Record<Tone, string> = {
  success: 'bg-tone-success',
  warning: 'bg-tone-warning',
  danger: 'bg-tone-danger',
  info: 'bg-tone-info',
  neutral: 'bg-tone-neutral',
  purple: 'bg-tone-purple',
}

/**
 * Badge status: SELALU menampilkan teks label (warna bukan satu-satunya indikator — PRD §8.1, §12).
 *   <StatusBadge meta={ATTENDANCE_META} value="SICK" />  →  "Sakit"
 */
export function StatusBadge<K extends string>({
  meta,
  value,
  showShort = false,
  className,
}: {
  meta: Record<K, EnumMeta>
  value: K | null | undefined
  /** Tampilkan kode singkat (S/I/A) di depan label. */
  showShort?: boolean
  className?: string
}) {
  if (!value) return <span className="text-muted-foreground">—</span>
  const m = meta[value]
  if (!m) return <span>{value}</span>
  return <ToneBadge tone={m.tone} className={className}>{showShort && m.short ? `${m.short} · ${m.label}` : m.label}</ToneBadge>
}

export function ToneBadge({
  tone,
  children,
  className,
}: {
  tone: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT_CLASS[tone])} />
      {children}
    </span>
  )
}
