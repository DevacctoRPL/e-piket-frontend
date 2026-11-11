import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  History,
  NotebookPen,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FramedCard } from '@/components/framed-card'
import { SearchField } from '@/components/search-field'
import { SegmentedControl } from '@/components/segmented-control'
import { cn } from '@/lib/utils'
import type { DashboardActivityItem } from '@/types/entities'

type BucketTab = 'today' | 'yesterday' | 'week'

const TABS: Array<{ value: BucketTab; label: string }> = [
  { value: 'today', label: 'Hari ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'week', label: 'Minggu ini' },
]

/** Kotak ikon selalu netral; hanya ikonnya yang diberi warna makna (gaya referensi Nuvio). */
const KIND: Record<DashboardActivityItem['kind'], { icon: LucideIcon; iconClass: string }> = {
  ATTENDANCE: { icon: ClipboardList, iconClass: 'text-tone-success' },
  TEACHER: { icon: UserCheck, iconClass: 'text-tone-danger' },
  SUBSTITUTION: { icon: CalendarClock, iconClass: 'text-tone-info' },
  DISMISSAL: { icon: DoorOpen, iconClass: 'text-tone-warning' },
  LOG: { icon: NotebookPen, iconClass: 'text-tone-purple' },
  DUTY: { icon: ShieldCheck, iconClass: 'text-muted-foreground' },
}

const LIMIT = 10

/**
 * Panel "Pembaruan Terkini" (setara "Latest Updates" referensi Nuvio): kontrol segmen periode,
 * pencarian, jumlah aktivitas, lalu linimasa vertikal dengan garis penghubung.
 */
export function LatestUpdates({
  activities = [],
  className,
}: {
  activities?: DashboardActivityItem[]
  className?: string
}) {
  const [tab, setTab] = useState<BucketTab>('today')
  const [search, setSearch] = useState('')
  const listId = useId()

  const counts = useMemo(
    () => ({
      today: activities.filter((a) => a.bucket === 'today').length,
      yesterday: activities.filter((a) => a.bucket === 'yesterday').length,
      week: activities.length,
    }),
    [activities],
  )

  const filtered = useMemo(() => {
    const byTab = tab === 'week' ? activities : activities.filter((a) => a.bucket === tab)
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
  }, [activities, tab, search])

  const periodText = tab === 'today' ? 'hari ini' : tab === 'yesterday' ? 'kemarin' : '7 hari terakhir'

  return (
    <FramedCard
      title="Pembaruan Terkini"
      titleId="latest-updates-title"
      icon={<History />}
      className={cn('h-full', className)}
      bodyClassName="gap-3"
    >
      <SegmentedControl
        ariaLabel="Rentang waktu aktivitas"
        value={tab}
        onChange={setTab}
        options={TABS}
        fullWidth
      />
      <SearchField
        value={search}
        onValueChange={setSearch}
        placeholder="Cari aktivitas"
        aria-label="Cari aktivitas"
        aria-controls={listId}
      />

      <p className="text-xs text-muted-foreground" aria-live="polite">
        <span className="font-semibold text-tone-success tabular-nums">{filtered.length}</span>{' '}
        {search ? 'aktivitas cocok' : 'aktivitas'} {periodText}
        {filtered.length > LIMIT && <span className="tabular-nums"> · menampilkan {LIMIT} terbaru</span>}
        {tab !== 'week' && counts[tab] === 0 && counts.week > 0 && ' — lihat "Minggu ini"'}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center">
          <p className="text-xs font-medium text-foreground">Belum ada aktivitas</p>
          <p className="mt-1 text-xs text-muted-foreground">Pilih periode lain atau ubah kata kunci.</p>
        </div>
      ) : (
        <ol id={listId} aria-label="Daftar aktivitas terkini" className="-mx-1 max-h-[440px] flex-1 overflow-y-auto px-1">
          {filtered.slice(0, LIMIT).map((item, i, arr) => {
            const k = KIND[item.kind]
            const Icon = k.icon
            const last = i === arr.length - 1
            return (
              <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0">
                {/* garis penghubung linimasa */}
                {!last && (
                  <span aria-hidden className="absolute top-8 bottom-0 left-[13.5px] w-px bg-border" />
                )}
                <span
                  aria-hidden
                  className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/85 bg-card shadow-2xs"
                >
                  <Icon className={cn('size-3.5', k.iconClass)} />
                </span>
                <Link
                  to={item.href}
                  className="group -mx-1.5 min-w-0 flex-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{item.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{item.timeLabel}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </FramedCard>
  )
}
