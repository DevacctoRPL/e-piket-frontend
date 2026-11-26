import { Pencil, Plus, RefreshCw, Trash2, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { DatePickerPill } from '@/components/date-picker-pill'
import { useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/date'
import { ABSENTEE_STATUS_LIST, ATTENDANCE_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { useClasses } from '@/lib/lookups'
import { cn } from '@/lib/utils'
import type { AbsenteeRow, AbsenteeStatus } from '@/types/entities'
import { AbsenteeFormDialog } from '../components/absentee-form-dialog'
import { StatusChips } from '../components/status-chips'
import { useAbsentees, useAbsenteeSummary, useDeleteAbsentee } from '../queries'

const PAGE_SIZE = 10
const SELECT_CLS =
  'native-select h-9 cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Panel Absensi Siswa — Judul halaman: "Siswa Tidak Hadir" (Excalidraw Layar 3 + Papan Tulis 2).
 * Status ketidakhadiran: Sakit (S), Izin (I), Alpa (A), Dispensasi (D), PKL (P).
 * Aksi: + Catat Ketidakhadiran, Edit (termasuk ubah ke Hadir), Hapus (kembalikan ke Hadir).
 */
export function AbsenteesPage() {
  const today = todayISO()
  const { values, set } = useFilters({
    date: today,
    classId: '',
    status: '',
    page: '1',
  })
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRow, setEditRow] = useState<AbsenteeRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<AbsenteeRow | null>(null)

  const page = Number(values.page) || 1
  const statusFilter = (values.status || '') as AbsenteeStatus | ''
  const classes = useClasses()
  const listQuery = useAbsentees({
    date: values.date,
    classId: values.classId || undefined,
    status: statusFilter || undefined,
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const summaryQuery = useAbsenteeSummary({
    date: values.date,
    classId: values.classId || undefined,
    search: search.trim() || undefined,
  })
  const removeMut = useDeleteAbsentee()

  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta
  const summary = summaryQuery.data

  const openCreate = () => {
    setEditRow(null)
    setDialogOpen(true)
  }

  const openEdit = (row: AbsenteeRow) => {
    setEditRow(row)
    setDialogOpen(true)
  }

  const handleSync = async () => {
    const [r1, r2] = await Promise.all([listQuery.refetch(), summaryQuery.refetch()])
    if (r1.isSuccess && r2.isSuccess) toast.success('Data siswa tidak hadir disinkronkan.')
  }

  const confirmDelete = async () => {
    if (!deleteRow) return
    try {
      await removeMut.mutateAsync(deleteRow.recordId)
      toast.success(`${deleteRow.studentName} dikembalikan menjadi Hadir.`)
      setDeleteRow(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const columns = useMemo<ColumnDef<AbsenteeRow, unknown>[]>(
    () => [
      {
        id: 'no',
        header: 'No',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {(page - 1) * PAGE_SIZE + row.index + 1}
          </span>
        ),
      },
      {
        id: 'studentName',
        header: 'Nama Siswa',
        accessorKey: 'studentName',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.studentName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{row.original.studentNis}</p>
          </div>
        ),
      },
      {
        id: 'className',
        header: 'Kelas',
        accessorKey: 'className',
        cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.className}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <StatusBadge meta={ATTENDANCE_META} value={row.original.status} />,
      },
      {
        id: 'reason',
        header: 'Keterangan',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-72 text-muted-foreground">
            {row.original.reason || row.original.note || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        enableSorting: false,
        meta: { headerClassName: 'text-right', className: 'text-right whitespace-nowrap' },
        cell: ({ row }) => (
          <div className="inline-flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row.original)}
              aria-label={`Edit ${row.original.studentName}`}
            >
              <Pencil className="size-3.5" aria-hidden /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteRow(row.original)}
              aria-label={`Hapus ${row.original.studentName}`}
            >
              <Trash2 className="size-3.5" aria-hidden /> Hapus
            </Button>
          </div>
        ),
      },
    ],
    [page],
  )

  return (
    <Page className="gap-5">
      <PageHeader
        title="Siswa Tidak Hadir"
        description="Daftar siswa tidak hadir dari Presensi Siswa. Catat ketidakhadiran, ubah status (S/I/A/D/P/H), atau kembalikan ke Hadir."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DatePickerPill
              id="absentees-date"
              date={values.date}
              maxDate={today}
              onChange={(next) => set({ date: next, page: '1' })}
            />
            <Button
              variant="outline"
              onClick={() => void handleSync()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} aria-hidden />
              Sinkron Presensi
            </Button>
          </div>
        }
      />

      <StatusChips
        selected={statusFilter}
        counts={summary?.byStatus}
        total={summary?.total}
        onSelect={(next) => set({ status: next, page: '1' })}
      />

      {/* Toolbar Excalidraw Layar 3 */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-border/85 bg-card p-3 shadow-2xs sm:flex-row sm:items-center">
        <SearchField
          value={search}
          onValueChange={(v) => {
            setSearch(v)
            if (page !== 1) set({ page: '1' })
          }}
          placeholder="Cari nama siswa atau kelas..."
          aria-label="Cari nama siswa atau kelas"
          className="flex-1"
        />
        <select
          aria-label="Filter kelas"
          value={values.classId}
          onChange={(e) => set({ classId: e.target.value, page: '1' })}
          className={SELECT_CLS}
        >
          <option value="">Kelas: Semua</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status ketidakhadiran"
          value={statusFilter}
          onChange={(e) => set({ status: e.target.value, page: '1' })}
          className={SELECT_CLS}
        >
          <option value="">Status: Semua</option>
          {ABSENTEE_STATUS_LIST.map((code) => (
            <option key={code} value={code}>
              {ATTENDANCE_META[code].label} ({ATTENDANCE_META[code].short})
            </option>
          ))}
        </select>
        <Button onClick={openCreate} className="shrink-0">
          <Plus aria-hidden /> Catat Ketidakhadiran
        </Button>
      </div>

      {listQuery.isPending ? (
        <TableSkeleton rows={7} cols={6} />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : (
        <div className={cn('transition-opacity', listQuery.isPlaceholderData && 'opacity-60')}>
          <DataTable
            title="Daftar Siswa Tidak Hadir"
            icon={<UserX />}
            caption="Daftar siswa tidak hadir"
            columns={columns}
            data={rows}
            getRowId={(r) => r.recordId}
            serverPagination={
              meta ? { meta, onPageChange: (p) => set({ page: String(p) }) } : undefined
            }
            renderMobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{row.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.className} · NIS {row.studentNis}
                    </p>
                  </div>
                  <StatusBadge meta={ATTENDANCE_META} value={row.status} />
                </div>
                <p className="text-xs text-muted-foreground">{row.reason || row.note || 'Tanpa keterangan'}</p>
                <div className="flex justify-end gap-1 border-t border-border/60 pt-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteRow(row)}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            )}
            emptyState={
              <EmptyState
                className="border-0 bg-transparent"
                icon={<UserX className="size-5" />}
                title="Tidak ada siswa tidak hadir"
                description="Belum ada siswa berstatus Sakit, Izin, Alpa, Dispensasi, atau PKL pada filter ini."
                action={
                  <Button size="sm" onClick={openCreate}>
                    <Plus /> Catat Ketidakhadiran
                  </Button>
                }
              />
            }
          />
        </div>
      )}

      <AbsenteeFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditRow(null)
        }}
        date={values.date}
        row={editRow}
      />

      <ConfirmDialog
        open={deleteRow !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null)
        }}
        title="Kembalikan status ke Hadir?"
        description={
          deleteRow
            ? `${deleteRow.studentName} (${deleteRow.className}) akan dihapus dari daftar Siswa Tidak Hadir dan statusnya dikembalikan menjadi Hadir.`
            : ''
        }
        confirmLabel="Hapus & Tandai Hadir"
        destructive
        pending={removeMut.isPending}
        onConfirm={confirmDelete}
      />
    </Page>
  )
}
