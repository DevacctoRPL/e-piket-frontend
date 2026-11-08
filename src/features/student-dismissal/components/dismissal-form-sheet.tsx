import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField, NativeSelect } from '@/components/form-field'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { useClasses, useSettings } from '@/features/master-data/lookups'
import { ApiError } from '@/lib/api-client'
import { combineDateTime, formatDateLong, nowWallTime, todayISO } from '@/lib/date'
import { applyServerErrors, detailMessage, getErrorMessage } from '@/lib/error-mapping'
import { DISMISSAL_META } from '@/lib/enums'
import type { ISODate, ShiftCode } from '@/types/entities'
import { dismissalKeys, useCreateDismissal } from '../queries'
import { DISMISSAL_FORM_FIELDS, dismissalFormSchema, type DismissalFormValues } from '../schemas'
import { AttendanceContextPanel } from './attendance-context'
import { DismissalDetailFields } from './dismissal-detail-fields'
import { StudentPicker } from './student-picker'

function emptyValues(date: ISODate, classId = ''): DismissalFormValues {
  return {
    classId,
    studentId: '',
    type: 'EARLY_LEAVE',
    // waktu sekarang hanya masuk akal untuk hari ini; tanggal lampau dibiarkan diisi manual
    exitTime: date === todayISO() ? nowWallTime() : '',
    returnTime: '',
    pickupName: '',
    pickupRelation: '',
    note: '',
  }
}

/** Formulir "Catat kepulangan" (PRD §7.2, FR-OUT-01/02). */
export function DismissalFormSheet({
  open,
  onOpenChange,
  date,
  shiftCode,
  defaultClassId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: ISODate
  shiftCode?: ShiftCode
  defaultClassId?: string
}) {
  const settings = useSettings()
  const requiresPickup = settings.data?.dismissalRequiresPickup ?? true
  const classes = useClasses({ scope: 'mine' })
  const classOptions = useMemo(
    () => (classes.data ?? []).filter((c) => c.status === 'ACTIVE' && (!shiftCode || c.shiftCode === shiftCode)),
    [classes.data, shiftCode],
  )
  const schema = useMemo(() => dismissalFormSchema({ requiresPickup }), [requiresPickup])
  const form = useForm<DismissalFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues(date, defaultClassId),
  })
  const { handleSubmit, register, reset, setValue, setError, watch, formState } = form
  const idem = useIdempotencyKey()
  const create = useCreateDismissal()
  const qc = useQueryClient()
  const [conflict, setConflict] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const studentLabelId = useId()

  const classId = watch('classId')
  const studentId = watch('studentId')
  const pending = create.isPending

  // Reset setiap kali sheet dibuka agar waktu keluar default = sekarang
  useEffect(() => {
    if (open) {
      reset(emptyValues(date, defaultClassId))
      idem.reset()
      setConflict(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date])

  const requestClose = () => {
    if (pending) return
    if (formState.isDirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  const onSubmit = handleSubmit(async (v) => {
    setConflict(null)
    try {
      await create.mutateAsync({
        idempotencyKey: idem.key(),
        input: {
          studentId: v.studentId,
          date,
          type: v.type,
          exitTime: combineDateTime(date, v.exitTime),
          returnTime: v.type === 'TEMPORARY_EXIT' && v.returnTime ? combineDateTime(date, v.returnTime) : null,
          pickupName: v.pickupName || null,
          pickupRelation: v.pickupRelation || null,
          note: v.note || null,
        },
      })
      toast.success(`Kepulangan tersimpan (${DISMISSAL_META[v.type].label}).`)
      idem.reset()
      reset(emptyValues(date, v.classId))
      onOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // body berubah setelah koreksi → kunci baru
        idem.reset()
        applyServerErrors(e, setError, DISMISSAL_FORM_FIELDS)
        // detail di luar field formulir (mis. tanggal) ditampilkan sebagai pesan umum
        const unmapped = Object.entries(e.details).filter(
          ([k]) => !(DISMISSAL_FORM_FIELDS as readonly string[]).includes(k),
        )
        if (unmapped.length > 0 || Object.keys(e.details).length === 0) {
          setConflict(unmapped.map(([, v]) => detailMessage(v)).join(' ') || getErrorMessage(e))
        }
        return
      }
      if (e instanceof ApiError && e.status === 409) {
        idem.reset()
        setConflict(e.message)
      }
      // error lain sudah ditampilkan sebagai toast oleh MutationCache
    }
  })

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-lg"
          onInteractOutside={(e) => {
            if (formState.isDirty || pending) e.preventDefault()
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle className="text-lg">Catat kepulangan</SheetTitle>
            <SheetDescription>{formatDateLong(date)}</SheetDescription>
          </SheetHeader>

          <form
            id="dismissal-form"
            onSubmit={(e) => void onSubmit(e)}
            noValidate
            className="grid flex-1 content-start gap-4 overflow-y-auto overscroll-contain p-4"
          >
            {conflict && (
              <Alert variant="destructive">
                <AlertTriangle />
                <div className="grid gap-2">
                  <p className="text-sm">{conflict}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => {
                      setConflict(null)
                      void qc.invalidateQueries({ queryKey: dismissalKeys.all })
                    }}
                  >
                    <RefreshCw /> Muat ulang data
                  </Button>
                </div>
              </Alert>
            )}

            <FormField label="Kelas" required error={formState.errors.classId?.message}>
              <NativeSelect
                disabled={pending || classes.isPending}
                {...register('classId', {
                  onChange: () => setValue('studentId', '', { shouldDirty: true }),
                })}
              >
                <option value="">{classes.isPending ? 'Memuat kelas…' : 'Pilih kelas'}</option>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <div className="grid gap-1.5">
              <Label id={studentLabelId}>
                Siswa <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <StudentPicker
                classId={classId || null}
                value={studentId}
                onChange={(id) => setValue('studentId', id, { shouldDirty: true, shouldValidate: true })}
                error={formState.errors.studentId?.message}
                disabled={pending}
                labelId={studentLabelId}
              />
            </div>

            <AttendanceContextPanel studentId={studentId || null} date={date} />

            <DismissalDetailFields
              form={form}
              requiresPickup={requiresPickup}
              disabled={pending}
              idPrefix="dismissal-new"
            />
          </form>

          <SheetFooter className="flex-row justify-end border-t bg-background">
            <Button type="button" variant="outline" onClick={requestClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" form="dismissal-form" disabled={pending} className="min-w-28">
              {pending ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <UnsavedChangesGuard when={open && formState.isDirty && !pending} />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Buang isian formulir?"
        description="Data kepulangan yang belum disimpan akan hilang."
        confirmLabel="Buang"
        cancelLabel="Lanjut mengisi"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          reset(emptyValues(date, defaultClassId))
          onOpenChange(false)
        }}
      />
    </>
  )
}
