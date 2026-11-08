import { History } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/misc'
import { addDays, formatDateShort, formatTime, todayISO } from '@/lib/date'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import type { ID } from '@/types/entities'
import { useTeacherAttendanceHistory } from '../queries'
import { formatLate } from '../utils'

/** Riwayat kehadiran pribadi 14 hari terakhir (AC-07). */
export function MyHistory({ teacherId }: { teacherId: ID }) {
  const today = todayISO()
  const q = useTeacherAttendanceHistory({ teacherId, dateFrom: addDays(today, -13), dateTo: today })

  return (
    <section aria-labelledby="my-history-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="my-history-title" className="font-semibold">
            Riwayat 14 hari terakhir
          </h2>
          <p className="text-xs text-muted-foreground">Kehadiran harian Anda sesuai catatan sistem.</p>
        </div>
        {q.data && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Hadir {q.data.summary.PRESENT} · Terlambat {q.data.summary.LATE} · Tidak hadir{' '}
            {q.data.summary.SICK + q.data.summary.PERMISSION + q.data.summary.ABSENT + q.data.summary.OFFICIAL_DUTY}
          </p>
        )}
      </div>
      {q.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Memuat riwayat">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.records.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="Belum ada riwayat kehadiran"
          description="Riwayat akan muncul setelah Anda melakukan check-in atau piket mencatat status Anda."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {q.data.records.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 shadow-xs">
              <div className="w-20 shrink-0 text-sm font-medium">{formatDateShort(r.date)}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
                <p className="truncate text-xs text-muted-foreground">
                  {r.checkInAt || r.checkOutAt ? (
                    <span className="tabular-nums">
                      {formatTime(r.checkInAt)} – {formatTime(r.checkOutAt)}
                    </span>
                  ) : (
                    r.reason ?? 'Tanpa keterangan'
                  )}
                  {r.lateMinutes ? ` · terlambat ${formatLate(r.lateMinutes)}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
