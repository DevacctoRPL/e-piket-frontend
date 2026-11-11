import { CheckCircle2, CircleAlert, ListChecks } from 'lucide-react'
import type { Tone } from '@/lib/enums'
import { useId, type ReactNode } from 'react'
import { FramedCard } from '@/components/framed-card'
import { StatusBadge } from '@/components/status-badge'
import { RECORD_STATUS_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { DutyAbsentTeacherRow, RecordStatus } from '@/types/entities'
import type { CompletenessItem } from '../types'

export function AgendaStatusBadge({ status }: { status: RecordStatus | null | undefined }) {
  return <StatusBadge meta={RECORD_STATUS_META} value={status} />
}

/** Seksi agenda bernomor (bingkai FramedCard), meniru susunan buku agenda piket. */
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
  const autoId = useId()
  const headingId = id ? `${id}-title` : autoId
  return (
    <div id={id} className="scroll-mt-20">
      <FramedCard
        titleId={headingId}
        title={
          <>
            <span className="sr-only">Bagian {number}. </span>
            <span aria-hidden className="text-muted-foreground mr-1.5 font-medium tabular-nums">
              {number}.
            </span>
            {title}
          </>
        }
        icon={invalid ? <CircleAlert className="text-tone-danger" /> : undefined}
        headerRight={actions || undefined}
        className={cn(invalid && 'border-l-tone-danger border-l-2')}
      >
        {description && (
          <p className="text-muted-foreground mb-3 text-xs text-pretty">{description}</p>
        )}
        {children}
      </FramedCard>
    </div>
  )
}

const METRIC_TONE: Partial<Record<Tone, string>> = {
  success: 'bg-tone-success',
  warning: 'bg-tone-warning',
  danger: 'bg-tone-danger',
}

/**
 * Deret angka ringkas di dalam seksi (tanpa kartu bersarang): label kecil + angka besar.
 * Warna hanya pada titik kecil di depan label bila angka membawa makna.
 */
export function AgendaMetrics({
  items,
  label,
}: {
  items: { label: string; value: ReactNode; tone?: Tone }[]
  label: string
}) {
  return (
    <dl
      aria-label={label}
      className="divide-border/70 border-border/75 grid grid-cols-3 divide-x overflow-hidden rounded-md border"
    >
      {items.map((it) => (
        <div key={it.label} className="min-w-0 px-2.5 py-2.5 sm:px-3">
          <dt className="text-muted-foreground flex items-center gap-1.5 text-xs leading-tight">
            {it.tone && METRIC_TONE[it.tone] && (
              <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', METRIC_TONE[it.tone])}
              />
            )}
            {it.label}
          </dt>
          <dd className="mt-1 text-xl leading-none font-semibold tracking-tight tabular-nums">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Checklist kelengkapan sebelum kirim/finalisasi (PRD §9.3). */
export function CompletenessChecklist({
  items,
  className,
}: {
  items: CompletenessItem[]
  className?: string
}) {
  const titleId = useId()
  const doneCount = items.filter((i) => i.done).length
  const complete = doneCount === items.length
  return (
    <div aria-live="polite">
      <FramedCard
        titleId={titleId}
        headingLevel="h3"
        title="Kelengkapan agenda"
        icon={<ListChecks />}
        headerRight={
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              complete ? 'text-tone-success' : 'text-tone-warning',
            )}
          >
            {doneCount}/{items.length} lengkap
          </span>
        }
        className={className}
      >
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex gap-2 text-sm">
              {item.done ? (
                <CheckCircle2 className="text-tone-success mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <CircleAlert className="text-tone-warning mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <div className="min-w-0">
                <p className={cn(!item.done && 'font-medium')}>
                  {item.label}
                  <span className="sr-only">
                    {item.done ? ' — sudah lengkap' : ' — belum lengkap'}
                  </span>
                </p>
                {!item.done && item.hint && (
                  <p className="text-muted-foreground text-xs">{item.hint}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </FramedCard>
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
  if (row.affectedPeriods === 0 || row.handledPeriods >= row.affectedPeriods)
    return 'success' as const
  if (row.handledPeriods === 0) return 'danger' as const
  return 'warning' as const
}
