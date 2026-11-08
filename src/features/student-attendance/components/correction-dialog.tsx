import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField, NativeSelect } from '@/components/form-field'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-client'
import { ATTENDANCE_META } from '@/lib/enums'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { AttendanceStatus, ID, RosterRow } from '@/types/entities'
import { usePatchRecord } from '../queries'
import { correctionSchema, type CorrectionValues } from '../schemas'

/**
 * Koreksi satu record pada sesi FINAL (PRD §9.2): perlu hak `student_attendance:correct` dan alasan;
 * backend mencatat audit before/after.
 */
export function CorrectionDialog({
  sessionId,
  row,
  open,
  onOpenChange,
  requiresReason,
  allowed,
  onConflict,
}: {
  sessionId: ID
  row: RosterRow | null
  open: boolean
  onOpenChange: (o: boolean) => void
  requiresReason: AttendanceStatus[]
  allowed: AttendanceStatus[]
  onConflict: () => void
}) {
  const record = row?.record ?? null
  const patch = usePatchRecord(sessionId)
  const form = useForm<CorrectionValues>({
    resolver: zodResolver(correctionSchema),
    defaultValues: { status: 'PRESENT', reason: '', note: '', arrivalTime: '', correctionReason: '' },
  })
  const { register, handleSubmit, reset, setError, control, formState } = form
  const status = useWatch({ control, name: 'status' })

  useEffect(() => {
    if (open && record) {
      reset({
        status: record.status,
        reason: record.reason ?? '',
        note: record.note ?? '',
        arrivalTime: record.arrivalTime ?? '',
        correctionReason: '',
      })
    }
  }, [open, record, reset])

  const onSubmit = handleSubmit((v) => {
    if (!record) return
    if (requiresReason.includes(v.status) && !v.reason.trim()) {
      setError('reason', { message: 'Alasan wajib diisi untuk status ini.' })
      return
    }
    patch.mutate(
      {
        recordId: record.id,
        body: {
          status: v.status,
          reason: v.reason.trim() || null,
          note: v.note.trim() || null,
          arrivalTime: v.status === 'LATE' ? v.arrivalTime || null : null,
          correctionReason: v.correctionReason.trim(),
          version: record.version,
        },
      },
      {
        onSuccess: () => {
          toast.success('Koreksi absensi tersimpan dan tercatat di log audit.')
          onOpenChange(false)
        },
        onError: (err) => {
          if (applyServerErrors(err, setError, ['status', 'reason', 'note', 'arrivalTime', 'correctionReason'])) return
          if (err instanceof ApiError && err.status === 409) {
            toast.error(getErrorMessage(err), {
              action: { label: 'Muat ulang', onClick: onConflict },
            })
            onOpenChange(false)
            return
          }
          toast.error(getErrorMessage(err))
        },
      },
    )
  })

  const needsReason = requiresReason.includes(status)

  return (
    <Dialog open={open} onOpenChange={(o) => !patch.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koreksi absensi</DialogTitle>
          <DialogDescription>
            {row ? (
              <>
                {row.student.name} · NIS {row.student.nis}. Status saat ini:{' '}
                <StatusBadge meta={ATTENDANCE_META} value={record?.status} />
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField label="Status baru" required error={formState.errors.status?.message}>
            <NativeSelect {...register('status')} className="h-11 sm:h-9">
              {allowed.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_META[s].short} · {ATTENDANCE_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <FormField label="Alasan" required={needsReason} error={formState.errors.reason?.message}>
              <Input {...register('reason')} maxLength={500} className="h-11 sm:h-9" />
            </FormField>
            {status === 'LATE' && (
              <FormField label="Jam datang" error={formState.errors.arrivalTime?.message}>
                <Input type="time" {...register('arrivalTime')} className="h-11 sm:h-9 sm:w-32" />
              </FormField>
            )}
          </div>
          <FormField label="Catatan" error={formState.errors.note?.message}>
            <Input {...register('note')} maxLength={500} className="h-11 sm:h-9" />
          </FormField>
          <FormField
            label="Alasan koreksi"
            required
            hint="Data final hanya dapat diubah dengan alasan. Perubahan dicatat di log audit."
            error={formState.errors.correctionReason?.message}
          >
            <Textarea {...register('correctionReason')} placeholder="Mis. surat sakit diterima menyusul" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={patch.isPending}>
              Batal
            </Button>
            <Button type="submit" disabled={patch.isPending}>
              {patch.isPending ? 'Menyimpan…' : 'Simpan koreksi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
