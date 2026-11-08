import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, BadgeCheck, Lock, RefreshCw, Repeat2, Save, Send } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField, NativeSelect } from '@/components/form-field'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle, Switch } from '@/components/ui/misc'
import { Textarea } from '@/components/ui/textarea'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useLookupMaps, usePeriods, useShifts, useSubjects } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { formatDateLong, formatDateTime, formatWallTime, todayISO } from '@/lib/date'
import { RECORD_STATUS_META, TEACHING_EXECUTION_META, TEACHING_PRESENCE_META } from '@/lib/enums'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import { TEACHING_EXECUTIONS, TEACHING_PRESENCES, type TeachingLog } from '@/types/entities'
import { periodLabel } from '../meta'
import { useApproveTeachingLog, useCreateTeachingLog, useUpdateTeachingLog } from '../queries'
import {
  SERVER_FIELDS,
  defaultFormValues,
  effectivePeriodCount,
  scheduledCount,
  teachingLogFormSchema,
  toPayload,
  type TeachingLogFormValues,
} from '../schemas'
import type { TeachingLogContext } from '../types'
import { ChoiceGroup } from './choice-group'

type Confirm = { kind: 'final' | 'correct' | 'approve'; values?: TeachingLogFormValues } | null

/**
 * Form jurnal mengajar (FR-TEACH-02..04, 06) — dipakai untuk membuat (dari slot / di luar jadwal)
 * maupun membuka jurnal yang sudah ada (edit draft, koreksi final, pengesahan, atau baca saja).
 */
export function TeachingLogForm({
  context,
  log,
  initialDate,
  onReload,
}: {
  /** Konteks dari slot jadwal; null = jurnal di luar jadwal (pilih kelas/mapel sendiri). */
  context: TeachingLogContext | null
  log: TeachingLog | null
  initialDate: string
  /** Muat ulang data jurnal (untuk konflik versi). */
  onReload?: () => void
}) {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const idem = useIdempotencyKey()
  const createMut = useCreateTeachingLog()
  const updateMut = useUpdateTeachingLog()
  const approveMut = useApproveTeachingLog()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [conflict, setConflict] = useState<ApiError | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingNav, setPendingNav] = useState<string | null>(null)

  const freeMode = context === null || context.timetableSlotId === null
  const isOwner = !log || (!!user?.teacherId && log.teacherId === user.teacherId)
  const canCorrect = can('teaching_log:correct')
  const isFinal = log?.status === 'FINAL'
  const isCorrection = isFinal && canCorrect
  const editable = log ? (isFinal ? canCorrect : isOwner || canCorrect) : can('teaching_log:write')
  const pending = createMut.isPending || updateMut.isPending

  const defaults = useMemo(
    () => defaultFormValues(context, log, { date: initialDate, freeMode }),
    [context, log, initialDate, freeMode],
  )
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<TeachingLogFormValues>({ resolver: zodResolver(teachingLogFormSchema), defaultValues: defaults })

  // Muat ulang nilai saat data server berubah (mis. setelah reload konflik).
  useEffect(() => reset(defaults), [defaults, reset])

  useEffect(() => {
    if (pendingNav) navigate(pendingNav, { replace: true })
  }, [pendingNav, navigate])

  const watched = useWatch({ control })
  const execution = watched.execution ?? 'HELD'
  const override = watched.overridePeriodCount ?? false
  const shiftCode = watched.shiftCode ?? ''
  const scheduled = scheduledCount({
    freeMode,
    periodStart: watched.periodStart ?? '',
    periodEnd: watched.periodEnd ?? '',
    scheduledPeriodCount: defaults.scheduledPeriodCount,
  })

  const fieldErr = (k: keyof TeachingLogFormValues) => errors[k]?.message

  /* ---------------------------------------------------------------- simpan */

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 409) {
      setConflict(e)
      return
    }
    if (e instanceof ApiError && e.status === 422) {
      const mapped = applyServerErrors(e, setError, SERVER_FIELDS)
      setFormError(mapped ? 'Periksa kembali isian yang ditandai.' : e.message)
      return
    }
    setFormError(getErrorMessage(e))
  }

  const save = async (values: TeachingLogFormValues, submit: boolean, correctionReason?: string) => {
    setFormError(null)
    setConflict(null)
    const payload = { ...toPayload(values, context), submit }
    try {
      const saved = log
        ? await updateMut.mutateAsync({
            id: log.id,
            body: { ...payload, version: log.version, correctionReason },
            idempotencyKey: idem.key(),
          })
        : await createMut.mutateAsync({ body: payload, idempotencyKey: idem.key() })
      idem.reset()
      setConfirm(null)
      toast.success(
        correctionReason
          ? 'Koreksi jurnal tersimpan dan tercatat di log audit.'
          : submit
            ? 'Jurnal difinalisasi.'
            : 'Draft jurnal tersimpan.',
      )
      reset(getValues())
      if (submit || correctionReason) {
        const back = saved.date === todayISO() ? '/jurnal-mengajar' : `/jurnal-mengajar?tanggal=${saved.date}`
        setPendingNav(isOwner ? back : `/jurnal-mengajar/${encodeURIComponent(saved.id)}`)
      } else if (!log) {
        setPendingNav(`/jurnal-mengajar/${encodeURIComponent(saved.id)}`)
      }
    } catch (e) {
      setConfirm(null)
      handleError(e)
    }
  }

  const onDraft = handleSubmit((v) => save(v, false))
  const onFinal = handleSubmit((v) => setConfirm({ kind: isCorrection ? 'correct' : 'final', values: v }))

  const approve = async () => {
    if (!log) return
    try {
      await approveMut.mutateAsync({ id: log.id, idempotencyKey: idem.key() })
      idem.reset()
      toast.success('Jurnal telah disahkan.')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setConflict(e)
    } finally {
      setConfirm(null)
    }
  }

  /* ---------------------------------------------------------------- render */

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void (isCorrection ? onFinal() : onDraft())
      }}
      className="grid gap-5"
      aria-label="Formulir jurnal mengajar"
    >
      <UnsavedChangesGuard when={isDirty && !pendingNav && editable} />

      <StatusStrip log={log} isCorrection={!!isCorrection} editable={editable} isOwner={isOwner} />

      {conflict && <ConflictAlert error={conflict} onReload={onReload} />}
      {formError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Jurnal belum tersimpan</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!editable || pending} className="grid min-w-0 gap-5">
        {/* Konteks pertemuan */}
        <Section title="Pertemuan" description={freeMode ? 'Jurnal di luar jadwal — pilih kelas dan jam secara manual.' : 'Diisi otomatis dari jadwal.'}>
          {freeMode ? (
            <FreeContextFields
              register={register}
              errors={errors}
              shiftCode={shiftCode}
              dateEditable={!log}
              onClassChange={(classShift) => classShift && setValue('shiftCode', classShift, { shouldDirty: true })}
            />
          ) : (
            context && <SlotContext ctx={context} />
          )}
        </Section>

        {/* Isi pembelajaran */}
        <Section title="Isi pembelajaran">
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <FormField label="Pertemuan ke-" error={fieldErr('meetingNumber')} hint="Opsional">
              <Input type="number" inputMode="numeric" min={1} {...register('meetingNumber')} />
            </FormField>
            <FormField label="Materi" required={execution === 'HELD'} error={fieldErr('topic')}>
              <Input placeholder="Mis. Persamaan linear dua variabel" autoComplete="off" {...register('topic')} />
            </FormField>
          </div>
          <FormField label="Kegiatan pembelajaran" error={fieldErr('activity')} hint="Metode/aktivitas, mis. ceramah, praktikum, diskusi kelompok.">
            <Textarea rows={3} {...register('activity')} />
          </FormField>
          <FormField label="Catatan" error={fieldErr('note')} hint="Opsional — kejadian penting, tindak lanjut, dsb.">
            <Textarea rows={2} {...register('note')} />
          </FormField>
        </Section>

        {/* Kehadiran & pelaksanaan */}
        <Section
          title="Kehadiran guru & pelaksanaan"
          description="Status kehadiran pada pertemuan ini — terpisah dari absensi harian guru."
        >
          <Controller
            control={control}
            name="teacherPresence"
            render={({ field }) => (
              <ChoiceGroup
                label="Status kehadiran guru"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                meta={TEACHING_PRESENCE_META}
                options={TEACHING_PRESENCES}
                disabled={!editable || pending}
                error={fieldErr('teacherPresence')}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="execution"
            render={({ field }) => (
              <ChoiceGroup
                label="Pelaksanaan"
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                meta={TEACHING_EXECUTION_META}
                options={TEACHING_EXECUTIONS}
                disabled={!editable || pending}
                error={fieldErr('execution')}
                required
              />
            )}
          />
          {execution === 'NOT_HELD' && (
            <FormField
              label="Alasan tidak terlaksana"
              required
              error={fieldErr('notHeldReason')}
              hint="Wajib — jurnal tidak boleh mengklaim pertemuan terlaksana bila dibatalkan."
            >
              <Textarea rows={2} placeholder="Mis. kelas mengikuti upacara/kegiatan sekolah" {...register('notHeldReason')} />
            </FormField>
          )}
        </Section>

        {/* Jumlah siswa & JML */}
        <Section title="Rekap siswa & jumlah jam" description="S/I/A siswa pada pertemuan ini dan jumlah jam pelajaran (JML).">
          <div className="grid grid-cols-3 gap-3 sm:max-w-md">
            <FormField label="Sakit (S)" error={fieldErr('studentSick')}>
              <Input type="number" inputMode="numeric" min={0} className="tabular-nums" {...register('studentSick')} />
            </FormField>
            <FormField label="Izin (I)" error={fieldErr('studentPermission')}>
              <Input type="number" inputMode="numeric" min={0} className="tabular-nums" {...register('studentPermission')} />
            </FormField>
            <FormField label="Alpa (A)" error={fieldErr('studentAbsent')}>
              <Input type="number" inputMode="numeric" min={0} className="tabular-nums" {...register('studentAbsent')} />
            </FormField>
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  JML: <span className="text-lg font-bold tabular-nums">{effectivePeriodCount(getValuesSafe(watched, defaults))}</span> jam
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Menurut jadwal: {scheduled} jam pelajaran
                </p>
              </div>
              <Controller
                control={control}
                name="overridePeriodCount"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Switch
                      checked={field.value}
                      onCheckedChange={(c) => {
                        field.onChange(c)
                        if (!c) setValue('periodCount', String(scheduled), { shouldDirty: true })
                      }}
                      disabled={!editable || pending}
                      aria-label="Koreksi JML"
                    />
                    Koreksi
                  </label>
                )}
              />
            </div>
            {override && (
              <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                <FormField label="JML koreksi" required error={fieldErr('periodCount')}>
                  <Input type="number" inputMode="numeric" min={0} className="tabular-nums" {...register('periodCount')} />
                </FormField>
                <FormField label="Alasan koreksi JML" required error={fieldErr('periodCountOverrideReason')}>
                  <Input placeholder="Mis. 1 jam dipakai untuk kegiatan sekolah" {...register('periodCountOverrideReason')} />
                </FormField>
              </div>
            )}
          </div>
        </Section>
      </fieldset>

      {/* Bar aksi — menempel di bawah pada ponsel, di atas navigasi bawah */}
      <div className="no-print sticky bottom-16 z-10 -mx-3 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4 sm:shadow-xs md:bottom-0">
        <Button type="button" variant="ghost" asChild className="mr-auto">
          <Link to="/jurnal-mengajar">Kembali</Link>
        </Button>
        {log && isFinal && canCorrect && !log.approvedAt && (
          <Button type="button" variant="outline" onClick={() => setConfirm({ kind: 'approve' })} disabled={approveMut.isPending}>
            <BadgeCheck /> {approveMut.isPending ? 'Memproses…' : 'Sahkan'}
          </Button>
        )}
        {editable && !isFinal && (
          <>
            <Button type="button" variant="outline" onClick={() => void onDraft()} disabled={pending}>
              <Save /> {updateMut.isPending || createMut.isPending ? 'Menyimpan…' : 'Simpan Draft'}
            </Button>
            <Button type="button" onClick={() => void onFinal()} disabled={pending}>
              <Send /> Simpan &amp; Finalisasi
            </Button>
          </>
        )}
        {editable && isFinal && (
          <Button type="button" onClick={() => void onFinal()} disabled={pending || !isDirty}>
            <Save /> {pending ? 'Menyimpan…' : 'Simpan Koreksi'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm?.kind === 'final'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Finalisasi jurnal?"
        description="Jurnal final masuk ke rekap dan laporan. Setelah final, perubahan hanya dapat dilakukan pimpinan/admin dengan alasan."
        confirmLabel="Finalisasi"
        pending={pending}
        onConfirm={() => (confirm?.values ? save(confirm.values, true) : undefined)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'correct'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Koreksi jurnal final"
        description="Perubahan pada jurnal final dicatat di log audit beserta nilai sebelum/sesudah dan alasan Anda."
        confirmLabel="Simpan koreksi"
        requireReason
        reasonLabel="Alasan koreksi"
        pending={pending}
        onConfirm={(reason) => (confirm?.values ? save(confirm.values, false, reason) : undefined)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'approve'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Sahkan jurnal ini?"
        description="Nama Anda dan waktu pengesahan akan tersimpan pada jurnal."
        confirmLabel="Sahkan"
        pending={approveMut.isPending}
        onConfirm={approve}
      />
    </form>
  )
}

/** useWatch mengembalikan DeepPartial; lengkapi dengan default agar perhitungan aman. */
function getValuesSafe(w: Partial<TeachingLogFormValues>, d: TeachingLogFormValues): TeachingLogFormValues {
  return { ...d, ...w } as TeachingLogFormValues
}

/* ------------------------------------------------------------------ bagian */

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="space-y-0.5">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function SlotContext({ ctx }: { ctx: TeachingLogContext }) {
  const { shiftName } = useLookupMaps()
  const items: [string, ReactNode][] = [
    ['Tanggal', formatDateLong(ctx.date)],
    ['Shift', shiftName(ctx.shiftCode)],
    ['Kelas', ctx.className],
    ['Mata pelajaran', ctx.subjectName],
    [
      'Jam',
      <span key="j" className="tabular-nums">
        {periodLabel(ctx.periodStart, ctx.periodEnd)}
        {ctx.startTime && ` · ${formatWallTime(ctx.startTime)}–${formatWallTime(ctx.endTime)}`}
      </span>,
    ],
  ]
  return (
    <div className="grid gap-3">
      {ctx.isSubstitution && (
        <ToneBadge tone="info">
          <Repeat2 className="size-3" aria-hidden /> Pengganti — Anda menggantikan guru yang berhalangan
        </ToneBadge>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {items.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-medium break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function FreeContextFields({
  register,
  errors,
  shiftCode,
  dateEditable,
  onClassChange,
}: {
  register: ReturnType<typeof useForm<TeachingLogFormValues>>['register']
  errors: ReturnType<typeof useForm<TeachingLogFormValues>>['formState']['errors']
  shiftCode: string
  dateEditable: boolean
  onClassChange: (shiftCode: string | undefined) => void
}) {
  const classes = useClasses({ scope: 'mine' })
  const subjects = useSubjects()
  const shifts = useShifts()
  const periods = usePeriods()
  const shiftPeriods = (periods.data ?? []).filter((p) => p.shiftCode === shiftCode)
  const classReg = register('classId')
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FormField label="Tanggal" required error={errors.date?.message}>
        <Input type="date" max={todayISO()} readOnly={!dateEditable} {...register('date')} />
      </FormField>
      <FormField label="Kelas" required error={errors.classId?.message}>
        <NativeSelect
          {...classReg}
          onChange={(e) => {
            void classReg.onChange(e)
            onClassChange(classes.data?.find((c) => c.id === e.target.value)?.shiftCode)
          }}
        >
          <option value="">{classes.isPending ? 'Memuat…' : 'Pilih kelas'}</option>
          {(classes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Mata pelajaran" required error={errors.subjectId?.message}>
        <NativeSelect {...register('subjectId')}>
          <option value="">{subjects.isPending ? 'Memuat…' : 'Pilih mapel'}</option>
          {(subjects.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Shift" required error={errors.shiftCode?.message}>
        <NativeSelect {...register('shiftCode')}>
          <option value="">Pilih shift</option>
          {(shifts.data ?? []).map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Jam ke- (mulai)" required error={errors.periodStart?.message}>
        <NativeSelect {...register('periodStart')} disabled={!shiftCode}>
          <option value="">{shiftCode ? 'Pilih' : 'Pilih shift dulu'}</option>
          {shiftPeriods.map((p) => (
            <option key={p.id} value={String(p.number)}>
              {p.number} · {formatWallTime(p.startTime)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Jam ke- (selesai)" required error={errors.periodEnd?.message}>
        <NativeSelect {...register('periodEnd')} disabled={!shiftCode}>
          <option value="">{shiftCode ? 'Pilih' : 'Pilih shift dulu'}</option>
          {shiftPeriods.map((p) => (
            <option key={p.id} value={String(p.number)}>
              {p.number} · s.d. {formatWallTime(p.endTime)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
    </div>
  )
}

function StatusStrip({
  log,
  isCorrection,
  editable,
  isOwner,
}: {
  log: TeachingLog | null
  isCorrection: boolean
  editable: boolean
  isOwner: boolean
}) {
  if (!log) return null
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge meta={RECORD_STATUS_META} value={log.status} />
        {log.approvedAt && (
          <ToneBadge tone="success">
            <BadgeCheck className="size-3" aria-hidden /> Disahkan
          </ToneBadge>
        )}
        <span className="text-muted-foreground">
          {log.teacherName}
          {log.submittedAt && ` · Final ${formatDateTime(log.submittedAt)}`}
          {log.approvedAt && ` · Disahkan oleh ${log.approvedByName ?? '—'} (${formatDateTime(log.approvedAt)})`}
        </span>
      </div>
      {isCorrection && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Mode koreksi</AlertTitle>
          <AlertDescription>Jurnal ini sudah final. Perubahan wajib disertai alasan dan tercatat di log audit.</AlertDescription>
        </Alert>
      )}
      {!editable && (
        <Alert variant="info">
          <Lock />
          <AlertTitle>Hanya baca</AlertTitle>
          <AlertDescription>
            {log.status === 'FINAL' && isOwner
              ? 'Jurnal sudah final. Hubungi pimpinan/admin bila perlu koreksi.'
              : 'Anda dapat melihat jurnal ini tetapi tidak dapat mengubahnya.'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function ConflictAlert({ error, onReload }: { error: ApiError; onReload?: () => void }) {
  const existingId = error.details.existingId
  return (
    <Alert variant="warning">
      <AlertTriangle />
      <AlertTitle>{existingId ? 'Jurnal sudah ada' : 'Data berubah'}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {existingId ? (
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link to={`/jurnal-mengajar/${encodeURIComponent(existingId)}`}>Buka jurnal yang ada</Link>
          </Button>
        ) : (
          onReload && (
            <Button type="button" size="sm" variant="outline" className="mt-1" onClick={onReload}>
              <RefreshCw /> Muat ulang
            </Button>
          )
        )}
      </AlertDescription>
    </Alert>
  )
}
