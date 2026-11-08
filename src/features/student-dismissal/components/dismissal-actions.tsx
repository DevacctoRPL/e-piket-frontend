import { zodResolver } from '@hookform/resolvers/zod'
import { MoreHorizontal, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { useSettings } from '@/features/master-data/lookups'
import { ApiError } from '@/lib/api-client'
import { combineDateTime, formatDate, nowWallTime, todayISO, wallTimeOf } from '@/lib/date'
import { applyServerErrors, detailMessage, getErrorMessage } from '@/lib/error-mapping'
import type { StudentDismissal } from '@/types/entities'
import { useCorrectDismissal, useDeleteDismissal, useMarkReturned } from '../queries'
import { DISMISSAL_FORM_FIELDS, dismissalFormSchema, type DismissalFormValues } from '../schemas'
import { DismissalDetailFields } from './dismissal-detail-fields'

/** Izin keluar yang belum ditandai kembali. */
export const isAwaitingReturn = (d: StudentDismissal) => d.type === 'TEMPORARY_EXIT' && !d.returnTime

/* ------------------------------------------------------------------ tandai kembali */

export function MarkReturnedButton({ dismissal, size = 'sm' }: { dismissal: StudentDismissal; size?: 'sm' | 'default' }) {
  const [open, setOpen] = useState(false)
  const [time, setTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mark = useMarkReturned()
  const exitWall = wallTimeOf(dismissal.exitTime)

  const openDialog = () => {
    setTime(dismissal.date === todayISO() ? nowWallTime() : '')
    setError(null)
    setOpen(true)
  }

  const confirm = async () => {
    if (!/^\d{2}:\d{2}$/.test(time)) return setError('Isi jam kembali.')
    if (time <= exitWall) return setError('Waktu kembali harus setelah waktu keluar.')
    try {
      await mark.mutateAsync({ id: dismissal.id, returnTime: combineDateTime(dismissal.date, time) })
      toast.success(`${dismissal.studentName} ditandai sudah kembali.`)
      setOpen(false)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 422 || e.status === 409)) {
        setError(e.details.returnTime ? detailMessage(e.details.returnTime) : getErrorMessage(e))
      }
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={(e) => {
          e.stopPropagation()
          openDialog()
        }}
      >
        <Undo2 /> Tandai kembali
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Tandai siswa sudah kembali?"
        description={
          <>
            <span className="font-medium text-foreground">{dismissal.studentName}</span> ({dismissal.className}) keluar
            pukul <span className="tabular-nums">{exitWall.replace(':', '.')}</span>.
          </>
        }
        confirmLabel="Simpan"
        pending={mark.isPending}
        onConfirm={confirm}
      >
        <FormField label="Jam kembali" required error={error ?? undefined}>
          <Input
            type="time"
            value={time}
            min={exitWall}
            onChange={(e) => {
              setTime(e.target.value)
              setError(null)
            }}
            className="tabular-nums"
          />
        </FormField>
      </ConfirmDialog>
    </>
  )
}

/* ------------------------------------------------------------------ koreksi */

function valuesFrom(d: StudentDismissal): DismissalFormValues {
  return {
    classId: d.classId,
    studentId: d.studentId,
    type: d.type,
    exitTime: wallTimeOf(d.exitTime),
    returnTime: d.returnTime ? wallTimeOf(d.returnTime) : '',
    pickupName: d.pickupName ?? '',
    pickupRelation: d.pickupRelation ?? '',
    note: d.note ?? '',
  }
}

export function CorrectDismissalDialog({
  dismissal,
  open,
  onOpenChange,
}: {
  dismissal: StudentDismissal
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const settings = useSettings()
  const requiresPickup = settings.data?.dismissalRequiresPickup ?? true
  const schema = useMemo(() => dismissalFormSchema({ requiresPickup }), [requiresPickup])
  const form = useForm<DismissalFormValues>({ resolver: zodResolver(schema), defaultValues: valuesFrom(dismissal) })
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const correct = useCorrectDismissal()

  useEffect(() => {
    if (open) {
      form.reset(valuesFrom(dismissal))
      setReason('')
      setReasonError(null)
      setFormError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dismissal.id])

  const submit = form.handleSubmit(async (v) => {
    if (reason.trim().length < 3) {
      setReasonError('Alasan koreksi wajib diisi (minimal 3 karakter).')
      return
    }
    setFormError(null)
    try {
      await correct.mutateAsync({
        id: dismissal.id,
        input: {
          type: v.type,
          exitTime: combineDateTime(dismissal.date, v.exitTime),
          returnTime: v.type === 'TEMPORARY_EXIT' && v.returnTime ? combineDateTime(dismissal.date, v.returnTime) : null,
          pickupName: v.pickupName || null,
          pickupRelation: v.pickupRelation || null,
          note: v.note || null,
          reason: reason.trim(),
        },
      })
      toast.success('Koreksi kepulangan tersimpan.')
      onOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        applyServerErrors(e, form.setError, DISMISSAL_FORM_FIELDS)
        if (e.details.reason) setReasonError(detailMessage(e.details.reason))
      } else if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        setFormError(e.message)
      }
    }
  })

  const pending = correct.isPending
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Koreksi kepulangan</DialogTitle>
          <DialogDescription>
            {dismissal.studentName} · {dismissal.className} · {formatDate(dismissal.date)}. Perubahan tercatat di log
            audit beserta alasannya.
          </DialogDescription>
        </DialogHeader>
        <form id={`correct-${dismissal.id}`} noValidate onSubmit={(e) => void submit(e)} className="grid gap-4">
          {formError && (
            <p role="alert" className="rounded-lg border border-tone-danger/30 bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger">
              {formError}
            </p>
          )}
          <DismissalDetailFields form={form} requiresPickup={requiresPickup} disabled={pending} idPrefix={`correct-${dismissal.id}`} />
          <FormField label="Alasan koreksi" required error={reasonError ?? undefined}>
            <Textarea
              rows={2}
              value={reason}
              disabled={pending}
              placeholder="mis. salah input jam keluar"
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(null)
              }}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" form={`correct-${dismissal.id}`} disabled={pending}>
            {pending ? 'Menyimpan…' : 'Simpan koreksi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ menu aksi baris */

export function DismissalRowActions({ dismissal }: { dismissal: StudentDismissal }) {
  const { can } = useAuth()
  const [correctOpen, setCorrectOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const del = useDeleteDismissal()
  if (!can('dismissal:write')) return null

  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {isAwaitingReturn(dismissal) && <MarkReturnedButton dismissal={dismissal} />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Aksi lain untuk catatan kepulangan`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCorrectOpen(true)}>
            <Pencil /> Koreksi
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CorrectDismissalDialog dismissal={dismissal} open={correctOpen} onOpenChange={setCorrectOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Hapus catatan kepulangan?"
        description={`Catatan kepulangan ${dismissal.studentName} pada ${formatDate(dismissal.date)} akan dihapus. Jejaknya tetap tersimpan di log audit.`}
        confirmLabel="Hapus"
        destructive
        requireReason
        reasonLabel="Alasan penghapusan"
        pending={del.isPending}
        onConfirm={async (reason) => {
          try {
            await del.mutateAsync({ id: dismissal.id, reason })
            toast.success('Catatan kepulangan dihapus.')
            setDeleteOpen(false)
          } catch {
            /* toast error dari MutationCache */
          }
        }}
      />
    </div>
  )
}
