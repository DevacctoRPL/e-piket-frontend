import { ClipboardList, LogIn, NotebookPen, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  if (!att) statusLine = isToday ? 'Anda belum check-in hari ini.' : 'Tidak ada catatan kehadiran.'
  else if (absent) statusLine = att.reason ? `Keterangan: ${att.reason}` : 'Tercatat tidak hadir.'
  else if (checkedOut) statusLine = `Masuk ${formatTime(att.checkInAt)} · Pulang ${formatTime(att.checkOutAt)}`
  else if (checkedIn) statusLine = `Masuk ${formatTime(att.checkInAt)} · belum check-out`
  else statusLine = 'Belum check-in.'

  const logsLeft = Math.max(0, me.todaySlots - me.logsFilled)

  return (
    <Card aria-labelledby="today-title" className="gap-4">
      <CardHeader>
        <CardTitle id="today-title" className="flex flex-wrap items-center gap-2 text-base">
          <h2>{isToday ? 'Hari ini' : 'Ringkasan saya'}</h2>
          {me.isDutyToday && (
            <ToneBadge tone="success">
              <ShieldCheck className="size-3" aria-hidden /> Bertugas piket
            </ToneBadge>
          )}
        </CardTitle>
        <CardDescription>Kehadiran pribadi dan pekerjaan mengajar Anda.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Kehadiran</dt>
            <dd className="flex flex-col gap-1">
              {att ? (
                <StatusBadge meta={TEACHER_ATTENDANCE_META} value={att.status} />
              ) : (
                <ToneBadge tone="warning">Belum check-in</ToneBadge>
              )}
              <span className="text-xs text-pretty text-muted-foreground tabular-nums">{statusLine}</span>
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Jurnal mengajar</dt>
            <dd className="flex flex-col gap-1">
              <span className="text-lg leading-none font-bold tabular-nums">
                {me.logsFilled}/{me.todaySlots}
              </span>
              <span className="text-xs text-muted-foreground">
                {me.todaySlots === 0
                  ? 'Tidak ada jadwal mengajar.'
                  : logsLeft === 0
                    ? 'Semua jurnal sudah diisi.'
                    : `${logsLeft} pertemuan belum berjurnal.`}
              </span>
            </dd>
          </div>
        </dl>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {can('teacher_attendance:self') && (
            <Button asChild variant={!checkedIn && !absent && isToday ? 'default' : 'outline'}>
              <Link to={withQuery('/absensi-guru', dateQuery)}>
                <LogIn aria-hidden />
                {!checkedIn && !absent && isToday ? 'Check-in' : checkedIn && !checkedOut && isToday ? 'Check-out' : 'Absensi saya'}
              </Link>
            </Button>
          )}
          {can('teaching_log:write') && (
            <Button asChild variant={checkedIn && logsLeft > 0 ? 'default' : 'outline'}>
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
        </div>
        {me.isDutyToday && can('duty_agenda:read') && (
          <Link
            to={withQuery('/agenda-piket', { date, shift: shiftCode })}
            className="flex items-center gap-2 rounded-lg border border-tone-success/25 bg-tone-success-bg px-3 py-2 text-sm font-medium text-tone-success hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ShieldCheck className="size-4" aria-hidden />
            Anda bertugas piket — buka agenda piket
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
