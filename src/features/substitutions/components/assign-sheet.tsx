import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, RefreshCw, ShieldAlert, UserSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, ErrorState } from '@/components/page'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/misc'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { SubstitutionConflict, SubstitutionSlot } from '@/types/entities'
import { useSubstitutionAbilities } from '../hooks'
import { useCreateSubstitution, useSubstituteCandidates } from '../queries'
import { assignSchema, type AssignFormValues } from '../schemas'
import { conflictsFromError, periodLabel, rangeOf } from '../utils'
import { CandidateList, CandidateListSkeleton } from './candidate-list'
import { SlotSummary } from './slot-summary'

/**
 * Sheet "Tetapkan pengganti" (FR-SUB-02/03, PRD §7.5, AC-09).
 * Konflik jadwal kandidat diperlihatkan sebelum simpan; kandidat bentrok hanya dapat dipilih
 * dengan override berizin + alasan (PRD §9.3).
 */
export function AssignSheet({
  slot,
  onOpenChange,
}: {
  slot: SubstitutionSlot | null
  onOpenChange: (open: boolean) => void
}) {
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [pending, setPending] = useState(false)

  const requestClose = () => {
    if (pending) return
    if (dirty) setConfirmClose(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet open={!!slot} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <SheetContent
          side="right"
          className="w-full gap-0 sm:max-w-lg"
          aria-describedby="assign-desc"
        >
          <SheetHeader className="border-b pr-10">
            <SheetTitle>Tetapkan guru pengganti</SheetTitle>
            <SheetDescription id="assign-desc">
              Pilih guru yang tidak bentrok jadwal, tentukan jam yang ditangani, lalu catat
              kegiatannya.
            </SheetDescription>
          </SheetHeader>
          {slot && (
            <AssignForm
              key={slot.id}
              slot={slot}
              onDirtyChange={setDirty}
              onPendingChange={setPending}
              onDone={() => {
                setDirty(false)
                onOpenChange(false)
              }}
              onCancel={requestClose}
            />
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Buang isian?"
        description="Penetapan guru pengganti belum disimpan. Isian akan hilang bila ditutup."
        confirmLabel="Buang & tutup"
        cancelLabel="Lanjut mengisi"
        destructive
        onConfirm={() => {
          setConfirmClose(false)
          setDirty(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}

function AssignForm({
  slot,
  onDirtyChange,
  onPendingChange,
  onDone,
  onCancel,
}: {
  slot: SubstitutionSlot
  onDirtyChange: (dirty: boolean) => void
  onPendingChange: (pending: boolean) => void
  onDone: () => void
  onCancel: () => void
}) {
  const { canOverride } = useSubstitutionAbilities()
  const idem = useIdempotencyKey()
  const create = useCreateSubstitution()
  const [sameSubjectOnly, setSameSubjectOnly] = useState(false)
  const [serverConflicts, setServerConflicts] = useState<SubstitutionConflict[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const schema = useMemo(() => assignSchema(slot), [slot])
  const form = useForm<AssignFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      substituteTeacherId: '',
      periodStart: String(slot.periodStart),
      periodEnd: String(slot.periodEnd),
      periodCount: String(slot.periodCount),
      activity: '',
      note: '',
      overrideConflict: false,
      overrideReason: '',
    },
  })
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty, isSubmitting },
  } = form
  const [teacherId, psRaw, peRaw, override] = useWatch({
    control,
    name: ['substituteTeacherId', 'periodStart', 'periodEnd', 'overrideConflict'],
  })
  const ps = Number(psRaw)
  const pe = Number(peRaw)
  const span = ps <= pe ? pe - ps + 1 : 0

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange])
  const busy = isSubmitting || create.isPending
  useEffect(() => onPendingChange(busy), [busy, onPendingChange])

  const range = useMemo(
    () =>
      span > 0
        ? { periodStart: ps, periodEnd: pe }
        : { periodStart: slot.periodStart, periodEnd: slot.periodEnd },
    [ps, pe, span, slot.periodStart, slot.periodEnd],
  )
  const candidatesQ = useSubstituteCandidates(slot.id, range)
  const candidates = useMemo(
    () => (candidatesQ.data ?? []).filter((c) => !sameSubjectOnly || c.teachesSameSubject),
    [candidatesQ.data, sameSubjectOnly],
  )
  const selected = candidatesQ.data?.find((c) => c.teacher.id === teacherId) ?? null
  const selectedConflicts = selected?.conflicts.filter((c) => c.type === 'TEACHER_BUSY') ?? []
  const hasConflict = selectedConflicts.length > 0

  // Kandidat yang dipilih ternyata berhalangan (data terbaru) → kosongkan pilihan.
  useEffect(() => {
    if (selected?.conflicts.some((c) => c.type === 'TEACHER_ABSENT')) {
      setValue('substituteTeacherId', '', { shouldDirty: true })
    }
  }, [selected, setValue])

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    setServerConflicts([])
    if (hasConflict && !canOverride) {
      setError('substituteTeacherId', {
        type: 'conflict',
        message: 'Guru ini bentrok jadwal. Pilih guru lain yang tersedia.',
      })
      return
    }
    if (hasConflict && !v.overrideConflict) {
      setError('overrideConflict', {
        type: 'conflict',
        message: 'Centang override untuk tetap menetapkan guru yang bentrok, atau pilih guru lain.',
      })
      return
    }
    if (hasConflict && v.overrideReason.trim().length < 3) {
      setError('overrideReason', {
        type: 'required',
        message: 'Alasan override wajib diisi (minimal 3 karakter).',
      })
      return
    }
    try {
      const record = await create.mutateAsync({
        idempotencyKey: idem.key(),
        body: {
          date: slot.date,
          timetableSlotId: slot.timetableSlotId,
          substituteTeacherId: v.substituteTeacherId,
          periodStart: Number(v.periodStart),
          periodEnd: Number(v.periodEnd),
          periodCount: Number(v.periodCount),
          activity: v.activity.trim() || null,
          note: v.note.trim() || null,
          overrideConflict: hasConflict ? true : undefined,
          overrideReason: hasConflict ? v.overrideReason.trim() : undefined,
        },
      })
      idem.reset()
      onDirtyChange(false)
      form.reset(v)
      toast.success(
        `${record.substituteTeacherName} ditetapkan sebagai guru pengganti ${slot.className}.`,
      )
      onDone()
    } catch (e) {
      idem.reset()
      if (e instanceof ApiError && e.code === 'SCHEDULE_CONFLICT') {
        setServerConflicts(conflictsFromError(e))
        void candidatesQ.refetch()
        return
      }
      if (e instanceof ApiError && e.code === 'SLOT_ALREADY_HANDLED') {
        toast.info(e.message)
        onDirtyChange(false)
        onDone()
        return
      }
      const mapped = applyServerErrors(e, setError, [
        'substituteTeacherId',
        'periodStart',
        'periodEnd',
        'periodCount',
        'activity',
        'note',
        'overrideReason',
      ])
      setFormError(mapped ? null : getErrorMessage(e))
      if (e instanceof ApiError && e.status === 422) void candidatesQ.refetch()
    }
  })

  const periodOptions = rangeOf(slot.periodStart, slot.periodEnd)
  const errorTeacherId = 'assign-teacher-error'

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <UnsavedChangesGuard when={isDirty && !busy} />
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <SlotSummary slot={slot} />

        {formError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Gagal menyimpan</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {serverConflicts.length > 0 && (
          <Alert variant="destructive">
            <ShieldAlert />
            <AlertTitle>Jadwal guru pengganti bentrok</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {serverConflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
              <p>
                Daftar kandidat sudah diperbarui. Pilih guru lain atau ajukan override dengan
                alasan.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <fieldset className="grid grid-cols-3 gap-3" disabled={busy}>
          <legend className="sr-only">Jam yang ditangani</legend>
          <FormField label="Dari jam" error={errors.periodStart?.message}>
            <NativeSelect
              {...register('periodStart', {
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                  const nps = Number(e.target.value)
                  const npe = Math.max(nps, pe)
                  setValue('periodEnd', String(npe), { shouldDirty: true })
                  setValue('periodCount', String(npe - nps + 1), { shouldDirty: true })
                },
              })}
            >
              {periodOptions.map((n) => (
                <option key={n} value={n}>
                  Ke-{n}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Sampai jam" error={errors.periodEnd?.message}>
            <NativeSelect
              {...register('periodEnd', {
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                  const npe = Number(e.target.value)
                  setValue('periodCount', String(Math.max(1, npe - ps + 1)), { shouldDirty: true })
                },
              })}
            >
              {periodOptions.map((n) => (
                <option key={n} value={n} disabled={n < ps}>
                  Ke-{n}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Jumlah jam" required error={errors.periodCount?.message}>
            <NativeSelect {...register('periodCount')}>
              {rangeOf(1, Math.max(1, span)).map((n) => (
                <option key={n} value={n}>
                  {n} jam
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </fieldset>
        <p className="text-muted-foreground -mt-3 text-xs">
          Slot terdampak {periodLabel(slot.periodStart, slot.periodEnd).toLowerCase()} (
          {slot.periodCount} jam). Jumlah jam yang ditangani dipakai pada rekap jam digantikan.
        </p>

        <section className="space-y-3" aria-labelledby="candidates-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="candidates-heading" className="text-sm font-semibold">
              Guru pengganti <span className="text-destructive">*</span>
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="same-subject"
                  checked={sameSubjectOnly}
                  onCheckedChange={(c) => setSameSubjectOnly(c === true)}
                />
                <Label htmlFor="same-subject" className="text-xs font-normal">
                  Hanya mapel sama
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void candidatesQ.refetch()}
                disabled={candidatesQ.isFetching}
                aria-label="Muat ulang kandidat"
              >
                <RefreshCw className={candidatesQ.isFetching ? 'animate-spin' : undefined} />
              </Button>
            </div>
          </div>
          {errors.substituteTeacherId?.message && (
            <p id={errorTeacherId} role="alert" className="text-destructive text-xs font-medium">
              {errors.substituteTeacherId.message}
            </p>
          )}
          {candidatesQ.isPending ? (
            <CandidateListSkeleton />
          ) : candidatesQ.isError ? (
            <ErrorState error={candidatesQ.error} onRetry={() => void candidatesQ.refetch()} />
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={<UserSearch className="size-5" />}
              title={sameSubjectOnly ? 'Tidak ada guru dengan mapel sama' : 'Tidak ada kandidat'}
              description={
                sameSubjectOnly
                  ? 'Matikan filter "Hanya mapel sama" untuk melihat semua guru aktif.'
                  : 'Belum ada guru aktif lain yang dapat ditugaskan.'
              }
              action={
                sameSubjectOnly ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSameSubjectOnly(false)}
                  >
                    Tampilkan semua guru
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Controller
              control={control}
              name="substituteTeacherId"
              render={({ field }) => (
                <CandidateList
                  name="substituteTeacherId"
                  candidates={candidates}
                  selectedId={field.value}
                  invalid={!!errors.substituteTeacherId}
                  describedBy={errors.substituteTeacherId ? errorTeacherId : undefined}
                  onSelect={(id) => {
                    field.onChange(id)
                    clearErrors(['substituteTeacherId', 'overrideConflict', 'overrideReason'])
                    setServerConflicts([])
                    setValue('overrideConflict', false)
                    setValue('overrideReason', '')
                  }}
                />
              )}
            />
          )}
        </section>

        {hasConflict && selected && (
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <AlertTitle>{selected.teacher.name} bentrok jadwal</AlertTitle>
            <AlertDescription className="justify-items-stretch gap-3">
              <ul className="list-disc pl-4">
                {selectedConflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
              {canOverride ? (
                <>
                  <div className="grid gap-1">
                    <div className="flex items-start gap-2">
                      <Controller
                        control={control}
                        name="overrideConflict"
                        render={({ field }) => (
                          <Checkbox
                            id="override-conflict"
                            checked={field.value}
                            onCheckedChange={(c) => {
                              field.onChange(c === true)
                              clearErrors('overrideConflict')
                            }}
                            aria-invalid={!!errors.overrideConflict || undefined}
                            aria-describedby={
                              errors.overrideConflict ? 'override-error' : undefined
                            }
                            className="mt-0.5"
                          />
                        )}
                      />
                      <Label
                        htmlFor="override-conflict"
                        className="text-foreground text-[13px] leading-snug font-normal"
                      >
                        Tetap tetapkan guru ini (override konflik jadwal). Tindakan ini tercatat di
                        audit log.
                      </Label>
                    </div>
                    {errors.overrideConflict?.message && (
                      <p
                        id="override-error"
                        role="alert"
                        className="text-destructive text-xs font-medium"
                      >
                        {errors.overrideConflict.message}
                      </p>
                    )}
                  </div>
                  {override && (
                    <FormField
                      label="Alasan override"
                      required
                      error={errors.overrideReason?.message}
                    >
                      <Textarea
                        {...register('overrideReason')}
                        rows={2}
                        placeholder="Mis. kelas digabung di aula, guru mengawasi dua kelas bersebelahan"
                      />
                    </FormField>
                  )}
                </>
              ) : (
                <p>
                  Pilih guru lain yang tersedia. Override konflik hanya dapat dilakukan admin atau
                  guru piket.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <FormField
          label="Kegiatan / materi"
          hint="Mis. mengerjakan LKS bab 3 dari guru mapel, latihan soal, diskusi kelompok."
          error={errors.activity?.message}
        >
          <Textarea {...register('activity')} rows={2} disabled={busy} />
        </FormField>
        <FormField label="Catatan" error={errors.note?.message}>
          <Textarea {...register('note')} rows={2} disabled={busy} placeholder="Opsional" />
        </FormField>
      </div>

      <div className="bg-background flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || candidatesQ.isPending}>
          {busy
            ? 'Menyimpan…'
            : hasConflict && override
              ? 'Simpan dengan override'
              : 'Simpan pengganti'}
        </Button>
      </div>
    </form>
  )
}
