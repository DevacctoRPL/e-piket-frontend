import { BookOpenCheck, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { DatePickerPill } from '@/components/date-picker-pill'
import { useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { SignatureCell } from '@/components/signature-cell'
import { MetaTag } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { todayISO } from '@/lib/date'
import { useClasses } from '@/lib/lookups'
import { cn } from '@/lib/utils'
import type { ExtraActivity } from '@/types/entities'
import { useExtraActivities } from '../queries'

const PAGE_SIZE = 10
const SELECT_CLS =
  'native-select h-9 cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * Panel Jam Tambahan:
 * Data jam tambahan read-only dari Presensi Guru dengan dukungan multi-kelas & TTD.
 * Kolom: No | Nama Guru / Kegiatan | Kelas | Materi | TTD.
 */
export function ExtraActivitiesPage() {
  const today = todayISO()
  const { values, set } = useFilters({
    date: today,
    classId: '',
    page: '1',
  })
  const [search, setSearch] = useState('')

  const page = Number(values.page) || 1
  const classes = useClasses()
  const listQuery = useExtraActivities({
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
    if (res.isSuccess) toast.success('Data jam tambahan berhasil disinkronkan.')
  }

  const columns = useMemo<ColumnDef<ExtraActivity, unknown>[]>(
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
        id: 'instructorAndActivity',
        header: 'Nama Guru / Kegiatan',
        accessorKey: 'instructorName',
        cell: ({ row }) => (
          <p className="text-foreground">
            <span className="font-medium">{row.original.instructorName}</span>
            <span className="mx-1.5 text-muted-foreground" aria-hidden="true">
              /
            </span>
            <span className="text-muted-foreground">{row.original.name}</span>
          </p>
        ),
      },
      {
        id: 'classes',
        header: 'Kelas',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.classNames.map((name) => (
              <MetaTag key={name}>{name}</MetaTag>
            ))}
          </div>
        ),
      },
      {
        id: 'topic',
        header: 'Materi',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-72 text-muted-foreground">
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
            signerName={row.original.instructorName}
            contextLabel={`${row.original.name} (${row.original.classNames.join(', ')})`}
          />
        ),
      },
    ],
    [page],
  )

  return (
    <Page className="gap-5">
      <PageHeader
        title="Jam Tambahan"
        description="Agenda jam tambahan tersinkron otomatis dari Presensi Guru (hanya baca)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DatePickerPill
              id="jam-tambahan-date"
              date={values.date}
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
          placeholder="Cari guru, kegiatan, kelas, atau materi..."
          aria-label="Cari jam tambahan"
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
        <TableSkeleton rows={6} cols={5} />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : (
        <div className={cn('transition-opacity', listQuery.isPlaceholderData && 'opacity-60')}>
          <DataTable
            title="Daftar Jam Tambahan"
            icon={<BookOpenCheck />}
            caption="Daftar jam tambahan guru"
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            serverPagination={
              meta ? { meta, onPageChange: (p) => set({ page: String(p) }) } : undefined
            }
            renderMobileCard={(item) => (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{item.instructorName}</span>
                  <span className="mx-1.5 text-muted-foreground" aria-hidden="true">
                    /
                  </span>
                  <span className="text-muted-foreground">{item.name}</span>
                </p>
                <div className="flex flex-wrap gap-1">
                  {item.classNames.map((n) => (
                    <MetaTag key={n}>{n}</MetaTag>
                  ))}
                </div>
                {item.topic && <p className="text-xs text-muted-foreground">{item.topic}</p>}
                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs">
                  <span className="text-muted-foreground">TTD</span>
                  <SignatureCell
                    signatureUrl={item.signatureUrl}
                    signedAt={item.signedAt}
                    signerName={item.instructorName}
                    contextLabel={`${item.name} (${item.classNames.join(', ')})`}
                  />
                </div>
              </div>
            )}
            emptyState={
              <EmptyState
                className="border-0 bg-transparent"
                icon={<BookOpenCheck className="size-5" />}
                title="Tidak ada jam tambahan"
                description="Belum ada agenda jam tambahan dari Presensi Guru pada tanggal atau filter terpilih."
              />
            }
          />
        </div>
      )}
    </Page>
  )
}
