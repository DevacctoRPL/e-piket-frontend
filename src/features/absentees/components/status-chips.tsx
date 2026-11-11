import { ATTENDANCE_META, NON_PRESENT_STATUSES } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/types/entities'

/**
 * Filter status (multi pilih) bergaya kontrol segmen (track abu tipis, segmen aktif gelap) yang sekaligus
 * menampilkan jumlah per status. Tidak memakai SegmentedControl karena pilihannya boleh lebih dari satu —
 * tiap segmen adalah tombol toggle (`aria-pressed`). Tidak ada segmen terpilih = semua status tidak hadir.
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
    <div
      className="no-print no-scrollbar inline-flex h-8 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/80 bg-muted/50 p-0.5"
      role="group"
      aria-label="Filter status ketidakhadiran"
    >
      <Chip active={allActive} onClick={onClear} label="Semua" count={total} loading={loading} />
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
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number | undefined
  loading?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-full shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'text-[11px] tabular-nums',
          active ? 'text-primary-foreground/70' : 'text-muted-foreground/80',
          loading && 'opacity-50',
        )}
        aria-label={count === undefined ? undefined : `${count} siswa`}
      >
        {count ?? '–'}
      </span>
    </button>
  )
}
