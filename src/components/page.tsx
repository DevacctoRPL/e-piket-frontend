import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage, getRequestId } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'

/** Judul halaman + deskripsi + aksi utama (kanan di desktop, di bawah judul di ponsel). */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'no-print flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">{title}</h1>
        {description && (
          <p className="text-sm text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Kontainer halaman standar. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto flex w-full max-w-7xl flex-col gap-5', className)}>{children}</div>
}

/** Empty state yang menjelaskan penyebab dan tindakan berikutnya (PRD §8.1). */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

/** Error state dengan langkah pemulihan (AC-14). Tidak menampilkan stack trace. */
export function ErrorState({
  error,
  onRetry,
  className,
  title,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
  title?: string
}) {
  const isNetwork = error instanceof ApiError && error.isNetworkError
  const isForbidden = error instanceof ApiError && error.status === 403
  const requestId = getRequestId(error)
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-tone-danger/20 bg-tone-danger-bg/40 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-tone-danger-bg text-tone-danger">
        {isNetwork ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="font-semibold">
          {title ?? (isForbidden ? 'Akses ditolak' : isNetwork ? 'Koneksi terputus' : 'Gagal memuat data')}
        </p>
        <p className="mx-auto max-w-md text-sm text-pretty text-muted-foreground">
          {getErrorMessage(error)}
        </p>
        {requestId && (
          <p className="text-xs text-muted-foreground">
            Kode referensi: <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
      {onRetry && !isForbidden && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Coba lagi
        </Button>
      )}
    </div>
  )
}

/** Skeleton tabel untuk pemuatan pertama. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 rounded-xl border p-4" aria-busy="true" aria-label="Memuat data">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

/**
 * Pola standar untuk query: loading → skeleton, error → ErrorState, kosong → EmptyState.
 *   <QueryBoundary query={q} empty={(d) => d.length === 0} emptyState={<EmptyState .../>}>{(data) => ...}</QueryBoundary>
 */
export function QueryBoundary<T>({
  query,
  children,
  loading,
  empty,
  emptyState,
}: {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown }
  children: (data: T) => ReactNode
  loading?: ReactNode
  empty?: (data: T) => boolean
  emptyState?: ReactNode
}) {
  if (query.isPending) return <>{loading ?? <TableSkeleton />}</>
  if (query.isError || query.data === undefined)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (empty?.(query.data) && emptyState) return <>{emptyState}</>
  return <>{children(query.data)}</>
}

/** Kartu statistik ringkas yang dapat ditelusuri (FR-RPT-01). */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  href?: string
  onClick?: () => void
}) {
  const toneRing = {
    neutral: 'text-muted-foreground bg-muted',
    success: 'text-tone-success bg-tone-success-bg',
    warning: 'text-tone-warning bg-tone-warning-bg',
    danger: 'text-tone-danger bg-tone-danger-bg',
    info: 'text-tone-info bg-tone-info-bg',
  }[tone]
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        {icon && (
          <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', toneRing)}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </>
  )
  const cls =
    'flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left shadow-xs transition-[box-shadow,border-color] duration-150'
  if (href) {
    return (
      <a href={href} className={cn(cls, 'hover:border-primary/40 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none')}>
        {content}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'hover:border-primary/40 hover:shadow-sm')}>
        {content}
      </button>
    )
  }
  return <div className={cls}>{content}</div>
}
