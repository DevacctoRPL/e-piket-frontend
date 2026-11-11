import { CalendarDays } from 'lucide-react'
import { FilterField } from '@/components/filter-bar'
import { useActiveAcademicYear, useShifts } from '@/features/master-data/lookups'
import { formatDateLong, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'

const BARE =
  'h-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent text-[13px] font-medium text-foreground outline-none'

/**
 * Header konteks (PRD §8.1, §2.2): tanggal & shift dipilih sekali per halaman lalu tampil konsisten.
 * Tampil sebagai baris ringkas tanpa kartu: tanggal panjang + TA di kiri, kontrol berprefix di kanan.
 * Nilai disimpan oleh halaman (biasanya via useFilters → URL).
 */
export function ContextHeader({
  date,
  onDateChange,
  shiftCode,
  onShiftChange,
  allowAllShifts = false,
  extra,
  className,
  maxDate = todayISO(),
}: {
  date: string
  onDateChange?: (d: string) => void
  shiftCode?: string
  onShiftChange?: (s: string) => void
  allowAllShifts?: boolean
  extra?: React.ReactNode
  className?: string
  maxDate?: string
}) {
  const shifts = useShifts()
  const { year, semester } = useActiveAcademicYear()
  return (
    <div
      className={cn(
        'no-print flex flex-col gap-2.5 border-b border-border/70 pb-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 truncate text-[13px]">
          <span className="font-semibold text-foreground">{formatDateLong(date)}</span>
          <span className="text-muted-foreground">
            {' · '}
            {year ? `TA ${year.name}` : 'Tahun ajaran'}
            {semester ? ` · Semester ${semester.name}` : ''}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {onDateChange && (
          <FilterField label="Tanggal" htmlFor="ctx-date">
            <input
              id="ctx-date"
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className={cn(BARE, 'px-2.5 tabular-nums')}
            />
          </FilterField>
        )}
        {onShiftChange && (
          <FilterField label="Shift" htmlFor="ctx-shift">
            <select
              id="ctx-shift"
              value={shiftCode ?? ''}
              onChange={(e) => onShiftChange(e.target.value)}
              className={cn(BARE, 'native-select min-w-24 pr-8 pl-2.5')}
            >
              {allowAllShifts && <option value="">Semua shift</option>}
              {(shifts.data ?? []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}
        {extra}
      </div>
    </div>
  )
}
