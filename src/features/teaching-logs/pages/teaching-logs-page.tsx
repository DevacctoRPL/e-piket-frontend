import { NotebookPen, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { DatePickerPill } from '@/components/date-picker-pill'
import { useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { SignatureCell } from '@/components/signature-cell'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/date'
import { useClasses } from '@/lib/lookups'
import { cn } from '@/lib/utils'
import type { TeachingLog } from '@/types/entities'
import { useAgendaGuruList } from '../queries'

const PAGE_SIZE = 10
const SELECT_CLS =
  'native-select h-9 cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Panel Agenda Guru:
 * Data kegiatan mengajar read-only dari Presensi Guru beserta TTD guru.
 * Kolom: No | Nama Guru | Kelas | Mata Pelajaran | Jam Ke- | Materi / Catatan | TTD.
 */
export function TeachingLogsPage() {
  const today = todayISO()
  const { values, set } = useFilters({
    date: today,
    classId: '',
    page: '1',
  })
  const [search, setSearch] = useState('')

  const page = Number(values.page) || 1
  const classes = useClasses()
  const listQuery = useAgendaGuruList({
    date: values.date,
    classId: values.classId || undefined,
    search: search.trim() || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data])
  const meta = listQuery.data?.meta

  const handleSync = async () => {
    const res = await listQuery.refetch()
    if (res.isSuccess) toast.success('Data agenda guru berhasil disinkronkan.')
  }

  const columns = useMemo<ColumnDef<TeachingLog, unknown>[]>(
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
        id: 'teacherName',
        header: 'Nama Guru',
        accessorKey: 'teacherName',
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.teacherName}</span>,
      },
      {
        id: 'className',
        header: 'Kelas',
        accessorKey: 'className',
        cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.className}</span>,
      },
      {
        id: 'subjectName',
        header: 'Mata Pelajaran',
        accessorKey: 'subjectName',
      },
      {
        id: 'periods',
        header: 'Jam Ke-',
        accessorKey: 'periodStart',
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.periodStart} - {row.original.periodEnd}
          </span>
        ),
      },
      {
        id: 'topic',
        header: 'Materi / Catatan',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-64 text-muted-foreground">
            {row.original.topic ?? row.original.note ?? '—'}
          </span>
        ),
      },
      {
        id: 'signature',
        header: 'TTD',
        enableSorting: false,
        cell: ({ row }) => (
          <SignatureCell
            signatureUrl={row.original.signatureUrl}
            signedAt={row.original.signedAt}
            signerName={row.original.teacherName}
            contextLabel={`${row.original.className} · ${row.original.subjectName}`}
          />
        ),
      },
    ],
    [page],
  )

  return (
    <Page className="gap-5">
      <PageHeader
        title="Agenda Guru"
        description="Kegiatan mengajar harian tersinkron otomatis dari Presensi Guru (hanya baca)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DatePickerPill
              id="agenda-guru-date"
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

      <div className="flex flex-col gap-2 rounded-xl border border-border/85 bg-card p-3 shadow-2xs sm:flex-row sm:items-center">
        <SearchField
          value={search}
          onValueChange={(v) => {
            setSearch(v)
            if (page !== 1) set({ page: '1' })
          }}
          placeholder="Cari guru, kelas, mapel..."
          aria-label="Cari kegiatan mengajar"
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
      </div>

      {listQuery.isPending ? (
        <TableSkeleton rows={7} cols={7} />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : (
        <div className={cn('transition-opacity', listQuery.isPlaceholderData && 'opacity-60')}>
          <DataTable
            title="Kegiatan Mengajar"
            icon={<NotebookPen />}
            caption="Daftar agenda kegiatan mengajar guru"
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            serverPagination={
              meta ? { meta, onPageChange: (p) => set({ page: String(p) }) } : undefined
            }
            renderMobileCard={(item) => (
              <div className="space-y-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.teacherName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.className} · {item.subjectName} · Jam {item.periodStart}–{item.periodEnd}
                  </p>
                </div>
                {item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <span className="text-muted-foreground">TTD</span>
                  <SignatureCell
                    signatureUrl={item.signatureUrl}
                    signedAt={item.signedAt}
                    signerName={item.teacherName}
                    contextLabel={`${item.className} · ${item.subjectName}`}
                  />
                </div>
              </div>
            )}
            emptyState={
              <EmptyState
                className="border-0 bg-transparent"
                icon={<NotebookPen className="size-5" />}
                title="Tidak ada kegiatan mengajar"
                description="Belum ada data agenda mengajar guru pada tanggal atau filter terpilih."
              />
            }
          />
        </div>
      )}
    </Page>
  )
}
