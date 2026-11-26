import { CalendarDays, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { FilterField } from '@/components/filter-bar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc'
import { formatDateLong, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/types/entities'

const BARE =
  'h-full min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent px-2.5 text-[13px] font-medium text-foreground outline-none'

/**
 * Pemilih tanggal ringkas berbentuk tombol pill untuk header halaman operasional.
 * Default menampilkan tanggal hari ini dengan opsi kembali ke hari ini.
 */
export function DatePickerPill({
  date,
  onChange,
  maxDate,
  id = 'page-date-picker',
}: {
  date: ISODate
  onChange: (next: ISODate) => void
  maxDate?: ISODate
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const today = todayISO()
  const isToday = date === today

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Tanggal: ${formatDateLong(date)}`}>
          <CalendarDays className="text-muted-foreground" aria-hidden />
          <span className="tabular-nums">{formatDateLong(date)}</span>
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2.5">
        <p className="text-xs font-semibold">Pilih tanggal</p>
        <FilterField label="Tanggal" htmlFor={id} className="w-full">
          <input
            id={id}
            type="date"
            value={date}
            max={maxDate}
            onChange={(e) => {
              if (e.target.value) {
                onChange(e.target.value)
                setOpen(false)
              }
            }}
            aria-label="Tanggal"
            className={cn(BARE, 'tabular-nums')}
          />
        </FilterField>
        {!isToday && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              onChange(today)
              setOpen(false)
            }}
          >
            Kembali ke hari ini
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
