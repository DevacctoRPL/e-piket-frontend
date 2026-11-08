import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch, type UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
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
import { Alert, AlertDescription } from '@/components/ui/misc'
import { Textarea } from '@/components/ui/textarea'
import { useSettings, useShifts, useTimetable } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { combineDateTime, formatDateLong, wallTimeOf } from '@/lib/date'
import { TEACHER_ABSENT_STATUSES, TEACHER_ATTENDANCE_META, enumOptions } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import type { ISODate, ScheduledTeacherRow, ShiftCode, TeacherAttendanceStatus } from '@/types/entities'
import { useRecordTeacherAttendance, useUpdateTeacherAttendance } from '../queries'
import { mapServerErrorsWith } from '../form-errors'
import { recordStatusSchema, type RecordStatusValues } from '../schemas'
import { isConflict } from '../utils'

const FIELD_MAP: Record<string, keyof RecordStatusValues> = {
  status: 'status',
  reason: 'reason',
  checkInAt: 'checkIn',
  checkOutAt: 'checkOut',
  correctionReason: 'correctionReason',
}
const mapServerErrors = (e: unknown, setError: UseFormSetError<RecordStatusValues>) =>
  mapServerErrorsWith<RecordStatusValues>(FIELD_MAP, e, setError)
const FALLBACK_REASON_REQUIRED: TeacherAttendanceStatus[] = ['SICK', 'PERMISSION', 'ABSENT', 'OFFICIAL_DUTY']

/**
 * Dialog "Catat status" (FR-TCH-02): piket/admin mencatat status guru yang belum/tidak check-in,
 * atau mengoreksi record yang ada (alasan koreksi wajib untuk perubahan status/jam — FR-OUT-03).
 */
export function RecordStatusDialog({
  row,
  date,
  shiftCode,
  open,
  onOpenChange,
  onReload,
}: {
  row: ScheduledTeacherRow | null
  date: ISODate
  /** Shift dari filter halaman ('' = semua). */
  shiftCode: ShiftCode | ''
  open: boolean
  onOpenChange: (open: boolean) => void
  onReload: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {row && (
          <RecordStatusForm
            key={`${row.teacher.id}:${row.attendance?.version ?? 0}`}
            row={row}
            date={date}
            shiftCode={shiftCode}
            onDone={() => onOpenChange(false)}
            onReload={onReload}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RecordStatusForm({
  row,
  date,
  shiftCode,
  onDone,
  onReload,
}: {
  row: ScheduledTeacherRow
  date: ISODate
  shiftCode: ShiftCode | ''
  onDone: () => void
  onReload: () => void
}) {
  const a = row.attendance
  const settings = useSettings()
  const shifts = useShifts()
  const timetable = useTimetable({ date, teacherId: row.teacher.id })
  const reasonRequired = settings.data?.teacherReasonRequiredStatuses ?? FALLBACK_REASON_REQUIRED
  const record = useRecordTeacherAttendance()
  const update = useUpdateTeacherAttendance()
  const idem = useIdempotencyKey()
  const pending = record.isPending || update.isPending

  const initial = useMemo(
    () => ({
      status: a?.status ?? ('SICK' as TeacherAttendanceStatus),
      checkIn: a?.checkInAt ? wallTimeOf(a.checkInAt) : '',
      checkOut: a?.checkOutAt ? wallTimeOf(a.checkOutAt) : '',
    }),
    [a],
  )
  const schema = useMemo(
    () => recordStatusSchema({ reasonRequired, isCorrection: !!a, initial }),
    [reasonRequired, a, initial],
  )

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<RecordStatusValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...initial, reason: a?.reason ?? '', correctionReason: '' },
  })
  const status = useWatch({ control, name: 'status' })
  const checkIn = useWatch({ control, name: 'checkIn' })
  const checkOut = useWatch({ control, name: 'checkOut' })
  const isAbsent = TEACHER_ABSENT_STATUSES.includes(status)
  const needsReason = reasonRequired.includes(status)
  const changedCore = !!a && (status !== initial.status || checkIn !== initial.checkIn || checkOut !== initial.checkOut)

  // Status tidak hadir → kosongkan jam agar data konsisten.
  useEffect(() => {
    if (isAbsent) {
      setValue('checkIn', '', { shouldDirty: true })
      setValue('checkOut', '', { shouldDirty: true })
    }
  }, [isAbsent, setValue])

  // Shift acuan: shift record lama → filter halaman → shift slot pertama → Pagi.
  const slotShift = timetable.data?.slice().sort((x, y) => x.periodStart - y.periodStart)[0]?.shiftCode
  const effectiveShift = a?.shiftCode || shiftCode || slotShift || shifts.data?.[0]?.code || 'MORNING'
  const shiftName = shifts.data?.find((s) => s.code === effectiveShift)?.name ?? effectiveShift

  const handleError = (e: unknown) => {
    if (isConflict(e)) {
      idem.reset()
      toast.error(e.message, { action: { label: 'Muat ulang', onClick: onReload } })
      onReload()
      onDone()
      return
    }
    if (!mapServerErrors(e, setError)) toast.error(getErrorMessage(e))
  }

  const onSubmit = handleSubmit((v) => {
    const checkInAt = v.checkIn ? combineDateTime(date, v.checkIn) : null
    const checkOutAt = v.checkOut ? combineDateTime(date, v.checkOut) : null
    const reason = v.reason || null
    const name = row.teacher.name
    if (!a) {
      record.mutate(
        {
          body: { teacherId: row.teacher.id, date, shiftCode: effectiveShift, status: v.status, reason, checkInAt, checkOutAt },
          idempotencyKey: idem.key(),
        },
        {
          onSuccess: () => {
            idem.reset()
            toast.success(`Status ${name} tersimpan sebagai ${TEACHER_ATTENDANCE_META[v.status].label}.`)
            onDone()
          },
          onError: handleError,
        },
      )
      return
    }
    update.mutate(
      {
        id: a.id,
        body: {
          status: v.status,
          reason,
          checkInAt,
          checkOutAt,
          correctionReason: v.correctionReason || null,
          version: a.version,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Kehadiran ${name} berhasil diperbarui.`)
          onDone()
        },
        onError: handleError,
      },
    )
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <UnsavedChangesGuard when={isDirty && !pending} />
      <DialogHeader>
        <DialogTitle>{a ? 'Ubah status kehadiran' : 'Catat status kehadiran'}</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{row.teacher.name}</span> · {formatDateLong(date)} · Shift{' '}
          {shiftName}
        </DialogDescription>
      </DialogHeader>

      {a?.source === 'SELF' && (
        <Alert variant="info">
          <Info />
          <AlertDescription>
            Guru ini sudah check-in mandiri. Perubahan status atau jam akan tercatat sebagai koreksi di log audit.
          </AlertDescription>
        </Alert>
      )}

      <FormField label="Status" required error={errors.status?.message}>
        <NativeSelect {...register('status')}>
          {enumOptions(TEACHER_ATTENDANCE_META).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>

      <FormField
        label="Alasan / keterangan"
        required={needsReason}
        error={errors.reason?.message}
        hint={needsReason ? 'Wajib untuk status ini sesuai kebijakan sekolah.' : 'Opsional.'}
      >
        <Textarea rows={2} placeholder="mis. Demam, surat dokter menyusul" {...register('reason')} />
      </FormField>

      {!isAbsent && (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Jam datang" required={status === 'LATE'} error={errors.checkIn?.message}>
            <Input type="time" {...register('checkIn')} />
          </FormField>
          <FormField label="Jam pulang" error={errors.checkOut?.message}>
            <Input type="time" {...register('checkOut')} />
          </FormField>
        </div>
      )}
      {isAbsent && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Jam mengajar terdampak dihitung otomatis dari jadwal ({row.scheduledPeriods} jam terjadwal). Koreksi dapat
          dilakukan setelah disimpan.
        </p>
      )}

      {a && (changedCore || errors.correctionReason) && (
        <FormField label="Alasan koreksi" required error={errors.correctionReason?.message}>
          <Textarea rows={2} placeholder="Jelaskan alasan perubahan status/jam…" {...register('correctionReason')} />
        </FormField>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </DialogFooter>
    </form>
  )
}
