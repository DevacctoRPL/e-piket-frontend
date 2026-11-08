import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField, NativeSelect } from '@/components/form-field'
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
import { useSettings } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { combineDateTime, nowWallTime, todayISO, wallTimeOf } from '@/lib/date'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { DutyAgenda, DutyNote } from '@/types/entities'
import { useAddDutyNote, useUpdateDutyNote } from '../queries'
import { dutyNoteCorrectionSchema, dutyNoteSchema, type DutyNoteFormValues } from '../schemas'

const FIELDS = ['time', 'category', 'content', 'correctionReason'] as const

function defaults(agenda: DutyAgenda, note: DutyNote | null): DutyNoteFormValues {
  return {
    time: note ? wallTimeOf(note.time) : agenda.date === todayISO() ? nowWallTime() : '07:00',
    category: note?.category ?? '',
    content: note?.content ?? '',
    correctionReason: '',
  }
}

/** Tambah / ubah catatan hal penting (FR-DUTY-04). Agenda FINAL → alasan koreksi wajib. */
export function NoteDialog({
  open,
  onOpenChange,
  agenda,
  note,
  onConflict,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agenda: DutyAgenda
  note: DutyNote | null
  onConflict: (error: ApiError) => void
}) {
  const isCorrection = agenda.status === 'FINAL'
  const settings = useSettings()
  const categories = settings.data?.dutyNoteCategories ?? []
  const add = useAddDutyNote(agenda.id)
  const update = useUpdateDutyNote(agenda.id)
  const idem = useIdempotencyKey()
  const pending = add.isPending || update.isPending

  const form = useForm<DutyNoteFormValues>({
    resolver: zodResolver(isCorrection ? dutyNoteCorrectionSchema : dutyNoteSchema),
    defaultValues: defaults(agenda, note),
  })
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = form

  useEffect(() => {
    if (open) {
      reset(defaults(agenda, note))
      idem.reset()
    }
    // hanya saat dialog dibuka / catatan berganti
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id])

  const onSubmit = handleSubmit(async (values) => {
    const body = {
      time: combineDateTime(agenda.date, values.time),
      category: values.category || null,
      content: values.content.trim(),
      ...(isCorrection ? { correctionReason: values.correctionReason.trim() } : {}),
    }
    try {
      if (note) await update.mutateAsync({ noteId: note.id, body })
      else await add.mutateAsync({ body, idempotencyKey: idem.key() })
      idem.reset()
      toast.success(note ? 'Catatan diperbarui.' : 'Catatan ditambahkan.')
      onOpenChange(false)
    } catch (err) {
      if (applyServerErrors(err, setError, FIELDS)) return
      if (err instanceof ApiError && err.status === 409) {
        onOpenChange(false)
        onConflict(err)
        return
      }
      toast.error(getErrorMessage(err))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? 'Ubah catatan' : 'Tambah catatan hal penting'}</DialogTitle>
          <DialogDescription>
            Catat kejadian, tamu, kedisiplinan, atau hal penting lain selama piket.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <FormField label="Jam" required error={errors.time?.message}>
              <Input type="time" {...register('time')} />
            </FormField>
            <FormField label="Kategori" hint="Opsional" error={errors.category?.message}>
              <NativeSelect {...register('category')}>
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Uraian" required error={errors.content?.message}>
            <Textarea rows={4} placeholder="Mis. Kunjungan orang tua siswa kelas X TKJ 1…" {...register('content')} />
          </FormField>
          {isCorrection && (
            <FormField
              label="Alasan koreksi"
              required
              hint="Agenda sudah final. Perubahan dicatat di audit log."
              error={errors.correctionReason?.message}
            >
              <Textarea rows={2} {...register('correctionReason')} />
            </FormField>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan catatan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
