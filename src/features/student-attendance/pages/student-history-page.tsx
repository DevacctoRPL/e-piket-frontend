import { ArrowLeft, CalendarRange, ListChecks, Percent, UserSearch } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { CardsSkeleton, EmptyState, ErrorState, Page, PageHeader, StatCard, TableSkeleton } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useClasses, useLookupMaps } from '@/features/master-data/lookups'
import { addDays, formatDate, formatDateShort, formatWallTime, todayISO } from '@/lib/date'
import { ATTENDANCE_META, RECORD_STATUS_META } from '@/lib/enums'
import { formatNumber } from '@/lib/format'
import type { AttendanceStatus } from '@/types/entities'
import { useClassStudents, useStudentHistory } from '../queries'
import type { StudentHistoryRecord, StudentHistorySummary } from '../types'

const SUMMARY_ORDER: AttendanceStatus[] = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE', 'EXCUSED', 'LEFT_EARLY']

/** Histori absensi siswa (FR-STU-08): filter rentang tanggal + ringkasan status. */
export function StudentHistoryPage() {
  const today = todayISO()
  const { values, set, reset, isDirty } = useFilters({
    classId: '',
    studentId: '',
    from: addDays(today, -30),
    to: today,
  })
  const classesQ = useClasses({ scope: 'mine' })
  const studentsQ = useClassStudents(values.classId)
  const { shiftName } = useLookupMaps()
  const rangeInvalid = values.from > values.to
  const historyQ = useStudentHistory(
    values.studentId && !rangeInvalid
      ? { studentId: values.studentId, dateFrom: values.from, dateTo: values.to }
      : null,
  )

  const classOptions = (classesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))
  const studentOptions = (studentsQ.data ?? []).map((s) => ({ value: s.id, label: `${s.name} · ${s.nis}` }))

  const columns = useMemo<ColumnDef<StudentHistoryRecord, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Tanggal',
        accessorFn: (r) => r.date,
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.date)}</span>,
      },
      {
        id: 'session',
        header: 'Sesi',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {shiftName(row.original.shiftCode)} · {row.original.sessionLabel}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.status,
        cell: ({ row }) => <StatusBadge meta={ATTENDANCE_META} value={row.original.status} showShort />,
      },
      {
        id: 'reason',
        header: 'Alasan / Catatan',
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="text-sm">
              {r.arrivalTime && <span className="tabular-nums">Datang {formatWallTime(r.arrivalTime)}. </span>}
              {r.reason ?? (r.arrivalTime ? '' : '—')}
              {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
            </div>
          )
        },
      },
      {
        id: 'sessionStatus',
        header: 'Status sesi',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => <StatusBadge meta={RECORD_STATUS_META} value={row.original.sessionStatus} />,
      },
    ],
    [shiftName],
  )

  return (
    <Page>
      <Button asChild variant="ghost" size="sm" className="no-print -ml-2 w-fit text-muted-foreground">
        <Link to="/absensi-siswa">
          <ArrowLeft /> Absensi siswa
        </Link>
      </Button>
      <PageHeader
        title="Riwayat Absensi Siswa"
        description="Lihat histori kehadiran seorang siswa pada rentang tanggal tertentu."
      />
      <FilterBar onReset={isDirty ? reset : undefined}>
        <FilterSelect
          label="Kelas"
          value={values.classId}
          onChange={(v) => set({ classId: v, studentId: '' })}
          options={classOptions}
          allLabel={classesQ.isPending ? 'Memuat kelas…' : 'Pilih kelas'}
        />
        <FilterSelect
          label="Siswa"
          value={values.studentId}
          onChange={(v) => set({ studentId: v })}
          options={studentOptions}
          allLabel={!values.classId ? 'Pilih kelas dulu' : studentsQ.isPending ? 'Memuat siswa…' : 'Pilih siswa'}
          className="lg:min-w-64"
        />
        <FilterDate label="Dari tanggal" value={values.from} max={values.to || today} onChange={(v) => v && set({ from: v })} />
        <FilterDate label="Sampai tanggal" value={values.to} min={values.from} max={today} onChange={(v) => v && set({ to: v })} />
      </FilterBar>

      {studentsQ.isError && <ErrorState error={studentsQ.error} onRetry={() => void studentsQ.refetch()} />}

      {rangeInvalid ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title="Rentang tanggal tidak valid"
          description="Tanggal akhir harus sama atau setelah tanggal awal."
        />
      ) : !values.studentId ? (
        <EmptyState
          icon={<UserSearch className="size-5" />}
          title="Pilih siswa"
          description="Pilih kelas lalu siswa untuk menampilkan riwayat absensinya."
        />
      ) : historyQ.isPending ? (
        <>
          <CardsSkeleton count={8} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : historyQ.isError ? (
        <ErrorState error={historyQ.error} onRetry={() => void historyQ.refetch()} />
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="history-student">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="history-student" className="text-[15px] font-semibold tracking-tight">
                {historyQ.data.student.name}{' '}
                <span className="text-[13px] font-normal text-muted-foreground">
                  · NIS {historyQ.data.student.nis} · {historyQ.data.student.className}
                </span>
              </h2>
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {formatDateShort(historyQ.data.dateFrom)} – {formatDateShort(historyQ.data.dateTo)}
              </p>
            </div>
            <HistorySummary summary={historyQ.data.summary} />
          </section>
          <DataTable
            title="Catatan absensi"
            icon={<ListChecks />}
            columns={columns}
            data={historyQ.data.records}
            getRowId={(r) => r.recordId}
            caption="Riwayat absensi siswa"
            initialSorting={[{ id: 'date', desc: true }]}
            emptyState={
              <EmptyState
                title="Tidak ada catatan absensi"
                description="Belum ada absensi tercatat untuk siswa ini pada rentang tanggal yang dipilih. Coba perluas rentang tanggal."
              />
            }
          />
        </>
      )}
    </Page>
  )
}

/** Ringkasan riwayat sebagai StatCard: angka netral; warna tone hanya pada ikon kecil "Kehadiran". */
function HistorySummary({ summary }: { summary: StudentHistorySummary }) {
  const rateTone = summary.presentRate >= 90 ? 'success' : summary.presentRate >= 75 ? 'warning' : 'danger'
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        label="Kehadiran"
        icon={<Percent />}
        tone={summary.total ? rateTone : 'neutral'}
        value={summary.total ? `${summary.presentRate.toLocaleString('id-ID')}%` : '—'}
        hint={`dari ${summary.total} sesi (hadir + terlambat)`}
      />
      {SUMMARY_ORDER.map((s) => (
        <StatCard
          key={s}
          label={`${ATTENDANCE_META[s].short} · ${ATTENDANCE_META[s].label}`}
          value={formatNumber(summary[s])}
        />
      ))}
    </div>
  )
}
