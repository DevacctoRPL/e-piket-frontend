import { AlertTriangle, BarChart3, CalendarX2, Clock3, Hourglass, Table2, UserCheck, UserX } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, StatCard, TableSkeleton } from '@/components/page'
import { PrintDocument, PrintTable } from '@/components/print-layout'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/misc'
import { useActiveAcademicYear, useShifts, useTeachers } from '@/features/master-data/lookups'
import { addDays, formatDate, formatTime, startOfMonth, todayISO } from '@/lib/date'
import { TEACHER_ATTENDANCE_META, enumOptions } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { TeacherAttendance, TeacherAttendanceStatus } from '@/types/entities'
import { TEACHER_ATTENDANCE_STATUSES } from '@/types/entities'
import { useTeacherAttendanceHistory } from '../queries'
import type { TeacherAttendanceHistoryParams, TeacherRecapRow } from '../types'
import { formatAffected } from '../utils'

const ABSENT_KEYS: TeacherAttendanceStatus[] = ['SICK', 'PERMISSION', 'ABSENT', 'OFFICIAL_DUTY']

/** Tab "Rekap" kehadiran guru (FR-TCH-05, AC-08, PRD §13 "Rekap absensi guru"). */
export function RecapPanel() {
  const today = todayISO()
  const { values, set, reset, isDirty } = useFilters({
    rTeacher: '',
    rFrom: startOfMonth(today),
    rTo: today,
    rStatus: '',
    rShift: '',
    rSemester: '',
  })
  const teachers = useTeachers()
  const shifts = useShifts()
  const { year } = useActiveAcademicYear()

  const invalidRange = values.rFrom > values.rTo
  const params: TeacherAttendanceHistoryParams = {
    teacherId: values.rTeacher || undefined,
    dateFrom: values.rFrom,
    dateTo: values.rTo,
    status: (values.rStatus as TeacherAttendanceStatus | '') || undefined,
    shiftCode: values.rShift || undefined,
    semesterId: values.rSemester || undefined,
  }
  const q = useTeacherAttendanceHistory(params, !invalidRange)
  const shiftData = shifts.data
  const shiftName = useCallback(
    (code: string) => shiftData?.find((sh) => sh.code === code)?.name ?? code,
    [shiftData],
  )

  const recapColumns = useMemo<ColumnDef<TeacherRecapRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Guru',
        accessorFn: (r) => r.teacherName,
        cell: ({ row: { original: r } }) => (
          <div>
            <p className="font-medium">{r.teacherName}</p>
            <p className="text-xs text-muted-foreground">NIP {r.teacherNip}</p>
          </div>
        ),
      },
      ...TEACHER_ATTENDANCE_STATUSES.map(
        (s): ColumnDef<TeacherRecapRow, unknown> => ({
          id: s,
          header: TEACHER_ATTENDANCE_META[s].label,
          accessorFn: (r) => r.counts[s],
          meta: { className: 'text-center tabular-nums', headerClassName: 'text-center' },
          cell: ({ getValue }) => {
            const n = getValue() as number
            return <span className={cn(n === 0 && 'text-muted-foreground/60')}>{n}</span>
          },
        }),
      ),
      {
        id: 'late',
        header: 'Menit terlambat',
        accessorFn: (r) => r.counts.lateMinutes,
        meta: { className: 'text-center tabular-nums', headerClassName: 'text-center' },
      },
      {
        id: 'affected',
        header: 'Jam terdampak',
        accessorFn: (r) => r.counts.affectedPeriods,
        meta: { className: 'text-center font-semibold tabular-nums', headerClassName: 'text-center' },
      },
    ],
    [],
  )

  const detailColumns = useMemo<ColumnDef<TeacherAttendance, unknown>[]>(
    () => [
      { id: 'date', header: 'Tanggal', accessorFn: (r) => r.date, cell: ({ row }) => formatDate(row.original.date) },
      { id: 'teacher', header: 'Guru', accessorFn: (r) => r.teacherName },
      { id: 'shift', header: 'Shift', accessorFn: (r) => r.shiftCode, cell: ({ row }) => shiftName(row.original.shiftCode) },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.status,
        cell: ({ row }) => <StatusBadge meta={TEACHER_ATTENDANCE_META} value={row.original.status} />,
      },
      {
        id: 'times',
        header: 'Datang / Pulang',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatTime(row.original.checkInAt)} / {formatTime(row.original.checkOutAt)}
          </span>
        ),
      },
      { id: 'reason', header: 'Alasan', enableSorting: false, cell: ({ row }) => row.original.reason ?? '—' },
      {
        id: 'affected',
        header: 'Jam terdampak',
        accessorFn: (r) => r.affectedPeriods,
        cell: ({ row }) =>
          row.original.affectedPeriodsComputed || row.original.affectedPeriodsOverride !== null
            ? formatAffected(row.original)
            : '—',
      },
    ],
    [shiftName],
  )

  const s = q.data?.summary
  const absentTotal = s ? ABSENT_KEYS.reduce((n, k) => n + s[k], 0) : 0
  const periodLabel = `${values.rFrom}_${values.rTo}`
  const teacherName = teachers.data?.find((t) => t.id === values.rTeacher)?.name
  const absentRecords = (q.data?.records ?? []).filter((r) => ABSENT_KEYS.includes(r.status))
  const quickRanges = [
    { value: '7d', label: '7 hari', from: addDays(today, -6) },
    { value: 'month', label: 'Bulan ini', from: startOfMonth(today) },
    { value: '30d', label: '30 hari', from: addDays(today, -29) },
  ] as const
  // Segmen aktif hanya bila filter tanggal persis sama dengan salah satu rentang cepat.
  const activeRange =
    !values.rSemester && values.rTo === today
      ? (quickRanges.find((r) => r.from === values.rFrom)?.value ?? '')
      : ''

  return (
    <div className="flex flex-col gap-4">
      <FilterBar onReset={isDirty ? reset : undefined}>
        <FilterSelect
          label="Guru"
          value={values.rTeacher}
          onChange={(v) => set({ rTeacher: v })}
          allLabel="Semua guru"
          options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterDate label="Dari tanggal" value={values.rFrom} max={values.rTo} onChange={(v) => set({ rFrom: v })} />
        <FilterDate label="Sampai tanggal" value={values.rTo} min={values.rFrom} max={today} onChange={(v) => set({ rTo: v })} />
        <FilterSelect
          label="Status"
          value={values.rStatus}
          onChange={(v) => set({ rStatus: v })}
          allLabel="Semua status"
          options={enumOptions(TEACHER_ATTENDANCE_META)}
        />
        <FilterSelect
          label="Shift"
          value={values.rShift}
          onChange={(v) => set({ rShift: v })}
          allLabel="Semua shift"
          options={(shifts.data ?? []).map((sh) => ({ value: sh.code, label: sh.name }))}
        />
        <FilterSelect
          label="Periode akademik"
          value={values.rSemester}
          onChange={(v) => set({ rSemester: v })}
          allLabel="Sesuai tanggal"
          options={(year?.semesters ?? []).map((sm) => ({ value: sm.id, label: `${year?.name ?? ''} · ${sm.name}` }))}
        />
      </FilterBar>

      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        {/* Bukan SegmentedControl: rentang bebas = tidak ada segmen aktif, dan radiogroup tanpa pilihan aktif
            tidak bisa dijangkau Tab (roving tabindex). Tombol aksi bergaya segmen tetap selalu fokusabel. */}
        <div
          role="group"
          aria-label="Rentang cepat"
          className="no-scrollbar inline-flex h-8 max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/80 bg-muted/50 p-0.5"
        >
          {quickRanges.map((r) => {
            const active = activeRange === r.value
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={active}
                onClick={() => set({ rFrom: r.from, rTo: today, rSemester: '' })}
                className={cn(
                  'inline-flex h-full shrink-0 items-center rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r.label}
              </button>
            )
          })}
        </div>
        <ExportMenu
          report="teacher-attendance"
          period={periodLabel}
          filters={{
            teacherId: values.rTeacher || undefined,
            dateFrom: q.data?.dateFrom ?? values.rFrom,
            dateTo: q.data?.dateTo ?? values.rTo,
            status: values.rStatus || undefined,
            shiftCode: values.rShift || undefined,
            semesterId: values.rSemester || undefined,
          }}
          onPrint={() => window.print()}
        />
      </div>

      {invalidRange ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Rentang tanggal tidak valid</AlertTitle>
          <AlertDescription>Tanggal akhir tidak boleh sebelum tanggal awal. Perbaiki filter tanggal.</AlertDescription>
        </Alert>
      ) : q.isPending ? (
        <TableSkeleton rows={6} cols={8} />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Hadir"
              value={s?.PRESENT ?? 0}
              icon={<UserCheck />}
              tone="success"
              hint={`dari ${s?.total ?? 0} catatan`}
            />
            <StatCard
              label="Terlambat"
              value={s?.LATE ?? 0}
              icon={<Clock3 />}
              tone="warning"
              hint={`${s?.lateMinutes ?? 0} menit total`}
            />
            <StatCard
              label="Tidak hadir"
              value={absentTotal}
              icon={<UserX />}
              tone="danger"
              hint={`S ${s?.SICK ?? 0} · I ${s?.PERMISSION ?? 0} · A ${s?.ABSENT ?? 0} · DL ${s?.OFFICIAL_DUTY ?? 0}`}
            />
            <StatCard label="Jam terdampak" value={s?.affectedPeriods ?? 0} icon={<Hourglass />} hint="jam pelajaran" />
          </div>

          <div className="no-print">
            <DataTable
              title={`Rekap per guru · ${formatDate(q.data.dateFrom)} – ${formatDate(q.data.dateTo)}`}
              icon={<Table2 />}
              columns={recapColumns}
              data={q.data.byTeacher}
              getRowId={(r) => r.teacherId}
              caption="Rekap kehadiran per guru"
              initialSorting={[{ id: 'name', desc: false }]}
              emptyState={
                <EmptyState
                  icon={<BarChart3 className="size-5" />}
                  title="Tidak ada data pada filter ini"
                  description="Ubah rentang tanggal, guru, status, atau shift untuk melihat rekap."
                  className="border-0 bg-transparent py-8"
                />
              }
              renderMobileCard={(r) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{r.teacherName}</p>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.counts.total} hari</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                    {TEACHER_ATTENDANCE_STATUSES.map((st) => (
                      <div key={st} className="rounded-md border border-border/70 px-1 py-1">
                        <p className="text-muted-foreground">{TEACHER_ATTENDANCE_META[st].label}</p>
                        <p className="font-semibold tabular-nums">{r.counts[st]}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Jam terdampak {r.counts.affectedPeriods} · terlambat {r.counts.lateMinutes} menit
                  </p>
                </div>
              )}
            />
          </div>

          {absentRecords.length > 0 && (
            <div className="no-print">
              <DataTable
                title="Rincian guru tidak hadir"
                icon={<CalendarX2 />}
                columns={detailColumns}
                data={absentRecords}
                getRowId={(r) => r.id}
                caption="Rincian guru tidak hadir"
                pageSize={10}
              />
            </div>
          )}

          <div className="print-only">
            <PrintDocument
              title="Rekap Kehadiran Guru"
              meta={[
                ['Periode', `${formatDate(q.data.dateFrom)} s.d. ${formatDate(q.data.dateTo)}`],
                ['Guru', teacherName ?? 'Semua guru'],
                ['Shift', values.rShift ? shiftName(values.rShift) : 'Semua shift'],
                ['Status', values.rStatus ? TEACHER_ATTENDANCE_META[values.rStatus as TeacherAttendanceStatus].label : 'Semua status'],
              ]}
              signatures={[{ role: 'Kepala Sekolah' }]}
            >
              <PrintTable>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Guru</th>
                    {TEACHER_ATTENDANCE_STATUSES.map((st) => (
                      <th key={st}>{TEACHER_ATTENDANCE_META[st].short}</th>
                    ))}
                    <th>Jam terdampak</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.byTeacher.map((r, i) => (
                    <tr key={r.teacherId}>
                      <td className="text-center">{i + 1}</td>
                      <td>{r.teacherName}</td>
                      {TEACHER_ATTENDANCE_STATUSES.map((st) => (
                        <td key={st} className="text-center">
                          {r.counts[st]}
                        </td>
                      ))}
                      <td className="text-center">{r.counts.affectedPeriods}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td colSpan={2}>Jumlah</td>
                    {TEACHER_ATTENDANCE_STATUSES.map((st) => (
                      <td key={st} className="text-center">
                        {q.data.summary[st]}
                      </td>
                    ))}
                    <td className="text-center">{q.data.summary.affectedPeriods}</td>
                  </tr>
                </tbody>
              </PrintTable>
              <p className="text-[11px]">
                Keterangan: H = Hadir, S = Sakit, I = Izin, A = Alpa, T = Terlambat, DL = Dinas Luar.
              </p>
            </PrintDocument>
          </div>
        </>
      )}
    </div>
  )
}
