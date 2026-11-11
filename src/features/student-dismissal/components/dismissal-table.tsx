import { Clock, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { formatDate, formatTime } from '@/lib/date'
import { DISMISSAL_META } from '@/lib/enums'
import type { PaginationMeta } from '@/types/api'
import type { StudentDismissal } from '@/types/entities'
import { DismissalRowActions, isAwaitingReturn } from './dismissal-actions'

function ReturnCell({ d }: { d: StudentDismissal }) {
  if (d.type !== 'TEMPORARY_EXIT') return <span className="text-muted-foreground">—</span>
  if (d.returnTime) return <span className="tabular-nums">{formatTime(d.returnTime)}</span>
  return <ToneBadge tone="warning">Belum kembali</ToneBadge>
}

function Pickup({ d }: { d: StudentDismissal }) {
  if (!d.pickupName) return <span className="text-muted-foreground">—</span>
  return (
    <span className="min-w-0">
      <span className="block truncate">{d.pickupName}</span>
      {d.pickupRelation && <span className="block text-xs text-muted-foreground">{d.pickupRelation}</span>}
    </span>
  )
}

function buildColumns(showDate: boolean): ColumnDef<StudentDismissal>[] {
  const cols: ColumnDef<StudentDismissal>[] = []
  if (showDate) {
    cols.push({
      id: 'date',
      header: 'Tanggal',
      accessorKey: 'date',
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDate(row.original.date)}</span>,
    })
  }
  cols.push(
    {
      id: 'student',
      header: 'Siswa',
      accessorKey: 'studentName',
      cell: ({ row }) => (
        <span className="min-w-0">
          <span className="block font-medium">{row.original.studentName}</span>
          <span className="block text-xs text-muted-foreground tabular-nums">
            {row.original.className} · NIS {row.original.studentNis}
          </span>
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Jenis',
      accessorKey: 'type',
      cell: ({ row }) => <StatusBadge meta={DISMISSAL_META} value={row.original.type} />,
    },
    {
      id: 'exitTime',
      header: 'Keluar',
      accessorKey: 'exitTime',
      cell: ({ row }) => <span className="tabular-nums">{formatTime(row.original.exitTime)}</span>,
    },
    {
      id: 'returnTime',
      header: 'Kembali',
      enableSorting: false,
      cell: ({ row }) => <ReturnCell d={row.original} />,
    },
    {
      id: 'pickup',
      header: 'Penjemput/penerima',
      enableSorting: false,
      cell: ({ row }) => <Pickup d={row.original} />,
    },
    {
      id: 'note',
      header: 'Catatan',
      enableSorting: false,
      meta: { className: 'max-w-56' },
      cell: ({ row }) =>
        row.original.note ? (
          <span className="line-clamp-2 text-sm">{row.original.note}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'recordedBy',
      header: 'Petugas',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          <span className="block">{row.original.recordedByName}</span>
          <span className="block tabular-nums">{formatTime(row.original.recordedAt)}</span>
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      meta: { className: 'text-right', headerClassName: 'text-right' },
      cell: ({ row }) => <DismissalRowActions dismissal={row.original} />,
    },
  )
  return cols
}

const COLUMNS_TODAY = buildColumns(false)
const COLUMNS_HISTORY = buildColumns(true)

function MobileCard({ d, showDate }: { d: StudentDismissal; showDate: boolean }) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{d.studentName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {d.className} · NIS {d.studentNis}
          </p>
        </div>
        <StatusBadge meta={DISMISSAL_META} value={d.type} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        {showDate && (
          <Item label="Tanggal">
            <span className="tabular-nums">{formatDate(d.date)}</span>
          </Item>
        )}
        <Item label="Keluar">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" /> {formatTime(d.exitTime)}
          </span>
        </Item>
        {d.type === 'TEMPORARY_EXIT' && (
          <Item label="Kembali">
            <ReturnCell d={d} />
          </Item>
        )}
        <Item label="Penjemput/penerima" className="col-span-2">
          {d.pickupName ? (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5 text-muted-foreground" />
              {d.pickupName}
              {d.pickupRelation && <span className="text-muted-foreground">({d.pickupRelation})</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Item>
        {d.note && (
          <Item label="Catatan" className="col-span-2">
            {d.note}
          </Item>
        )}
      </dl>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          Dicatat {d.recordedByName} · <span className="tabular-nums">{formatTime(d.recordedAt)}</span>
        </p>
        <DismissalRowActions dismissal={d} />
      </div>
    </div>
  )
}

function Item({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

export function DismissalTable({
  data,
  showDate = false,
  emptyState,
  serverPagination,
  caption,
  title,
  icon,
}: {
  data: StudentDismissal[]
  showDate?: boolean
  emptyState: ReactNode
  serverPagination?: { meta: PaginationMeta; onPageChange: (page: number) => void }
  caption: string
  /** Judul seksi (FramedCard) di atas tabel. */
  title?: string
  icon?: ReactNode
}) {
  return (
    <DataTable
      title={title}
      icon={icon}
      columns={showDate ? COLUMNS_HISTORY : COLUMNS_TODAY}
      data={data}
      getRowId={(d) => d.id}
      emptyState={emptyState}
      serverPagination={serverPagination}
      caption={caption}
      rowClassName={(d) => (isAwaitingReturn(d) ? 'border-l-2 border-l-tone-warning' : undefined)}
      renderMobileCard={(d) => <MobileCard d={d} showDate={showDate} />}
    />
  )
}
