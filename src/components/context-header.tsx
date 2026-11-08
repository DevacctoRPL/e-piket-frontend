import { CalendarDays } from 'lucide-react'
import { useActiveAcademicYear, useShifts } from '@/features/master-data/lookups'
import { formatDateLong, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'
import { NativeSelect } from '@/components/form-field'
import { Input } from '@/components/ui/input'

/**
 * Header konteks (PRD §8.1, §2.2): tanggal & shift dipilih sekali per halaman lalu tampil konsisten.
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
        'no-print flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <CalendarDays className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{formatDateLong(date)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {year ? `TA ${year.name}` : 'Tahun ajaran'} {semester ? `· Semester ${semester.name}` : ''}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {onDateChange && (
          <Input
            type="date"
            value={date}
            max={maxDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            aria-label="Tanggal"
            className="w-auto"
          />
        )}
        {onShiftChange && (
          <NativeSelect
            value={shiftCode ?? ''}
            onChange={(e) => onShiftChange(e.target.value)}
            aria-label="Shift"
            className="w-auto min-w-28"
          >
            {allowAllShifts && <option value="">Semua shift</option>}
            {(shifts.data ?? []).map((s) => (
              <option key={s.code} value={s.code}>
                Shift {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {extra}
      </div>
    </div>
  )
}
