import { CalendarClock, ClipboardList, ShieldCheck, UserX } from 'lucide-react'
import { CardsSkeleton } from '@/components/page'
import { KpiCard } from '@/components/kpi-card'
import { useDashboardSummary } from '@/features/dashboard/queries'
import { withQuery } from '@/features/dashboard/utils'
import { todayISO } from '@/lib/date'
import { formatNumber } from '@/lib/format'

/**
 * Strip 4 KPI operasional hari ini (dari ringkasan dashboard yang sudah ada) di atas tampilan Sistem.
 * Bila ringkasan gagal dimuat strip disembunyikan — kartu sistem tetap tampil.
 */
export function OperationalStrip() {
  const date = todayISO()
  const q = useDashboardSummary({ date, shiftCode: null })

  if (q.isPending) return <CardsSkeleton count={4} />
  if (q.isError || !q.data) {
    return (
      <p role="status" className="text-xs text-muted-foreground">
        Ringkasan operasional hari ini belum dapat dimuat.
      </p>
    )
  }

  const s = q.data
  const sa = s.studentAttendance
  const ta = s.teacherAttendance
  const sub = s.substitutions
  const agendaOpen = s.dutyAgenda.filter((a) => a.status !== 'FINAL').length
  const fraction = (a: number, b: number) => (
    <>
      {formatNumber(a)}
      <span className="text-base font-medium text-muted-foreground">/{formatNumber(b)}</span>
    </>
  )

  return (
    <section aria-labelledby="sa-ops-title">
      <h2 id="sa-ops-title" className="sr-only">
        Ringkasan operasional hari ini
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Absensi kelas terkirim"
          icon={<ClipboardList />}
          value={fraction(sa.sessionsSubmitted, sa.classesScheduled)}
          hint={sa.sessionsDraft > 0 ? `${sa.sessionsDraft} masih draft` : 'Kelas terjadwal hari ini'}
          actionLabel="Detail"
          href={withQuery('/absensi-siswa', { date })}
        />
        <KpiCard
          label="Guru tidak hadir"
          icon={<UserX />}
          iconClassName={ta.absent > 0 ? 'text-tone-danger' : undefined}
          value={formatNumber(ta.absent)}
          valueClassName={ta.absent > 0 ? 'text-tone-danger' : undefined}
          hint={`Belum check-in ${ta.notCheckedIn} · ${ta.scheduled} terjadwal`}
          actionLabel="Detail"
          href={withQuery('/absensi-guru', { date })}
        />
        <KpiCard
          label="Jam kosong belum tertangani"
          icon={<CalendarClock />}
          iconClassName={sub.unhandledSlots > 0 ? 'text-tone-danger' : undefined}
          value={formatNumber(sub.unhandledSlots)}
          valueClassName={sub.unhandledSlots > 0 ? 'text-tone-danger' : undefined}
          hint={
            sub.affectedSlots === 0
              ? 'Tidak ada jam kosong'
              : `${sub.handledSlots}/${sub.affectedSlots} slot tertangani`
          }
          actionLabel="Detail"
          href={withQuery('/jam-kosong', { date })}
        />
        <KpiCard
          label="Agenda piket belum final"
          icon={<ShieldCheck />}
          iconClassName={agendaOpen > 0 ? 'text-tone-warning' : undefined}
          value={fraction(agendaOpen, s.dutyAgenda.length)}
          valueClassName={agendaOpen > 0 ? 'text-tone-warning' : undefined}
          hint={agendaOpen === 0 ? 'Semua shift sudah final' : 'Shift hari ini'}
          actionLabel="Detail"
          href={withQuery('/agenda-piket', { dateFrom: date, dateTo: date })}
        />
      </div>
    </section>
  )
}
