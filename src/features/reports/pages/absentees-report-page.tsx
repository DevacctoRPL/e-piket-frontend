import { ListChecks, PhoneCall, PhoneOff, UserX } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { ATTENDANCE_META, enumOptions, NON_PRESENT_STATUSES } from '@/lib/enums'
import { formatDate, formatDateShort, formatDateTime } from '@/lib/date'
import type { AbsenteeRow } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, textOrDash } from '../components/cells'
import { ReportTable, ReportView, SummaryGrid } from '../components/report-shell'
import { formatNumber } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { AbsenteesReport } from '../types'

const def = reportDef('siswa-tidak-hadir')
const STATUS_OPTIONS = enumOptions(ATTENDANCE_META, NON_PRESENT_STATUSES)

function ContactCell({ r }: { r: AbsenteeRow }) {
  if (!r.contact?.contactedAt)
    return (
      <ToneBadge tone="danger" icon={PhoneOff}>
        Belum dihubungi
      </ToneBadge>
    )
  return (
    <div className="text-xs">
      <p className="font-medium">{textOrDash(r.contact.receiverName)} · {textOrDash(r.contact.contactedPhone)}</p>
      <p className="text-muted-foreground">{textOrDash(r.contact.contactNote)}</p>
    </div>
  )
}

export function AbsenteesReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('absentees', filters.query)
  const { shiftName } = useLookupMaps()
  const range = filters.range
  const operationalHref = drillHref(def.operationalPath, {
    classId: filters.values.classId,
    shiftCode: filters.values.shiftCode,
    status: filters.values.status,
    dateFrom: range?.dateFrom,
    dateTo: range?.dateTo,
  })

  const columns: ColumnDef<AbsenteeRow>[] = [
    { id: 'date', header: 'Tanggal', accessorFn: (r) => r.date, cell: (c) => <span className="whitespace-nowrap">{formatDateShort(c.row.original.date)}</span> },
    { id: 'class', header: 'Kelas', accessorFn: (r) => r.className },
    {
      id: 'student',
      header: 'Siswa',
      accessorFn: (r) => r.studentName,
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="font-medium">{r.studentName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{r.studentNis}</p>
        </div>
      ),
    },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: (c) => <StatusBadge meta={ATTENDANCE_META} value={c.row.original.status} /> },
    { id: 'reason', header: 'Alasan', accessorFn: (r) => r.reason ?? '', cell: (c) => textOrDash(c.row.original.reason) },
    { id: 'contact', header: 'Konfirmasi wali', enableSorting: false, cell: (c) => <ContactCell r={c.row.original} /> },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <DrillLink to={drillHref(def.operationalPath, { classId: r.classId, dateFrom: r.date, dateTo: r.date })}>Detail</DrillLink>
      ),
      meta: { className: 'text-right', hideOnMobile: true },
    },
  ]

  return (
    <ReportView<AbsenteesReport>
      def={def}
      filters={filters}
      filterConfig={{ shift: true, class: true, student: true, status: { label: 'Status', options: STATUS_OPTIONS } }}
      query={query}
      mode={mode}
      operationalLink={{ label: 'Kelola konfirmasi wali', href: operationalHref }}
      note="Hanya dari sesi absensi berstatus Dikirim/Final. Nomor telepon wali ditampilkan sesuai hak akses Anda."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Siswa tidak hadir" value={formatNumber(d.total)} hint="Record bukan Hadir" icon={<UserX />} tone={d.total > 0 ? 'danger' : 'neutral'} href={operationalHref} />
          <StatCard label="Sakit · Izin · Alpa" value={`${d.counts.SICK} · ${d.counts.PERMISSION} · ${d.counts.ABSENT}`} hint={`Terlambat ${d.counts.LATE}`} />
          <StatCard label="Sudah dihubungi" value={formatNumber(d.contacted)} icon={<PhoneCall />} />
          <StatCard label="Belum dihubungi" value={formatNumber(d.notContacted)} icon={<PhoneOff />} tone={d.notContacted > 0 ? 'danger' : 'neutral'} href={operationalHref} />
        </SummaryGrid>
      )}
      content={(d) => (
        <ReportTable
          title="Daftar siswa"
          icon={<ListChecks />}
          caption={def.title}
          columns={columns}
          data={d.rows}
          getRowId={(r) => r.recordId}
          emptyState={
            <EmptyState
              title="Tidak ada siswa tidak hadir"
              description="Semua siswa pada sesi yang sudah dikirim berstatus Hadir, atau absensi belum dikirim. Ubah periode/filter untuk melihat data lain."
            />
          }
          renderMobileCard={(r) => (
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{r.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.className} · {formatDate(r.date)}
                  </p>
                </div>
                <StatusBadge meta={ATTENDANCE_META} value={r.status} />
              </div>
              <p className="text-sm">{textOrDash(r.reason)}</p>
              <ContactCell r={r} />
            </div>
          )}
          totals={[
            ['Total', formatNumber(d.total)],
            ...NON_PRESENT_STATUSES.filter((s) => d.counts[s] > 0).map<[string, string]>((s) => [ATTENDANCE_META[s].label, formatNumber(d.counts[s])]),
            ['Dihubungi', formatNumber(d.contacted)],
          ]}
        />
      )}
      printMeta={(d) => [['Jumlah', `${d.total} siswa (dihubungi ${d.contacted}, belum ${d.notContacted})`]]}
      print={(d) => (
        <PrintTable>
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Shift</th>
              <th>Kelas</th>
              <th>Nama Siswa</th>
              <th>Status</th>
              <th>Alasan</th>
              <th>Nomor Dihubungi</th>
              <th>Penerima</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <tr key={r.recordId}>
                <td className="text-center">{i + 1}</td>
                <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                <td>{shiftName(r.shiftCode)}</td>
                <td>{r.className}</td>
                <td>
                  {r.studentName}
                  <span className="block text-[10px]">{r.studentNis}</span>
                </td>
                <td>{ATTENDANCE_META[r.status].label}</td>
                <td>{textOrDash(r.reason)}</td>
                <td>{textOrDash(r.contact?.contactedPhone)}</td>
                <td>{textOrDash(r.contact?.receiverName)}</td>
                <td>
                  {textOrDash(r.contact?.contactNote ?? r.note)}
                  {r.contact?.contactedAt && (
                    <span className="block text-[10px]">
                      {formatDateTime(r.contact.contactedAt)} · {r.contact.contactedByName}
                    </span>
                  )}
                </td>
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
              <td colSpan={5}>
                {d.total} siswa —{' '}
                {NON_PRESENT_STATUSES.filter((s) => d.counts[s] > 0)
                  .map((s) => `${ATTENDANCE_META[s].label}: ${d.counts[s]}`)
                  .join(', ')}
              </td>
            </tr>
          </tfoot>
        </PrintTable>
      )}
    />
  )
}
