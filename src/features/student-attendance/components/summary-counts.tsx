import { ATTENDANCE_META, type Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, AttendanceSummaryCounts } from '@/types/entities'

const MAIN: AttendanceStatus[] = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE']
const EXTRA: AttendanceStatus[] = ['EXCUSED', 'LEFT_EARLY']

/** Titik kecil penanda tone (kelas statis agar dibangkitkan Tailwind). Warna bukan satu-satunya penanda: label selalu tampil. */
const DOT: Record<Tone, string> = {
  success: 'bg-tone-success',
  info: 'bg-tone-info',
  purple: 'bg-tone-purple',
  danger: 'bg-tone-danger',
  warning: 'bg-tone-warning',
  neutral: 'bg-tone-neutral',
}

function Dot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])} />
}

/** Ringkasan H/S/I/A/T (+ status lain bila ada) dan jumlah belum diisi — teks tenang, warna hanya pada titik kecil. */
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
            <dt className="font-medium text-muted-foreground">
              <abbr title={ATTENDANCE_META[s].label} className="no-underline">
                {ATTENDANCE_META[s].short}
              </abbr>
            </dt>
            <dd className="font-semibold text-foreground">{counts[s]}</dd>
          </div>
        ))}
        {counts.unmarked > 0 && (
          <div className="flex items-baseline gap-1">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Dot tone="warning" />
              Belum
            </dt>
            <dd className="font-semibold text-foreground">{counts.unmarked}</dd>
          </div>
        )}
      </dl>
    )
  }
  return (
    <div
      role="group"
      aria-label="Ringkasan absensi"
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] tabular-nums', className)}
    >
      <dl className="contents">
        {statuses.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Dot tone={ATTENDANCE_META[s].tone} />
              {ATTENDANCE_META[s].label}
            </dt>
            <dd className="font-semibold text-foreground">{counts[s]}</dd>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Dot tone={counts.unmarked > 0 ? 'warning' : 'neutral'} />
            Belum diisi
          </dt>
          <dd className="font-semibold text-foreground">{counts.unmarked}</dd>
        </div>
      </dl>
      <span className="text-xs text-muted-foreground">dari {counts.total} siswa</span>
    </div>
  )
}
