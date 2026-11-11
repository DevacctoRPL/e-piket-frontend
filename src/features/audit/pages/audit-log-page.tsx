import { History, SearchX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterDate, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/date'
import { AUDIT_ACTION_META, enumOptions } from '@/lib/enums'
import { AUDIT_ACTIONS, type AuditAction, type AuditLog } from '@/types/entities'
import { entityLabel } from '../audit-format'
import { AuditDetailSheet } from '../components/audit-detail-sheet'
import { useAuditFacets, useAuditLogs } from '../queries'
import type { AuditLogFilters } from '../types'

const FILTER_DEFAULTS = {
  entity: '',
  actorId: '',
  action: '',
  dateFrom: '',
  dateTo: '',
  page: '1',
}

const PAGE_SIZE = 20

function isAuditAction(v: string): v is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(v)
}

export function AuditLogPage() {
  const urlFilters = useFilters(FILTER_DEFAULTS)
  const { values } = urlFilters
  /**
   * Kata kunci TIDAK disimpan di URL: ringkasan audit dapat memuat nama siswa,
   * dan data pribadi siswa tidak boleh muncul di URL/riwayat browser (PRD §12.2).
   */
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AuditLog | null>(null)

  const params = useMemo<AuditLogFilters>(
    () => ({
      entity: values.entity || undefined,
      actorId: values.actorId || undefined,
      action: isAuditAction(values.action) ? values.action : undefined,
      dateFrom: values.dateFrom || undefined,
      dateTo: values.dateTo || undefined,
      search: search.trim() || undefined,
      page: Number(values.page) || 1,
      pageSize: PAGE_SIZE,
    }),
    [values.entity, values.actorId, values.action, values.dateFrom, values.dateTo, search, values.page],
  )

  const logs = useAuditLogs(params)
  const facets = useAuditFacets()

  const setFilter = urlFilters.set
  const onSearch = useCallback(
    (v: string) => {
      setSearch(v)
      setFilter({ page: '1' }) // kembali ke halaman 1 saat kata kunci berubah
    },
    [setFilter],
  )
  const isDirty = urlFilters.isDirty || search !== ''
  const resetAll = () => {
    setSearch('')
    urlFilters.reset()
  }
  const filters = { set: urlFilters.set, reset: resetAll, isDirty }

  const columns = useMemo<ColumnDef<AuditLog, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Waktu',
        accessorKey: 'timestamp',
        enableSorting: false,
        cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.timestamp)}</span>,
      },
      {
        id: 'actor',
        header: 'Pelaku',
        accessorKey: 'actorName',
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.actorName}</span>,
      },
      {
        id: 'action',
        header: 'Aksi',
        enableSorting: false,
        cell: ({ row }) => <StatusBadge meta={AUDIT_ACTION_META} value={row.original.action} />,
      },
      {
        id: 'entity',
        header: 'Entitas',
        enableSorting: false,
        cell: ({ row }) => entityLabel(row.original.entity),
      },
      {
        id: 'summary',
        header: 'Ringkasan',
        enableSorting: false,
        meta: { className: 'max-w-sm whitespace-normal' },
        cell: ({ row }) => <span className="line-clamp-2">{row.original.summary}</span>,
      },
      {
        id: 'reason',
        header: 'Alasan',
        enableSorting: false,
        meta: { className: 'max-w-xs whitespace-normal' },
        cell: ({ row }) =>
          row.original.reason ? (
            <span className="line-clamp-2">{row.original.reason}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  )

  const entityOptions = (facets.data?.entities ?? []).map((e) => ({ value: e, label: entityLabel(e) }))
  const actorOptions = (facets.data?.actors ?? []).map((a) => ({ value: a.id, label: a.name }))

  return (
    <Page>
      <PageHeader
        title="Audit Log"
        description="Riwayat perubahan, koreksi, finalisasi, dan penghapusan data: siapa, kapan, data apa, dan alasannya."
      />

      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <SearchInput
          label="Cari"
          placeholder="Ringkasan, pelaku, alasan…"
          value={search}
          onChange={onSearch}
          className="lg:min-w-56"
        />
        <FilterSelect
          label="Entitas"
          value={values.entity}
          onChange={(v) => filters.set({ entity: v })}
          options={entityOptions}
          allLabel="Semua entitas"
        />
        <FilterSelect
          label="Pelaku"
          value={values.actorId}
          onChange={(v) => filters.set({ actorId: v })}
          options={actorOptions}
          allLabel="Semua pelaku"
        />
        <FilterSelect
          label="Aksi"
          value={values.action}
          onChange={(v) => filters.set({ action: v })}
          options={enumOptions(AUDIT_ACTION_META)}
          allLabel="Semua aksi"
        />
        <FilterDate
          label="Dari tanggal"
          value={values.dateFrom}
          max={values.dateTo || undefined}
          onChange={(v) => filters.set({ dateFrom: v })}
        />
        <FilterDate
          label="Sampai tanggal"
          value={values.dateTo}
          min={values.dateFrom || undefined}
          onChange={(v) => filters.set({ dateTo: v })}
        />
      </FilterBar>

      {logs.isPending ? (
        <TableSkeleton rows={8} cols={6} />
      ) : logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
      ) : (
        <div className={logs.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={logs.isFetching}>
          <DataTable
            title="Riwayat audit"
            icon={<History />}
            caption="Daftar riwayat audit"
            columns={columns}
            data={logs.data.data}
            getRowId={(r) => r.id}
            onRowClick={setSelected}
            serverPagination={{
              meta: logs.data.meta,
              onPageChange: (p) => filters.set({ page: String(p) }),
            }}
            renderMobileCard={(r) => (
              <button
                type="button"
                className="flex w-full flex-col gap-1.5 text-left"
                aria-label={`Lihat detail: ${r.summary}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge meta={AUDIT_ACTION_META} value={r.action} />
                  <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(r.timestamp)}</span>
                </div>
                <p className="text-sm font-medium">{r.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {r.actorName} · {entityLabel(r.entity)}
                </p>
                {r.reason && <p className="text-xs break-words">Alasan: {r.reason}</p>}
              </button>
            )}
            emptyState={
              filters.isDirty ? (
                <EmptyState
                  icon={<SearchX className="size-5" />}
                  title="Tidak ada riwayat yang cocok"
                  description="Tidak ada entri audit untuk kombinasi filter ini. Coba perluas rentang tanggal atau hapus sebagian filter."
                  action={
                    <Button variant="outline" size="sm" onClick={filters.reset}>
                      Reset filter
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<History className="size-5" />}
                  title="Belum ada riwayat audit"
                  description="Riwayat akan tercatat otomatis saat data dikoreksi, difinalisasi, dihapus, atau pengaturan diubah."
                />
              )
            }
          />
        </div>
      )}

      <AuditDetailSheet
        id={selected?.id ?? null}
        initial={selected ?? undefined}
        onClose={() => setSelected(null)}
      />
    </Page>
  )
}
