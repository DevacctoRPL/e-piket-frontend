import { CalendarClock, ClipboardCheck, NotebookText, UserX } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { RECORD_STATUS_META } from '@/lib/enums'
import { formatDate, formatDateShort } from '@/lib/date'
import { reportDef } from '../catalog'
import { DrillLink, MiniStat, Num } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { DutyAgendaReport, DutyAgendaReportRow } from '../types'

const def = reportDef('agenda-piket')
const right = { className: 'text-right', headerClassName: 'text-right' }

function AgendaStatus({ r }: { r: DutyAgendaReportRow }) {
  return r.status ? <StatusBadge meta={RECORD_STATUS_META} value={r.status} /> : <ToneBadge tone="danger">Belum dibuat</ToneBadge>
}

const agendaHref = (r: DutyAgendaReportRow) =>
  r.agendaId
    ? `${def.operationalPath}/${encodeURIComponent(r.agendaId)}`
    : drillHref(def.operationalPath, { dateFrom: r.date, dateTo: r.date, shiftCode: r.shiftCode })

export function DutyAgendaReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('duty-agendas', filters.query)

  const columns: ColumnDef<DutyAgendaReportRow>[] = [
    {
      id: 'date',
      header: 'Tanggal · Shift',
      accessorFn: (r) => `${r.date}${r.shiftCode}`,
      cell: ({ row: { original: r } }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{formatDateShort(r.date)}</p>
          <p className="text-xs text-muted-foreground">{r.shiftName}</p>
        </div>
      ),
    },
    { id: 'officers', header: 'Petugas', enableSorting: false, cell: (c) => <span className="text-sm">{c.row.original.dutyTeacherNames.join(', ') || '—'}</span> },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status ?? '', cell: (c) => <AgendaStatus r={c.row.original} /> },
    {
      id: 'teachers',
      header: 'Guru hadir',
      accessorFn: (r) => r.presentTeacherCount,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums">
          {r.presentTeacherCount}/{r.scheduledTeacherCount}
        </span>
      ),
      meta: right,
    },
    {
      id: 'absent',
      header: 'Tidak hadir',
      accessorFn: (r) => r.absentTeacherCount,
      cell: ({ row: { original: r } }) => (
        <div className="text-right">
          <Num value={r.absentTeacherCount} />
          {r.absentTeacherNames.length > 0 && <p className="max-w-48 text-xs text-muted-foreground">{r.absentTeacherNames.join(', ')}</p>}
        </div>
      ),
      meta: right,
    },
    {
      id: 'periods',
      header: 'Jam terdampak / ditangani',
      accessorFn: (r) => r.affectedPeriods,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums">
          {r.affectedPeriods} / {r.handledPeriods}
        </span>
      ),
      meta: right,
    },
    { id: 'notes', header: 'Catatan', accessorFn: (r) => r.notesCount, cell: (c) => <Num value={c.row.original.notesCount} />, meta: right },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: (c) => <DrillLink to={agendaHref(c.row.original)}>Buka</DrillLink>,
      meta: { className: 'text-right', hideOnMobile: true },
    },
  ]

  return (
    <ReportView<DutyAgendaReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true }}
      query={query}
      mode={mode}
      operationalLink={{ label: 'Buka agenda piket', href: def.operationalPath }}
      note="Agenda Final memakai snapshot saat disahkan; agenda yang belum final memakai data absensi guru & jam kosong terkini. Hari sekolah tanpa agenda ditandai Belum dibuat."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Agenda final" value={`${d.totals.final}/${d.totals.rows}`} hint={`${d.totals.notFinal} belum final · ${d.totals.notCreated} belum dibuat`} icon={<ClipboardCheck />} tone={d.totals.notCreated + d.totals.notFinal > 0 ? 'warning' : 'success'} />
          <StatCard label="Guru tidak hadir" value={formatNumber(d.totals.absentTeacherCount)} hint="Akumulasi per shift" icon={<UserX />} tone="danger" />
          <StatCard label="Jam terdampak" value={formatNumber(d.totals.affectedPeriods)} hint={`${d.totals.handledPeriods} jam ditangani pengganti`} icon={<CalendarClock />} tone="info" />
          <StatCard label="Catatan penting" value={formatNumber(d.totals.notesCount)} icon={<NotebookText />} />
        </SummaryGrid>
      )}
      content={(d) => (
        <section className="space-y-3">
          <SectionTitle description={`${formatNumber(d.totals.rows)} agenda shift`}>Rekap agenda</SectionTitle>
          <ReportTable
            caption={def.title}
            columns={columns}
            data={d.rows}
            getRowId={(r) => r.key}
            emptyState={<EmptyState title="Belum ada agenda piket" description="Tidak ada hari sekolah terjadwal pada periode ini, atau tanggal yang dipilih masih di masa depan." />}
            renderMobileCard={(r) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {formatDate(r.date)} · {r.shiftName}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.dutyTeacherNames.join(', ') || '—'}</p>
                  </div>
                  <AgendaStatus r={r} />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <MiniStat label="Guru hadir" value={`${r.presentTeacherCount}/${r.scheduledTeacherCount}`} />
                  <MiniStat label="Jam terdampak" value={`${r.affectedPeriods} (${r.handledPeriods} ditangani)`} />
                  <MiniStat label="Catatan" value={r.notesCount} />
                </div>
                {r.absentTeacherNames.length > 0 && <p className="text-xs text-muted-foreground">Tidak hadir: {r.absentTeacherNames.join(', ')}</p>}
                <DrillLink to={agendaHref(r)}>Buka agenda</DrillLink>
              </div>
            )}
            totals={[
              ['Final', `${d.totals.final}/${d.totals.rows}`],
              ['Guru tidak hadir', formatNumber(d.totals.absentTeacherCount)],
              ['Jam terdampak', formatNumber(d.totals.affectedPeriods)],
              ['Ditangani', formatNumber(d.totals.handledPeriods)],
              ['Catatan', formatNumber(d.totals.notesCount)],
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
              <th>Petugas Piket</th>
              <th>Guru Hadir</th>
              <th>Guru Tidak Hadir</th>
              <th>Jam Terdampak</th>
              <th>Jam Ditangani</th>
              <th>Catatan</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.key}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{r.shiftName}</td>
                <td>{r.dutyTeacherNames.join(', ')}</td>
                <td className="text-center">
                  {r.presentTeacherCount}/{r.scheduledTeacherCount}
                </td>
                <td>
                  {r.absentTeacherCount}
                  {r.absentTeacherNames.length > 0 && <span className="block text-[10px]">{r.absentTeacherNames.join(', ')}</span>}
                </td>
                <td className="text-right">{r.affectedPeriods}</td>
                <td className="text-right">{r.handledPeriods}</td>
                <td className="text-right">{r.notesCount}</td>
                <td>{r.status ? RECORD_STATUS_META[r.status].label : 'Belum dibuat'}</td>
              </tr>
            ))}
            {d.rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center">Tidak ada data.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={5} className="text-center">JUMLAH</td>
              <td>{d.totals.absentTeacherCount}</td>
              <td className="text-right">{d.totals.affectedPeriods}</td>
              <td className="text-right">{d.totals.handledPeriods}</td>
              <td className="text-right">{d.totals.notesCount}</td>
              <td>Final {d.totals.final}/{d.totals.rows}</td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
