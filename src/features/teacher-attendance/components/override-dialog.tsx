import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/error-mapping'
import type { TeacherAttendance } from '@/types/entities'
import { mapServerErrorsWith } from '../form-errors'
import { useUpdateTeacherAttendance } from '../queries'
import { overrideSchema, type OverrideValues } from '../schemas'
import { isConflict } from '../utils'

const FIELD_MAP = { affectedPeriodsOverride: 'value', overrideReason: 'reason' } as const

/** "Koreksi jam terdampak" (FR-TCH-03, PRD §9.2): nilai sistem dapat dikoreksi dengan alasan wajib. */
export function OverrideDialog({
  attendance,
  open,
  onOpenChange,
  onReload,
}: {
  attendance: TeacherAttendance | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReload: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {attendance && (
          <OverrideForm
            key={`${attendance.id}:${attendance.version}`}
            attendance={attendance}
            onDone={() => onOpenChange(false)}
            onReload={onReload}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function OverrideForm({
  attendance: a,
  onDone,
  onReload,
}: {
  attendance: TeacherAttendance
  onDone: () => void
  onReload: () => void
}) {
  const update = useUpdateTeacherAttendance()
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<OverrideValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      useComputed: a.affectedPeriodsOverride === null,
      value: a.affectedPeriodsOverride ?? a.affectedPeriodsComputed,
      reason: a.overrideReason ?? '',
    },
  })
  const useComputed = useWatch({ control, name: 'useComputed' })

  const onSubmit = handleSubmit((v) => {
    update.mutate(
      {
        id: a.id,
        body: {
          affectedPeriodsOverride: v.useComputed ? null : v.value,
          overrideReason: v.useComputed ? null : v.reason,
          version: a.version,
        },
      },
      {
        onSuccess: (r) => {
          toast.success(`Jam terdampak ${r.teacherName} menjadi ${r.affectedPeriods} jam.`)
          onDone()
        },
        onError: (e) => {
          if (isConflict(e)) {
            toast.error(e.message, { action: { label: 'Muat ulang', onClick: onReload } })
            onReload()
            onDone()
            return
          }
          if (!mapServerErrorsWith<OverrideValues>(FIELD_MAP, e, setError)) toast.error(getErrorMessage(e))
        },
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <UnsavedChangesGuard when={isDirty && !update.isPending} />
      <DialogHeader>
        <DialogTitle>Koreksi jam terdampak</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{a.teacherName}</span> · hitungan sistem dari jadwal aktif:{' '}
          <span className="font-semibold text-foreground tabular-nums">{a.affectedPeriodsComputed} jam</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center gap-2">
        <Checkbox
          id="use-computed"
          checked={useComputed}
          onCheckedChange={(c) => setValue('useComputed', c === true, { shouldDirty: true, shouldValidate: true })}
        />
        <Label htmlFor="use-computed" className="font-normal">
          Gunakan hitungan sistem ({a.affectedPeriodsComputed} jam)
        </Label>
      </div>

      {!useComputed && (
        <>
          <FormField label="Jumlah jam terdampak" required error={errors.value?.message} hint="Jam pelajaran yang benar-benar tidak diajar.">
            <Input type="number" inputMode="numeric" min={0} max={24} step={1} className="w-32" {...register('value', { valueAsNumber: true })} />
          </FormField>
          <FormField label="Alasan koreksi" required error={errors.reason?.message}>
            <Textarea rows={2} placeholder="mis. Guru hadir mulai jam ke-5, dua jam pertama kosong" {...register('reason')} />
          </FormField>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={update.isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Menyimpan…' : 'Simpan koreksi'}
        </Button>
      </DialogFooter>
    </form>
  )
}
