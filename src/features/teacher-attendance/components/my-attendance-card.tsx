import { CalendarClock, CheckCircle2, Clock, LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
    <section
      aria-labelledby="my-attendance-title"
      className="overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="my-attendance-title" className="font-semibold">
            Kehadiran Saya
          </h2>
          <p className="text-xs text-muted-foreground">{formatDateLong(today)}</p>
        </div>
        {q.data?.shift && (
          <ToneBadge tone="info">
            Shift {q.data.shift.name} · {formatWallTime(q.data.shift.startTime)}–{formatWallTime(q.data.shift.endTime)}
          </ToneBadge>
        )}
      </div>
      {q.isPending ? (
        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr] sm:p-5" aria-busy="true" aria-label="Memuat kehadiran">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-36 rounded-lg" />
        </div>
      ) : q.isError || !q.data ? (
        <div className="p-4 sm:p-5">
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        </div>
      ) : (
        <MyAttendanceBody day={q.data} onReload={() => void q.refetch()} />
      )}
    </section>
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
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Status hari ini:</span>
          {a ? (
            <StatusBadge meta={TEACHER_ATTENDANCE_META} value={a.status} className="text-sm" />
          ) : (
            <ToneBadge tone="neutral">Belum check-in</ToneBadge>
          )}
          {day.isDutyTeacher && (
            <ToneBadge tone="success">
              <ShieldCheck className="size-3" /> Piket hari ini
            </ToneBadge>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <TimeTile icon={<LogIn />} label="Datang" value={formatTime(a?.checkInAt)} />
          <TimeTile icon={<LogOut />} label="Pulang" value={formatTime(a?.checkOutAt)} />
        </dl>

        {late && (
          <p className="flex items-center gap-1.5 text-sm text-tone-warning">
            <Clock className="size-4" /> Terlambat {late} dari batas toleransi.
          </p>
        )}
        {absent && a && (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
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
            <Button
              size="lg"
              className="h-12 w-full text-base"
              onClick={doCheckIn}
              disabled={checkIn.isPending || !online}
            >
              <LogIn className="size-5" /> {checkIn.isPending ? 'Menyimpan…' : 'Check-in sekarang'}
            </Button>
          )}
          {canCheckOut && (
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full border-primary/40 text-base"
              onClick={() => setConfirmOut(true)}
              disabled={checkOut.isPending || !online}
            >
              <LogOut className="size-5" /> {checkOut.isPending ? 'Menyimpan…' : 'Check-out (akhir tugas)'}
            </Button>
          )}
          {done && (
            <p className="flex items-center gap-2 rounded-lg bg-tone-success-bg px-3 py-2.5 text-sm font-medium text-tone-success">
              <CheckCircle2 className="size-4" /> Kehadiran hari ini lengkap.
            </p>
          )}
          {!online && (canCheckIn || canCheckOut) && (
            <p className="text-xs text-tone-warning">Anda sedang offline. Sambungkan internet untuk check-in/check-out.</p>
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
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarClock className="size-4 text-muted-foreground" /> Jadwal mengajar hari ini
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{day.scheduledPeriods} jam</span>
        </div>
        {day.slots.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Tidak ada jadwal mengajar hari ini.
            {day.isDutyTeacher ? ' Anda bertugas sebagai guru piket.' : ''}
          </p>
        ) : (
          <ol className="grid gap-1.5">
            {day.slots.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                  {formatWallTime(s.startTime)}–{formatWallTime(s.endTime)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.subjectName}</p>
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
    <div className="rounded-lg border px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon} {label}
      </dt>
      <dd className={cn('mt-0.5 text-2xl font-bold tabular-nums', empty && 'text-muted-foreground/60')}>{value}</dd>
    </div>
  )
}
