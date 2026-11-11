import { CalendarClock, CalendarDays, CircleCheck, CircleDashed, Clock, ListChecks } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { SUBSTITUTION_SLOT_META, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { formatDate, formatDateShort } from '@/lib/date'
import type { SubstitutionSlot } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, MiniStat, Num } from '../components/cells'
import { ReportTable, ReportView, SummaryGrid } from '../components/report-shell'
import { formatNumber, periodRange } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { SubstitutionDayRow, SubstitutionReport } from '../types'

const def = reportDef('jam-kosong')
const right = { className: 'text-right', headerClassName: 'text-right' }
const dayHref = (date: string, classId?: string) => drillHref(def.operationalPath, { date, classId })

export function SubstitutionsReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('substitutions', filters.query)
  const { shiftName } = useLookupMaps()

  const dayColumns: ColumnDef<SubstitutionDayRow>[] = [
    { id: 'date', header: 'Tanggal', accessorFn: (r) => r.date, cell: (c) => <span className="font-medium whitespace-nowrap">{formatDateShort(c.row.original.date)}</span> },
    { id: 'slots', header: 'Slot kosong', accessorFn: (r) => r.summary.affectedSlots, cell: (c) => <Num value={c.row.original.summary.affectedSlots} />, meta: right },
    { id: 'handledSlots', header: 'Slot tertangani', accessorFn: (r) => r.summary.handledSlots, cell: (c) => <Num value={c.row.original.summary.handledSlots} />, meta: right },
    { id: 'affected', header: 'Jam terdampak', accessorFn: (r) => r.summary.affectedPeriods, cell: (c) => <Num value={c.row.original.summary.affectedPeriods} />, meta: right },
    { id: 'handled', header: 'Jam tertangani', accessorFn: (r) => r.summary.handledPeriods, cell: (c) => <Num value={c.row.original.summary.handledPeriods} />, meta: right },
    {
      id: 'unhandled',
      header: 'Belum tertangani',
      accessorFn: (r) => r.summary.unhandledPeriods,
      cell: (c) => <Num value={c.row.original.summary.unhandledPeriods} className={c.row.original.summary.unhandledPeriods > 0 ? 'font-semibold text-tone-danger' : undefined} />,
      meta: right,
    },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: (c) => <DrillLink to={dayHref(c.row.original.date, filters.values.classId)}>Buka</DrillLink>,
      meta: { className: 'text-right', hideOnMobile: true },
    },
  ]

  const slotColumns: ColumnDef<SubstitutionSlot>[] = [
    {
      id: 'date',
      header: 'Tanggal · Jam',
      accessorFn: (r) => `${r.date}${String(r.periodStart).padStart(2, '0')}`,
      cell: ({ row: { original: r } }) => (
        <div className="whitespace-nowrap">
          <p className="font-medium">{formatDateShort(r.date)}</p>
          <p className="text-xs text-muted-foreground">
            {shiftName(r.shiftCode)} · jam ke-{periodRange(r.periodStart, r.periodEnd)}
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
    {
      id: 'absent',
      header: 'Guru berhalangan',
      accessorFn: (r) => r.absentTeacherName,
      cell: ({ row: { original: r } }) => (
        <div className="space-y-1">
          <p>{r.absentTeacherName}</p>
          <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.absentTeacherStatus} />
        </div>
      ),
    },
    { id: 'jp', header: 'JP', accessorFn: (r) => r.periodCount, cell: (c) => <Num value={c.row.original.periodCount} />, meta: right },
    {
      id: 'substitute',
      header: 'Pengganti',
      accessorFn: (r) => r.substitution?.substituteTeacherName ?? '',
      cell: ({ row: { original: r } }) =>
        r.substitution ? (
          <div>
            <p>{r.substitution.substituteTeacherName}</p>
            <p className="text-xs text-muted-foreground">{r.substitution.periodCount} JP · {r.substitution.activity ?? '—'}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: (c) => <StatusBadge meta={SUBSTITUTION_SLOT_META} value={c.row.original.status} /> },
  ]

  return (
    <ReportView<SubstitutionReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true, subject: true, teacher: ['substitution:write', 'teaching_log:read_all'] }}
      query={query}
      mode={mode}
      operationalLink={{ label: 'Kelola jam kosong', href: def.operationalPath }}
      note="Slot jam kosong = slot jadwal yang gurunya berstatus Sakit/Izin/Alpa/Dinas Luar. Slot dianggap tertangani bila memiliki guru pengganti yang tidak dibatalkan (PRD §9.2)."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Slot kosong" value={formatNumber(d.totals.affectedSlots)} hint={`${d.days.length} hari`} icon={<CalendarClock />} />
          <StatCard label="Jam terdampak" value={formatNumber(d.totals.affectedPeriods)} icon={<Clock />} />
          <StatCard label="Jam tertangani" value={formatNumber(d.totals.handledPeriods)} hint={`${d.totals.handledSlots} slot`} icon={<CircleCheck />} />
          <StatCard
            label="Belum tertangani"
            value={formatNumber(d.totals.unhandledPeriods)}
            hint={`${d.totals.unhandledSlots} slot`}
            icon={<CircleDashed />}
            tone={d.totals.unhandledPeriods > 0 ? 'danger' : 'neutral'}
          />
        </SummaryGrid>
      )}
      content={(d) => (
        <>
          <ReportTable
            title="Rekap harian"
            icon={<CalendarDays />}
            description="Ringkasan per tanggal"
            caption={`${def.title} per hari`}
            columns={dayColumns}
            data={d.days}
            getRowId={(r) => r.date}
            emptyState={<EmptyState title="Tidak ada jam kosong" description="Tidak ada guru berhalangan yang memiliki jadwal mengajar pada periode/filter ini." />}
            renderMobileCard={(r) => (
              <div className="space-y-2">
                <p className="font-semibold">{formatDate(r.date)}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <MiniStat label="Terdampak" value={r.summary.affectedPeriods} />
                  <MiniStat label="Tertangani" value={r.summary.handledPeriods} />
                  <MiniStat label="Belum" value={r.summary.unhandledPeriods} />
                </div>
                <DrillLink to={dayHref(r.date, filters.values.classId)}>Buka jam kosong</DrillLink>
              </div>
            )}
            totals={[
              ['Slot', `${d.totals.handledSlots}/${d.totals.affectedSlots} tertangani`],
              ['Jam terdampak', formatNumber(d.totals.affectedPeriods)],
              ['Tertangani', formatNumber(d.totals.handledPeriods)],
              ['Belum', formatNumber(d.totals.unhandledPeriods)],
            ]}
          />
          {d.slots.length > 0 && (
            <ReportTable
              title="Rincian slot & guru pengganti"
              icon={<ListChecks />}
              caption={`${def.title} rincian slot`}
              columns={slotColumns}
              data={d.slots}
              getRowId={(r) => r.id}
              pageSize={25}
              renderMobileCard={(r) => (
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {r.className} · {r.subjectName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.date)} · jam ke-{periodRange(r.periodStart, r.periodEnd)} · {r.periodCount} JP
                      </p>
                    </div>
                    <StatusBadge meta={SUBSTITUTION_SLOT_META} value={r.status} />
                  </div>
                  <p className="text-sm">
                    {r.absentTeacherName} ({TEACHER_ATTENDANCE_META[r.absentTeacherStatus].label})
                    {r.substitution && ` → ${r.substitution.substituteTeacherName}`}
                  </p>
                </div>
              )}
            />
          )}
        </>
      )}
      printMeta={(d) => [
        ['Ringkasan', `${d.totals.affectedPeriods} jam terdampak · ${d.totals.handledPeriods} tertangani · ${d.totals.unhandledPeriods} belum tertangani`],
      ]}
      print={(d) => (
        <PrintTable>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Shift</th>
              <th>Jam ke-</th>
              <th>Kelas</th>
              <th>Mata Pelajaran</th>
              <th>Guru Berhalangan</th>
              <th>Keterangan</th>
              <th>JP</th>
              <th>Guru Pengganti</th>
              <th>JP Ditangani</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.slots.map((r, i) => (
              <tr key={r.id}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{shiftName(r.shiftCode)}</td>
                <td className="text-center">{periodRange(r.periodStart, r.periodEnd)}</td>
                <td>{r.className}</td>
                <td>{r.subjectName}</td>
                <td>{r.absentTeacherName}</td>
                <td>{TEACHER_ATTENDANCE_META[r.absentTeacherStatus].label}</td>
                <td className="text-right">{r.periodCount}</td>
                <td>{r.substitution?.substituteTeacherName ?? '—'}</td>
                <td className="text-right">{r.substitution?.periodCount ?? 0}</td>
                <td>{SUBSTITUTION_SLOT_META[r.status].label}</td>
              </tr>
            ))}
            {d.slots.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center">Tidak ada data.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={8} className="text-center">JUMLAH</td>
              <td className="text-right">{d.totals.affectedPeriods}</td>
              <td />
              <td className="text-right">{d.totals.handledPeriods}</td>
              <td>Belum: {d.totals.unhandledPeriods} JP</td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
