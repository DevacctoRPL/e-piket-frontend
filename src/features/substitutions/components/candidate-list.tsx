import { AlertTriangle, BookOpen, CheckCircle2, Clock } from 'lucide-react'
import { ToneBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { SubstituteCandidate } from '@/types/entities'
import { CONFLICT_META } from '../utils'

/**
 * Daftar kandidat guru pengganti sebagai radio group yang dapat diakses keyboard.
 * Konflik jadwal selalu ditampilkan dengan teks (bukan hanya warna) — PRD §9.3.
 */
export function CandidateList({
  candidates,
  selectedId,
  onSelect,
  name,
  invalid,
  describedBy,
}: {
  candidates: SubstituteCandidate[]
  selectedId: string
  onSelect: (id: string) => void
  name: string
  invalid?: boolean
  describedBy?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Kandidat guru pengganti"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className="grid gap-2"
    >
      {candidates.map((c) => {
        const absent = c.conflicts.some((x) => x.type === 'TEACHER_ABSENT')
        const busy = c.conflicts.length > 0
        const selected = selectedId === c.teacher.id
        const inputId = `${name}-${c.teacher.id}`
        return (
          <label
            key={c.teacher.id}
            htmlFor={inputId}
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border bg-card p-3 shadow-xs transition-[border-color,box-shadow] duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
              selected && 'border-primary ring-1 ring-primary',
              !selected && busy && 'border-tone-warning/40',
              absent && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              id={inputId}
              type="radio"
              name={name}
              value={c.teacher.id}
              checked={selected}
              disabled={absent}
              onChange={() => onSelect(c.teacher.id)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="grid min-w-0 flex-1 gap-1.5">
              <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="min-w-0 font-medium break-words">{c.teacher.name}</span>
                {busy ? (
                  <span className="flex flex-wrap gap-1">
                    {[...new Set(c.conflicts.map((x) => x.type))].map((t) => (
                      <ToneBadge key={t} tone={CONFLICT_META[t].tone}>
                        {CONFLICT_META[t].label}
                      </ToneBadge>
                    ))}
                  </span>
                ) : (
                  <ToneBadge tone="success">Tersedia</ToneBadge>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">NIP {c.teacher.nip}</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3" aria-hidden /> {c.loadPeriods} jam hari ini
                </span>
                {c.teachesSameSubject && (
                  <span className="inline-flex items-center gap-1 font-medium text-tone-info">
                    <BookOpen className="size-3" aria-hidden /> Mapel sama
                  </span>
                )}
              </span>
              {busy && (
                <ul className="grid gap-0.5 text-xs">
                  {c.conflicts.map((x, i) => (
                    <li
                      key={i}
                      className={cn(
                        'flex items-start gap-1.5',
                        x.type === 'TEACHER_ABSENT' ? 'text-tone-danger' : 'text-tone-warning',
                      )}
                    >
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                      <span>{x.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {selected && !busy && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-tone-success">
                  <CheckCircle2 className="size-3" aria-hidden /> Dipilih
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

export function CandidateListSkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Memuat kandidat">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] rounded-xl" />
      ))}
    </div>
  )
}
