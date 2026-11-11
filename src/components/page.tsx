import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { KpiCard } from '@/components/kpi-card'
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
      <div className="min-w-0 space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight text-balance text-foreground sm:text-[22px]">{title}</h1>
        {description && (
          <p className="max-w-3xl text-[13px] text-pretty text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:pt-0.5">{actions}</div>}
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
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center',
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground shadow-2xs [&_svg]:size-4">
        {icon ?? <Inbox />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
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
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-border/85 bg-card px-6 py-10 text-center shadow-2xs',
        className,
      )}
    >
      <div className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-card text-tone-danger shadow-2xs [&_svg]:size-4">
        {isNetwork ? <WifiOff /> : <AlertTriangle />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">
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
    <div
      className="space-y-2.5 rounded-xl border border-border/85 bg-card p-3 shadow-2xs"
      aria-busy="true"
      aria-label="Memuat data"
    >
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
        <Skeleton key={i} className="h-[104px] rounded-xl" />
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

const STAT_ICON_TONE = {
  neutral: undefined,
  success: 'text-tone-success',
  warning: 'text-tone-warning',
  danger: 'text-tone-danger',
  info: undefined,
} as const

/**
 * Kartu statistik ringkas yang dapat ditelusuri (FR-RPT-01) — dibangun di atas KpiCard (bingkai Nuvio).
 * `tone` hanya mewarnai ikon kecil; angka & label tetap netral. `href` dinavigasi via router (SPA).
 */
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
  return (
    <KpiCard
      label={label}
      value={value}
      hint={hint}
      icon={icon}
      iconClassName={STAT_ICON_TONE[tone]}
      href={href}
      onClick={onClick}
    />
  )
}
