import { ArrowRight, Settings, ShieldUser, ScrollText, SquarePen, type LucideIcon } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CountChip, FramedCard } from '@/components/framed-card'
import { SegmentedControl } from '@/components/segmented-control'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/date'
import { AUDIT_ACTION_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AuditAction, SystemOverview } from '@/types/entities'
import { InlineEmpty } from './metric'

type ImportantEvent = SystemOverview['importantEvents'][number]
type EventFilter = 'all' | 'correction' | 'account' | 'settings'

const ACCOUNT_ACTIONS: readonly AuditAction[] = ['ROLE_CHANGE', 'STATUS_CHANGE', 'PASSWORD_RESET']
const SETTINGS_ENTITIES = new Set(['SchoolSettings', 'DutyAssignment'])

function categoryOf(e: ImportantEvent): Exclude<EventFilter, 'all'> | null {
  if (e.action === 'CORRECT' || e.action === 'DELETE') return 'correction'
  if (ACCOUNT_ACTIONS.includes(e.action) || e.entity === 'User') return 'account'
  if (SETTINGS_ENTITIES.has(e.entity)) return 'settings'
  return null
}

const CATEGORY_ICON: Record<Exclude<EventFilter, 'all'>, { icon: LucideIcon; className: string }> = {
  correction: { icon: SquarePen, className: 'text-tone-warning' },
  account: { icon: ShieldUser, className: 'text-tone-info' },
  settings: { icon: Settings, className: 'text-muted-foreground' },
}

const LIMIT = 8

/** Kartu "Kejadian Penting": linimasa audit berisiko (koreksi, hapus, akun, pengaturan). */
export function ImportantEventsCard({
  events,
  className,
}: {
  events: SystemOverview['importantEvents']
  className?: string
}) {
  const [filter, setFilter] = useState<EventFilter>('all')
  const listId = useId()

  const counts = useMemo(() => {
    const c = { all: events.length, correction: 0, account: 0, settings: 0 }
    for (const e of events) {
      const k = categoryOf(e)
      if (k) c[k]++
    }
    return c
  }, [events])

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => categoryOf(e) === filter)),
    [events, filter],
  )

  const options = [
    { value: 'all' as const, label: 'Semua', count: counts.all },
    { value: 'correction' as const, label: 'Koreksi & Hapus', count: counts.correction },
    { value: 'account' as const, label: 'Akun', count: counts.account },
    { value: 'settings' as const, label: 'Pengaturan', count: counts.settings },
  ]

  return (
    <FramedCard
      title="Kejadian Penting"
      titleId="sa-events-title"
      icon={<ScrollText />}
      titleBadge={<CountChip>{events.length}</CountChip>}
      className={className}
      bodyClassName="gap-3"
      headerRight={
        <Button asChild variant="ghost" size="sm">
          <Link to="/audit">
            Audit Log <ArrowRight className="text-muted-foreground" />
          </Link>
        </Button>
      }
    >
      <SegmentedControl
        ariaLabel="Jenis kejadian"
        value={filter}
        onChange={setFilter}
        options={options}
        size="sm"
        fullWidth
      />

      {filtered.length === 0 ? (
        <InlineEmpty>Belum ada kejadian penting untuk kategori ini.</InlineEmpty>
      ) : (
        <ol id={listId} aria-label="Daftar kejadian penting" className="-mx-1 max-h-[420px] overflow-y-auto px-1">
          {filtered.slice(0, LIMIT).map((e, i, arr) => {
            const cat = categoryOf(e)
            const ic = cat
              ? CATEGORY_ICON[cat]
              : { icon: AUDIT_ACTION_META[e.action]?.icon ?? Settings, className: 'text-muted-foreground' }
            const Icon = ic.icon
            const last = i === arr.length - 1
            return (
              <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[13.5px] w-px bg-border" />}
                <span
                  aria-hidden
                  className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/85 bg-card shadow-2xs"
                >
                  <Icon className={cn('size-3.5', ic.className)} />
                </span>
                <Link
                  to={e.href}
                  className="-mx-1.5 min-w-0 flex-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-center justify-between gap-2">
                    <StatusBadge meta={AUDIT_ACTION_META} value={e.action} />
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {formatDateTime(e.timestamp)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-foreground/85">
                    {e.summary}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.actorName} · {e.entity}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
      {filtered.length > LIMIT && (
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Menampilkan {LIMIT} dari {filtered.length} kejadian.
        </p>
      )}
    </FramedCard>
  )
}
