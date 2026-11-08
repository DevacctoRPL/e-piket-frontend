import { CheckCircle2, CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/status-badge'
import { RECORD_STATUS_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { DutyAbsentTeacherRow, RecordStatus } from '@/types/entities'
import type { CompletenessItem } from '../types'

export function AgendaStatusBadge({ status }: { status: RecordStatus | null | undefined }) {
  return <StatusBadge meta={RECORD_STATUS_META} value={status} />
}

/** Kartu bagian agenda bernomor, meniru susunan buku agenda piket. */
export function AgendaSection({
  number,
  title,
  description,
  actions,
  children,
  id,
  invalid,
}: {
  number: number
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  id?: string
  invalid?: boolean
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        'scroll-mt-20 rounded-xl border bg-card shadow-xs transition-colors',
        invalid && 'border-tone-danger/40',
      )}
    >
      <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 gap-3">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground tabular-nums"
          >
            {number}
          </span>
          <div className="min-w-0 space-y-0.5">
            <h2 id={headingId} className="font-semibold">
              <span className="sr-only">Bagian {number}. </span>
              {title}
            </h2>
            {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  )
}

/** Checklist kelengkapan sebelum kirim/finalisasi (PRD §9.3). */
export function CompletenessChecklist({ items, className }: { items: CompletenessItem[]; className?: string }) {
  const doneCount = items.filter((i) => i.done).length
  const complete = doneCount === items.length
  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-xs', className)} aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Kelengkapan agenda</p>
        <span
          className={cn(
            'text-xs font-semibold tabular-nums',
            complete ? 'text-tone-success' : 'text-tone-warning',
          )}
        >
          {doneCount}/{items.length} lengkap
        </span>
      </div>
      <ul className="grid gap-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-tone-success" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-tone-warning" aria-hidden />
            )}
            <div className="min-w-0">
              <p className={cn(!item.done && 'font-medium')}>
                {item.label}
                <span className="sr-only">{item.done ? ' — sudah lengkap' : ' — belum lengkap'}</span>
              </p>
              {!item.done && item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Ringkasan jam terdampak/tertangani dari baris guru tidak hadir. */
export function summarizeAbsent(rows: DutyAbsentTeacherRow[]) {
  const affected = rows.reduce((n, r) => n + r.affectedPeriods, 0)
  const handled = rows.reduce((n, r) => n + Math.min(r.handledPeriods, r.affectedPeriods), 0)
  return { affected, handled, unhandled: Math.max(0, affected - handled) }
}

/** Teks "Sudah digantikan" per guru. */
export function handledLabel(row: DutyAbsentTeacherRow) {
  if (row.affectedPeriods === 0) return 'Tidak ada jam'
  if (row.handledPeriods >= row.affectedPeriods) return 'Semua jam'
  if (row.handledPeriods === 0) return 'Belum'
  return `${row.handledPeriods} dari ${row.affectedPeriods} jam`
}

export function handledTone(row: DutyAbsentTeacherRow) {
  if (row.affectedPeriods === 0 || row.handledPeriods >= row.affectedPeriods) return 'success' as const
  if (row.handledPeriods === 0) return 'danger' as const
  return 'warning' as const
}
