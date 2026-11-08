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

const SELECTED: Record<Tone, string> = {
  success: 'border-tone-success bg-tone-success text-white',
  info: 'border-tone-info bg-tone-info text-white',
  purple: 'border-tone-purple bg-tone-purple text-white',
  danger: 'border-tone-danger bg-tone-danger text-white',
  warning: 'border-tone-warning bg-tone-warning text-white',
  neutral: 'border-tone-neutral bg-tone-neutral text-white',
}

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
              'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg border bg-background px-2 leading-none transition-[background-color,border-color,color,transform] duration-100 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 sm:min-w-14',
              selected ? SELECTED[meta.tone] : 'hover:bg-accent',
            )}
          >
            <span className="text-base font-bold" aria-hidden>
              {meta.short}
            </span>
            <span className={cn('mt-0.5 text-[10px] font-medium', !selected && 'text-muted-foreground')} aria-hidden>
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
                'flex min-h-11 items-center gap-1 rounded-lg border bg-background px-2.5 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
                moreSelected && value ? SELECTED[ATTENDANCE_META[value].tone] : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {moreSelected && value ? ATTENDANCE_META[value].label : 'Lainnya'}
              <ChevronDown className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {more.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
                <span className="w-6 font-bold">{ATTENDANCE_META[s].short}</span>
                {ATTENDANCE_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
})
