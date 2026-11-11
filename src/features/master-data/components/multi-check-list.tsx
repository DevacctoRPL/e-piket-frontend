import { useId, useState } from 'react'
import { SearchField } from '@/components/search-field'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/**
 * Multi-select berbasis daftar checkbox (ramah sentuh & keyboard). Pencarian muncul bila opsi banyak.
 */
export function MultiCheckList({
  label,
  options,
  value,
  onChange,
  error,
  required,
  emptyText = 'Tidak ada pilihan.',
  columns = 2,
}: {
  label: string
  options: { value: string; label: string; hint?: string; disabled?: boolean }[]
  value: string[]
  onChange: (v: string[]) => void
  error?: string
  required?: boolean
  emptyText?: string
  columns?: 1 | 2
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const selected = new Set(value)
  const needle = q.trim().toLowerCase()
  const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options
  const toggle = (v: string, on: boolean) =>
    onChange(on ? [...value, v] : value.filter((x) => x !== v))

  return (
    <fieldset className="grid gap-2" aria-describedby={error ? `${id}-err` : undefined} aria-invalid={!!error || undefined}>
      <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span>
          {label}
          {required && (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          )}
        </span>
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{value.length} dipilih</span>
      </legend>
      {options.length > 8 && (
        <SearchField
          value={q}
          onValueChange={setQ}
          placeholder="Cari…"
          aria-label={`Cari ${label.toLowerCase()}`}
        />
      )}
      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/90 p-3 text-[13px] text-muted-foreground">{emptyText}</p>
      ) : (
        <div
          className={cn(
            'grid max-h-56 gap-0.5 overflow-y-auto rounded-md border border-input p-1.5',
            columns === 2 && 'sm:grid-cols-2',
            error && 'border-destructive',
          )}
        >
          {shown.map((o) => {
            const cid = `${id}-${o.value}`
            return (
              <label
                key={o.value}
                htmlFor={cid}
                className={cn(
                  'flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-accent',
                  o.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Checkbox
                  id={cid}
                  checked={selected.has(o.value)}
                  disabled={o.disabled}
                  onCheckedChange={(c) => toggle(o.value, c === true)}
                />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </label>
            )
          })}
          {shown.length === 0 && <p className="p-2 text-sm text-muted-foreground">Tidak ada yang cocok.</p>}
        </div>
      )}
      {error && (
        <p id={`${id}-err`} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}
