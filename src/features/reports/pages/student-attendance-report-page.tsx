import { CheckCircle2, ClipboardList, UserX, Users } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { ATTENDANCE_META } from '@/lib/enums'
import { formatDate, formatDateShort } from '@/lib/date'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, InfoTip, MiniStat, Num } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber, formatPercent } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { AttendanceReport, AttendanceReportRow } from '../types'

const def = reportDef('absensi-siswa')

const GROUP_OPTIONS = [
  { value: 'class', label: 'Per kelas' },
  { value: 'student', label: 'Per siswa' },
  { value: 'date', label: 'Per tanggal' },
]

const PERCENT_HELP =
  'Persentase hadir = (Hadir + Terlambat) ÷ jumlah record status × 100. Hanya sesi berstatus Dikirim/Final yang dihitung; sesi Draft belum masuk rekap.'

export function StudentAttendanceReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def, { defaultGroupBy: 'class' })
  const query = useReport('attendance-summary', filters.query)
  const range = filters.range

  const absenteesHref = (row: Pick<AttendanceReportRow, 'classId' | 'date'>) =>
    drillHref('/siswa-tidak-hadir', {
      classId: row.classId ?? filters.values.classId,
      shiftCode: filters.values.shiftCode,
      dateFrom: row.date ?? range?.dateFrom,
      dateTo: row.date ?? range?.dateTo,
    })

  const firstHeader = { class: 'Kelas', student: 'Siswa', date: 'Tanggal' }[filters.groupBy]
  const columns: ColumnDef<AttendanceReportRow>[] = [
    {
      id: 'label',
      header: firstHeader,
      accessorFn: (r) => (r.date ? r.date : r.label),
      cell: ({ row: { original: r } }) => (
        <div className="min-w-0">
          <p className="font-medium">{r.date ? formatDateShort(r.date) : r.label}</p>
          {r.sublabel && <p className="text-xs text-muted-foreground">{r.sublabel}</p>}
        </div>
      ),
    },
    { id: 'sessions', header: 'Sesi', accessorFn: (r) => r.sessions, cell: (c) => <Num value={c.row.original.sessions} />, meta: { className: 'text-right', headerClassName: 'text-right' } },
    ...ATTENDANCE_STATUSES.map<ColumnDef<AttendanceReportRow>>((s) => ({
      id: s,
      header: ATTENDANCE_META[s].short ?? s,
      accessorFn: (r) => r.counts[s],
      cell: (c) => <Num value={c.row.original.counts[s]} />,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    })),
    { id: 'total', header: 'Total', accessorFn: (r) => r.total, cell: (c) => <Num value={c.row.original.total} className="font-semibold" />, meta: { className: 'text-right', headerClassName: 'text-right' } },
    {
      id: 'pct',
      header: '% Hadir',
      accessorFn: (r) => r.percentPresent ?? -1,
      cell: (c) => <span className="font-semibold tabular-nums">{formatPercent(c.row.original.percentPresent)}</span>,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) =>
        r.total - r.present > 0 || r.counts.LATE > 0 ? (
          <DrillLink to={absenteesHref(r)}>Tidak hadir</DrillLink>
        ) : null,
      meta: { className: 'text-right whitespace-nowrap' },
    },
  ]

  return (
    <ReportView<AttendanceReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true, student: true, groupBy: GROUP_OPTIONS }}
      query={query}
      mode={mode}
      operationalLink={{ label: 'Buka absensi harian', href: def.operationalPath }}
      note={PERCENT_HELP}
      summary={(d) => (
        <SummaryGrid>
          <StatCard
            label="% Hadir"
            value={formatPercent(d.totals.percentPresent)}
            hint={
              <span className="inline-flex items-center gap-1">
                {formatNumber(d.totals.present)} dari {formatNumber(d.totals.total)} record
                <InfoTip label="Cara hitung persentase hadir">{PERCENT_HELP}</InfoTip>
              </span>
            }
            icon={<CheckCircle2 />}
            tone="success"
          />
          <StatCard label="Record status" value={formatNumber(d.totals.total)} hint={`${formatNumber(d.totals.sessions)} sesi dihitung`} icon={<ClipboardList />} tone="info" />
          <StatCard
            label="Sakit · Izin · Alpa"
            value={`${d.totals.counts.SICK} · ${d.totals.counts.PERMISSION} · ${d.totals.counts.ABSENT}`}
            hint="Telusuri daftar siswa tidak hadir"
            icon={<UserX />}
            tone="danger"
            href={absenteesHref({ classId: null, date: null })}
          />
          <StatCard
            label="Terlambat"
            value={formatNumber(d.totals.counts.LATE)}
            hint={d.sessionsExcluded > 0 ? `${d.sessionsExcluded} sesi Draft belum dihitung` : 'Semua sesi sudah dikirim'}
            icon={<Users />}
            tone="warning"
          />
        </SummaryGrid>
      )}
      content={(d) => (
        <section className="space-y-3">
          <SectionTitle description={`${formatNumber(d.rows.length)} baris · dikelompokkan ${GROUP_OPTIONS.find((g) => g.value === d.groupBy)?.label.toLowerCase()}`}>
            Rincian per status
          </SectionTitle>
          <ReportTable
            caption={`${def.title} ${filters.periodText}`}
            columns={columns}
            data={d.rows}
            getRowId={(r) => r.key}
            pageSize={d.groupBy === 'student' ? 30 : 50}
            emptyState={
              <EmptyState
                title="Belum ada data absensi pada periode ini"
                description={
                  d.sessionsExcluded > 0
                    ? `Ada ${d.sessionsExcluded} sesi Draft yang belum dikirim sehingga belum dihitung. Kirim absensi dari halaman Absensi Siswa.`
                    : 'Tidak ada sesi absensi yang dikirim/final untuk filter ini. Ubah periode atau filter kelas.'
                }
              />
            }
            renderMobileCard={(r) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.date ? formatDate(r.date) : r.label}</p>
                    {r.sublabel && <p className="text-xs text-muted-foreground">{r.sublabel}</p>}
                  </div>
                  <span className="text-lg font-bold tabular-nums">{formatPercent(r.percentPresent)}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE', 'LEFT_EARLY', 'EXCUSED'] as const).map((s) => (
                    <MiniStat key={s} label={ATTENDANCE_META[s].label} value={r.counts[s]} />
                  ))}
                  <MiniStat label="Total" value={r.total} />
                </div>
                {r.total - r.present > 0 && <DrillLink to={absenteesHref(r)}>Lihat siswa tidak hadir</DrillLink>}
              </div>
            )}
            totals={[
              ['Sesi', formatNumber(d.totals.sessions)],
              ...ATTENDANCE_STATUSES.map<[string, string]>((s) => [ATTENDANCE_META[s].short ?? s, formatNumber(d.totals.counts[s])]),
              ['Total', formatNumber(d.totals.total)],
              ['% Hadir', formatPercent(d.totals.percentPresent)],
            ]}
          />
        </section>
      )}
      printMeta={(d) => [
        ['Pengelompokan', GROUP_OPTIONS.find((g) => g.value === d.groupBy)?.label ?? '—'],
        ['Sesi dihitung', `${d.sessionsCounted} sesi (Dikirim/Final)`],
      ]}
      print={(d) => (
        <>
          <PrintTable>
            <thead>
              <tr>
                <th>No</th>
                <th>{firstHeader}</th>
                <th>Sesi</th>
                {ATTENDANCE_STATUSES.map((s) => (
                  <th key={s}>{ATTENDANCE_META[s].short}</th>
                ))}
                <th>Total</th>
                <th>% Hadir</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="text-center">{i + 1}</td>
                  <td>
                    {r.date ? formatDate(r.date) : r.label}
                    {r.sublabel && <span className="block text-[10px]">{r.sublabel}</span>}
                  </td>
                  <td className="text-right">{r.sessions}</td>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <td key={s} className="text-right">{r.counts[s]}</td>
                  ))}
                  <td className="text-right font-semibold">{r.total}</td>
                  <td className="text-right">{formatPercent(r.percentPresent)}</td>
                </tr>
              ))}
              {d.rows.length === 0 && (
                <tr>
                  <td colSpan={ATTENDANCE_STATUSES.length + 5} className="text-center">Tidak ada data.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={2} className="text-center">JUMLAH</td>
                <td className="text-right">{d.totals.sessions}</td>
                {ATTENDANCE_STATUSES.map((s) => (
                  <td key={s} className="text-right">{d.totals.counts[s]}</td>
                ))}
                <td className="text-right">{d.totals.total}</td>
                <td className="text-right">{formatPercent(d.totals.percentPresent)}</td>
              </tr>
            </tfoot>
          </PrintTable>
          <p className="text-[11px]">
            Keterangan: {ATTENDANCE_STATUSES.map((s) => `${ATTENDANCE_META[s].short} = ${ATTENDANCE_META[s].label}`).join(', ')}. {PERCENT_HELP}
          </p>
        </>
      )}
    />
  )
}
