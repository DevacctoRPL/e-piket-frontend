import { dayName, formatWallTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Period, TimetableSlot } from '@/types/entities'

export const DAYS = [1, 2, 3, 4, 5, 6, 7] as const

export function periodRangeLabel(s: Pick<TimetableSlot, 'periodStart' | 'periodEnd'>) {
  return s.periodStart === s.periodEnd ? `Jam ke-${s.periodStart}` : `Jam ke-${s.periodStart}–${s.periodEnd}`
}

/** '07.00–08.20' dari tabel periode shift; '—' bila periode belum dimuat. */
export function slotTimeLabel(
  s: Pick<TimetableSlot, 'shiftCode' | 'periodStart' | 'periodEnd'>,
  periods: Period[] | undefined,
) {
  const ps = (periods ?? []).filter((p) => p.shiftCode === s.shiftCode)
  const start = ps.find((p) => p.number === s.periodStart)?.startTime
  const end = ps.find((p) => p.number === s.periodEnd)?.endTime
  return start && end ? `${formatWallTime(start)}–${formatWallTime(end)}` : '—'
}

/**
 * Tab hari Senin–Minggu (radiogroup yang dapat digulir horizontal di ponsel).
 * `counts` opsional menampilkan jumlah slot per hari.
 */
export function DayTabs({
  value,
  onChange,
  counts,
  today,
}: {
  value: number
  onChange: (d: number) => void
  counts?: Partial<Record<number, number>>
  today?: number
}) {
  return (
    <div
      role="tablist"
      aria-label="Pilih hari"
      className="no-print -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
    >
      {DAYS.map((d) => {
        const active = d === value
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d)}
            className={cn(
              'flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              active ? 'border-primary bg-primary text-primary-foreground shadow-xs' : 'bg-card hover:bg-accent',
            )}
          >
            <span className="sm:hidden">{dayName(d).slice(0, 3)}</span>
            <span className="hidden sm:inline">{dayName(d)}</span>
            {today === d && (
              <span className={cn('text-[10px] font-semibold uppercase', active ? 'text-primary-foreground/80' : 'text-primary')}>
                Hari ini
              </span>
            )}
            {counts?.[d] !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground',
                )}
              >
                {counts[d]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
