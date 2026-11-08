import { Check, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { ErrorState } from '@/components/page'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { ID } from '@/types/entities'
import { useClassStudents } from '../queries'

/**
 * Daftar siswa satu kelas yang dapat dicari (nama/NIS). Pencarian hanya di memori —
 * tidak pernah masuk URL (PRD §12.2).
 */
export function StudentPicker({
  classId,
  value,
  onChange,
  error,
  disabled,
  labelId,
}: {
  classId: ID | null
  value: ID
  onChange: (id: ID) => void
  error?: string
  disabled?: boolean
  labelId: string
}) {
  const students = useClassStudents(classId)
  const [q, setQ] = useState('')
  const searchId = useId()
  const errorId = `${searchId}-error`

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const all = students.data ?? []
    if (!needle) return all
    return all.filter((s) => s.name.toLowerCase().includes(needle) || s.nis.includes(needle))
  }, [students.data, q])

  if (!classId) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
        Pilih kelas terlebih dahulu untuk menampilkan daftar siswa.
      </p>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={searchId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau NIS…"
          aria-label="Cari siswa"
          className="pl-8"
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      {students.isPending ? (
        <div className="grid gap-1.5" aria-busy="true" aria-label="Memuat daftar siswa">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      ) : students.isError ? (
        <ErrorState error={students.error} onRetry={() => void students.refetch()} className="py-6" />
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'max-h-56 overflow-y-auto overscroll-contain rounded-lg border bg-background p-1',
            error && 'border-destructive',
          )}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {(students.data ?? []).length === 0
                ? 'Belum ada siswa aktif di kelas ini.'
                : 'Tidak ada siswa yang cocok dengan pencarian.'}
            </p>
          ) : (
            filtered.map((s) => {
              const selected = s.id === value
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onChange(s.id)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors duration-100 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    selected && 'bg-accent text-accent-foreground',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {selected && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">NIS {s.nis}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
