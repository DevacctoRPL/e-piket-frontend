import { cn } from '@/lib/utils'
import type { AttendanceSummaryCounts } from '@/types/entities'
import { markedCount, percent } from '../utils'

/**
 * Empat kelompok saja agar bar tetap terbaca (bukan 8 warna):
 * Hadir · Terlambat · Tidak hadir (S/I/A) · Lainnya (pulang awal, dispensasi) — plus "Belum diisi".
 */
const GROUPS = [
  { key: 'present', label: 'Hadir', fill: 'bg-tone-success', pick: (c: AttendanceSummaryCounts) => c.PRESENT },
  { key: 'late', label: 'Terlambat', fill: 'bg-tone-warning', pick: (c: AttendanceSummaryCounts) => c.LATE },
  {
    key: 'absent',
    label: 'Tidak hadir (S/I/A)',
    fill: 'bg-tone-danger',
    pick: (c: AttendanceSummaryCounts) => c.SICK + c.PERMISSION + c.ABSENT,
  },
  {
    key: 'other',
    label: 'Pulang awal / dispensasi',
    fill: 'bg-tone-neutral',
    pick: (c: AttendanceSummaryCounts) => c.LEFT_EARLY + c.EXCUSED,
  },
  { key: 'unmarked', label: 'Belum diisi', fill: 'bg-chart-bar', pick: (c: AttendanceSummaryCounts) => c.unmarked },
] as const

/**
 * Distribusi status kehadiran siswa: satu bar bertumpuk + legenda berlabel angka.
 * Identitas kelompok tidak bergantung pada warna saja (PRD §8.1, §12 Aksesibilitas).
 */
export function AttendanceDistribution({ counts }: { counts: AttendanceSummaryCounts }) {
  const total = counts.total
  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">
        Belum ada data absensi siswa untuk tanggal &amp; shift ini.
      </p>
    )
  }

  const rows = GROUPS.map((g) => ({ ...g, value: g.pick(counts) })).filter((r) => r.value > 0)
  const marked = markedCount(counts)
  const absentPct = percent(counts.SICK + counts.PERMISSION + counts.ABSENT, marked)
  const summaryText = rows.map((r) => `${r.label} ${r.value}`).join(', ')

  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="img"
        aria-label={`Distribusi status ${total} siswa: ${summaryText}.`}
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
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label="Rincian status kehadiran siswa">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2 shrink-0 rounded-[2px]', r.fill)} />
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
        {absentPct !== null && (
          <li className="text-muted-foreground tabular-nums sm:ml-auto">
            {marked}/{total} terisi · S/I/A {absentPct}%
          </li>
        )}
      </ul>
    </div>
  )
}
