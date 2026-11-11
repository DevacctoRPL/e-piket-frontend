import { CircleCheck, CircleDashed, CircleDot, CircleX, Clock3, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import type { EnumMeta } from '@/lib/enums'
import { cn } from '@/lib/utils'

/** Warna tone hanya pada ikon kecil saat terpilih; tombol tetap netral (abu). */
const TONE_ICON_CHECKED: Record<EnumMeta['tone'], string> = {
  success: 'peer-checked:[&>svg]:text-tone-success',
  warning: 'peer-checked:[&>svg]:text-tone-warning',
  danger: 'peer-checked:[&>svg]:text-tone-danger',
  info: 'peer-checked:[&>svg]:text-tone-info',
  neutral: 'peer-checked:[&>svg]:text-foreground',
  purple: 'peer-checked:[&>svg]:text-tone-purple',
}

const TONE_ICON: Record<EnumMeta['tone'], LucideIcon> = {
  success: CircleCheck,
  warning: Clock3,
  danger: CircleX,
  info: CircleDot,
  neutral: CircleDashed,
  purple: CircleDot,
}

/**
 * Pilihan tunggal berbentuk tombol (radio native → dapat dipakai dengan keyboard & pembaca layar).
 * Label teks selalu tampil; warna hanya penegas.
 */
export function ChoiceGroup<K extends string>({
  label,
  name,
  value,
  onChange,
  meta,
  options,
  disabled,
  required,
  error,
  className,
}: {
  label: string
  name: string
  value: K
  onChange: (v: K) => void
  meta: Record<K, EnumMeta>
  options: readonly K[]
  disabled?: boolean
  required?: boolean
  error?: string
  className?: string
}) {
  const id = useId()
  return (
    <fieldset className={cn('grid gap-1.5', className)} aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-1.5 text-sm font-medium">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const m = meta[opt]
          const Icon = m.icon ?? TONE_ICON[m.tone]
          return (
            <label key={opt} className="relative">
              <input
                type="radio"
                name={name}
                value={opt}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border/90 bg-card px-2.5 text-[13px] font-medium text-foreground/80 shadow-2xs transition-colors select-none hover:bg-accent',
                  '[&>svg]:size-3.5 [&>svg]:shrink-0 [&>svg]:text-muted-foreground',
                  'peer-checked:border-foreground/40 peer-checked:bg-muted peer-checked:text-foreground',
                  'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
                  TONE_ICON_CHECKED[m.tone],
                )}
              >
                <Icon aria-hidden />
                {m.label}
              </span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
