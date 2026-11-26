import {
  BookOpenCheck,
  CalendarClock,
  NotebookPen,
  RefreshCw,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { DatePickerPill } from '@/components/date-picker-pill'
import { useFilters } from '@/components/filter-bar'
import { KpiCard } from '@/components/kpi-card'
import { CardsSkeleton, ErrorState, Page } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useCurrentUser } from '@/features/auth/auth-context'
import { formatDate, formatDateLong, todayISO } from '@/lib/date'
import { formatRoleLabels } from '@/lib/enums'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardSummary } from '@/types/entities'
import { AttendanceDistribution } from '../components/attendance-distribution'
import { LatestUpdates } from '../components/latest-updates'
import { AttendanceTrendChart } from '../components/nuvio-card'
import { PendingTasks } from '../components/pending-tasks'
import { useDashboardSummary } from '../queries'
import { formatPercent, greeting, percent, withQuery } from '../utils'

/**
 * Dashboard operasional Guru Piket khusus 4 modul aktif:
 * Absensi Guru & Jam Kosong, Agenda Guru, Siswa Tidak Hadir (S/I/A/D/P), dan Jam Tambahan.
 */
export function DashboardPage() {
  const user = useCurrentUser()
  const today = todayISO()
  const { values, set } = useFilters({ date: today })
  const date = values.date
  const isToday = date === today
  const query = useDashboardSummary({ date })

  const reload = async () => {
    const res = await query.refetch()
    if (res.isSuccess) toast.success('Ringkasan dashboard diperbarui.')
  }

  return (
    <Page className="gap-5">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-[22px]">
            {greeting()}, {user.name}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {formatDateLong(date)}
            {user.roles.length > 0 && (
              <>
                <span aria-hidden> · </span>
                Peran:{' '}
                <span className="font-medium text-foreground/85">{formatRoleLabels(user.roles)}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DatePickerPill
            id="dash-date"
            date={date}
            maxDate={today}
            onChange={(next) => set({ date: next })}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => void reload()}
            disabled={query.isFetching}
            aria-label="Muat ulang ringkasan"
            title="Muat ulang"
          >
            <RefreshCw className={cn(query.isFetching && 'animate-spin')} aria-hidden />
          </Button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {query.isFetching && query.data ? 'Memperbarui ringkasan…' : ''}
      </p>

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DashboardContent
          summary={query.data}
          date={date}
          isToday={isToday}
          stale={query.isPlaceholderData}
        />
      )}
    </Page>
  )
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Memuat ringkasan dashboard">
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <CardsSkeleton count={3} />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-[440px] rounded-xl lg:col-span-4" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}

function DashboardContent({
  summary,
  date,
  isToday,
  stale,
}: {
  summary: DashboardSummary
  date: string
  isToday: boolean
  stale: boolean
}) {
  const ta = summary.teacherAttendance
  const sub = summary.substitutions
  const abs = summary.absentees
  const agenda = summary.agendaGuru
  const extra = summary.jamTambahan
  const trendDays = summary.trends.days
  const dateParam = isToday ? undefined : date

  const fraction = (a: number, b: number) => (
    <>
      {formatNumber(a)}
      <span className="text-base font-medium text-muted-foreground">/{formatNumber(b)}</span>
    </>
  )

  const agendaPct = percent(agenda.signed, agenda.total)
  const extraPct = percent(extra.signed, extra.total)

  const distribution = (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dist-title" className="text-xs font-semibold">
          Sebaran siswa tidak hadir {isToday ? 'hari ini' : formatDate(date)}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          Total {formatNumber(abs.total)} siswa
        </span>
      </div>
      <AttendanceDistribution counts={abs} />
    </div>
  )

  return (
    <div className={cn('flex flex-col gap-5 transition-opacity', stale && 'opacity-60')}>
      <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          <section aria-labelledby="stats-title">
            <h2 id="stats-title" className="sr-only">
              Ringkasan {isToday ? 'hari ini' : formatDateLong(date)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label="Kehadiran Guru"
                icon={<UserCheck />}
                value={fraction(ta.present, ta.scheduled)}
                hint={`Tidak hadir ${ta.absent} · terlambat ${ta.late}`}
                actionLabel="Detail"
                href={withQuery('/absensi-guru', { date: dateParam })}
              />
              <KpiCard
                label="Jam Kosong Terisi"
                icon={<CalendarClock />}
                value={formatNumber(sub.handledSlots)}
                hint={
                  sub.affectedSlots === 0
                    ? 'Tidak ada jam kosong'
                    : sub.unhandledSlots > 0
                      ? `${sub.unhandledSlots} slot belum ada pengganti`
                      : 'Semua jam kosong sudah terisi'
                }
                actionLabel="Kelola"
                href={withQuery('/absensi-guru', { date: dateParam })}
              />
              <KpiCard
                label="Siswa Tidak Hadir"
                icon={<UserX />}
                value={formatNumber(abs.total)}
                deltaPct={summary.trends.absentDeltaPct}
                upIsGood={false}
                hint={`S ${abs.SICK} · I ${abs.PERMISSION} · A ${abs.ABSENT} · D ${abs.EXCUSED} · P ${abs.PKL}`}
                sparkline={trendDays.map((d) => d.absentStudents)}
                href={withQuery('/absensi-siswa', { date: dateParam })}
              />
            </div>
          </section>

          <AttendanceTrendChart trends={summary.trends} selectedDate={date} footer={distribution} />
        </div>

        <div className="flex min-w-0 flex-col lg:col-span-4">
          <LatestUpdates activities={summary.activities} className="flex-1" />
        </div>
      </div>

      <section aria-label="Ringkasan agenda dan jam tambahan" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label="Agenda Guru"
          icon={<NotebookPen />}
          value={formatNumber(agenda.total)}
          deltaPct={summary.trends.agendaSignedDeltaPct}
          hint={
            agenda.total === 0
              ? 'Belum ada kegiatan mengajar tercatat'
              : `${agenda.signed} sudah TTD (${formatPercent(agendaPct)})`
          }
          sparkline={trendDays.map((d) => d.agendaSigned)}
          actionLabel="Buka Agenda"
          href={withQuery('/agenda-guru', { date: dateParam })}
        />
        <KpiCard
          label="Jam Tambahan"
          icon={<BookOpenCheck />}
          value={formatNumber(extra.total)}
          hint={
            extra.total === 0
              ? 'Belum ada jam tambahan hari ini'
              : `${extra.signed} sudah TTD (${formatPercent(extraPct)})`
          }
          actionLabel="Buka Jam Tambahan"
          href={withQuery('/jam-tambahan', { date: dateParam })}
        />
      </section>

      <PendingTasks tasks={summary.pendingTasks} />
    </div>
  )
}
