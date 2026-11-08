import { ATTENDANCE_META, type Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, AttendanceSummaryCounts } from '@/types/entities'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import { markedCount, percent } from '../utils'

const FILL: Record<Tone, string> = {
  success: 'bg-tone-success',
  warning: 'bg-tone-warning',
  danger: 'bg-tone-danger',
  info: 'bg-tone-info',
  neutral: 'bg-tone-neutral',
  purple: 'bg-tone-purple',
}

interface Row {
  key: AttendanceStatus | 'UNMARKED'
  label: string
  short: string
  tone: Tone | null
  value: number
}

/**
 * Distribusi status kehadiran siswa: satu bar bertumpuk berbasis div + legenda berlabel angka.
 * Identitas status tidak bergantung pada warna saja — setiap segmen punya baris legenda
 * dengan kode singkat, label, dan jumlah (PRD §8.1, §12 Aksesibilitas).
 */
export function AttendanceDistribution({ counts }: { counts: AttendanceSummaryCounts }) {
  const marked = markedCount(counts)
  const total = counts.total
  const rows: Row[] = [
    ...ATTENDANCE_STATUSES.map((s) => ({
      key: s,
      label: ATTENDANCE_META[s].label,
      short: ATTENDANCE_META[s].short ?? '',
      tone: ATTENDANCE_META[s].tone,
      value: counts[s],
    })),
    { key: 'UNMARKED', label: 'Belum diisi', short: '–', tone: null, value: counts.unmarked },
  ]
  const visible = rows.filter((r) => r.value > 0)

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Belum ada data absensi siswa untuk tanggal &amp; shift ini. Angka muncul setelah absensi kelas diisi.
      </p>
    )
  }

  const summaryText = visible.map((r) => `${r.label} ${r.value}`).join(', ')
  const absentPct = percent(counts.ABSENT, marked)

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={`Distribusi status ${total} siswa: ${summaryText}.`}
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      >
        {visible.map((r) => (
          <div
            key={r.key}
            title={`${r.label}: ${r.value}`}
            className={cn('h-full', r.tone ? FILL[r.tone] : 'bg-muted-foreground/25')}
            style={{ width: `${(r.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul
        className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-sm sm:grid-cols-4"
        aria-label="Rincian status kehadiran siswa"
      >
        {rows.map((r) => (
          <li
            key={r.key}
            className={cn('flex min-w-0 items-center gap-2', r.value === 0 && 'text-muted-foreground')}
          >
            <span
              aria-hidden
              className={cn(
                'size-2.5 shrink-0 rounded-sm',
                r.tone ? FILL[r.tone] : 'bg-muted-foreground/25',
                r.value === 0 && 'opacity-40',
              )}
            />
            <span className="truncate">
              <span className="font-mono text-xs text-muted-foreground">{r.short}</span> {r.label}
            </span>
            <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground tabular-nums">
        {marked} dari {total} siswa sudah diberi status
        {counts.unmarked > 0 ? ` · ${counts.unmarked} belum diisi` : ''}
        {absentPct !== null ? ` · Alpa ${absentPct}%` : ''}
      </p>
    </div>
  )
}
