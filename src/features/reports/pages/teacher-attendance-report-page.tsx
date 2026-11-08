import { AlarmClock, CalendarX2, UserCheck, Users } from 'lucide-react'
import { EmptyState, StatCard } from '@/components/page'
import type { ColumnDef } from '@/components/data-table'
import { PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupMaps } from '@/features/master-data/lookups'
import { enumOptions, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { formatDate, formatDateShort, formatTime } from '@/lib/date'
import { TEACHER_ATTENDANCE_STATUSES, type TeacherAttendance } from '@/types/entities'
import { reportDef } from '../catalog'
import { DrillLink, MiniStat, Num, textOrDash } from '../components/cells'
import { ReportTable, ReportView, SectionTitle, SummaryGrid } from '../components/report-shell'
import { formatNumber } from '../lib/format'
import { drillHref, useReportFilters } from '../lib/use-report-filters'
import { useReport } from '../queries'
import type { TeacherAttendanceReport, TeacherAttendanceReportRow } from '../types'

const def = reportDef('absensi-guru')
const STATUS_OPTIONS = enumOptions(TEACHER_ATTENDANCE_META)
const right = { className: 'text-right', headerClassName: 'text-right' }

export function TeacherAttendanceReportPage({ mode = 'screen' }: { mode?: 'screen' | 'print' }) {
  const filters = useReportFilters(def)
  const query = useReport('teacher-attendance', filters.query)
  const { can } = useAuth()
  const { shiftName } = useLookupMaps()
  const canDrill = can('teacher_attendance:read')

  const summaryColumns: ColumnDef<TeacherAttendanceReportRow>[] = [
    {
      id: 'teacher',
      header: 'Guru',
      accessorFn: (r) => r.teacherName,
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="font-medium">{r.teacherName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">NIP {r.nip}</p>
        </div>
      ),
    },
    ...TEACHER_ATTENDANCE_STATUSES.map<ColumnDef<TeacherAttendanceReportRow>>((s) => ({
      id: s,
      header: TEACHER_ATTENDANCE_META[s].short ?? s,
      accessorFn: (r) => r.counts[s],
      cell: (c) => <Num value={c.row.original.counts[s]} />,
      meta: right,
    })),
    { id: 'records', header: 'Hari', accessorFn: (r) => r.records, cell: (c) => <Num value={c.row.original.records} className="font-semibold" />, meta: right },
    { id: 'late', header: 'Menit terlambat', accessorFn: (r) => r.lateMinutes, cell: (c) => <Num value={c.row.original.lateMinutes} />, meta: right },
    { id: 'affected', header: 'Jam terdampak', accessorFn: (r) => r.affectedPeriods, cell: (c) => <Num value={c.row.original.affectedPeriods} />, meta: right },
    {
      id: 'drill',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) =>
        canDrill ? (
          <DrillLink to={drillHref(def.operationalPath, { teacherId: r.teacherId, dateFrom: filters.range?.dateFrom, dateTo: filters.range?.dateTo })}>
            Riwayat
          </DrillLink>
        ) : null,
      meta: { className: 'text-right', hideOnMobile: true },
    },
  ]

  const detailColumns: ColumnDef<TeacherAttendance>[] = [
    { id: 'date', header: 'Tanggal', accessorFn: (r) => r.date, cell: (c) => <span className="whitespace-nowrap">{formatDateShort(c.row.original.date)}</span> },
    { id: 'teacher', header: 'Guru', accessorFn: (r) => r.teacherName },
    { id: 'shift', header: 'Shift', accessorFn: (r) => r.shiftCode, cell: (c) => shiftName(c.row.original.shiftCode) },
    { id: 'status', header: 'Status', accessorFn: (r) => r.status, cell: (c) => <StatusBadge meta={TEACHER_ATTENDANCE_META} value={c.row.original.status} /> },
    {
      id: 'inout',
      header: 'Masuk · Pulang',
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatTime(r.checkInAt)} · {formatTime(r.checkOutAt)}
        </span>
      ),
    },
    { id: 'late', header: 'Terlambat', accessorFn: (r) => r.lateMinutes ?? 0, cell: (c) => (c.row.original.lateMinutes ? `${c.row.original.lateMinutes} mnt` : '—'), meta: right },
    { id: 'reason', header: 'Alasan', enableSorting: false, cell: (c) => textOrDash(c.row.original.reason) },
  ]

  return (
    <ReportView<TeacherAttendanceReport>
      def={def}
      filters={filters}
      filterConfig={{
        shift: true,
        teacher: ['teacher_attendance:read'],
        status: { label: 'Status', options: STATUS_OPTIONS },
      }}
      query={query}
      mode={mode}
      operationalLink={{ label: 'Buka absensi guru', href: def.operationalPath }}
      note="Jam terdampak dihitung dari jadwal aktif untuk status Sakit/Izin/Alpa/Dinas Luar (termasuk koreksi piket bila ada). Menit terlambat dihitung setelah batas toleransi shift."
      summary={(d) => (
        <SummaryGrid>
          <StatCard label="Kehadiran tercatat" value={formatNumber(d.totals.records)} hint={`${d.teachers.length} guru`} icon={<Users />} tone="info" />
          <StatCard label="Hadir" value={formatNumber(d.totals.counts.PRESENT + d.totals.counts.LATE)} hint={`Terlambat ${d.totals.counts.LATE}`} icon={<UserCheck />} tone="success" />
          <StatCard
            label="Tidak hadir"
            value={formatNumber(d.totals.counts.SICK + d.totals.counts.PERMISSION + d.totals.counts.ABSENT + d.totals.counts.OFFICIAL_DUTY)}
            hint={`${d.totals.affectedPeriods} jam terdampak`}
            icon={<CalendarX2 />}
            tone="danger"
          />
          <StatCard label="Menit terlambat" value={formatNumber(d.totals.lateMinutes)} icon={<AlarmClock />} tone="warning" />
        </SummaryGrid>
      )}
      content={(d) => (
        <>
          <section className="space-y-3">
            <SectionTitle description="Jumlah hari per status">Rekap per guru</SectionTitle>
            <ReportTable
              caption={`${def.title} per guru`}
              columns={summaryColumns}
              data={d.teachers}
              getRowId={(r) => r.teacherId}
              emptyState={<EmptyState title="Belum ada absensi guru" description="Tidak ada catatan kehadiran guru pada periode/filter ini." />}
              renderMobileCard={(r) => (
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold">{r.teacherName}</p>
                    <p className="text-xs text-muted-foreground">NIP {r.nip} · {r.records} hari</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TEACHER_ATTENDANCE_STATUSES.map((s) => (
                      <MiniStat key={s} label={TEACHER_ATTENDANCE_META[s].label} value={r.counts[s]} />
                    ))}
                    <MiniStat label="Menit terlambat" value={r.lateMinutes} />
                    <MiniStat label="Jam terdampak" value={r.affectedPeriods} />
                  </div>
                </div>
              )}
              totals={[
                ...TEACHER_ATTENDANCE_STATUSES.map<[string, string]>((s) => [TEACHER_ATTENDANCE_META[s].short ?? s, formatNumber(d.totals.counts[s])]),
                ['Hari', formatNumber(d.totals.records)],
                ['Menit terlambat', formatNumber(d.totals.lateMinutes)],
                ['Jam terdampak', formatNumber(d.totals.affectedPeriods)],
              ]}
            />
          </section>
          {d.records.length > 0 && (
            <section className="space-y-3">
              <SectionTitle description={`${formatNumber(d.records.length)} catatan check-in/out`}>Rincian harian</SectionTitle>
              <ReportTable
                caption={`${def.title} rincian`}
                columns={detailColumns}
                data={d.records}
                getRowId={(r) => r.id}
                pageSize={25}
                renderMobileCard={(r) => (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{r.teacherName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(r.date)} · {shiftName(r.shiftCode)}
                        </p>
                      </div>
                      <StatusBadge meta={TEACHER_ATTENDANCE_META} value={r.status} />
                    </div>
                    <p className="text-sm tabular-nums">
                      Masuk {formatTime(r.checkInAt)} · Pulang {formatTime(r.checkOutAt)}
                      {r.lateMinutes ? ` · terlambat ${r.lateMinutes} mnt` : ''}
                    </p>
                    {r.reason && <p className="text-xs text-muted-foreground">{r.reason}</p>}
                  </div>
                )}
              />
            </section>
          )}
        </>
      )}
      print={(d) => (
        <>
          <PrintTable>
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Guru</th>
                <th>NIP</th>
                {TEACHER_ATTENDANCE_STATUSES.map((s) => (
                  <th key={s}>{TEACHER_ATTENDANCE_META[s].short}</th>
                ))}
                <th>Hari</th>
                <th>Menit Terlambat</th>
                <th>Jam Terdampak</th>
              </tr>
            </thead>
            <tbody>
              {d.teachers.map((r, i) => (
                <tr key={r.teacherId}>
                  <td className="text-center">{i + 1}</td>
                  <td>{r.teacherName}</td>
                  <td className="whitespace-nowrap">{r.nip}</td>
                  {TEACHER_ATTENDANCE_STATUSES.map((s) => (
                    <td key={s} className="text-right">{r.counts[s]}</td>
                  ))}
                  <td className="text-right">{r.records}</td>
                  <td className="text-right">{r.lateMinutes}</td>
                  <td className="text-right">{r.affectedPeriods}</td>
                </tr>
              ))}
              {d.teachers.length === 0 && (
                <tr>
                  <td colSpan={TEACHER_ATTENDANCE_STATUSES.length + 6} className="text-center">Tidak ada data.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={3} className="text-center">JUMLAH</td>
                {TEACHER_ATTENDANCE_STATUSES.map((s) => (
                  <td key={s} className="text-right">{d.totals.counts[s]}</td>
                ))}
                <td className="text-right">{d.totals.records}</td>
                <td className="text-right">{d.totals.lateMinutes}</td>
                <td className="text-right">{d.totals.affectedPeriods}</td>
              </tr>
            </tfoot>
          </PrintTable>
          {d.records.some((r) => r.status !== 'PRESENT') && (
            <>
              <p className="font-semibold">Rincian ketidakhadiran &amp; keterlambatan</p>
              <PrintTable>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tanggal</th>
                    <th>Nama Guru</th>
                    <th>Status</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Terlambat</th>
                    <th>Jam Terdampak</th>
                    <th>Alasan</th>
                  </tr>
                </thead>
                <tbody>
                  {d.records
                    .filter((r) => r.status !== 'PRESENT')
                    .map((r, i) => (
                      <tr key={r.id}>
                        <td className="text-center">{i + 1}</td>
                        <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                        <td>{r.teacherName}</td>
                        <td>{TEACHER_ATTENDANCE_META[r.status].label}</td>
                        <td className="text-center">{formatTime(r.checkInAt)}</td>
                        <td className="text-center">{formatTime(r.checkOutAt)}</td>
                        <td className="text-right">{r.lateMinutes ?? '—'}</td>
                        <td className="text-right">{r.affectedPeriods}</td>
                        <td>{textOrDash(r.reason)}</td>
                      </tr>
                    ))}
                </tbody>
              </PrintTable>
            </>
          )}
          <p className="text-[11px]">
            Keterangan: {TEACHER_ATTENDANCE_STATUSES.map((s) => `${TEACHER_ATTENDANCE_META[s].short} = ${TEACHER_ATTENDANCE_META[s].label}`).join(', ')}.
          </p>
        </>
      )}
    />
  )
}
