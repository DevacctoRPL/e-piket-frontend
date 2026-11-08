import { BookCheck, BookX, Clock, Gauge } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { RECORD_STATUS_META, TEACHING_EXECUTION_META, TEACHING_PRESENCE_META } from '@/lib/enums'
import { formatDate, formatDateShort } from '@/lib/date'
import type { TeachingLog } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, InfoTip, textOrDash } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber, formatPercent, periodRange } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { TeachingLogReport } from '../types'

const def = reportDef('jurnal-mengajar')
const FILL_HELP =
  'Kelengkapan = slot jadwal yang memiliki jurnal Dikirim/Final ÷ slot terjadwal pada hari sekolah sampai hari ini. Jam kosong yang tidak tertangani tidak dihitung.'

export function TeachingLogsReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('teaching-logs', filters.query)
  const { shiftName } = useLookupMaps()

  const columns: ColumnDef<TeachingLog>[] = [
    {
      id: 'date',
      header: 'Tanggal · Jam',
      accessorFn: (r) => `${r.date}${String(r.periodStart).padStart(2, '0')}`,
      cell: ({ row: { original: r } }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{formatDateShort(r.date)}</p>
          <p className="text-xs text-muted-foreground">
            Jam ke-{periodRange(r.periodStart, r.periodEnd)} · {r.periodCount} JP
          </p>
        </div>
      ),
    },
    {
      id: 'class',
      header: 'Kelas · Mapel',
      accessorFn: (r) => r.className,
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="font-medium">{r.className}</p>
          <p className="text-xs text-muted-foreground">{r.subjectName}</p>
        </div>
      ),
    },
    { id: 'teacher', header: 'Guru', accessorFn: (r) => r.teacherName },
    {
      id: 'topic',
      header: 'Materi · Kegiatan',
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <div className="max-w-72">
          <p>{r.execution === 'NOT_HELD' ? textOrDash(r.notHeldReason) : textOrDash(r.topic)}</p>
          {r.activity && <p className="text-xs text-muted-foreground">{r.activity}</p>}
        </div>
      ),
    },
    { id: 'meeting', header: 'Pertemuan', accessorFn: (r) => r.meetingNumber ?? 0, cell: (c) => c.row.original.meetingNumber ?? '—', meta: { className: 'text-right', headerClassName: 'text-right' } },
    { id: 'exec', header: 'Pelaksanaan', accessorFn: (r) => r.execution, cell: (c) => <StatusBadge meta={TEACHING_EXECUTION_META} value={c.row.original.execution} /> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: (c) => <StatusBadge meta={RECORD_STATUS_META} value={c.row.original.status} />, meta: { hideOnMobile: true } },
  ]

  return (
    <ReportView<TeachingLogReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true, subject: true, teacher: ['teaching_log:read_all'] }}
      query={query}
      mode={mode}
      operationalLink={{
        label: 'Buka jurnal',
        href: drillHref(def.operationalPath, {
          tab: 'riwayat',
          classId: filters.values.classId,
          teacherId: filters.values.teacherId,
          dateFrom: filters.range?.dateFrom,
          dateTo: filters.range?.dateTo,
        }),
      }}
      note={`${FILL_HELP} JML terlaksana hanya menjumlah jurnal berstatus Terlaksana.`}
      summary={(d) => (
        <SummaryGrid>
          <StatCard
            label="Kelengkapan jurnal"
            value={formatPercent(d.totals.fillRate)}
            hint={
              <span className="inline-flex items-center gap-1">
                {d.totals.filledSlots} dari {d.totals.expectedSlots} slot
                <InfoTip label="Cara hitung kelengkapan">{FILL_HELP}</InfoTip>
              </span>
            }
            icon={<Gauge />}
            tone={d.totals.fillRate !== null && d.totals.fillRate >= 90 ? 'success' : 'warning'}
          />
          <StatCard label="Terlaksana" value={formatNumber(d.totals.held)} hint={`dari ${d.totals.logs} jurnal`} icon={<BookCheck />} tone="success" />
          <StatCard label="Tidak terlaksana" value={formatNumber(d.totals.notHeld)} icon={<BookX />} tone={d.totals.notHeld > 0 ? 'danger' : 'neutral'} />
          <StatCard label="JML terlaksana" value={formatNumber(d.totals.periods)} hint={d.totals.draftExcluded > 0 ? `${d.totals.draftExcluded} jurnal Draft belum dihitung` : 'Jam pelajaran'} icon={<Clock />} tone="info" />
        </SummaryGrid>
      )}
      content={(d) => (
        <section className="space-y-3">
          <SectionTitle description={`${formatNumber(d.totals.logs)} jurnal`}>Rincian jurnal</SectionTitle>
          <ReportTable
            caption={def.title}
            columns={columns}
            data={d.rows}
            getRowId={(r) => r.id}
            pageSize={25}
            emptyState={
              <EmptyState
                title="Belum ada jurnal pada periode ini"
                description="Jurnal yang masih Draft belum masuk rekap. Kirim jurnal dari halaman Jurnal Mengajar."
                action={<DrillLink to={def.operationalPath}>Buka jurnal mengajar</DrillLink>}
              />
            }
            renderMobileCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {r.className} · {r.subjectName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.date)} · Jam ke-{periodRange(r.periodStart, r.periodEnd)} · {r.periodCount} JP
                    </p>
                  </div>
                  <StatusBadge meta={TEACHING_EXECUTION_META} value={r.execution} />
                </div>
                <p className="text-sm">{r.execution === 'NOT_HELD' ? textOrDash(r.notHeldReason) : textOrDash(r.topic)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.teacherName}
                  {r.meetingNumber ? ` · Pertemuan ke-${r.meetingNumber}` : ''}
                </p>
              </div>
            )}
            totals={[
              ['Jurnal', formatNumber(d.totals.logs)],
              ['Terlaksana', formatNumber(d.totals.held)],
              ['Tidak terlaksana', formatNumber(d.totals.notHeld)],
              ['JML', formatNumber(d.totals.periods)],
              ['Kelengkapan', formatPercent(d.totals.fillRate)],
            ]}
          />
        </section>
      )}
      printMeta={(d) => [['Kelengkapan jurnal', `${formatPercent(d.totals.fillRate)} (${d.totals.filledSlots}/${d.totals.expectedSlots} slot)`]]}
      print={(d) => (
        <PrintTable>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Shift</th>
              <th>Jam ke-</th>
              <th>JML</th>
              <th>Kelas</th>
              <th>Mata Pelajaran</th>
              <th>Guru</th>
              <th>Pert.</th>
              <th>Materi</th>
              <th>Kegiatan</th>
              <th>Kehadiran Guru</th>
              <th>Pelaksanaan</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{shiftName(r.shiftCode)}</td>
                <td className="text-center">{periodRange(r.periodStart, r.periodEnd)}</td>
                <td className="text-right">{r.periodCount}</td>
                <td>{r.className}</td>
                <td>{r.subjectName}</td>
                <td>{r.teacherName}</td>
                <td className="text-center">{r.meetingNumber ?? '—'}</td>
                <td>{textOrDash(r.topic)}</td>
                <td>{textOrDash(r.activity)}</td>
                <td>{TEACHING_PRESENCE_META[r.teacherPresence].label}</td>
                <td>
                  {TEACHING_EXECUTION_META[r.execution].label}
                  {r.notHeldReason && <span className="block text-[10px]">{r.notHeldReason}</span>}
                </td>
              </tr>
            ))}
            {d.rows.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center">Tidak ada data.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={4} className="text-center">JUMLAH</td>
              <td className="text-right">{d.totals.periods}</td>
              <td colSpan={8}>
                {d.totals.logs} jurnal — terlaksana {d.totals.held}, tidak terlaksana {d.totals.notHeld}; kelengkapan {formatPercent(d.totals.fillRate)}
              </td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
