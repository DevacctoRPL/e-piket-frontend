import { X } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { SearchField } from '@/components/search-field'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Filter disimpan di URL search params agar bertahan saat berpindah tab/halaman dan dapat dibagikan
 * (PRD §8.1). JANGAN menaruh data pribadi siswa (nama, telepon) di URL (PRD §12.2) —
 * gunakan ID, dan simpan kata kunci pencarian nama di state lokal (useState) lalu oper ke <SearchInput>
 * — SearchInput sendiri tidak pernah menulis ke URL.
 */
export function useFilters<T extends Record<string, string>>(defaults: T) {
  const [sp, setSp] = useSearchParams()
  const values = Object.fromEntries(
    Object.entries(defaults).map(([k, d]) => [k, sp.get(k) ?? d]),
  ) as T
  const set = (patch: Partial<T>) => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === '' || v === defaults[k]) next.delete(k)
          else next.set(k, String(v))
        }
        // reset paginasi saat filter berubah
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const reset = () =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.keys(defaults).forEach((k) => next.delete(k))
        next.delete('page')
        return next
      },
      { replace: true },
    )
  const isDirty = Object.entries(defaults).some(([k, d]) => (sp.get(k) ?? d) !== d)
  return { values, set, reset, isDirty }
}

/**
 * Toolbar filter ringkas (gaya referensi Nuvio): kontrol h-8 berderet tanpa kartu pembungkus.
 * Label tiap filter tampil sebagai prefix di dalam kontrol sehingga tetap terbaca & dapat diakses.
 */
export function FilterBar({
  children,
  onReset,
  className,
}: {
  children: ReactNode
  onReset?: () => void
  className?: string
}) {
  return (
    <div role="search" className={cn('no-print flex flex-wrap items-center gap-2', className)}>
      {children}
      {onReset && (
        <Button variant="ghost" onClick={onReset} className="text-muted-foreground">
          <X /> Reset
        </Button>
      )}
    </div>
  )
}

/**
 * Bingkai kontrol berprefix: `[Label | kontrol]`. Dipakai FilterSelect/FilterDate, dan dapat membungkus
 * kontrol kustom (mis. checkbox) agar tingginya sama dengan filter lain.
 */
export function FilterField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div
      className={cn(
        'flex h-8 max-w-full min-w-0 items-center rounded-md border border-input bg-card text-[13px] shadow-2xs transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        className,
      )}
    >
      <label
        htmlFor={htmlFor}
        className="flex h-full shrink-0 items-center border-r border-border/70 px-2.5 text-xs whitespace-nowrap text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex h-full min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

const BARE_CONTROL =
  'h-full w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent text-[13px] font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  /** Label untuk opsi "semua" (value ''). Tidak ada opsi semua bila undefined. */
  allLabel?: string
  className?: string
}) {
  const id = useId()
  return (
    <FilterField label={label} className={className} htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('native-select max-w-56 pr-8 pl-2.5', BARE_CONTROL)}
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FilterField>
  )
}

export function FilterDate({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  className?: string
}) {
  const id = useId()
  return (
    <FilterField label={label} className={className} htmlFor={id}>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={cn('px-2.5 tabular-nums', BARE_CONTROL)}
      />
    </FilterField>
  )
}

/**
 * Input pencarian dengan debounce. Komponen terkontrol yang TIDAK menyentuh URL: nilai dari useFilters
 * akan masuk URL, sedangkan nilai dari useState tetap di memori (wajib untuk nama siswa, PRD §12.2).
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  label = 'Cari',
  delay = 300,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  delay?: number
  className?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  useEffect(() => {
    if (local === value) return
    const t = setTimeout(() => onChange(local), delay)
    return () => clearTimeout(t)
  }, [local, value, delay, onChange])
  return (
    <SearchField
      value={local}
      onValueChange={setLocal}
      placeholder={placeholder}
      aria-label={label}
      className={cn('w-full sm:w-56', className)}
    />
  )
}
