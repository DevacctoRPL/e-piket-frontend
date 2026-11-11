import { SegmentedControl } from '@/components/segmented-control'
import { dayName, formatWallTime } from '@/lib/date'
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
 * Pemilih hari Senin–Minggu (SegmentedControl: radiogroup dengan navigasi panah, dapat digulir horizontal
 * di ponsel). `counts` opsional menampilkan jumlah slot per hari; `today` menandai hari ini sebagai teks.
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
    <SegmentedControl
      ariaLabel="Pilih hari"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      className="no-print"
      options={DAYS.map((d) => ({
        value: String(d),
        count: counts?.[d],
        label: (
          <>
            <span className="sm:hidden">{dayName(d).slice(0, 3)}</span>
            <span className="hidden sm:inline">{dayName(d)}</span>
            {today === d && <span className="text-[11px] font-normal opacity-75">· Hari ini</span>}
          </>
        ),
      }))}
    />
  )
}
