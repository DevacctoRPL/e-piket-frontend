import { ClipboardList, LogIn, LogOut, NotebookPen, ShieldCheck, UserCheck } from 'lucide-react'
import { Link } from 'react-router'
import { FramedCard } from '@/components/framed-card'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { formatTime } from '@/lib/date'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import type { DashboardSummary, ISODate } from '@/types/entities'
import { withQuery } from '../utils'

/** Kartu "Hari ini" untuk guru: status kehadiran pribadi + aksi cepat (PRD §8 Dashboard). */
export function TodayCard({
  me,
  date,
  shiftCode,
  isToday,
}: {
  me: NonNullable<DashboardSummary['me']>
  date: ISODate
  shiftCode: string
  isToday: boolean
}) {
  const { can } = useAuth()
  const att = me.teacherAttendance
  const checkedIn = !!att?.checkInAt
  const checkedOut = !!att?.checkOutAt
  const absent = att && !att.checkInAt && att.status !== 'PRESENT' && att.status !== 'LATE'
  const dateQuery = isToday ? {} : { date }

  let statusLine: string
  if (!att) statusLine = isToday ? 'Belum check-in hari ini' : 'Tidak ada catatan kehadiran'
  else if (absent) statusLine = att.reason ? att.reason : 'Tercatat tidak hadir'
  else if (checkedOut) statusLine = `Masuk ${formatTime(att.checkInAt)} · pulang ${formatTime(att.checkOutAt)}`
  else if (checkedIn) statusLine = `Masuk ${formatTime(att.checkInAt)} · belum check-out`
  else statusLine = 'Belum check-in'

  const logsLeft = Math.max(0, me.todaySlots - me.logsFilled)

  // Tepat satu aksi utama (gelap) sesuai langkah berikutnya; sisanya outline.
  const needsCheckIn = isToday && !checkedIn && !absent
  const needsCheckOut = isToday && checkedIn && !checkedOut
  const primary: 'attendance' | 'log' | null = needsCheckIn ? 'attendance' : logsLeft > 0 ? 'log' : needsCheckOut ? 'attendance' : null
  const attendanceLabel = needsCheckIn ? 'Check-in' : needsCheckOut ? 'Check-out' : 'Absensi saya'

  return (
    <FramedCard
      titleId="today-title"
      title={isToday ? 'Hari ini' : 'Ringkasan saya'}
      icon={<UserCheck />}
      headerRight={
        me.isDutyToday ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-tone-success">
            <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
            Bertugas piket
          </span>
        ) : undefined
      }
      bodyClassName="gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <dl className="grid grid-cols-2 gap-x-8 gap-y-1 sm:flex sm:gap-10">
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Kehadiran pribadi</dt>
          <dd className="space-y-0.5">
            {att ? (
              <StatusBadge meta={TEACHER_ATTENDANCE_META} value={att.status} />
            ) : (
              <ToneBadge tone="warning">Belum check-in</ToneBadge>
            )}
            <p className="truncate text-xs text-muted-foreground tabular-nums">{statusLine}</p>
          </dd>
        </div>
        <div className="min-w-0 space-y-1">
          <dt className="text-xs text-muted-foreground">Jurnal mengajar</dt>
          <dd className="space-y-0.5">
            <p className="text-sm leading-5 font-semibold tabular-nums">
              {me.logsFilled}
              <span className="text-muted-foreground">/{me.todaySlots}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {me.todaySlots === 0
                ? 'Tidak ada jadwal mengajar'
                : logsLeft === 0
                  ? 'Semua jurnal sudah diisi'
                  : `${logsLeft} pertemuan belum berjurnal`}
            </p>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {can('teacher_attendance:self') && (
          <Button asChild variant={primary === 'attendance' ? 'default' : 'outline'}>
            <Link to={withQuery('/absensi-guru', dateQuery)}>
              {needsCheckOut ? <LogOut aria-hidden /> : <LogIn aria-hidden />}
              {attendanceLabel}
            </Link>
          </Button>
        )}
        {can('teaching_log:write') && (
          <Button asChild variant={primary === 'log' ? 'default' : 'outline'}>
            <Link to={withQuery('/jurnal-mengajar', { date })}>
              <NotebookPen aria-hidden /> Isi jurnal
            </Link>
          </Button>
        )}
        {can('student_attendance:write') && (
          <Button asChild variant="outline">
            <Link to={withQuery('/absensi-siswa', { date, shift: shiftCode })}>
              <ClipboardList aria-hidden /> Absensi kelas
            </Link>
          </Button>
        )}
        {me.isDutyToday && can('duty_agenda:read') && (
          <Button asChild variant="outline">
            <Link to={withQuery('/agenda-piket', { dateFrom: date, dateTo: date, shiftCode })}>
              <ShieldCheck aria-hidden /> Buka agenda piket
            </Link>
          </Button>
        )}
      </div>
    </FramedCard>
  )
}
