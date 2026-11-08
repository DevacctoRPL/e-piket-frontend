import { AlertTriangle, ClipboardCheck, Info } from 'lucide-react'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/misc'
import { getErrorMessage } from '@/lib/error-mapping'
import { ATTENDANCE_META, DISMISSAL_META, NON_PRESENT_STATUSES, RECORD_STATUS_META } from '@/lib/enums'
import { formatDate, formatTime, formatWallTime } from '@/lib/date'
import type { ID, ISODate } from '@/types/entities'
import { useDismissalContext } from '../queries'

/**
 * Ringkasan absensi kedatangan siswa pada hari itu (PRD §7.2 langkah 2). Hanya informasi —
 * pencatatan kepulangan tidak mengubah status kedatangan (PRD §9.2).
 */
export function AttendanceContextPanel({ studentId, date }: { studentId: ID | null; date: ISODate }) {
  const ctx = useDismissalContext(studentId, date)
  if (!studentId) return null

  return (
    <section
      aria-label="Ringkasan absensi siswa"
      aria-live="polite"
      className="grid gap-2 rounded-xl border bg-muted/40 p-3"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <ClipboardCheck className="size-3.5" /> Absensi kedatangan · {formatDate(date)}
      </p>
      {ctx.isPending ? (
        <div className="grid gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : ctx.isError ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {getErrorMessage(ctx.error)}
        </p>
      ) : (
        <>
          {ctx.data.attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Absensi kelas {ctx.data.student.className} untuk tanggal ini belum dibuat.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {ctx.data.attendance.map((a) => (
                <li key={a.sessionId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Sesi {a.sessionLabel}:</span>
                  {a.status ? (
                    <StatusBadge meta={ATTENDANCE_META} value={a.status} />
                  ) : (
                    <span className="text-muted-foreground">Belum diberi status</span>
                  )}
                  {a.arrivalTime && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      datang {formatWallTime(a.arrivalTime)}
                    </span>
                  )}
                  {a.sessionStatus !== 'FINAL' && (
                    <StatusBadge meta={RECORD_STATUS_META} value={a.sessionStatus} />
                  )}
                  {a.reason && <span className="w-full text-xs text-muted-foreground">Alasan: {a.reason}</span>}
                </li>
              ))}
            </ul>
          )}
          {ctx.data.attendance.some((a) => a.status && NON_PRESENT_STATUSES.includes(a.status) && a.status !== 'LATE') && (
            <p className="flex items-start gap-1.5 text-xs text-tone-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Status kedatangan siswa bukan Hadir. Pastikan data kepulangan memang benar.
            </p>
          )}
          {ctx.data.dismissals.length > 0 && (
            <div className="grid gap-1 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground">Sudah tercatat hari itu:</p>
              <ul className="grid gap-1">
                {ctx.data.dismissals.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge meta={DISMISSAL_META} value={d.type} />
                    <span className="tabular-nums">keluar {formatTime(d.exitTime)}</span>
                    {d.returnTime && <span className="tabular-nums text-muted-foreground">kembali {formatTime(d.returnTime)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            Catatan kepulangan disimpan terpisah dan tidak mengubah absensi kedatangan.
          </p>
        </>
      )}
    </section>
  )
}
