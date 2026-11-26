import { CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { ISODate, SubstitutionSlot } from '@/types/entities'
import { useDeleteManualEmptySlot, useDeleteSubstitute, useEmptySlots } from '../queries'
import { AddEmptySlotDialog, EditEmptySlotDialog } from './empty-slot-dialogs'

const PAGE_SIZE = 6

/**
 * Kolom kanan Absensi Guru:
 * - Hanya menampilkan jam kosong yang sudah memiliki guru pengganti (slot.substitution !== null)
 * - Bar atas: Pencarian + tombol "+ Tambah" (quick-pick jadwal guru tidak hadir atau input manual)
 * - Tabel: Kelas & Jam | Guru Tidak Hadir | Guru Piket | Aksi (Edit, Hapus)
 */
export function EmptySlotsCard({ date }: { date: ISODate }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editSlot, setEditSlot] = useState<SubstitutionSlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SubstitutionSlot | null>(null)

  const query = useEmptySlots(date)
  const deleteSub = useDeleteSubstitute()
  const deleteManual = useDeleteManualEmptySlot()

  const assignedSlots = useMemo(
    () => (query.data ?? []).filter((s) => s.substitution !== null),
    [query.data],
  )

  const unhandledSlots = useMemo(
    () => (query.data ?? []).filter((s) => s.substitution === null && !s.isManual),
    [query.data],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assignedSlots
    return assignedSlots.filter((s) =>
      [
        s.className,
        s.subjectName,
        `jam ke ${s.periodStart} - ${s.periodEnd}`,
        `jam ${s.periodStart}-${s.periodEnd}`,
        s.absentTeacherName,
        s.substitution?.substituteTeacherName ?? '',
        s.substitution?.activity ?? '',
      ].some((v) => v.toLowerCase().includes(q)),
    )
  }, [assignedSlots, search])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const startIdx = totalItems === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const endIdx = Math.min(safePage * PAGE_SIZE, totalItems)

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      if (deleteTarget.isManual && deleteTarget.manualSlotId) {
        await deleteManual.mutateAsync(deleteTarget.manualSlotId)
        toast.success('Jam kosong manual dihapus.')
      } else if (deleteTarget.substitution) {
        await deleteSub.mutateAsync(deleteTarget.substitution.id)
        toast.success('Penugasan guru piket dihapus.')
      }
      setDeleteTarget(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const deleting = deleteSub.isPending || deleteManual.isPending

  return (
    <>
      <FramedCard
        title="Jam Kosong"
        titleId="empty-slots-title"
        description="Daftar kelas jam kosong yang sudah memiliki guru pengganti"
        icon={<CalendarClock />}
        titleBadge={query.data ? <CountChip>{assignedSlots.length}</CountChip> : undefined}
        bodyClassName="gap-3 p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            value={search}
            onValueChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Cari kelas, jam ke-, guru tidak hadir, atau guru piket..."
            aria-label="Cari kelas jam kosong"
            className="flex-1"
          />
          <Button onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus aria-hidden /> Tambah
          </Button>
        </div>

        {query.isPending ? (
          <TableSkeleton rows={6} cols={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : totalItems === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            icon={<CalendarClock className="size-5" />}
            title={search ? 'Tidak ditemukan' : 'Belum ada jam kosong terisi'}
            description={
              search
                ? 'Tidak ada data jam kosong yang cocok dengan kata kunci pencarian.'
                : 'Belum ada penugasan guru pengganti pada tanggal ini. Klik "+ Tambah" untuk mencatat pengganti.'
            }
          />
        ) : (
          <div className={cn('space-y-3 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-lg border border-border/80 md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Kelas &amp; Jam</TableHead>
                    <TableHead>Guru Tidak Hadir</TableHead>
                    <TableHead>Guru Piket</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="whitespace-nowrap">
                        <p className="font-semibold text-foreground">{slot.className}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Jam ke-{slot.periodStart}–{slot.periodEnd} · {slot.subjectName}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{slot.absentTeacherName}</TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {slot.substitution?.substituteTeacherName}
                          </p>
                          {slot.substitution?.activity && (
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {slot.substitution.activity}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditSlot(slot)}
                            aria-label={`Edit jam kosong ${slot.className}`}
                          >
                            <Pencil className="size-3.5" aria-hidden /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteTarget(slot)}
                            aria-label={`Hapus jam kosong ${slot.className}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden /> Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="grid gap-2 md:hidden">
              {pageRows.map((slot) => (
                <li key={slot.id} className="space-y-2 rounded-lg border border-border/85 bg-card p-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{slot.className}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Jam ke-{slot.periodStart}–{slot.periodEnd} · {slot.subjectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setEditSlot(slot)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(slot)}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Guru tidak hadir</dt>
                    <dd>{slot.absentTeacherName}</dd>
                    <dt className="text-muted-foreground">Guru piket</dt>
                    <dd className="font-medium text-foreground">
                      {slot.substitution?.substituteTeacherName}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <p className="tabular-nums">
                Menampilkan {startIdx}–{endIdx} dari {totalItems} kelas
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Halaman jam kosong sebelumnya"
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
                    aria-label="Halaman jam kosong berikutnya"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </FramedCard>

      <AddEmptySlotDialog
        date={date}
        unhandledSlots={unhandledSlots}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <EditEmptySlotDialog
        slot={editSlot}
        onOpenChange={(open) => {
          if (!open) setEditSlot(null)
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteTarget?.isManual ? 'Hapus jam kosong manual?' : 'Hapus penugasan guru piket?'}
        description={
          deleteTarget?.isManual
            ? `Slot jam kosong ${deleteTarget.className} (Jam ke-${deleteTarget.periodStart}–${deleteTarget.periodEnd}) akan dihapus permanen.`
            : deleteTarget
              ? `Penugasan ${deleteTarget.substitution?.substituteTeacherName ?? ''} di ${deleteTarget.className} akan dihapus dari daftar Jam Kosong.`
              : ''
        }
        confirmLabel="Hapus"
        destructive
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </>
  )
}
