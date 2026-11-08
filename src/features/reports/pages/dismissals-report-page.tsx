import { DoorOpen, LogOut, Timer, Undo2 } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { DISMISSAL_META, enumOptions } from '@/lib/enums'
import { formatDate, formatDateShort, formatTime } from '@/lib/date'
import { DISMISSAL_TYPES, type StudentDismissal } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, textOrDash } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { DismissalsReport } from '../types'

const def = reportDef('kepulangan')
const TYPE_OPTIONS = enumOptions(DISMISSAL_META)

const pickup = (r: StudentDismissal) =>
  r.pickupName ? `${r.pickupName}${r.pickupRelation ? ` (${r.pickupRelation})` : ''}` : '—'

export function DismissalsReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('dismissals', filters.query)
  const { shiftName } = useLookupMaps()
  const range = filters.range

  const columns: ColumnDef<StudentDismissal>[] = [
    { id: 'date', header: 'Tanggal', accessorFn: (r) => r.exitTime, cell: (c) => <span className="whitespace-nowrap">{formatDateShort(c.row.original.date)}</span> },
    {
      id: 'time',
      header: 'Keluar · Kembali',
      accessorFn: (r) => r.exitTime,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatTime(r.exitTime)}
          {r.returnTime && <span className="text-muted-foreground"> → {formatTime(r.returnTime)}</span>}
        </span>
      ),
    },
    { id: 'class', header: 'Kelas', accessorFn: (r) => r.className },
    { id: 'student', header: 'Siswa', accessorFn: (r) => r.studentName, cell: (c) => <span className="font-medium">{c.row.original.studentName}</span> },
    { id: 'type', header: 'Jenis', accessorFn: (r) => r.type, cell: (c) => <StatusBadge meta={DISMISSAL_META} value={c.row.original.type} /> },
    { id: 'pickup', header: 'Penjemput', enableSorting: false, cell: (c) => pickup(c.row.original) },
    { id: 'note', header: 'Catatan', enableSorting: false, cell: (c) => textOrDash(c.row.original.note), meta: { hideOnMobile: true } },
    { id: 'by', header: 'Petugas', accessorFn: (r) => r.recordedByName, meta: { hideOnMobile: true } },
  ]

  return (
    <ReportView<DismissalsReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true, student: true, type: { label: 'Jenis kepulangan', options: TYPE_OPTIONS } }}
      query={query}
      mode={mode}
      operationalLink={{
        label: 'Buka kepulangan',
        href: drillHref(def.operationalPath, { tab: 'riwayat', classId: filters.values.classId, from: range?.dateFrom, to: range?.dateTo }),
      }}
      note="Kepulangan dicatat terpisah dari absensi kedatangan (PRD §9.2) — tidak mengubah status hadir siswa."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Total kepulangan" value={formatNumber(d.total)} icon={<DoorOpen />} tone="info" />
          <StatCard label={DISMISSAL_META.EARLY_LEAVE.label} value={formatNumber(d.counts.EARLY_LEAVE)} icon={<LogOut />} tone="warning" />
          <StatCard label={DISMISSAL_META.TEMPORARY_EXIT.label} value={formatNumber(d.counts.TEMPORARY_EXIT)} icon={<Undo2 />} tone="info" />
          <StatCard label={DISMISSAL_META.NORMAL.label} value={formatNumber(d.counts.NORMAL)} icon={<Timer />} tone="success" />
        </SummaryGrid>
      )}
      content={(d) => (
        <section className="space-y-3">
          <SectionTitle description={`${formatNumber(d.total)} catatan`}>Rincian kepulangan</SectionTitle>
          <ReportTable
            caption={def.title}
            columns={columns}
            data={d.rows}
            getRowId={(r) => r.id}
            emptyState={
              <EmptyState
                title="Belum ada catatan kepulangan"
                description="Tidak ada siswa yang tercatat pulang lebih awal atau izin keluar pada periode/filter ini."
                action={<DrillLink to={def.operationalPath}>Catat kepulangan</DrillLink>}
              />
            }
            renderMobileCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.className} · {formatDate(r.date)} · {formatTime(r.exitTime)}
                      {r.returnTime && ` → ${formatTime(r.returnTime)}`}
                    </p>
                  </div>
                  <StatusBadge meta={DISMISSAL_META} value={r.type} />
                </div>
                <p className="text-sm">Penjemput: {pickup(r)}</p>
                {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
              </div>
            )}
            totals={[
              ['Total', formatNumber(d.total)],
              ...DISMISSAL_TYPES.map<[string, string]>((t) => [DISMISSAL_META[t].label, formatNumber(d.counts[t])]),
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
              <th>Kelas</th>
              <th>Nama Siswa</th>
              <th>Jenis</th>
              <th>Keluar</th>
              <th>Kembali</th>
              <th>Penjemput</th>
              <th>Catatan</th>
              <th>Petugas</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{shiftName(r.shiftCode)}</td>
                <td>{r.className}</td>
                <td>{r.studentName}</td>
                <td>{DISMISSAL_META[r.type].label}</td>
                <td className="text-center">{formatTime(r.exitTime)}</td>
                <td className="text-center">{r.returnTime ? formatTime(r.returnTime) : '—'}</td>
                <td>{pickup(r)}</td>
                <td>{textOrDash(r.note)}</td>
                <td>{r.recordedByName}</td>
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
              <td colSpan={5} className="text-center">JUMLAH</td>
              <td colSpan={6}>
                {d.total} — {DISMISSAL_TYPES.map((t) => `${DISMISSAL_META[t].label}: ${d.counts[t]}`).join(', ')}
              </td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
