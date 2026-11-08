import { ArrowLeft, CalendarRange, UserSearch } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useClasses, useLookupMaps } from '@/features/master-data/lookups'
import { addDays, formatDate, formatDateShort, formatWallTime, todayISO } from '@/lib/date'
import { ATTENDANCE_META, RECORD_STATUS_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : historyQ.isError ? (
        <ErrorState error={historyQ.error} onRetry={() => void historyQ.refetch()} />
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="history-student">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="history-student" className="text-lg font-semibold">
                {historyQ.data.student.name}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  · NIS {historyQ.data.student.nis} · {historyQ.data.student.className}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatDateShort(historyQ.data.dateFrom)} – {formatDateShort(historyQ.data.dateTo)}
              </p>
            </div>
            <HistorySummary summary={historyQ.data.summary} />
          </section>
          <DataTable
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

function HistorySummary({ summary }: { summary: StudentHistorySummary }) {
  const rateTone = summary.presentRate >= 90 ? 'text-tone-success' : summary.presentRate >= 75 ? 'text-tone-warning' : 'text-tone-danger'
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <div className="col-span-2 flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs sm:col-span-1">
        <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kehadiran</dt>
        <dd className={cn('text-2xl font-bold tabular-nums', summary.total ? rateTone : 'text-muted-foreground')}>
          {summary.total ? `${summary.presentRate.toLocaleString('id-ID')}%` : '—'}
        </dd>
        <dd className="text-xs text-muted-foreground tabular-nums">dari {summary.total} sesi (hadir + terlambat)</dd>
      </div>
      {SUMMARY_ORDER.map((s) => (
        <div key={s} className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <dt className="text-xs font-semibold text-muted-foreground">
            {ATTENDANCE_META[s].short} · {ATTENDANCE_META[s].label}
          </dt>
          <dd className="text-2xl font-bold tabular-nums">{summary[s]}</dd>
        </div>
      ))}
    </dl>
  )
}
