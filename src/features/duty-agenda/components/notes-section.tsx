import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ToneBadge } from '@/components/status-badge'
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
        <ol className="grid gap-2">
          {agenda.notes.map((n, i) => (
            <li key={n.id} className="flex gap-3 rounded-lg border p-3">
              <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{formatTime(n.time)}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {n.category && <ToneBadge tone="info">{n.category}</ToneBadge>}
                  <span className="text-xs text-muted-foreground">oleh {n.createdByName}</span>
                </div>
                <p className="text-sm break-words whitespace-pre-line">{n.content}</p>
              </div>
              {editable && (
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ubah catatan ${i + 1}`}
                    onClick={() => setDialog({ open: true, note: n })}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus catatan ${i + 1}`}
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(n)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {agenda.noImportantNotes
            ? 'Ditandai: tidak ada hal penting/kejadian pada shift ini.'
            : 'Belum ada catatan. Tambahkan kejadian, tamu, atau hal penting selama piket.'}
        </p>
      )}

      {editable && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setDialog({ open: true, note: null })}>
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
