import { ChevronDown } from 'lucide-react'
import { memo, useRef, type KeyboardEvent } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ATTENDANCE_META, type Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/types/entities'
import { MORE_STATUSES, QUICK_STATUSES } from '../roster-model'

/** Warna tone hanya pada huruf kode status terpilih; tombol tetap netral. */
const CODE_TONE: Record<Tone, string> = {
  success: 'text-tone-success',
  info: 'text-tone-info',
  purple: 'text-tone-purple',
  danger: 'text-tone-danger',
  warning: 'text-tone-warning',
  neutral: 'text-foreground',
}

const BASE =
  'flex items-center justify-center rounded-md border leading-none transition-[background-color,border-color,color] duration-100 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
const IDLE = 'border-border/90 bg-card text-muted-foreground shadow-2xs hover:bg-accent hover:text-foreground'
const SELECTED = 'border-foreground/40 bg-muted text-foreground'

/**
 * Pemilih status cepat (H S I A T + lainnya). Huruf + label agar tidak bergantung warna (PRD §12).
 * Pola radiogroup dengan roving tabindex: panah kiri/kanan berpindah status.
 */
export const StatusPicker = memo(function StatusPicker({
  value,
  onChange,
  label,
  disabled,
  allowed,
}: {
  value: AttendanceStatus | null
  onChange: (s: AttendanceStatus) => void
  /** Label aksesibel grup, mis. "Status Ayu Lestari". */
  label: string
  disabled?: boolean
  allowed?: AttendanceStatus[]
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const quick = QUICK_STATUSES.filter((s) => !allowed || allowed.includes(s))
  const more = MORE_STATUSES.filter((s) => !allowed || allowed.includes(s))
  const moreSelected = value !== null && more.includes(value)
  const focusIndex = Math.max(0, value ? quick.indexOf(value) : 0)

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + quick.length) % quick.length
    const s = quick[next]
    if (s) {
      onChange(s)
      refs.current[next]?.focus()
    }
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {quick.map((s, i) => {
        const meta = ATTENDANCE_META[s]
        const selected = value === s
        return (
          <button
            key={s}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={meta.label}
            title={meta.label}
            disabled={disabled}
            tabIndex={i === focusIndex ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(s)}
            className={cn(
              BASE,
              // ponsel: target sentuh 44px (huruf di atas label); desktop: satu baris setinggi kontrol (h-8)
              'min-h-11 min-w-11 flex-col gap-1 px-2 sm:min-h-8 sm:flex-row sm:gap-1.5 sm:px-2.5',
              selected ? SELECTED : IDLE,
            )}
          >
            <span
              className={cn('text-sm font-semibold', selected ? CODE_TONE[meta.tone] : 'text-foreground/70')}
              aria-hidden
            >
              {meta.short}
            </span>
            <span className="text-[10px] font-medium sm:text-xs" aria-hidden>
              {meta.label}
            </span>
          </button>
        )
      })}
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              aria-label={moreSelected && value ? `Status lain: ${ATTENDANCE_META[value].label}` : 'Status lainnya'}
              className={cn(
                BASE,
                'min-h-11 gap-1 px-2.5 text-xs font-medium sm:min-h-8',
                moreSelected && value ? SELECTED : IDLE,
              )}
            >
              {moreSelected && value && (
                <span className={cn('font-semibold', CODE_TONE[ATTENDANCE_META[value].tone])} aria-hidden>
                  {ATTENDANCE_META[value].short}
                </span>
              )}
              {moreSelected && value ? ATTENDANCE_META[value].label : 'Lainnya'}
              <ChevronDown className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {more.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
                <span className="w-6 font-semibold text-muted-foreground">{ATTENDANCE_META[s].short}</span>
                {ATTENDANCE_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})
