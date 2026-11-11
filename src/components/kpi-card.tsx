import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Sparkline } from '@/components/sparkline'
import { deltaTone, formatDelta } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface KpiCardProps {
  label: ReactNode
  /** Ikon kecil di kanan header (abu-abu). */
  icon?: ReactNode
  /** Warna ikon header bila ikon membawa makna (mis. danger untuk "tidak hadir"). */
  iconClassName?: string
  value: ReactNode
  /** Warna angka utama bila nilai membawa sinyal urgensi (mis. danger/warning saat > 0). */
  valueClassName?: string
  /** Persentase perubahan; tidak ditampilkan bila undefined. */
  deltaPct?: number
  deltaLabel?: ReactNode
  /** Kenaikan berarti baik (default) atau buruk. Menentukan warna delta & sparkline. */
  upIsGood?: boolean
  /** Baris keterangan pendek di bawah angka (muted). */
  hint?: ReactNode
  /** Penunjuk aksi netral di kanan bawah kartu interaktif (mis. "Detail"). */
  actionLabel?: ReactNode
  sparkline?: number[]
  href?: string
  onClick?: () => void
  className?: string
}

/**
 * Kartu KPI standar (gaya referensi Nuvio): label + ikon di bingkai, angka besar, delta berwarna
 * "vs pekan lalu" dan sparkline opsional. Tanpa efek angkat/geser saat hover.
 */
export function KpiCard({
  label,
  icon,
  iconClassName,
  value,
  valueClassName,
  deltaPct,
  deltaLabel = 'vs pekan lalu',
  upIsGood = true,
  hint,
  actionLabel,
  sparkline,
  href,
  onClick,
  className,
}: KpiCardProps) {
  const tone = deltaPct === undefined ? 'flat' : deltaTone(deltaPct, upIsGood)
  const interactive = !!href || !!onClick
  const body = (
    <>
      <div className="flex min-h-8 items-center justify-between gap-2 px-2.5 py-1">
        <span className="truncate text-xs font-medium text-foreground/80">{label}</span>
        {icon && (
          <span aria-hidden className={cn('flex shrink-0 text-muted-foreground [&_svg]:size-3.5', iconClassName)}>
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          'flex flex-1 flex-col justify-between gap-2 rounded-lg border border-border/75 bg-card px-3.5 py-3 transition-colors',
          interactive && 'group-hover:border-border',
        )}
      >
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div
              className={cn(
                'text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums',
                valueClassName,
              )}
            >
              {value}
            </div>
            {deltaPct !== undefined && (
              <p className="text-xs whitespace-nowrap">
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    tone === 'good' && 'text-tone-success',
                    tone === 'bad' && 'text-tone-danger',
                    tone === 'flat' && 'text-muted-foreground',
                  )}
                >
                  {formatDelta(deltaPct)}
                </span>{' '}
                <span className="text-muted-foreground">{deltaLabel}</span>
              </p>
            )}
          </div>
          {sparkline && (
            <Sparkline points={sparkline} tone={tone === 'flat' ? 'good' : tone} width={76} height={34} />
          )}
        </div>
        {(hint || (interactive && actionLabel)) && (
          <div className="flex items-center justify-between gap-2">
            {hint ? (
              <p
                className="min-w-0 truncate text-xs text-muted-foreground"
                title={typeof hint === 'string' ? hint : undefined}
              >
                {hint}
              </p>
            ) : (
              <span />
            )}
            {interactive && actionLabel && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                {actionLabel}
                <ChevronRight aria-hidden className="size-3.5" />
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
  const shell = cn(
    'group flex min-w-0 flex-col rounded-xl border border-border/85 bg-hatch p-1 shadow-2xs',
    interactive &&
      'text-left transition-shadow hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
    className,
  )
  if (href)
    return (
      <Link to={href} data-slot="card" className={shell}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" data-slot="card" onClick={onClick} className={shell}>
        {body}
      </button>
    )
  return (
    <div data-slot="card" className={shell}>
      {body}
    </div>
  )
}
