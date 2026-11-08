import { Check } from 'lucide-react'
import { ATTENDANCE_META, NON_PRESENT_STATUSES, type Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/types/entities'

const ACTIVE_TONE: Record<Tone, string> = {
  success: 'border-tone-success/40 bg-tone-success-bg text-tone-success',
  warning: 'border-tone-warning/40 bg-tone-warning-bg text-tone-warning',
  danger: 'border-tone-danger/40 bg-tone-danger-bg text-tone-danger',
  info: 'border-tone-info/40 bg-tone-info-bg text-tone-info',
  neutral: 'border-tone-neutral/40 bg-tone-neutral-bg text-tone-neutral',
  purple: 'border-tone-purple/40 bg-tone-purple-bg text-tone-purple',
}

/**
 * Chip filter status (multi pilih) yang sekaligus menampilkan jumlah per status.
 * Tidak ada chip terpilih = semua status tidak hadir.
 */
export function StatusChips({
  selected,
  counts,
  loading,
  onToggle,
  onClear,
}: {
  selected: readonly AttendanceStatus[]
  counts: Partial<Record<AttendanceStatus, number>> | undefined
  loading?: boolean
  onToggle: (s: AttendanceStatus) => void
  onClear: () => void
}) {
  const total = counts ? NON_PRESENT_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0) : undefined
  const allActive = selected.length === 0
  return (
    <div className="no-print flex flex-wrap gap-2" role="group" aria-label="Filter status ketidakhadiran">
      <Chip active={allActive} onClick={onClear} label="Semua" count={total} loading={loading} activeClass="border-primary/40 bg-primary/10 text-primary" />
      {NON_PRESENT_STATUSES.map((s) => {
        const meta = ATTENDANCE_META[s]
        return (
          <Chip
            key={s}
            active={selected.includes(s)}
            onClick={() => onToggle(s)}
            label={meta.short ? `${meta.short} · ${meta.label}` : meta.label}
            count={counts?.[s] ?? (counts ? 0 : undefined)}
            loading={loading}
            activeClass={ACTIVE_TONE[meta.tone]}
          />
        )
      })}
    </div>
  )
}

function Chip({
  active,
  onClick,
  label,
  count,
  loading,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number | undefined
  loading?: boolean
  activeClass: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? activeClass : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {active && <Check className="size-3.5" aria-hidden />}
      <span>{label}</span>
      <span
        className={cn(
          'min-w-5 rounded-full px-1.5 text-center tabular-nums',
          active ? 'bg-background/70' : 'bg-muted',
          loading && 'opacity-50',
        )}
        aria-label={count === undefined ? undefined : `${count} siswa`}
      >
        {count ?? '–'}
      </span>
    </button>
  )
}
