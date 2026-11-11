import { CalendarClock, CheckCircle2, Clock, LogIn, LogOut, RefreshCw, ShieldCheck, UserCheck, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FramedCard } from '@/components/framed-card'
import { ErrorState } from '@/components/page'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { useOnline } from '@/hooks/use-online'
import { formatDateLong, formatTime, formatWallTime, todayISO } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import { useCheckIn, useCheckOut, useMyTeacherAttendance } from '../queries'
import type { MyTeacherAttendanceDay } from '../types'
import { formatLate, isConflict } from '../utils'

/** Kartu "Kehadiran Saya" (FR-TCH-01, FR-OUT-03, AC-07). */
export function MyAttendanceCard() {
  const today = todayISO()
  const q = useMyTeacherAttendance(today)

  return (
    <FramedCard
      title="Kehadiran Saya"
      titleId="my-attendance-title"
      icon={<UserCheck />}
      description={formatDateLong(today)}
      headerRight={
        q.data?.shift && (
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            Shift {q.data.shift.name} · {formatWallTime(q.data.shift.startTime)}–{formatWallTime(q.data.shift.endTime)}
          </span>
        )
      }
    >
      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Memuat kehadiran">
          <Skeleton className="h-36 rounded-md" />
          <Skeleton className="h-36 rounded-md" />
        </div>
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} className="border-0 py-6 shadow-none" />
      ) : (
        <MyAttendanceBody day={q.data} onReload={() => void q.refetch()} />
      )}
    </FramedCard>
  )
}

function MyAttendanceBody({ day, onReload }: { day: MyTeacherAttendanceDay; onReload: () => void }) {
  const online = useOnline()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const inKey = useIdempotencyKey()
  const outKey = useIdempotencyKey()
  const [confirmOut, setConfirmOut] = useState(false)

  const a = day.attendance
  const absent = !!a && TEACHER_ABSENT_STATUSES.includes(a.status)
  const canCheckIn = !a?.checkInAt && !absent
  const canCheckOut = !!a?.checkInAt && !a.checkOutAt
  const done = !!a?.checkInAt && !!a.checkOutAt
  const late = formatLate(a?.lateMinutes)

  const handleError = (e: unknown, reset: () => void) => {
    if (isConflict(e)) {
      reset()
      toast.error(e.message, { action: { label: 'Muat ulang', onClick: onReload } })
      onReload()
      return
    }
    // Error jaringan: kunci idempotensi dipertahankan agar percobaan ulang tidak menggandakan data.
    toast.error(getErrorMessage(e))
  }

  const doCheckIn = () =>
    checkIn.mutate(inKey.key(), {
      onSuccess: (r) => {
        inKey.reset()
        toast.success(
          r.status === 'LATE'
            ? `Check-in tercatat pukul ${formatTime(r.checkInAt)} (terlambat ${formatLate(r.lateMinutes) ?? ''}).`
            : `Check-in tercatat pukul ${formatTime(r.checkInAt)}.`,
        )
      },
      onError: (e) => handleError(e, inKey.reset),
    })

  const doCheckOut = () =>
    checkOut.mutate(outKey.key(), {
      onSuccess: (r) => {
        outKey.reset()
        setConfirmOut(false)
        toast.success(`Check-out tercatat pukul ${formatTime(r.checkOutAt)}. Terima kasih!`)
      },
      onError: (e) => {
        setConfirmOut(false)
        handleError(e, outKey.reset)
      },
    })

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Status hari ini:</span>
          {a ? (
            <StatusBadge meta={TEACHER_ATTENDANCE_META} value={a.status} className="text-sm" />
          ) : (
            <ToneBadge tone="neutral">Belum check-in</ToneBadge>
          )}
          {day.isDutyTeacher && (
            <ToneBadge tone="success" icon={ShieldCheck}>
              Piket hari ini
            </ToneBadge>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <TimeTile icon={<LogIn />} label="Datang" value={formatTime(a?.checkInAt)} />
          <TimeTile icon={<LogOut />} label="Pulang" value={formatTime(a?.checkOutAt)} />
        </dl>

        {late && (
          <p className="flex items-center gap-1.5 text-[13px] text-foreground/85">
            <Clock className="size-3.5 shrink-0 text-tone-warning" aria-hidden /> Terlambat {late} dari batas toleransi.
          </p>
        )}
        {absent && a && (
          <p className="rounded-md border border-border/80 px-3 py-2 text-[13px] text-muted-foreground">
            Dicatat oleh {a.updatedByName}
            {a.reason ? (
              <>
                {' '}
                · Alasan: <span className="font-medium">{a.reason}</span>
              </>
            ) : null}
            . Hubungi guru piket bila status ini keliru.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {canCheckIn && (
            <Button size="lg" className="w-full" onClick={doCheckIn} disabled={checkIn.isPending || !online}>
              <LogIn /> {checkIn.isPending ? 'Menyimpan…' : 'Check-in sekarang'}
            </Button>
          )}
          {canCheckOut && (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => setConfirmOut(true)}
              disabled={checkOut.isPending || !online}
            >
              <LogOut /> {checkOut.isPending ? 'Menyimpan…' : 'Check-out (akhir tugas)'}
            </Button>
          )}
          {done && (
            <p className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-2 text-[13px] font-medium">
              <CheckCircle2 className="size-4 shrink-0 text-tone-success" aria-hidden /> Kehadiran hari ini lengkap.
            </p>
          )}
          {!online && (canCheckIn || canCheckOut) && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <WifiOff className="size-3.5 shrink-0 text-tone-warning" aria-hidden /> Anda sedang offline. Sambungkan
              internet untuk check-in/check-out.
            </p>
          )}
          {(canCheckIn || canCheckOut) && (
            <p className="text-xs text-muted-foreground">
              Waktu dicatat otomatis oleh server. Perubahan jam secara manual hanya dapat dilakukan piket/admin dengan alasan.
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden /> Jadwal mengajar hari ini
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{day.scheduledPeriods} jam</span>
        </div>
        {day.slots.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">
            Tidak ada jadwal mengajar hari ini.
            {day.isDutyTeacher ? ' Anda bertugas sebagai guru piket.' : ''}
          </p>
        ) : (
          <ol className="divide-y divide-border/70 rounded-md border border-border/80">
            {day.slots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {formatWallTime(s.startTime)}–{formatWallTime(s.endTime)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{s.subjectName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.className} · Jam ke-{s.periodStart}
                    {s.periodEnd !== s.periodStart ? `–${s.periodEnd}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Button variant="ghost" size="sm" className="self-start" onClick={onReload}>
          <RefreshCw /> Perbarui
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOut}
        onOpenChange={setConfirmOut}
        title="Check-out sekarang?"
        description={
          <p>
            Waktu pulang akan dicatat pukul sekarang. Pastikan tugas mengajar dan jurnal hari ini sudah selesai.
            Check-out tidak dapat dibatalkan sendiri.
          </p>
        }
        confirmLabel="Ya, check-out"
        pending={checkOut.isPending}
        onConfirm={doCheckOut}
      />
    </div>
  )
}

function TimeTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const empty = value === '—'
  return (
    <div className="rounded-md border border-border/80 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon} {label}
      </dt>
      <dd className={cn('mt-0.5 text-2xl font-semibold tracking-tight tabular-nums', empty && 'text-muted-foreground/60')}>
        {value}
      </dd>
    </div>
  )
}
