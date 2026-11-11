import { History, NotebookPen, ShieldAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { useClasses, useLookupMaps, useTeachers } from '@/features/master-data/lookups'
import { addDays, formatDate, formatDateShort, todayISO } from '@/lib/date'
import type { SubstitutionRecord } from '@/types/entities'
import { useSubstitutionRecords } from '../queries'
import { periodLabel, RECORD_META } from '../utils'

const PAGE_SIZE = 20

/** Tab "Riwayat": histori penugasan guru pengganti dengan filter + ekspor (FR-SUB-04, FR-RPT-03). */
export function HistoryTab() {
  const today = todayISO()
  const defaults = useMemo(
    () => ({ hFrom: addDays(today, -13), hTo: today, hClass: '', hTeacher: '', hStatus: '', page: '1' }),
    [today],
  )
  const { values, set, reset, isDirty } = useFilters(defaults)
  const classes = useClasses()
  const teachers = useTeachers()
  const { classById, subjectById, teacherById, shiftName } = useLookupMaps()
  const page = Math.max(1, Number(values.page) || 1)
  const invalidRange = values.hFrom > values.hTo

  const params = {
    dateFrom: values.hFrom,
    dateTo: values.hTo,
    classId: values.hClass || undefined,
    teacherId: values.hTeacher || undefined,
    status: (values.hStatus || undefined) as SubstitutionRecord['status'] | undefined,
    page,
    pageSize: PAGE_SIZE,
  }
  const q = useSubstitutionRecords(params)

  const columns = useMemo<ColumnDef<SubstitutionRecord, unknown>[]>(
    () => [
      {
        header: 'Tanggal',
        accessorKey: 'date',
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.date)}</span>,
      },
      {
        header: 'Kelas',
        id: 'class',
        accessorFn: (r) => classById.get(r.classId)?.name ?? '—',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{classById.get(row.original.classId)?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Shift {shiftName(row.original.shiftCode)}</p>
          </div>
        ),
      },
      {
        header: 'Jam',
        id: 'periods',
        accessorFn: (r) => r.periodStart,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {periodLabel(row.original.periodStart, row.original.periodEnd)}
          </span>
        ),
      },
      {
        header: 'Mapel',
        id: 'subject',
        accessorFn: (r) => subjectById.get(r.subjectId)?.name ?? '—',
      },
      {
        header: 'Guru berhalangan',
        id: 'absent',
        accessorFn: (r) => teacherById.get(r.absentTeacherId)?.name ?? '—',
      },
      {
        header: 'Guru pengganti',
        accessorKey: 'substituteTeacherName',
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{row.original.substituteTeacherName}</span>
            {row.original.conflictOverridden && (
              <ToneBadge tone="warning" icon={ShieldAlert}>
                Override
              </ToneBadge>
            )}
          </div>
        ),
      },
      {
        header: 'Jumlah jam',
        accessorKey: 'periodCount',
        meta: { className: 'text-right tabular-nums', headerClassName: 'text-right' },
      },
      {
        header: 'Kegiatan',
        accessorKey: 'activity',
        enableSorting: false,
        meta: { hideOnMobile: true, className: 'max-w-64 whitespace-normal' },
        cell: ({ row }) => row.original.activity ?? <span className="text-muted-foreground">—</span>,
      },
      {
        header: 'Jurnal',
        id: 'journal',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => <JournalLink record={row.original} />,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge meta={RECORD_META} value={row.original.status} />,
      },
    ],
    [classById, subjectById, teacherById, shiftName],
  )

  const exportFilters = {
    dateFrom: values.hFrom,
    dateTo: values.hTo,
    classId: values.hClass || undefined,
    teacherId: values.hTeacher || undefined,
  }

  const exportMenu = (
    <ExportMenu report="substitutions" filters={exportFilters} period={`${values.hFrom}_${values.hTo}`} />
  )

  return (
    <div className="space-y-3">
      <FilterBar onReset={isDirty ? reset : undefined}>
        <FilterDate label="Dari tanggal" value={values.hFrom} max={values.hTo} onChange={(v) => set({ hFrom: v })} />
        <FilterDate label="Sampai tanggal" value={values.hTo} min={values.hFrom} max={today} onChange={(v) => set({ hTo: v })} />
        <FilterSelect
          label="Kelas"
          value={values.hClass}
          onChange={(v) => set({ hClass: v })}
          allLabel="Semua kelas"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Guru"
          value={values.hTeacher}
          onChange={(v) => set({ hTeacher: v })}
          allLabel="Semua guru"
          options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          label="Status"
          value={values.hStatus}
          onChange={(v) => set({ hStatus: v })}
          allLabel="Semua status"
          options={[
            { value: 'ACTIVE', label: RECORD_META.ACTIVE.label },
            { value: 'CANCELLED', label: RECORD_META.CANCELLED.label },
          ]}
        />
      </FilterBar>

      {invalidRange ? (
        <EmptyState title="Rentang tanggal tidak valid" description="Tanggal awal harus sebelum atau sama dengan tanggal akhir." />
      ) : q.isPending ? (
        <TableSkeleton rows={6} cols={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={q.isFetching}>
          <DataTable
            title="Riwayat guru pengganti"
            icon={<History />}
            toolbar={exportMenu}
            caption="Riwayat guru pengganti"
            columns={columns}
            data={q.data.data}
            getRowId={(r) => r.id}
            serverPagination={{ meta: q.data.meta, onPageChange: (p) => set({ page: String(p) }) }}
            rowClassName={(r) => (r.status === 'CANCELLED' ? 'opacity-60' : undefined)}
            emptyState={
              <EmptyState
                icon={<History className="size-5" />}
                title="Belum ada riwayat guru pengganti"
                description="Tidak ada penugasan guru pengganti pada rentang dan filter ini. Ubah rentang tanggal atau reset filter."
              />
            }
            renderMobileCard={(r) => (
              <div className="grid gap-1.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {classById.get(r.classId)?.name ?? '—'}
                      <span className="font-normal text-muted-foreground"> · {subjectById.get(r.subjectId)?.name ?? '—'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatDateShort(r.date)} · {periodLabel(r.periodStart, r.periodEnd)} · {r.periodCount} jam
                    </p>
                  </div>
                  <StatusBadge meta={RECORD_META} value={r.status} />
                </div>
                <p>
                  <span className="text-muted-foreground">Pengganti: </span>
                  <span className="font-medium">{r.substituteTeacherName}</span>
                  {r.conflictOverridden && <span className="text-muted-foreground"> (override)</span>}
                </p>
                <p className="text-muted-foreground">
                  Menggantikan {teacherById.get(r.absentTeacherId)?.name ?? '—'}
                </p>
                {r.activity && <p className="break-words">{r.activity}</p>}
                <JournalLink record={r} />
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}

/** FR-SUB-03: jurnal mengajar yang diisi guru pengganti untuk penugasan ini. */
function JournalLink({ record }: { record: SubstitutionRecord }) {
  if (record.status === 'CANCELLED') return null
  if (!record.teachingLogId) {
    return <ToneBadge tone="warning">Jurnal belum diisi</ToneBadge>
  }
  return (
    <Link
      to={`/jurnal-mengajar/${encodeURIComponent(record.teachingLogId)}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:underline"
      onClick={(e) => e.stopPropagation()}
    >
      <NotebookPen className="size-3.5" aria-hidden /> Lihat jurnal
    </Link>
  )
}
