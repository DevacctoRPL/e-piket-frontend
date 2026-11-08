import {
  CalendarClock,
  ClipboardList,
  DoorOpen,
  NotebookPen,
  RefreshCw,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { ContextHeader } from '@/components/context-header'
import { useFilters } from '@/components/filter-bar'
import { CardsSkeleton, ErrorState, Page, PageHeader, StatCard } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useAuth, useCurrentUser } from '@/features/auth/auth-context'
import { formatDateLong, todayISO } from '@/lib/date'
import { ROLE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { DashboardSummary } from '@/types/entities'
import { AttendanceDistribution } from '../components/attendance-distribution'
import { DutyAgendaStatus } from '../components/duty-agenda-status'
import { PendingTasks } from '../components/pending-tasks'
import { TodayCard } from '../components/today-card'
import { useDashboardSummary } from '../queries'
import { useSpaLinks } from '../use-spa-links'
import { formatPercent, greeting, markedCount, percent, presentCount, withQuery } from '../utils'

/** Dashboard berbasis peran (PRD §8 Dashboard, FR-RPT-01). */
export function DashboardPage() {
  const user = useCurrentUser()
  const today = todayISO()
  const { values, set } = useFilters({ date: today, shift: '' })
  const date = values.date
  const shiftCode = values.shift
  const query = useDashboardSummary({ date, shiftCode: shiftCode || null })
  const isToday = date === today

  const reload = async () => {
    const res = await query.refetch()
    if (res.isSuccess) toast.success('Ringkasan dashboard diperbarui.')
  }

  return (
    <Page>
      <PageHeader
        title={`${greeting()}, ${user.name}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span>{formatDateLong(today)}</span>
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
            <span className="sr-only">Peran:</span>
            {user.roles.map((r) => (
              <ToneBadge key={r} tone={ROLE_META[r].tone}>
                {ROLE_META[r].label}
              </ToneBadge>
            ))}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={query.isFetching}
            aria-label="Muat ulang ringkasan"
          >
            <RefreshCw className={cn(query.isFetching && 'animate-spin')} aria-hidden />
            {query.isFetching ? 'Memuat…' : 'Muat ulang'}
          </Button>
        }
      />

      <ContextHeader
        date={date}
        onDateChange={(d) => set({ date: d })}
        shiftCode={shiftCode}
        onShiftChange={(s) => set({ shift: s })}
        allowAllShifts
        extra={
          !isToday ? (
            <Button variant="ghost" size="sm" onClick={() => set({ date: today })}>
              Kembali ke hari ini
            </Button>
          ) : null
        }
      />

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
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <CardsSkeleton count={6} />
      <Skeleton className="h-40 rounded-xl" />
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
  const onLinkClick = useSpaLinks()
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

  const stats = [
    canStudent && (
      <StatCard
        key="sa"
        label="Absensi siswa"
        icon={<ClipboardList />}
        tone={sa.classesScheduled > 0 && sa.sessionsSubmitted >= sa.classesScheduled ? 'success' : 'warning'}
        value={
          <>
            {sa.sessionsSubmitted}
            <span className="text-base font-semibold text-muted-foreground">/{sa.classesScheduled}</span>
          </>
        }
        hint={
          <>
            kelas terkirim{sa.sessionsDraft > 0 ? ` · ${sa.sessionsDraft} draft` : ''} · hadir{' '}
            {formatPercent(presentPct)}
          </>
        }
        href={withQuery('/absensi-siswa', { date, shift })}
      />
    ),
    canStudent && (
      <StatCard
        key="absent"
        label="Siswa tidak hadir"
        icon={<UserX />}
        tone={sa.counts.ABSENT > 0 ? 'danger' : 'neutral'}
        value={nonPresent}
        hint={`S ${sa.counts.SICK} · I ${sa.counts.PERMISSION} · A ${sa.counts.ABSENT}`}
        href={
          can('absentees:read')
            ? withQuery('/siswa-tidak-hadir', { dateFrom: date, dateTo: date, shift })
            : undefined
        }
      />
    ),
    (canTeacherAll || me) && (
      <StatCard
        key="ta"
        label={canTeacherAll ? 'Guru tidak hadir' : 'Kehadiran saya'}
        icon={<UserCheck />}
        tone={ta.absent > 0 ? 'danger' : ta.notCheckedIn > 0 ? 'warning' : 'success'}
        value={canTeacherAll ? ta.absent : `${ta.present}/${ta.scheduled}`}
        hint={
          canTeacherAll
            ? `Terlambat ${ta.late} · Belum check-in ${ta.notCheckedIn} · dari ${ta.scheduled} terjadwal`
            : ta.scheduled === 0
              ? 'Tidak terjadwal mengajar'
              : ta.notCheckedIn > 0
                ? 'Belum check-in'
                : ta.late > 0
                  ? 'Hadir · terlambat'
                  : ta.absent > 0
                    ? 'Tercatat tidak hadir'
                    : 'Sudah check-in'
        }
        href={withQuery('/absensi-guru', { date, shift })}
      />
    ),
    canSubs && (
      <StatCard
        key="sub"
        label="Jam kosong belum tertangani"
        icon={<CalendarClock />}
        tone={sub.unhandledSlots > 0 ? 'danger' : sub.affectedSlots > 0 ? 'success' : 'neutral'}
        value={sub.unhandledSlots}
        hint={
          sub.affectedSlots === 0
            ? 'Tidak ada jam kosong'
            : `${sub.unhandledPeriods} jam pelajaran · ${sub.handledSlots}/${sub.affectedSlots} slot tertangani`
        }
        href={withQuery('/jam-kosong', { date, shift })}
      />
    ),
    canLogs && (
      <StatCard
        key="tl"
        label={can('teaching_log:read_all') ? 'Jurnal terisi' : 'Jurnal saya'}
        icon={<NotebookPen />}
        tone={tl.expected > 0 && tl.filled >= tl.expected ? 'success' : 'info'}
        value={
          <>
            {tl.filled}
            <span className="text-base font-semibold text-muted-foreground">/{tl.expected}</span>
          </>
        }
        hint={tl.expected === 0 ? 'Tidak ada pertemuan terjadwal' : `${formatPercent(logPct)} pertemuan berjurnal`}
        href={withQuery('/jurnal-mengajar', { date, shift })}
      />
    ),
    canDismissal && (
      <StatCard
        key="dis"
        label="Kepulangan"
        icon={<DoorOpen />}
        tone={dis.earlyLeave > 0 ? 'warning' : 'neutral'}
        value={dis.total}
        hint={`Pulang awal ${dis.earlyLeave} · Izin keluar ${dis.temporaryExit}`}
        href={withQuery('/kepulangan', { date, shift })}
      />
    ),
  ].filter(Boolean)

  return (
    <div
      className={cn('grid gap-5 transition-opacity lg:grid-cols-3', stale && 'opacity-60')}
      onClick={onLinkClick}
    >
      {me && (
        <div className="lg:col-span-1">
          <TodayCard me={me} date={date} shiftCode={shiftCode} isToday={isToday} />
        </div>
      )}
      <div className={me ? 'lg:col-span-2' : 'lg:col-span-3'}>
        <PendingTasks tasks={summary.pendingTasks} />
      </div>

      {stats.length > 0 && (
        <section aria-labelledby="stats-title" className="flex flex-col gap-3 lg:col-span-3">
          <h2 id="stats-title" className="text-sm font-semibold text-muted-foreground">
            Ringkasan {isToday ? 'hari ini' : formatDateLong(date)}
            <span className="sr-only"> — pilih kartu untuk melihat daftar record pembentuk angka</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {stats}
          </div>
        </section>
      )}

      {canStudent && (
        <Card aria-labelledby="dist-title" className={cn('gap-4', canDuty ? 'lg:col-span-2' : 'lg:col-span-3')}>
          <CardHeader>
            <CardTitle id="dist-title" className="text-base">
              <h2>Status kehadiran siswa</h2>
            </CardTitle>
            <CardDescription>
              Gabungan dari {sa.sessionsSubmitted + sa.sessionsDraft} sesi absensi pada{' '}
              {sa.classesScheduled} kelas{shiftCode ? '' : ' (semua shift)'}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceDistribution counts={sa.counts} />
          </CardContent>
        </Card>
      )}

      {canDuty && (
        <div className={canStudent ? 'lg:col-span-1' : 'lg:col-span-3'}>
          <DutyAgendaStatus agendas={summary.dutyAgenda} date={date} />
        </div>
      )}
    </div>
  )
}
