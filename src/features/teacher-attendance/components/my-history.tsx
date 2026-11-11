import { History } from 'lucide-react'
import { FramedCard } from '@/components/framed-card'
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

  const s = q.data?.summary
  return (
    <FramedCard
      title="Riwayat 14 hari terakhir"
      titleId="my-history-title"
      icon={<History />}
      description="Kehadiran harian Anda sesuai catatan sistem."
      headerRight={
        s && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Hadir {s.PRESENT} · Terlambat {s.LATE} · Tidak hadir{' '}
            {s.SICK + s.PERMISSION + s.ABSENT + s.OFFICIAL_DUTY}
          </p>
        )
      }
      bodyClassName={q.data && q.data.records.length > 0 ? 'p-0' : undefined}
    >
      {q.isPending ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Memuat riwayat">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </div>
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} className="border-0 py-6 shadow-none" />
      ) : q.data.records.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="Belum ada riwayat kehadiran"
          description="Riwayat akan muncul setelah Anda melakukan check-in atau piket mencatat status Anda."
          className="border-0 bg-transparent py-6"
        />
      ) : (
        <ul className="divide-y divide-border/70">
          {q.data.records.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-24 shrink-0 text-[13px] font-medium tabular-nums">{formatDateShort(r.date)}</div>
              <div className="w-28 shrink-0">
                <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {r.checkInAt || r.checkOutAt ? (
                  <span className="tabular-nums">
                    {formatTime(r.checkInAt)} – {formatTime(r.checkOutAt)}
                  </span>
                ) : (
                  r.reason ?? 'Tanpa keterangan'
                )}
                {r.lateMinutes ? ` · terlambat ${formatLate(r.lateMinutes)}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </FramedCard>
  )
}
