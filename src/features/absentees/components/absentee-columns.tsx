import { CheckCircle2, PhoneCall } from 'lucide-react'
import type { ColumnDef } from '@/components/data-table'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateShort, formatDateTime, formatTime } from '@/lib/date'
import { ATTENDANCE_META, RECORD_STATUS_META } from '@/lib/enums'
import type { AbsenteeRow, GuardianContact } from '@/types/entities'

export function ContactSummary({ contact, compact = false }: { contact: GuardianContact | null; compact?: boolean }) {
  if (!contact) return <ToneBadge tone="warning">Belum dikonfirmasi</ToneBadge>
  return (
    <div className="grid min-w-0 gap-0.5 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <CheckCircle2 className="size-3.5 shrink-0 text-tone-success" aria-hidden />
        <span className="truncate">{contact.receiverName ?? 'Terkonfirmasi'}</span>
        {contact.contactedPhone && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">· {contact.contactedPhone}</span>
        )}
      </p>
      {contact.contactNote && (
        <p className={compact ? 'line-clamp-2 text-xs text-muted-foreground' : 'text-xs text-muted-foreground'}>
          {contact.contactNote}
        </p>
      )}
      {contact.contactedAt && (
        <p className="text-[11px] text-muted-foreground tabular-nums" title={formatDateTime(contact.contactedAt)}>
          {formatTime(contact.contactedAt)} · {contact.contactedByName ?? '—'}
        </p>
      )}
    </div>
  )
}

export function ReasonCell({ row }: { row: AbsenteeRow }) {
  if (!row.reason && !row.note) return <span className="text-muted-foreground">—</span>
  return (
    <div className="grid gap-0.5 text-sm">
      {row.reason && <p>{row.reason}</p>}
      {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
    </div>
  )
}

function ContactButton({ row, onContact }: { row: AbsenteeRow; onContact: (row: AbsenteeRow) => void }) {
  return (
    <Button
      variant={row.contact ? 'ghost' : 'outline'}
      size="sm"
      onClick={(e) => {
        e.stopPropagation()
        onContact(row)
      }}
      aria-label={`${row.contact ? 'Ubah' : 'Catat'} konfirmasi untuk ${row.studentName}`}
    >
      <PhoneCall /> {row.contact ? 'Ubah' : 'Catat konfirmasi'}
    </Button>
  )
}

export function absenteeColumns({
  canWrite,
  onContact,
  multiDay,
  shiftName,
}: {
  canWrite: boolean
  onContact: (row: AbsenteeRow) => void
  multiDay: boolean
  shiftName: (code: string) => string
}): ColumnDef<AbsenteeRow>[] {
  const cols: ColumnDef<AbsenteeRow>[] = [
    {
      id: 'date',
      header: 'Tanggal',
      accessorFn: (r) => r.date,
      cell: ({ row }) => (
        <div className="grid text-sm whitespace-nowrap">
          <span>{multiDay ? formatDateShort(row.original.date) : formatDate(row.original.date)}</span>
          <span className="text-xs text-muted-foreground">{shiftName(row.original.shiftCode)}</span>
        </div>
      ),
    },
    {
      id: 'student',
      header: 'Nama',
      accessorFn: (r) => r.studentName,
      cell: ({ row }) => (
        <div className="grid min-w-36">
          <span className="font-medium">{row.original.studentName}</span>
          <span className="text-xs text-muted-foreground tabular-nums">NIS {row.original.studentNis}</span>
        </div>
      ),
    },
    {
      id: 'class',
      header: 'Kelas',
      accessorFn: (r) => r.className,
      sortingFn: (a, b) => a.original.className.localeCompare(b.original.className, 'id', { numeric: true }),
      cell: ({ row }) => (
        <div className="grid gap-1 whitespace-nowrap">
          <span>{row.original.className}</span>
          {row.original.sessionStatus === 'DRAFT' && (
            <StatusBadge meta={RECORD_STATUS_META} value="DRAFT" />
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorFn: (r) => r.status,
      cell: ({ row }) => <StatusBadge meta={ATTENDANCE_META} value={row.original.status} showShort />,
    },
    {
      id: 'reason',
      header: 'Alasan/Keterangan',
      enableSorting: false,
      cell: ({ row }) => <ReasonCell row={row.original} />,
    },
    {
      id: 'guardian',
      header: 'Kontak wali',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="grid text-sm">
          <span>{row.original.guardianName ?? '—'}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{row.original.guardianPhone ?? '—'}</span>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Konfirmasi',
      accessorFn: (r) => (r.contact ? 1 : 0),
      cell: ({ row }) => <ContactSummary contact={row.original.contact} compact />,
      meta: { className: 'max-w-64' },
    },
  ]
  if (canWrite) {
    cols.push({
      id: 'actions',
      header: () => <span className="sr-only">Aksi</span>,
      enableSorting: false,
      cell: ({ row }) => <ContactButton row={row.original} onContact={onContact} />,
      meta: { className: 'text-right', headerClassName: 'text-right' },
    })
  }
  return cols
}

/** Kartu ponsel: nama + status di atas, alasan, wali, konfirmasi, tombol aksi lebar penuh. */
export function AbsenteeMobileCard({
  row,
  canWrite,
  onContact,
  shiftName,
}: {
  row: AbsenteeRow
  canWrite: boolean
  onContact: (row: AbsenteeRow) => void
  shiftName: (code: string) => string
}) {
  return (
    <div className="grid gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold break-words">{row.studentName}</p>
          <p className="text-xs text-muted-foreground">
            {row.className} · {formatDateShort(row.date)} · {shiftName(row.shiftCode)}
          </p>
        </div>
        <StatusBadge meta={ATTENDANCE_META} value={row.status} showShort />
      </div>
      {(row.reason || row.note) && <ReasonCell row={row} />}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-xs text-muted-foreground">Wali</dt>
        <dd className="min-w-0 break-words">
          {row.guardianName ?? '—'}
          {row.guardianPhone && <span className="text-muted-foreground tabular-nums"> · {row.guardianPhone}</span>}
        </dd>
        <dt className="text-xs text-muted-foreground">Konfirmasi</dt>
        <dd className="min-w-0">
          <ContactSummary contact={row.contact} />
        </dd>
      </dl>
      {row.sessionStatus === 'DRAFT' && (
        <p className="text-xs text-muted-foreground">Absensi kelas masih draft.</p>
      )}
      {canWrite && (
        <Button
          variant={row.contact ? 'outline' : 'default'}
          className="w-full"
          onClick={() => onContact(row)}
          aria-label={`${row.contact ? 'Ubah' : 'Catat'} konfirmasi untuk ${row.studentName}`}
        >
          <PhoneCall /> {row.contact ? 'Ubah konfirmasi' : 'Catat konfirmasi'}
        </Button>
      )}
    </div>
  )
}
