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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
}: {
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

  if (data.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="space-y-3">
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-xs md:block">
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
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      {header.isPlaceholder ? null : canSort && header.column.accessorFn ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
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
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn('rounded-xl border bg-card p-3 shadow-xs', rowClassName?.(row.original))}
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
        <nav className="no-print flex items-center justify-between gap-2 text-sm" aria-label="Paginasi">
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
}
