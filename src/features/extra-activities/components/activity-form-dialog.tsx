import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField, NativeSelect } from '@/components/form-field'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
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
import { Alert, AlertDescription, Switch } from '@/components/ui/misc'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { useShifts, useTeachers } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { EXTRA_ACTIVITY_TYPE_META, enumOptions } from '@/lib/enums'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { ExtraActivity } from '@/types/entities'
import { useCreateExtraActivity, useUpdateExtraActivity } from '../queries'
import {
  ACTIVITY_FIELDS,
  activitySchema,
  EXTERNAL_INSTRUCTOR,
  toFormValues,
  toInput,
  type ActivityFormValues,
} from '../schemas'
import type { ExtraActivityPatch } from '../types'
import { ClassPicker } from './class-picker'

function emptyValues(teacherId: string | null): ActivityFormValues {
  return {
    name: '',
    type: 'COURSE',
    instructorTeacherId: teacherId ?? '',
    instructorName: '',
    date: todayISO(),
    shiftCode: '',
    startTime: '',
    endTime: '',
    classIds: [],
    topic: '',
    note: '',
    participantAttendanceEnabled: false,
  }
}

/**
 * Form tambah/ubah kegiatan tambahan (FR-EXT-01, FR-EXT-02).
 * Mengubah kegiatan FINAL memerlukan alasan koreksi (PRD §9.2).
 */
export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Bila diisi → mode ubah. */
  activity?: ExtraActivity
  onSaved?: (a: ExtraActivity) => void
}) {
  const { user } = useAuth()
  const isEdit = Boolean(activity)
  const shifts = useShifts()
  const teachers = useTeachers()
  const createMut = useCreateExtraActivity()
  const updateMut = useUpdateExtraActivity(activity?.id ?? '')
  const idem = useIdempotencyKey()
  const [formError, setFormError] = useState<{ message: string; conflict: boolean } | null>(null)
  const [pendingPatch, setPendingPatch] = useState<ExtraActivityPatch | null>(null)

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: activity ? toFormValues(activity) : emptyValues(user?.teacherId ?? null),
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    formState: { errors, isDirty },
  } = form

  // Reset setiap kali dialog dibuka agar data selalu dari versi terbaru.
  useEffect(() => {
    if (!open) return
    reset(activity ? toFormValues(activity) : emptyValues(user?.teacherId ?? null))
    setFormError(null)
    idem.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.id, activity?.version])

  // Default shift = shift pertama yang aktif.
  const firstShift = shifts.data?.find((s) => s.isActive)?.code
  const shiftValue = watch('shiftCode')
  useEffect(() => {
    if (open && !shiftValue && firstShift) setValue('shiftCode', firstShift)
  }, [open, shiftValue, firstShift, setValue])

  const instructorId = watch('instructorTeacherId')
  const pending = createMut.isPending || updateMut.isPending

  const handleError = (e: unknown) => {
    if (applyServerErrors(e, setError, ACTIVITY_FIELDS)) {
      setFormError({ message: 'Periksa kembali isian yang ditandai.', conflict: false })
      return
    }
    const conflict = e instanceof ApiError && e.status === 409
    setFormError({ message: getErrorMessage(e), conflict })
  }

  const close = () => {
    reset(activity ? toFormValues(activity) : emptyValues(user?.teacherId ?? null))
    onOpenChange(false)
  }

  const savePatch = async (patch: ExtraActivityPatch) => {
    try {
      const saved = await updateMut.mutateAsync(patch)
      toast.success('Perubahan kegiatan disimpan.')
      setPendingPatch(null)
      reset(toFormValues(saved))
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e) {
      setPendingPatch(null)
      handleError(e)
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const body = toInput(values)
    if (activity) {
      const patch: ExtraActivityPatch = { ...body, version: activity.version }
      if (activity.status === 'FINAL') {
        setPendingPatch(patch)
        return
      }
      await savePatch(patch)
      return
    }
    try {
      const saved = await createMut.mutateAsync({ body, idempotencyKey: idem.key() })
      idem.reset()
      toast.success('Kegiatan tambahan dibuat.')
      reset(emptyValues(user?.teacherId ?? null))
      onOpenChange(false)
      onSaved?.(saved)
    } catch (e) {
      // 422 tidak tersimpan di server → kunci baru untuk percobaan berikutnya.
      if (e instanceof ApiError && e.status === 422) idem.reset()
      handleError(e)
    }
  })

  const teacherOptions = (teachers.data ?? []).filter(
    (t) => t.status === 'ACTIVE' || t.id === activity?.instructorTeacherId,
  )

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return
          if (!o) close()
          else onOpenChange(o)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Ubah kegiatan' : 'Tambah kegiatan'}</DialogTitle>
            <DialogDescription>
              Satu agenda dapat diikuti beberapa kelas sekaligus. Presensi peserta dicatat terpisah dari absensi
              reguler.
            </DialogDescription>
          </DialogHeader>

          <form id="extra-activity-form" onSubmit={onSubmit} noValidate className="grid gap-4">
            {formError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {formError.message}
                  {formError.conflict && ' Tutup formulir lalu muat ulang halaman untuk melihat versi terbaru.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <FormField label="Nama kegiatan" required error={errors.name?.message}>
                <Input placeholder="mis. Kursus Persiapan Sertifikasi Jaringan" autoComplete="off" {...register('name')} />
              </FormField>
              <FormField label="Jenis" required error={errors.type?.message}>
                <NativeSelect {...register('type')}>
                  {enumOptions(EXTRA_ACTIVITY_TYPE_META).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Pengampu" required error={errors.instructorTeacherId?.message}>
                <NativeSelect {...register('instructorTeacherId')} disabled={teachers.isPending}>
                  <option value="">{teachers.isPending ? 'Memuat guru…' : 'Pilih guru pengampu'}</option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  <option value={EXTERNAL_INSTRUCTOR}>Pengampu dari luar sekolah…</option>
                </NativeSelect>
              </FormField>
              {instructorId === EXTERNAL_INSTRUCTOR && (
                <FormField label="Nama pengampu" required error={errors.instructorName?.message}>
                  <Input placeholder="mis. Instruktur LPK Mitra" autoComplete="off" {...register('instructorName')} />
                </FormField>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <FormField label="Tanggal" required error={errors.date?.message} className="col-span-2 sm:col-span-1">
                <Input type="date" {...register('date')} />
              </FormField>
              <FormField label="Shift" required error={errors.shiftCode?.message} className="col-span-2 sm:col-span-1">
                <NativeSelect {...register('shiftCode')}>
                  <option value="">Pilih shift</option>
                  {(shifts.data ?? []).map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Jam mulai" error={errors.startTime?.message}>
                <Input type="time" {...register('startTime')} />
              </FormField>
              <FormField label="Jam selesai" error={errors.endTime?.message}>
                <Input type="time" {...register('endTime')} />
              </FormField>
            </div>

            <div className="grid gap-1.5">
              <Label id="class-picker-label">
                Kelas peserta<span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Controller
                control={control}
                name="classIds"
                render={({ field }) => (
                  <ClassPicker
                    value={field.value}
                    onChange={field.onChange}
                    invalid={Boolean(errors.classIds)}
                    describedBy={errors.classIds ? 'class-picker-error' : undefined}
                  />
                )}
              />
              {errors.classIds && (
                <p id="class-picker-error" role="alert" className="text-xs font-medium text-destructive">
                  {errors.classIds.message}
                </p>
              )}
            </div>

            <FormField label="Materi" error={errors.topic?.message}>
              <Textarea rows={2} placeholder="Materi atau pokok bahasan" {...register('topic')} />
            </FormField>
            <FormField label="Keterangan" error={errors.note?.message}>
              <Textarea rows={2} placeholder="Catatan, perlengkapan, atau lokasi" {...register('note')} />
            </FormField>

            <Controller
              control={control}
              name="participantAttendanceEnabled"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="participant-attendance">Catat presensi peserta</Label>
                    <p className="text-xs text-muted-foreground">
                      Daftar peserta otomatis diisi dari siswa aktif kelas terpilih (status awal Hadir).
                    </p>
                  </div>
                  <Switch id="participant-attendance" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" form="extra-activity-form" disabled={pending}>
              {pending ? 'Menyimpan…' : isEdit ? 'Simpan perubahan' : 'Simpan kegiatan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingPatch !== null}
        onOpenChange={(o) => !o && setPendingPatch(null)}
        title="Koreksi kegiatan final"
        description="Kegiatan ini sudah final. Perubahan akan dicatat di audit log beserta alasan Anda."
        confirmLabel="Simpan koreksi"
        requireReason
        reasonLabel="Alasan koreksi"
        pending={updateMut.isPending}
        onConfirm={(reason) => (pendingPatch ? savePatch({ ...pendingPatch, reason }) : undefined)}
      />

      <UnsavedChangesGuard when={open && isDirty} />
    </>
  )
}
