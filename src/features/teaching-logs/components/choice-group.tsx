import { useId } from 'react'
import type { EnumMeta } from '@/lib/enums'
import { cn } from '@/lib/utils'

const TONE_CHECKED: Record<EnumMeta['tone'], string> = {
  success: 'peer-checked:border-tone-success peer-checked:bg-tone-success-bg peer-checked:text-tone-success',
  warning: 'peer-checked:border-tone-warning peer-checked:bg-tone-warning-bg peer-checked:text-tone-warning',
  danger: 'peer-checked:border-tone-danger peer-checked:bg-tone-danger-bg peer-checked:text-tone-danger',
  info: 'peer-checked:border-tone-info peer-checked:bg-tone-info-bg peer-checked:text-tone-info',
  neutral: 'peer-checked:border-foreground/40 peer-checked:bg-muted peer-checked:text-foreground',
  purple: 'peer-checked:border-tone-purple peer-checked:bg-tone-purple-bg peer-checked:text-tone-purple',
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
        {options.map((opt) => (
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
                'inline-flex h-9 cursor-pointer items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors select-none hover:bg-accent',
                'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
                TONE_CHECKED[meta[opt].tone],
              )}
            >
              {meta[opt].label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
