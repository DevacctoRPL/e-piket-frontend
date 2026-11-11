import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * Angka ringkas di dalam kartu bingkai (label kecil + nilai tabular + keterangan muted).
 * Netral; warna hanya pada ikon kecil bila membawa makna.
 */
export function Metric({
  label,
  value,
  hint,
  icon,
  iconClassName,
  href,
  aside,
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  iconClassName?: string
  href?: string
  /** Elemen kecil di kanan nilai (mis. sparkline). */
  aside?: ReactNode
  className?: string
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {icon && (
          <span aria-hidden className={cn('flex shrink-0 text-muted-foreground [&_svg]:size-3.5', iconClassName)}>
            {icon}
          </span>
        )}
      </span>
      <span className="mt-1.5 flex items-end justify-between gap-2">
        <span className="text-xl leading-none font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
        {aside}
      </span>
      {hint && <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">{hint}</span>}
    </>
  )
  const shell = cn('flex min-w-0 flex-col rounded-lg border border-border/75 bg-card px-3 py-2.5', className)
  if (href)
    return (
      <Link
        to={href}
        className={cn(
          shell,
          'transition-colors hover:border-border hover:bg-muted/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        )}
      >
        {body}
      </Link>
    )
  return <div className={shell}>{body}</div>
}

/** Judul sub-bagian kecil di dalam kartu. */
export function SubHeading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-xs font-semibold text-foreground">{children}</h3>
      {right && <span className="text-[11px] text-muted-foreground tabular-nums">{right}</span>}
    </div>
  )
}

/** Ruang kosong ringkas di dalam kartu. */
export function InlineEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}
