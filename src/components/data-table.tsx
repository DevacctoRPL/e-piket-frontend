import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CountChip, FramedCard } from '@/components/framed-card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PaginationMeta } from '@/types/api'
import { cn } from '@/lib/utils'

export type { ColumnDef } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string
    headerClassName?: string
    /** Sembunyikan kolom di tampilan kartu ponsel. */
    hideOnMobile?: boolean
  }
}

/**
 * Tabel adaptif (PRD §11.3): desktop = tabel penuh dengan sort & paginasi, ponsel = daftar kartu.
 *
 * - Paginasi klien (default) atau server (`serverPagination` + `meta` + `onPageChange`).
 * - `renderMobileCard` opsional; default menampilkan pasangan header: nilai.
 * - `title` (+ `icon`, `toolbar`) membungkus tabel dalam FramedCard bergaya "SLA Monitoring" referensi Nuvio:
 *   judul + jumlah data di kiri, pencarian/filter/kebab di kanan header.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  renderMobileCard,
  emptyState,
  pageSize = 20,
  serverPagination,
  onRowClick,
  rowClassName,
  caption,
  initialSorting = [],
  footer,
  title,
  icon,
  toolbar,
  showCount = true,
}: {
  /** Judul seksi → tabel dibungkus FramedCard. */
  title?: ReactNode
  icon?: ReactNode
  /** Kontrol di kanan header (SearchField, tombol Filter, kebab). */
  toolbar?: ReactNode
  /** Tampilkan jumlah data di samping judul (default true). */
  showCount?: boolean
  columns: ColumnDef<T, unknown>[] | ColumnDef<T, never>[]
  data: T[]
  getRowId?: (row: T, index: number) => string
  renderMobileCard?: (row: T) => ReactNode
  emptyState?: ReactNode
  pageSize?: number
  serverPagination?: { meta: PaginationMeta; onPageChange: (page: number) => void }
  onRowClick?: (row: T) => void
  rowClassName?: (row: T) => string | undefined
  caption?: string
  initialSorting?: SortingState
  footer?: ReactNode
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })

   
  const table = useReactTable({
    data,
    columns: columns as ColumnDef<T, unknown>[],
    getRowId,
    state: serverPagination ? { sorting } : { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(serverPagination ? { manualPagination: true } : { getPaginationRowModel: getPaginationRowModel() }),
  })

  const rows = table.getRowModel().rows
  const page = serverPagination ? serverPagination.meta.page : pagination.pageIndex + 1
  const totalPages = serverPagination ? serverPagination.meta.totalPages : table.getPageCount() || 1
  const totalItems = serverPagination ? serverPagination.meta.totalItems : data.length
  const goTo = (p: number) =>
    serverPagination ? serverPagination.onPageChange(p) : table.setPageIndex(p - 1)

  const framed = title !== undefined

  const body =
    data.length === 0 && emptyState ? (
      framed ? (
        <div className="-m-1">{emptyState}</div>
      ) : (
        emptyState
      )
    ) : (
    <div className="space-y-3">
      {/* Desktop */}
      <div
        className={cn(
          'hidden overflow-hidden md:block',
          framed ? '-mx-4 -mt-4 border-b border-border/60' : 'rounded-xl border border-border/85 bg-card shadow-2xs',
        )}
      >
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort() && header.column.columnDef.enableSorting !== false
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.headerClassName}
                      aria-sort={
                        sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : canSort ? 'none' : undefined
                      }
                    >
                      {header.isPlaceholder ? null : canSort && header.column.accessorFn ? (
                        <button
                          type="button"
                          className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ChevronUp aria-hidden className="size-3.5 text-foreground" />
                          ) : sorted === 'desc' ? (
                            <ChevronDown aria-hidden className="size-3.5 text-foreground" />
                          ) : (
                            <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row.original))}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {footer}
      </div>

      {/* Ponsel */}
      <ul className={cn('grid gap-2 md:hidden', framed && '-m-1')}>
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'rounded-lg border border-border/85 bg-card p-3 shadow-2xs',
              onRowClick && 'cursor-pointer active:bg-muted/40',
              rowClassName?.(row.original),
            )}
            onClick={onRowClick ? () => onRowClick(row.original) : undefined}
          >
            {renderMobileCard ? (
              renderMobileCard(row.original)
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                {row
                  .getVisibleCells()
                  .filter((c) => !c.column.columnDef.meta?.hideOnMobile)
                  .map((cell) => (
                    <div key={cell.id} className="contents">
                      <dt className="text-xs text-muted-foreground">
                        {typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : ''}
                      </dt>
                      <dd className="min-w-0 break-words">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </dd>
                    </div>
                  ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="no-print flex items-center justify-between gap-2 text-xs" aria-label="Paginasi">
          <p className="text-muted-foreground tabular-nums">
            Halaman {page} dari {totalPages} · {totalItems} data
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Halaman sebelumnya">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)} aria-label="Halaman berikutnya">
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </div>
    )

  if (!framed) return <>{body}</>
  return (
    <FramedCard
      title={title}
      icon={icon}
      titleBadge={showCount ? <CountChip>{totalItems}</CountChip> : undefined}
      headerRight={toolbar}
      bodyClassName="p-4"
    >
      {body}
    </FramedCard>
  )
}
