import { cn } from '@/lib/utils'
import type { AbsenteeStatusCounts } from '@/types/entities'

const GROUPS = [
  { key: 'SICK', label: 'Sakit (S)', fill: 'bg-tone-info', pick: (c: AbsenteeStatusCounts) => c.SICK },
  { key: 'PERMISSION', label: 'Izin (I)', fill: 'bg-tone-purple', pick: (c: AbsenteeStatusCounts) => c.PERMISSION },
  { key: 'ABSENT', label: 'Alpa (A)', fill: 'bg-tone-danger', pick: (c: AbsenteeStatusCounts) => c.ABSENT },
  { key: 'EXCUSED', label: 'Dispensasi (D)', fill: 'bg-tone-neutral', pick: (c: AbsenteeStatusCounts) => c.EXCUSED },
  { key: 'PKL', label: 'PKL (P)', fill: 'bg-tone-warning', pick: (c: AbsenteeStatusCounts) => c.PKL },
] as const

/**
 * Distribusi 5 status siswa tidak hadir (S, I, A, D, P).
 */
export function AttendanceDistribution({ counts }: { counts: AbsenteeStatusCounts }) {
  const total = counts.total
  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
        Tidak ada siswa tidak hadir yang tercatat pada tanggal ini.
      </p>
    )
  }

  const rows = GROUPS.map((g) => ({ ...g, value: g.pick(counts) })).filter((r) => r.value > 0)
  const summaryText = rows.map((r) => `${r.label} ${r.value}`).join(', ')

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={`Distribusi ${total} siswa tidak hadir: ${summaryText}.`}
        className="flex h-2 w-full gap-px overflow-hidden rounded-sm bg-muted"
      >
        {rows.map((r) => (
          <div
            key={r.key}
            title={`${r.label}: ${r.value}`}
            className={cn('h-full', r.fill)}
            style={{ width: `${(r.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label="Rincian status siswa tidak hadir">
        {GROUPS.map((g) => {
          const val = g.pick(counts)
          return (
            <li key={g.key} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-[2px]', g.fill)} />
              <span className="text-muted-foreground">{g.label}</span>
              <span className="font-semibold tabular-nums">{val}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
