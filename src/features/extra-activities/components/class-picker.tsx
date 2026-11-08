import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/misc'
import { useClasses } from '@/features/master-data/lookups'
import { cn } from '@/lib/utils'
import type { ID } from '@/types/entities'

/**
 * Pemilih banyak kelas dengan checkbox, dikelompokkan per tingkat (FR-EXT-02).
 * Satu kegiatan induk dapat memuat beberapa kelas.
 */
export function ClassPicker({
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
}: {
  value: ID[]
  onChange: (ids: ID[]) => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
}) {
  const classes = useClasses()
  const groups = useMemo(() => {
    const map = new Map<number, { id: ID; name: string; studentCount?: number }[]>()
    for (const c of classes.data ?? []) {
      if (c.status !== 'ACTIVE' && !value.includes(c.id)) continue
      map.set(c.grade, [...(map.get(c.grade) ?? []), c])
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([grade, items]) => ({ grade, items: items.sort((a, b) => a.name.localeCompare(b.name, 'id')) }))
  }, [classes.data, value])

  const selected = new Set(value)
  const toggle = (id: ID, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    // pertahankan urutan tampilan
    onChange(groups.flatMap((g) => g.items.map((c) => c.id)).filter((x) => next.has(x)))
  }

  if (classes.isPending) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    )
  }
  if (classes.isError) {
    return <p className="text-sm text-destructive">Gagal memuat daftar kelas. Tutup lalu buka kembali formulir.</p>
  }

  return (
    <div
      role="group"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={cn('space-y-3 rounded-lg border p-3', invalid && 'border-destructive')}
    >
      {groups.map((g) => (
        <fieldset key={g.grade} className="space-y-1.5">
          <legend className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Kelas {romanGrade(g.grade)}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {g.items.map((c) => {
              const id = `cls-pick-${c.id}`
              const checked = selected.has(c.id)
              return (
                <label
                  key={c.id}
                  htmlFor={id}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors',
                    checked ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={(v) => toggle(c.id, v === true)}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  {c.studentCount !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">{c.studentCount}</span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {value.length} kelas dipilih
      </p>
    </div>
  )
}

function romanGrade(g: number) {
  return ({ 10: 'X', 11: 'XI', 12: 'XII' } as Record<number, string>)[g] ?? String(g)
}
