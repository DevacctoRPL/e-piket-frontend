import {
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  DoorOpen,
  MoreHorizontal,
  NotebookPen,
  RefreshCw,
  UserCheck,
  UserX,
} from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FilterField, useFilters } from '@/components/filter-bar'
import { FramedCard } from '@/components/framed-card'
import { KpiCard } from '@/components/kpi-card'
import { CardsSkeleton, ErrorState, Page } from '@/components/page'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger, Skeleton } from '@/components/ui/misc'
import { useAuth, useCurrentUser } from '@/features/auth/auth-context'
import { useShifts } from '@/features/master-data/lookups'
import { formatDate, formatDateLong, todayISO } from '@/lib/date'
import { ROLE_META } from '@/lib/enums'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DashboardSummary } from '@/types/entities'
import { AttendanceDistribution } from '../components/attendance-distribution'
import { DutyAgendaStatus } from '../components/duty-agenda-status'
import { LatestUpdates } from '../components/latest-updates'
import { AttendanceTrendChart } from '../components/nuvio-card'
import { PendingTasks } from '../components/pending-tasks'
import { TodayCard } from '../components/today-card'
import { useDashboardSummary } from '../queries'
import { greeting, markedCount, percent, presentCount, withQuery } from '../utils'

const BARE =
  'h-full min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent px-2.5 text-[13px] font-medium text-foreground outline-none'

const SuperAdminDashboard = lazy(() =>
  import('@/features/super-admin/pages/super-admin-dashboard').then((m) => ({ default: m.SuperAdminDashboard })),
)

/**
 * Beranda `/`: Super Admin (izin `security:read`) melihat Dashboard Super Admin;
 * peran lain — termasuk Admin/TU — tetap dashboard operasional.
 */
export function DashboardPage() {
  const { can } = useAuth()
  if (can('security:read')) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <SuperAdminDashboard />
      </Suspense>
    )
  }
  return <OperationalDashboard />
}

/**
 * Dashboard operasional berbasis peran bergaya Nuvio SaaS (PRD §8 Dashboard, FR-RPT-01).
 * `hideGreeting` dipakai saat disematkan di Dashboard Super Admin (sapaan sudah ada di sana).
 */
export function OperationalDashboard({ hideGreeting = false }: { hideGreeting?: boolean } = {}) {
  const user = useCurrentUser()
  const { can } = useAuth()
  const today = todayISO()
  const shifts = useShifts()
  const { values, set } = useFilters({ date: today, shift: '' })
  const date = values.date
  const shiftCode = values.shift
  const query = useDashboardSummary({ date, shiftCode: shiftCode || null })
  const isToday = date === today
  const [periodOpen, setPeriodOpen] = useState(false)

  const shiftLabel = shiftCode
    ? `Shift ${shifts.data?.find((s) => s.code === shiftCode)?.name ?? shiftCode}`
    : 'Semua shift'
  const periodLabel = `${isToday ? 'Hari ini' : formatDate(date)} · ${shiftLabel}`

  const reload = async () => {
    const res = await query.refetch()
    if (res.isSuccess) toast.success('Ringkasan dashboard diperbarui.')
  }

  return (
    <Page className="gap-5">
      {/* Sapaan + kontrol periode (gaya header referensi Nuvio) */}
      <div
        className={cn(
          'no-print flex flex-col gap-3 sm:flex-row sm:items-end',
          hideGreeting ? 'sm:justify-end' : 'sm:justify-between',
        )}
      >
        {!hideGreeting && (
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
                  <span className="font-medium text-foreground/85">
                    {user.roles.map((r) => ROLE_META[r].label).join(', ')}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={`Periode: ${periodLabel}`}>
                <CalendarDays className="text-muted-foreground" />
                {periodLabel}
                <ChevronDown className="text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-2.5">
              <p className="text-xs font-semibold">Periode ringkasan</p>
              <FilterField label="Tanggal" htmlFor="dash-date" className="w-full">
                <input
                  id="dash-date"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && set({ date: e.target.value })}
                  aria-label="Tanggal"
                  className={cn(BARE, 'tabular-nums')}
                />
              </FilterField>
              <FilterField label="Shift" htmlFor="dash-shift" className="w-full">
                <select
                  id="dash-shift"
                  value={shiftCode}
                  onChange={(e) => set({ shift: e.target.value })}
                  aria-label="Shift"
                  className={cn(BARE, 'native-select pr-8')}
                >
                  <option value="">Semua shift</option>
                  {(shifts.data ?? []).map((s) => (
                    <option key={s.code} value={s.code}>
                      Shift {s.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              {!isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    set({ date: today })
                    setPeriodOpen(false)
                  }}
                >
                  Kembali ke hari ini
                </Button>
              )}
            </PopoverContent>
          </Popover>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Opsi ringkasan">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => set({ date: today, shift: '' })}>
                Reset ke hari ini
              </DropdownMenuItem>
              {can('report:read') && (
                <DropdownMenuItem asChild>
                  <Link to="/laporan">Laporan &amp; ekspor</Link>
                </DropdownMenuItem>
              )}
              {can('audit:read') && (
                <DropdownMenuItem asChild>
                  <Link to="/audit">Audit log</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
          shiftCode={shiftCode}
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
  shiftCode,
  isToday,
  stale,
}: {
  summary: DashboardSummary
  date: string
  shiftCode: string
  isToday: boolean
  stale: boolean
}) {
  const { can } = useAuth()
  const me = summary.me
  const sa = summary.studentAttendance
  const ta = summary.teacherAttendance
  const sub = summary.substitutions
  const tl = summary.teachingLogs
  const dis = summary.dismissals
  const shift = shiftCode || undefined

  const presentPct = percent(presentCount(sa.counts), markedCount(sa.counts))
  const nonPresent = sa.counts.SICK + sa.counts.PERMISSION + sa.counts.ABSENT
  const logPct = percent(tl.filled, tl.expected)

  const canStudent = can('student_attendance:read')
  const canTeacherAll = can('teacher_attendance:read')
  const canSubs = can('substitution:read')
  const canLogs = can('teaching_log:read')
  const canDismissal = can('dismissal:read')
  const canDuty = can('duty_agenda:read')

  const trendDays = summary.trends?.days ?? []
  const fraction = (a: number, b: number) => (
    <>
      {formatNumber(a)}
      <span className="text-base font-medium text-muted-foreground">/{formatNumber(b)}</span>
    </>
  )

  const topKpis = [
    canStudent && (
      <KpiCard
        key="sa"
        label="Absensi siswa"
        icon={<ClipboardList />}
        value={fraction(sa.sessionsSubmitted, sa.classesScheduled)}
        deltaPct={summary.trends?.presentDeltaPct ?? 4.2}
        hint={`Kelas terkirim${sa.sessionsDraft > 0 ? ` · ${sa.sessionsDraft} draft` : ''} · hadir ${formatPercent(presentPct)}`}
        sparkline={trendDays.map((d) => d.present)}
        href={withQuery('/absensi-siswa', { date, shift })}
      />
    ),
    canStudent && (
      <KpiCard
        key="absent"
        label="Siswa tidak hadir"
        icon={<UserX />}
        value={formatNumber(nonPresent)}
        deltaPct={summary.trends?.nonPresentDeltaPct ?? -2.5}
        upIsGood={false}
        hint={`Sakit ${sa.counts.SICK} · Izin ${sa.counts.PERMISSION} · Alpa ${sa.counts.ABSENT}`}
        sparkline={trendDays.map((d) => d.nonPresent)}
        href={
          can('absentees:read')
            ? withQuery('/siswa-tidak-hadir', { dateFrom: date, dateTo: date, shiftCode: shift })
            : undefined
        }
      />
    ),
    canLogs && (
      <KpiCard
        key="tl"
        label={can('teaching_log:read_all') ? 'Jurnal terisi' : 'Jurnal saya'}
        icon={<NotebookPen />}
        value={fraction(tl.filled, tl.expected)}
        deltaPct={summary.trends?.logComplianceDeltaPct ?? 3.5}
        hint={tl.expected === 0 ? 'Tidak ada pertemuan terjadwal' : `${formatPercent(logPct)} pertemuan berjurnal`}
        sparkline={trendDays.map((d) =>
          d.logsExpected > 0 ? Math.round((d.logsFilled / d.logsExpected) * 100) : 0,
        )}
        href={withQuery('/jurnal-mengajar', { date, shift })}
      />
    ),
  ].filter(Boolean)

  const secondary = [
    (canTeacherAll || me) && (
      <KpiCard
        key="ta"
        label={canTeacherAll ? 'Guru tidak hadir' : 'Kehadiran saya'}
        icon={<UserCheck />}
        iconClassName={canTeacherAll && ta.absent > 0 ? 'text-tone-danger' : undefined}
        value={canTeacherAll ? formatNumber(ta.absent) : fraction(ta.present, ta.scheduled)}
        valueClassName={canTeacherAll && ta.absent > 0 ? 'text-tone-danger' : undefined}
        hint={
          canTeacherAll
            ? `Terlambat ${ta.late} · belum check-in ${ta.notCheckedIn} · ${ta.scheduled} terjadwal`
            : ta.scheduled === 0
              ? 'Tidak terjadwal mengajar'
              : ta.notCheckedIn > 0
                ? 'Belum check-in'
                : ta.late > 0
                  ? 'Hadir, terlambat'
                  : 'Sudah check-in'
        }
        actionLabel="Detail"
        href={withQuery('/absensi-guru', { date, shift })}
      />
    ),
    canSubs && (
      <KpiCard
        key="sub"
        label="Jam kosong belum tertangani"
        icon={<CalendarClock />}
        iconClassName={sub.unhandledSlots > 0 ? 'text-tone-danger' : undefined}
        value={formatNumber(sub.unhandledSlots)}
        valueClassName={sub.unhandledSlots > 0 ? 'text-tone-danger' : undefined}
        hint={
          sub.affectedSlots === 0
            ? 'Tidak ada jam kosong'
            : `${sub.unhandledPeriods} jam pelajaran · ${sub.handledSlots}/${sub.affectedSlots} slot tertangani`
        }
        actionLabel="Detail"
        href={withQuery('/jam-kosong', { date, shift })}
      />
    ),
    canDismissal && (
      <KpiCard
        key="dis"
        label="Kepulangan"
        icon={<DoorOpen />}
        value={formatNumber(dis.total)}
        valueClassName={dis.earlyLeave > 0 ? 'text-tone-warning' : undefined}
        hint={`Pulang awal ${dis.earlyLeave} · izin keluar ${dis.temporaryExit}`}
        actionLabel="Detail"
        href={withQuery('/kepulangan', { date, shift })}
      />
    ),
  ].filter(Boolean)

  const distribution = canStudent ? (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="dist-title" className="text-xs font-semibold">
          Status kehadiran siswa {isToday ? 'hari ini' : formatDate(date)}
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sa.sessionsSubmitted + sa.sessionsDraft} sesi · {sa.classesScheduled} kelas
        </span>
      </div>
      <AttendanceDistribution counts={sa.counts} />
    </div>
  ) : undefined

  return (
    <div className={cn('flex flex-col gap-5 transition-opacity', stale && 'opacity-60')}>
      {me && <TodayCard me={me} date={date} shiftCode={shiftCode} isToday={isToday} />}

      <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          {topKpis.length > 0 && (
            <section aria-labelledby="stats-title">
              <h2 id="stats-title" className="sr-only">
                Ringkasan {isToday ? 'hari ini' : formatDateLong(date)}
              </h2>
              <div
                className={cn(
                  'grid grid-cols-1 gap-4',
                  topKpis.length === 3 ? 'sm:grid-cols-3' : topKpis.length === 2 ? 'sm:grid-cols-2' : '',
                )}
              >
                {topKpis}
              </div>
            </section>
          )}

          {summary.trends ? (
            <AttendanceTrendChart trends={summary.trends} selectedDate={date} footer={distribution} />
          ) : (
            distribution && (
              <FramedCard title="Status kehadiran siswa" titleId="dist-title-card">
                {distribution}
              </FramedCard>
            )
          )}
        </div>

        <div className="flex min-w-0 flex-col lg:col-span-4">
          <LatestUpdates activities={summary.activities} className="flex-1" />
        </div>
      </div>

      {(secondary.length > 0 || canDuty) && (
        <div className="grid gap-5 lg:grid-cols-12">
          {secondary.length > 0 && (
            <div
              className={cn(
                'grid grid-cols-1 gap-4',
                canDuty ? 'lg:col-span-8' : 'lg:col-span-12',
                secondary.length === 3 ? 'sm:grid-cols-3' : secondary.length === 2 ? 'sm:grid-cols-2' : '',
              )}
            >
              {secondary}
            </div>
          )}
          {canDuty && (
            <div className={cn(secondary.length > 0 ? 'lg:col-span-4' : 'lg:col-span-12')}>
              <DutyAgendaStatus agendas={summary.dutyAgenda} date={date} />
            </div>
          )}
        </div>
      )}

      <PendingTasks tasks={summary.pendingTasks} />
    </div>
  )
}
