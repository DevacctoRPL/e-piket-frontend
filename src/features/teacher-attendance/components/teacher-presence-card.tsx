import { ChevronLeft, ChevronRight, RefreshCw, UserCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TEACHER_ABSENT_STATUSES, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { ISODate, ScheduledTeacherRow, TeacherAttendanceStatus } from '@/types/entities'
import { useScheduledTeachers } from '../queries'

const PAGE_SIZE = 6

type StatusFilter = '' | 'HADIR' | 'TIDAK_HADIR' | TeacherAttendanceStatus

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Status: Semua' },
  { value: 'HADIR', label: 'Hadir' },
  { value: 'TIDAK_HADIR', label: 'Tidak Hadir' },
  { value: 'SICK', label: 'Sakit' },
  { value: 'PERMISSION', label: 'Izin' },
  { value: 'ABSENT', label: 'Alpa' },
  { value: 'OFFICIAL_DUTY', label: 'Dinas Luar' },
  { value: 'LATE', label: 'Terlambat' },
]

function matchesStatus(row: ScheduledTeacherRow, filter: StatusFilter): boolean {
  if (!filter) return true
  const st = row.attendance?.status
  if (filter === 'HADIR') return st === 'PRESENT' || st === 'LATE'
  if (filter === 'TIDAK_HADIR') return !!st && TEACHER_ABSENT_STATUSES.includes(st)
  return st === filter
}

/**
 * Kolom kiri Absensi Guru (Excalidraw Layar 1):
 * Kehadiran Guru read-only dari Presensi Guru + tombol Sinkron Presensi.
 */
export function TeacherPresenceCard({
  date,
  onSyncAll,
}: {
  date: ISODate
  onSyncAll: () => Promise<void>
}) {
  const query = useScheduledTeachers(date)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (query.data ?? []).filter((r) => {
      if (!matchesStatus(r, statusFilter)) return false
      if (!q) return true
      return (
        r.teacher.name.toLowerCase().includes(q) ||
        r.teacher.nip.toLowerCase().includes(q) ||
        (r.teacher.code?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [query.data, search, statusFilter])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(safePage * PAGE_SIZE, totalItems)

  const handleSync = async () => {
    setSyncing(true)
    try {
      await onSyncAll()
      toast.success('Data presensi guru berhasil disinkronkan.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <FramedCard
      title="Kehadiran Guru"
      titleId="teacher-presence-title"
      description="Data otomatis dari presensi guru (Read-only)"
      icon={<UserCheck />}
      titleBadge={query.data ? <CountChip>{query.data.length}</CountChip> : undefined}
      headerRight={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleSync()}
          disabled={syncing || query.isFetching}
        >
          <RefreshCw className={cn('size-3.5', (syncing || query.isFetching) && 'animate-spin')} aria-hidden />
          Sinkron Presensi
        </Button>
      }
      bodyClassName="gap-3 p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField
          value={search}
          onValueChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Cari nama guru..."
          aria-label="Cari nama guru"
          className="flex-1"
        />
        <select
          aria-label="Filter status kehadiran guru"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as StatusFilter)
            setPage(1)
          }}
          className="native-select h-9 cursor-pointer appearance-none rounded-md border border-border/90 bg-card pr-8 pl-3 text-[13px] font-medium text-foreground shadow-2xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {query.isPending ? (
        <TableSkeleton rows={6} cols={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : totalItems === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          icon={<UserCheck className="size-5" />}
          title="Tidak ada data guru"
          description={
            search || statusFilter
              ? 'Tidak ada guru yang cocok dengan pencarian atau filter status.'
              : 'Belum ada guru terjadwal pada tanggal ini.'
          }
        />
      ) : (
        <div className={cn('space-y-3 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <div className="overflow-hidden rounded-lg border border-border/80">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">No</TableHead>
                  <TableHead>Nama Guru</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, idx) => {
                  const rowNum = (safePage - 1) * PAGE_SIZE + idx + 1
                  const att = row.attendance
                  const isAbsent = !!att && TEACHER_ABSENT_STATUSES.includes(att.status)
                  const affected = att?.affectedPeriods ?? row.scheduledPeriods
                  return (
                    <TableRow key={row.teacher.id}>
                      <TableCell className="text-muted-foreground tabular-nums">{rowNum}</TableCell>
                      <TableCell className="min-w-0">
                        <p className="truncate font-medium text-foreground">{row.teacher.name}</p>
                        {isAbsent && affected > 0 && (
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {affected} jam terdampak
                            {att?.reason ? ` · ${att.reason}` : ''}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {att ? (
                          <StatusBadge meta={TEACHER_ATTENDANCE_META} value={att.status} />
                        ) : (
                          <ToneBadge tone="neutral">Belum Presensi</ToneBadge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="tabular-nums">
              Menampilkan {startIdx}–{endIdx} dari {totalItems} guru
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Halaman guru sebelumnya"
                >
                  <ChevronLeft />
                </Button>
                <span className="px-1.5 font-medium text-foreground tabular-nums">
                  {safePage}/{totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Halaman guru berikutnya"
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </FramedCard>
  )
}
