import {
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock3,
  type LucideIcon,
} from 'lucide-react'
import { Children, isValidElement, type ReactNode } from 'react'
import type { EnumMeta, Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'

/** Permukaan badge yang tenang: latar tipis + tepi semantik lembut + teks kontras tinggi. */
const TONE_SURFACE: Record<Tone, string> = {
  success: 'border-tone-success/25 bg-tone-success-bg text-tone-success',
  warning: 'border-tone-warning/30 bg-tone-warning-bg text-tone-warning',
  danger: 'border-tone-danger/25 bg-tone-danger-bg text-tone-danger',
  info: 'border-tone-info/25 bg-tone-info-bg text-tone-info',
  neutral: 'border-border/85 bg-muted/55 text-foreground/80',
  purple: 'border-tone-purple/25 bg-tone-purple-bg text-tone-purple',
}

/** Warna ikon mengikuti tone semantik. */
const ICON_TONE: Record<Tone, string> = {
  success: 'text-tone-success',
  warning: 'text-tone-warning',
  danger: 'text-tone-danger',
  info: 'text-tone-info',
  neutral: 'text-muted-foreground',
  purple: 'text-tone-purple',
}

/** Ikon bawaan per tone bila meta tidak menyediakan ikon spesifik. */
const TONE_ICON: Record<Tone, LucideIcon> = {
  success: CircleCheck,
  warning: Clock3,
  danger: CircleX,
  info: CircleDot,
  neutral: CircleDashed,
  purple: CircleDot,
}

/** Kelas statis untuk ikon sisipan pemanggil. */
const CHILD_ICON_TONE: Record<Tone, string> = {
  success: '[&>svg]:text-tone-success',
  warning: '[&>svg]:text-tone-warning',
  danger: '[&>svg]:text-tone-danger',
  info: '[&>svg]:text-tone-info',
  neutral: '[&>svg]:text-muted-foreground',
  purple: '[&>svg]:text-tone-purple',
}

/** Pemanggil yang sudah menyisipkan komponen ikon (mis. <ShieldCheck />) tidak perlu ikon bawaan. */
function hasOwnIcon(children: ReactNode) {
  return Children.toArray(children).some((c) => isValidElement(c) && typeof c.type !== 'string')
}

/**
 * Badge status persegi membulat halus (rounded-md) dengan warna teredam dan tanpa titik otomatis.
 * Teks label SELALU tampil — warna bukan satu-satunya indikator (PRD §8.1, §12).
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
  return (
    <ToneBadge tone={m.tone} icon={m.icon} className={className}>
      {showShort && m.short ? `${m.short} · ${m.label}` : m.label}
    </ToneBadge>
  )
}

export function ToneBadge({
  tone,
  icon,
  children,
  className,
}: {
  tone: Tone
  /** Ganti ikon bawaan tone. */
  icon?: LucideIcon
  /** @deprecated tidak berpengaruh; dipertahankan untuk kompatibilitas pemanggil lama. */
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  const Icon = icon ?? TONE_ICON[tone]
  const custom = hasOwnIcon(children)
  return (
    <span
      data-slot="status"
      data-tone={tone}
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_SURFACE[tone],
        '[&>svg]:size-3.5 [&>svg]:shrink-0',
        CHILD_ICON_TONE[tone],
        className,
      )}
    >
      {!custom && <Icon aria-hidden className={cn('size-3.5 shrink-0', ICON_TONE[tone])} />}
      {children}
    </span>
  )
}

/**
 * Label metadata statis (peran, kategori, shift, label hari) — tag netral monokrom, bukan status.
 */
export function MetaTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1 rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground/80',
        className,
      )}
    >
      {children}
    </span>
  )
}
