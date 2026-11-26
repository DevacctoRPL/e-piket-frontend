import { ABSENTEE_STATUS_LIST, ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AbsenteeStatus } from '@/types/entities'

/**
 * Chip filter cepat untuk 5 status ketidakhadiran siswa: Sakit (S), Izin (I), Alpa (A), Dispensasi (D), PKL (P).
 */
export function StatusChips({
  selected,
  counts,
  total,
  onSelect,
}: {
  selected: AbsenteeStatus | ''
  counts?: Record<AbsenteeStatus, number>
  total?: number
  onSelect: (next: AbsenteeStatus | '') => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ringkasan status siswa tidak hadir">
      <button
        type="button"
        onClick={() => onSelect('')}
        aria-pressed={selected === ''}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          selected === ''
            ? 'border-foreground/30 bg-foreground text-background'
            : 'border-border/85 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <span>Semua</span>
        {total !== undefined && <span className="tabular-nums opacity-85">{total}</span>}
      </button>
      {ABSENTEE_STATUS_LIST.map((code) => {
        const meta = ATTENDANCE_META[code]
        const active = selected === code
        const count = counts?.[code]
        return (
          <button
            key={code}
            type="button"
            onClick={() => onSelect(active ? '' : code)}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              active
                ? 'border-foreground/30 bg-foreground text-background'
                : 'border-border/85 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span>
              {meta.label} ({meta.short})
            </span>
            {count !== undefined && <span className="tabular-nums opacity-85">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
