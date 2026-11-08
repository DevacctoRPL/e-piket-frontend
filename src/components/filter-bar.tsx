import { Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { NativeSelect } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Filter disimpan di URL search params agar bertahan saat berpindah tab/halaman dan dapat dibagikan
 * (PRD §8.1). JANGAN menaruh data pribadi siswa (nama, telepon) di URL (PRD §12.2) —
 * gunakan ID atau kata kunci pencarian yang tidak disimpan (lihat `persist: false` di SearchInput).
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

export function FilterBar({ children, onReset, className }: { children: ReactNode; onReset?: () => void; className?: string }) {
  return (
    <div
      role="search"
      className={cn(
        'no-print grid grid-cols-1 items-end gap-3 rounded-xl border bg-card p-3 shadow-xs sm:grid-cols-2 lg:flex lg:flex-wrap',
        className,
      )}
    >
      {children}
      {onReset && (
        <Button variant="ghost" size="sm" onClick={onReset} className="justify-self-start lg:ml-auto">
          <X /> Reset filter
        </Button>
      )}
    </div>
  )
}

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-w-0 gap-1 lg:min-w-40', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

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
  return (
    <FilterField label={label} className={className}>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </FilterField>
  )
}

export function FilterDate({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
}) {
  return (
    <FilterField label={label}>
      <Input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    </FilterField>
  )
}

/** Input pencarian dengan debounce. */
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
    <FilterField label={label} className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pl-8"
        />
      </div>
    </FilterField>
  )
}
