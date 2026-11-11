import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentOption<V extends string> {
  value: V
  label: ReactNode
  /** Angka kecil di belakang label (mis. jumlah item). */
  count?: number
  disabled?: boolean
}

/**
 * Kontrol segmen kecil (gaya "Today / Yesterday / This week" referensi Nuvio):
 * track abu tipis, segmen aktif gelap. Radiogroup dengan navigasi panah kiri/kanan.
 */
export function SegmentedControl<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'default',
  fullWidth = false,
  className,
}: {
  value: V
  onChange: (v: V) => void
  options: readonly SegmentOption<V>[]
  ariaLabel: string
  size?: 'sm' | 'default'
  fullWidth?: boolean
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const trackRef = useRef<HTMLDivElement>(null)
  const enabled = options.filter((o) => !o.disabled)
  const activeIdx = options.findIndex((o) => o.value === value)

  // Indikator gelap yang meluncur ke segmen aktif (transform + width, kurva ease-out kuat).
  const [indicator, setIndicator] = useState<{ x: number; w: number; ready: boolean }>({ x: 0, w: 0, ready: false })
  const [animate, setAnimate] = useState(false)
  useLayoutEffect(() => {
    const el = refs.current[activeIdx]
    const track = trackRef.current
    if (!el || !track) return
    const measure = () => setIndicator({ x: el.offsetLeft, w: el.offsetWidth, ready: true })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeIdx, options.length])
  // Posisi awal tanpa animasi; animasi aktif setelah render pertama.
  useLayoutEffect(() => {
    if (indicator.ready && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(id)
    }
  }, [indicator.ready, animate])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const pos = enabled.findIndex((o) => o.value === options[idx]!.value)
    const nextPos =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? enabled.length - 1
          : (pos + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
    const next = enabled[nextPos]
    if (!next) return
    onChange(next.value)
    refs.current[options.findIndex((o) => o.value === next.value)]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      ref={trackRef}
      className={cn(
        'no-scrollbar relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/80 bg-muted/50 p-0.5',
        size === 'sm' ? 'h-7' : 'h-8',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {activeIdx >= 0 && indicator.ready && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-md bg-primary shadow-2xs',
            animate &&
              'transition-[transform,width] duration-[260ms] ease-[var(--ease-out)] motion-reduce:transition-none',
          )}
          style={{ width: indicator.w, transform: `translateX(${indicator.x}px)` }}
        />
      )}
      {options.map((o, i) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative z-10 inline-flex h-full shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 font-medium whitespace-nowrap transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
              size === 'sm' ? 'text-xs' : 'text-[13px]',
              fullWidth && 'flex-1',
              active
                ? cn('text-primary-foreground', !indicator.ready && 'bg-primary')
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  active ? 'text-primary-foreground/70' : 'text-muted-foreground/80',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
