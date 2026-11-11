import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField, NativeSelect } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { Textarea } from '@/components/ui/textarea'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { SubstitutionRecord } from '@/types/entities'
import { useSubstitutionAbilities } from '../hooks'
import { useUpdateSubstitution } from '../queries'
import { editSchema, type EditFormValues } from '../schemas'
import { periodLabel, rangeOf } from '../utils'

/** Ubah kegiatan/catatan guru pengganti (FR-SUB-03) dan jumlah jam (khusus piket/admin). */
export function EditRecordDialog({
  record,
  className,
  onOpenChange,
}: {
  record: SubstitutionRecord | null
  className?: string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah catatan guru pengganti</DialogTitle>
          <DialogDescription>
            {record
              ? `${record.substituteTeacherName} · ${className ?? ''} · ${periodLabel(record.periodStart, record.periodEnd)}`
              : ''}
          </DialogDescription>
        </DialogHeader>
        {record && <EditForm key={record.id} record={record} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ record, onDone }: { record: SubstitutionRecord; onDone: () => void }) {
  const { canWrite } = useSubstitutionAbilities()
  const max = record.periodEnd - record.periodStart + 1
  const schema = useMemo(() => editSchema(max), [max])
  const update = useUpdateSubstitution()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<EditFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      activity: record.activity ?? '',
      note: record.note ?? '',
      periodCount: String(record.periodCount),
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      await update.mutateAsync({
        id: record.id,
        body: {
          activity: v.activity.trim() || null,
          note: v.note.trim() || null,
          ...(canWrite ? { periodCount: Number(v.periodCount) } : {}),
        },
      })
      toast.success('Catatan guru pengganti diperbarui.')
      onDone()
    } catch (e) {
      if (!applyServerErrors(e, setError, ['activity', 'note', 'periodCount'])) setFormError(getErrorMessage(e))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      {formError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription className="text-foreground">{formError}</AlertDescription>
        </Alert>
      )}
      <FormField label="Jumlah jam ditangani" error={errors.periodCount?.message} hint={canWrite ? undefined : 'Hanya guru piket/admin yang dapat mengubah jumlah jam.'}>
        <NativeSelect {...register('periodCount')} disabled={!canWrite || update.isPending}>
          {rangeOf(1, max).map((n) => (
            <option key={n} value={n}>
              {n} jam
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Kegiatan / materi" error={errors.activity?.message}>
        <Textarea {...register('activity')} rows={3} disabled={update.isPending} />
      </FormField>
      <FormField label="Catatan" error={errors.note?.message}>
        <Textarea {...register('note')} rows={2} disabled={update.isPending} />
      </FormField>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={!isDirty || update.isPending}>
          {update.isPending ? 'Menyimpan…' : 'Simpan perubahan'}
        </Button>
      </div>
    </form>
  )
}
