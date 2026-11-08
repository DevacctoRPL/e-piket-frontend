import { ToneBadge } from '@/components/status-badge'
import { ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, AttendanceSummaryCounts } from '@/types/entities'

const MAIN: AttendanceStatus[] = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE']
const EXTRA: AttendanceStatus[] = ['EXCUSED', 'LEFT_EARLY']

/** Ringkasan H/S/I/A/T (+ status lain bila ada) dan jumlah belum diisi. */
export function SummaryCounts({
  counts,
  compact = false,
  className,
}: {
  counts: AttendanceSummaryCounts
  compact?: boolean
  className?: string
}) {
  const statuses = [...MAIN, ...EXTRA.filter((s) => counts[s] > 0)]
  if (compact) {
    return (
      <dl className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums', className)}>
        {statuses.map((s) => (
          <div key={s} className="flex items-baseline gap-1" title={ATTENDANCE_META[s].label}>
            <dt className="font-semibold text-muted-foreground">
              <abbr title={ATTENDANCE_META[s].label} className="no-underline">
                {ATTENDANCE_META[s].short}
              </abbr>
            </dt>
            <dd className="font-bold">{counts[s]}</dd>
          </div>
        ))}
        {counts.unmarked > 0 && (
          <div className="flex items-baseline gap-1 text-tone-warning">
            <dt>Belum</dt>
            <dd className="font-bold">{counts.unmarked}</dd>
          </div>
        )}
      </dl>
    )
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label="Ringkasan absensi">
      {statuses.map((s) => (
        <ToneBadge key={s} tone={ATTENDANCE_META[s].tone} className="tabular-nums">
          {ATTENDANCE_META[s].label} <span className="font-bold">{counts[s]}</span>
        </ToneBadge>
      ))}
      <ToneBadge tone={counts.unmarked > 0 ? 'warning' : 'neutral'} className="tabular-nums">
        Belum diisi <span className="font-bold">{counts.unmarked}</span>
      </ToneBadge>
      <span className="text-xs text-muted-foreground tabular-nums">dari {counts.total} siswa</span>
    </div>
  )
}
