import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Permukaan seksi standar (gaya referensi Nuvio): bingkai luar bertekstur diagonal berisi baris judul
 * (ikon + judul + kontrol kecil) yang membungkus kartu putih.
 * Radius bersarang: luar `rounded-xl` (14px) + `p-1` → dalam `rounded-lg` (10px).
 * Menyertakan `data-slot="card"` agar kompatibel dengan selektor pengujian.
 */
export function FramedCard({
  title,
  titleId,
  titleBadge,
  headingLevel = 'h2',
  icon,
  headerRight,
  description,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode
  titleId?: string
  /** Elemen kecil setelah judul, mis. jumlah item. */
  titleBadge?: ReactNode
  headingLevel?: 'h2' | 'h3'
  /** Ikon kecil sebelum judul. */
  icon?: ReactNode
  /** Kontrol di kanan header (pencarian, filter, kebab, pemilih periode). */
  headerRight?: ReactNode
  /** Kalimat pendek opsional di bawah judul (di dalam bingkai). */
  description?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  const HeadingTag = headingLevel
  return (
    <section
      data-slot="card"
      aria-labelledby={titleId}
      className={cn('flex min-w-0 flex-col rounded-xl border border-border/85 bg-hatch p-1 shadow-2xs', className)}
    >
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span aria-hidden className="flex shrink-0 text-muted-foreground [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <HeadingTag id={titleId} className="truncate text-[13px] font-semibold tracking-tight text-foreground">
              {title}
            </HeadingTag>
            {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          {titleBadge}
        </div>
        {headerRight && <div className="flex flex-wrap items-center gap-1.5">{headerRight}</div>}
      </div>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col rounded-lg border border-border/75 bg-card p-4 text-card-foreground',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  )
}

/** Angka kecil di samping judul seksi (jumlah item). */
export function CountChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border/80 bg-muted/50 px-1 text-[11px] font-semibold tabular-nums text-foreground/80',
        className,
      )}
    >
      {children}
    </span>
  )
}
