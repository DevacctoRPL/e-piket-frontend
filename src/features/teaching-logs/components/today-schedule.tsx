import { ArrowRight, BadgeCheck, CalendarClock, CalendarX2, Clock, NotebookPen, Plus, Repeat2 } from 'lucide-react'
import { Link } from 'react-router'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState } from '@/components/page'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useLookupMaps } from '@/features/master-data/lookups'
import { formatDateLong, formatWallTime, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TodayTeachingSlot } from '@/types/entities'
import { SLOT_LOG_META, periodLabel, slotHref, slotLogState, todayProgress } from '../meta'
import { useTodayTeachingSlots } from '../queries'

/** FR-TEACH-01: jadwal mengajar hari ini (termasuk tugas pengganti) beserta status jurnal. */
export function TodaySchedule({ date }: { date: string }) {
  const query = useTodayTeachingSlots(date)
  const isToday = date === todayISO()

  if (query.isPending) return <TodaySkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  const slots = query.data
  const freeHref = `/jurnal-mengajar/baru?${new URLSearchParams({ date }).toString()}`

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX2 className="size-5" />}
        title={isToday ? 'Tidak ada jadwal mengajar hari ini' : 'Tidak ada jadwal mengajar pada tanggal ini'}
        description="Jadwal mengikuti data master dan penugasan guru pengganti. Bila Anda mengajar di luar jadwal, catat jurnalnya secara manual."
        action={
          <Button asChild variant="outline">
            <Link to={freeHref}>
              <Plus /> Catat jurnal di luar jadwal
            </Link>
          </Button>
        }
      />
    )
  }

  const p = todayProgress(slots)
  const pct = p.total ? Math.round((p.filled / p.total) * 100) : 0

  return (
    <FramedCard
      title="Jadwal mengajar"
      icon={<CalendarClock />}
      titleBadge={<CountChip>{p.total}</CountChip>}
      headerRight={
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link to={freeHref}>
            <Plus /> Di luar jadwal
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      <section aria-label="Kemajuan pengisian jurnal" className="space-y-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            <span className="tabular-nums">{p.filled}</span> dari <span className="tabular-nums">{p.total}</span>{' '}
            jurnal terisi
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{pct}%</p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={p.total}
          aria-valuenow={p.filled}
          aria-label="Jurnal terisi"
        >
          <div
            className="h-full rounded-full bg-foreground/80 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateLong(date)}
          {p.draft > 0 && ` · ${p.draft} masih draft, finalisasi setelah pembelajaran selesai`}
        </p>
      </section>

      <ol className="divide-y divide-border/60" aria-label="Jadwal mengajar">
        {slots.map((s) => (
          <SlotCard key={`${s.slot.id}-${s.substitutionRecordId ?? 'own'}`} item={s} date={date} />
        ))}
      </ol>
    </FramedCard>
  )
}

function SlotCard({ item, date }: { item: TodayTeachingSlot; date: string }) {
  const { shiftName } = useLookupMaps()
  const state = slotLogState(item.log)
  const { slot } = item
  return (
    <li
      className={cn(
        'flex flex-col gap-3 border-l-2 border-l-transparent px-4 py-3 sm:flex-row sm:items-center sm:gap-4',
        state === 'EMPTY' && 'border-l-tone-warning',
      )}
    >
      <div className="flex shrink-0 items-center gap-3 sm:w-40">
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border border-border/80 bg-muted/45 text-foreground">
          <span className="text-[10px] leading-none text-muted-foreground">Jam</span>
          <span className="text-sm leading-tight font-semibold tabular-nums">
            {slot.periodStart === slot.periodEnd ? slot.periodStart : `${slot.periodStart}-${slot.periodEnd}`}
          </span>
        </span>
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-1 font-medium tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            {formatWallTime(item.startTime)}–{formatWallTime(item.endTime)}
          </p>
          <p className="text-xs text-muted-foreground">Shift {shiftName(slot.shiftCode)}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold">{item.className}</p>
          <span className="text-muted-foreground" aria-hidden>
            ·
          </span>
          <p className="min-w-0 truncate text-sm">{item.subjectName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge meta={SLOT_LOG_META} value={state} />
          {item.isSubstitution && (
            <ToneBadge tone="info">
              <Repeat2 className="size-3" aria-hidden /> Pengganti
            </ToneBadge>
          )}
          {item.log?.approvedAt && (
            <ToneBadge tone="success">
              <BadgeCheck className="size-3" aria-hidden /> Disahkan
            </ToneBadge>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {periodLabel(slot.periodStart, slot.periodEnd)} · JML {item.log?.periodCount ?? slot.periodCount}
          </span>
        </div>
        {item.log?.topic && (
          <p className="line-clamp-1 text-sm text-muted-foreground">Materi: {item.log.topic}</p>
        )}
      </div>

      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        aria-label={`${state === 'EMPTY' ? 'Isi jurnal' : state === 'DRAFT' ? 'Lanjutkan jurnal' : 'Lihat jurnal'} ${item.className} ${item.subjectName}`}
      >
        <Link to={slotHref(item, date)}>
          {state === 'EMPTY' ? (
            <>
              <NotebookPen /> Isi jurnal
            </>
          ) : state === 'DRAFT' ? (
            <>
              Lanjutkan <ArrowRight />
            </>
          ) : (
            <>
              Lihat <ArrowRight />
            </>
          )}
        </Link>
      </Button>
    </li>
  )
}

function TodaySkeleton() {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Memuat jadwal">
      <Skeleton className="h-20 rounded-xl" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
  )
}
