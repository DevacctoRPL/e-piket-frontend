import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { MetaTag } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { formatTime } from '@/lib/date'
import { getErrorMessage } from '@/lib/error-mapping'
import type { DutyAgenda, DutyNote } from '@/types/entities'
import { useDeleteDutyNote } from '../queries'
import { NoteDialog } from './note-dialog'

/** Daftar catatan hal penting + tambah/ubah/hapus (FR-DUTY-04). */
export function NotesList({
  agenda,
  editable,
  onConflict,
}: {
  agenda: DutyAgenda
  /** Boleh menambah/mengubah (draft oleh petugas, atau mode koreksi agenda final). */
  editable: boolean
  onConflict: (error: ApiError) => void
}) {
  const [dialog, setDialog] = useState<{ open: boolean; note: DutyNote | null }>({ open: false, note: null })
  const [toDelete, setToDelete] = useState<DutyNote | null>(null)
  const remove = useDeleteDutyNote(agenda.id)
  const isCorrection = agenda.status === 'FINAL'

  const confirmDelete = async (reason: string) => {
    if (!toDelete) return
    try {
      await remove.mutateAsync({ noteId: toDelete.id, correctionReason: isCorrection ? reason : undefined })
      toast.success('Catatan dihapus.')
      setToDelete(null)
    } catch (err) {
      setToDelete(null)
      if (err instanceof ApiError && err.status === 409) onConflict(err)
      else toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {agenda.notes.length > 0 ? (
        <ol className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/75">
          {agenda.notes.map((n, i) => (
            <li key={n.id} className="flex gap-3 px-3 py-2.5">
              <span className="w-12 shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums">{formatTime(n.time)}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {n.category && <MetaTag>{n.category}</MetaTag>}
                  <span className="text-xs text-muted-foreground">oleh {n.createdByName}</span>
                </div>
                <p className="text-sm break-words whitespace-pre-line">{n.content}</p>
              </div>
              {editable && (
                <div className="shrink-0">
                  <RowActionsMenu
                    label={`Aksi untuk catatan ${i + 1}`}
                    actions={[
                      { label: 'Ubah catatan', icon: Pencil, onSelect: () => setDialog({ open: true, note: n }) },
                      {
                        label: 'Hapus catatan',
                        icon: Trash2,
                        destructive: true,
                        separated: true,
                        onSelect: () => setToDelete(n),
                      },
                    ]}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {agenda.noImportantNotes
            ? 'Ditandai: tidak ada hal penting/kejadian pada shift ini.'
            : 'Belum ada catatan. Tambahkan kejadian, tamu, atau hal penting selama piket.'}
        </p>
      )}

      {editable && (
        <Button variant="outline" className="self-start" onClick={() => setDialog({ open: true, note: null })}>
          <Plus /> Tambah catatan
        </Button>
      )}

      <NoteDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        agenda={agenda}
        note={dialog.note}
        onConflict={onConflict}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Hapus catatan?"
        description={
          isCorrection
            ? 'Agenda sudah final. Penghapusan dicatat di audit log beserta alasannya.'
            : 'Catatan akan dihapus dari agenda piket. Riwayat tetap tercatat di audit log.'
        }
        confirmLabel="Hapus"
        destructive
        requireReason={isCorrection}
        reasonLabel="Alasan koreksi"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
