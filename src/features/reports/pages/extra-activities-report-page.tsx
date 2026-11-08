import { BookOpenCheck, GraduationCap, Timer, Users } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { EXTRA_ACTIVITY_TYPE_META, RECORD_STATUS_META } from '@/lib/enums'
import { formatDate, formatDateShort, formatWallTime } from '@/lib/date'
import { reportDef } from '../catalog'
import { DrillLink, textOrDash } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { ExtraActivityReport, ExtraActivityReportRow } from '../types'

const def = reportDef('kegiatan-tambahan')

const timeText = (r: ExtraActivityReportRow) =>
  r.startTime ? `${formatWallTime(r.startTime)}–${formatWallTime(r.endTime)}` : '—'
const attendanceText = (r: ExtraActivityReportRow) =>
  r.participantAttendanceEnabled ? `${r.presentCount}/${r.participantCount} hadir` : 'Tidak dicatat'

export function ExtraActivitiesReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('extra-activities', filters.query)
  const { shiftName } = useLookupMaps()

  const columns: ColumnDef<ExtraActivityReportRow>[] = [
    {
      id: 'date',
      header: 'Tanggal · Waktu',
      accessorFn: (r) => r.date,
      cell: ({ row: { original: r } }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{formatDateShort(r.date)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{timeText(r)}</p>
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Kegiatan',
      accessorFn: (r) => r.name,
      cell: ({ row: { original: r } }) => (
        <div className="space-y-1">
          <p className="font-medium">{r.name}</p>
          <StatusBadge meta={EXTRA_ACTIVITY_TYPE_META} value={r.type} />
        </div>
      ),
    },
    { id: 'classes', header: 'Kelas', enableSorting: false, cell: (c) => c.row.original.classNames.join(', ') || '—' },
    { id: 'instructor', header: 'Pengampu', accessorFn: (r) => r.instructorName },
    { id: 'topic', header: 'Materi', enableSorting: false, cell: (c) => <span className="block max-w-64">{textOrDash(c.row.original.topic)}</span> },
    { id: 'att', header: 'Presensi', enableSorting: false, cell: (c) => <span className="tabular-nums">{attendanceText(c.row.original)}</span> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: (c) => <StatusBadge meta={RECORD_STATUS_META} value={c.row.original.status} /> },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: (c) => <DrillLink to={`${def.operationalPath}/${c.row.original.id}`}>Detail</DrillLink>,
      meta: { className: 'text-right', hideOnMobile: true },
    },
  ]

  return (
    <ReportView<ExtraActivityReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true }}
      query={query}
      mode={mode}
      operationalLink={{
        label: 'Buka kegiatan tambahan',
        href: drillHref(def.operationalPath, { dateFrom: filters.range?.dateFrom, dateTo: filters.range?.dateTo }),
      }}
      note="Presensi peserta hanya dihitung untuk kegiatan yang mengaktifkan presensi. Hadir = status Hadir atau Terlambat."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Kegiatan" value={formatNumber(d.totals.activities)} icon={<BookOpenCheck />} tone="info" />
          <StatCard label={EXTRA_ACTIVITY_TYPE_META.COURSE.label} value={formatNumber(d.totals.byType.COURSE)} icon={<GraduationCap />} />
          <StatCard label={EXTRA_ACTIVITY_TYPE_META.EXTRA_HOURS.label} value={formatNumber(d.totals.byType.EXTRA_HOURS)} hint={`Lainnya ${d.totals.byType.OTHER}`} icon={<Timer />} />
          <StatCard label="Peserta hadir" value={`${d.totals.present}/${d.totals.participants}`} hint="Kegiatan dengan presensi" icon={<Users />} tone="success" />
        </SummaryGrid>
      )}
      content={(d) => (
        <section className="space-y-3">
          <SectionTitle description={`${formatNumber(d.totals.activities)} kegiatan`}>Daftar kegiatan</SectionTitle>
          <ReportTable
            caption={def.title}
            columns={columns}
            data={d.rows}
            getRowId={(r) => r.id}
            emptyState={<EmptyState title="Belum ada kegiatan tambahan" description="Tidak ada kursus atau jam tambahan pada periode/filter ini." />}
            renderMobileCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)} · {timeText(r)} · {r.classNames.join(', ')}
                    </p>
                  </div>
                  <StatusBadge meta={RECORD_STATUS_META} value={r.status} />
                </div>
                <p className="text-sm">{textOrDash(r.topic)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.instructorName} · {attendanceText(r)}
                </p>
              </div>
            )}
            totals={[
              ['Kegiatan', formatNumber(d.totals.activities)],
              ['Peserta', formatNumber(d.totals.participants)],
              ['Hadir', formatNumber(d.totals.present)],
            ]}
          />
        </section>
      )}
      print={(d) => (
        <PrintTable>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Shift</th>
              <th>Waktu</th>
              <th>Kegiatan</th>
              <th>Jenis</th>
              <th>Kelas</th>
              <th>Pengampu</th>
              <th>Materi</th>
              <th>Keterangan</th>
              <th>Presensi</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{shiftName(r.shiftCode)}</td>
                <td className="whitespace-nowrap">{timeText(r)}</td>
                <td>{r.name}</td>
                <td>{EXTRA_ACTIVITY_TYPE_META[r.type].label}</td>
                <td>{r.classNames.join(', ')}</td>
                <td>{r.instructorName}</td>
                <td>{textOrDash(r.topic)}</td>
                <td>{textOrDash(r.note)}</td>
                <td>{attendanceText(r)}</td>
              </tr>
            ))}
            {d.rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center">Tidak ada data.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={4} className="text-center">JUMLAH</td>
              <td colSpan={7}>
                {d.totals.activities} kegiatan — peserta hadir {d.totals.present}/{d.totals.participants}
              </td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
