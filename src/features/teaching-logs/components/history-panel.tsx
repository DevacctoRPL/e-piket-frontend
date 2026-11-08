import { BadgeCheck, NotebookTabs } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useShifts, useSubjects, useTeachers } from '@/features/master-data/lookups'
import { addDays, formatDate, formatDateShort, todayISO } from '@/lib/date'
import { RECORD_STATUS_META, TEACHING_EXECUTION_META, enumOptions } from '@/lib/enums'
import type { RecordStatus, TeachingLog } from '@/types/entities'
import { periodRange } from '../meta'
import { useTeachingLogs } from '../queries'
import type { TeachingLogListParams } from '../types'

const STATUS_OPTIONS = enumOptions(RECORD_STATUS_META, ['DRAFT', 'FINAL'] as RecordStatus[])

/** FR-TEACH-05: histori jurnal dengan filter tanggal, guru, kelas, mapel, shift. */
export function HistoryPanel() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const readAll = can(['teaching_log:read_all', 'teaching_log:correct'])
  const today = todayISO()
  const filters = useFilters({
    dateFrom: addDays(today, -13),
    dateTo: today,
    classId: '',
    subjectId: '',
    shiftCode: '',
    teacherId: '',
    status: '',
    page: '1',
  })
  const v = filters.values

  const classes = useClasses(readAll ? {} : { scope: 'mine' })
  const subjects = useSubjects()
  const shifts = useShifts()
  const teachers = useTeachers()

  const params: TeachingLogListParams = {
    dateFrom: v.dateFrom || undefined,
    dateTo: v.dateTo || undefined,
    classId: v.classId || undefined,
    subjectId: v.subjectId || undefined,
    shiftCode: v.shiftCode || undefined,
    teacherId: readAll ? v.teacherId || undefined : undefined,
    status: (v.status || undefined) as RecordStatus | undefined,
    page: Number(v.page) || 1,
    pageSize: 20,
  }
  const query = useTeachingLogs(params)

  const columns = useMemo<ColumnDef<TeachingLog, unknown>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Tanggal',
        cell: ({ row }) => <span className="whitespace-nowrap">{formatDateShort(row.original.date)}</span>,
      },
      {
        id: 'period',
        header: 'Jam ke',
        cell: ({ row }) => (
          <span className="tabular-nums">{periodRange(row.original.periodStart, row.original.periodEnd)}</span>
        ),
        meta: { className: 'whitespace-nowrap' },
      },
      { accessorKey: 'className', header: 'Kelas', meta: { className: 'whitespace-nowrap font-medium' } },
      { accessorKey: 'subjectName', header: 'Mapel' },
      ...(readAll
        ? [{ accessorKey: 'teacherName', header: 'Guru' } satisfies ColumnDef<TeachingLog, unknown>]
        : []),
      {
        accessorKey: 'topic',
        header: 'Materi',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.execution === 'NOT_HELD' ? (
            <div className="space-y-1">
              <StatusBadge meta={TEACHING_EXECUTION_META} value="NOT_HELD" />
              <p className="line-clamp-2 text-xs text-muted-foreground">{row.original.notHeldReason}</p>
            </div>
          ) : (
            <span className="line-clamp-2 max-w-64">{row.original.topic ?? '—'}</span>
          ),
      },
      {
        accessorKey: 'activity',
        header: 'Kegiatan',
        enableSorting: false,
        cell: ({ row }) => <span className="line-clamp-2 max-w-56">{row.original.activity ?? '—'}</span>,
        meta: { hideOnMobile: true },
      },
      {
        accessorKey: 'periodCount',
        header: 'JML',
        cell: ({ row }) => (
          <span className="tabular-nums" title={row.original.periodCountOverrideReason ?? undefined}>
            {row.original.periodCount}
            {row.original.periodCountOverrideReason && <span className="text-tone-warning">*</span>}
          </span>
        ),
        meta: { className: 'text-center', headerClassName: 'text-center' },
      },
      {
        id: 'sia',
        header: 'S/I/A',
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {row.original.studentSick}/{row.original.studentPermission}/{row.original.studentAbsent}
          </span>
        ),
        meta: { className: 'text-center', headerClassName: 'text-center' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <StatusBadge meta={RECORD_STATUS_META} value={row.original.status} />
            {row.original.approvedAt && (
              <ToneBadge tone="success">
                <BadgeCheck className="size-3" aria-hidden /> Disahkan
              </ToneBadge>
            )}
          </div>
        ),
      },
    ],
    [readAll],
  )

  const exportFilters = { ...params, page: undefined, pageSize: undefined }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-semibold">Riwayat jurnal</h2>
          <p className="text-sm text-muted-foreground">
            {readAll ? 'Seluruh jurnal mengajar sesuai filter.' : 'Jurnal milik Anda dan kelas binaan Anda.'}
          </p>
        </div>
        <ExportMenu
          report="teaching-logs"
          filters={exportFilters}
          period={`${v.dateFrom || 'awal'}_${v.dateTo || today}`}
          onPrint={() => window.print()}
        />
      </div>

      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <FilterDate label="Dari tanggal" value={v.dateFrom} max={v.dateTo || today} onChange={(x) => filters.set({ dateFrom: x })} />
        <FilterDate label="Sampai tanggal" value={v.dateTo} min={v.dateFrom} max={today} onChange={(x) => filters.set({ dateTo: x })} />
        <FilterSelect
          label="Kelas"
          value={v.classId}
          allLabel="Semua kelas"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          onChange={(x) => filters.set({ classId: x })}
        />
        <FilterSelect
          label="Mata pelajaran"
          value={v.subjectId}
          allLabel="Semua mapel"
          options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          onChange={(x) => filters.set({ subjectId: x })}
        />
        <FilterSelect
          label="Shift"
          value={v.shiftCode}
          allLabel="Semua shift"
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
          onChange={(x) => filters.set({ shiftCode: x })}
        />
        {readAll && (
          <FilterSelect
            label="Guru"
            value={v.teacherId}
            allLabel="Semua guru"
            options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            onChange={(x) => filters.set({ teacherId: x })}
          />
        )}
        <FilterSelect
          label="Status"
          value={v.status}
          allLabel="Semua status"
          options={STATUS_OPTIONS}
          onChange={(x) => filters.set({ status: x })}
        />
      </FilterBar>

      {query.isPending ? (
        <TableSkeleton cols={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            caption="Riwayat jurnal mengajar"
            columns={columns}
            data={query.data.data}
            getRowId={(r) => r.id}
            onRowClick={(r) => navigate(`/jurnal-mengajar/${encodeURIComponent(r.id)}`)}
            serverPagination={{
              meta: query.data.meta,
              onPageChange: (page) => filters.set({ page: String(page) }),
            }}
            renderMobileCard={(r) => <HistoryCard log={r} showTeacher={readAll} />}
            emptyState={
              <EmptyState
                icon={<NotebookTabs className="size-5" />}
                title="Belum ada jurnal pada filter ini"
                description={
                  filters.isDirty
                    ? 'Coba perluas rentang tanggal atau hapus sebagian filter.'
                    : 'Jurnal yang Anda simpan dari jadwal hari ini akan muncul di sini.'
                }
              />
            }
          />
          <p className="mt-2 text-xs text-muted-foreground">
            JML bertanda <span className="text-tone-warning">*</span> telah dikoreksi dari jadwal (arahkan kursor untuk
            melihat alasan). Periode: {formatDate(v.dateFrom)} – {formatDate(v.dateTo)}.
          </p>
        </div>
      )}
    </div>
  )
}

function HistoryCard({ log, showTeacher }: { log: TeachingLog; showTeacher: boolean }) {
  return (
    <div className="grid cursor-pointer gap-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {log.className} · <span className="font-normal">{log.subjectName}</span>
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDateShort(log.date)} · Jam ke-{periodRange(log.periodStart, log.periodEnd)} · JML {log.periodCount}
          </p>
          {showTeacher && <p className="text-xs text-muted-foreground">{log.teacherName}</p>}
        </div>
        <StatusBadge meta={RECORD_STATUS_META} value={log.status} />
      </div>
      <p className="line-clamp-2">
        {log.execution === 'NOT_HELD' ? `Tidak terlaksana: ${log.notHeldReason ?? '—'}` : (log.topic ?? '—')}
      </p>
      <p className="text-xs text-muted-foreground tabular-nums">
        S {log.studentSick} · I {log.studentPermission} · A {log.studentAbsent}
        {log.approvedAt && ' · Disahkan'}
      </p>
    </div>
  )
}
