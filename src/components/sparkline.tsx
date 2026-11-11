import { useId } from 'react'
import { cn } from '@/lib/utils'

export type SparkTone = 'good' | 'bad' | 'flat'

const STROKE: Record<SparkTone, string> = {
  good: 'var(--tone-success)',
  bad: 'var(--tone-danger)',
  flat: 'var(--muted-foreground)',
}

/**
 * Sparkline area halus (stroke 1.75px, wash ~16% → 0). Tidak menggambar apa pun bila titik < 2
 * — tidak ada deret palsu.
 */
export function Sparkline({
  points,
  tone = 'good',
  width = 96,
  height = 40,
  className,
}: {
  points: number[]
  tone?: SparkTone
  width?: number
  height?: number
  className?: string
}) {
  const gradId = useId()
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = Math.max(1, max - min)
  const padX = 2
  const padY = 4
  const coords = points.map((v, i) => ({
    x: padX + (i / (points.length - 1)) * (width - padX * 2),
    y: height - padY - ((v - min) / range) * (height - padY * 2),
  }))
  let line = `M ${coords[0]!.x} ${coords[0]!.y}`
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i]!
    const b = coords[i + 1]!
    const cx = (a.x + b.x) / 2
    line += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`
  }
  const area = `${line} L ${coords.at(-1)!.x} ${height} L ${coords[0]!.x} ${height} Z`
  const stroke = STROKE[tone]
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={cn('shrink-0 overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.16" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
