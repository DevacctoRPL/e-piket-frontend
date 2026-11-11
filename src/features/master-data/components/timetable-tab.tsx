import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, CircleAlert, LayoutGrid, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, useFilters } from '@/components/filter-bar'
import { FormField, NativeSelect } from '@/components/form-field'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { SegmentedControl } from '@/components/segmented-control'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { dayName, formatWallTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Period, TimetableSlot } from '@/types/entities'
import { useClasses, useLookupMaps, usePeriods, useShifts, useTeachers, useTimetable, useSubjects } from '../lookups'
import { useMasterMutations } from '../queries'
import { timetableSchema, type TimetableForm } from '../schemas'
import {
  AddButton,
  DeleteDialog,
  MobileCard,
  RowActions,
  TabToolbar,
  mapMutationError,
  useCrudState,
  useSubmitKey,
  type FormError,
} from './crud-kit'
import { FormDialog } from './form-dialog'
import { DayTabs, periodRangeLabel, slotTimeLabel } from './schedule-shared'

type SlotDraft = Partial<Pick<TimetableSlot, 'dayOfWeek' | 'shiftCode' | 'classId' | 'periodStart' | 'periodEnd'>>
type DialogTarget = { slot: TimetableSlot } | { draft: SlotDraft }

export function TimetableTab() {
  const shifts = useShifts()
  const classes = useClasses()
  const periods = usePeriods()
  const lookups = useLookupMaps()
  const crud = useCrudState<TimetableSlot>()
  const { askDelete } = crud
  const { remove } = useMasterMutations('timetables')
  const [target, setTarget] = useState<DialogTarget | null>(null)
  const filters = useFilters({ day: '1', tclass: '', tshift: '', view: 'list' })
  const dayOfWeek = Number(filters.values.day) || 1
  const view = filters.values.view === 'grid' ? 'grid' : 'list'

  const slots = useTimetable({
    dayOfWeek,
    classId: filters.values.tclass || undefined,
    shiftCode: filters.values.tshift || undefined,
  })

  const shiftClasses = useMemo(
    () => (classes.data ?? []).filter((c) => !filters.values.tshift || c.shiftCode === filters.values.tshift),
    [classes.data, filters.values.tshift],
  )

  const openCreate = (draft: SlotDraft = {}) =>
    setTarget({
      draft: {
        dayOfWeek,
        classId: filters.values.tclass || undefined,
        shiftCode:
          filters.values.tshift ||
          classes.data?.find((c) => c.id === filters.values.tclass)?.shiftCode ||
          undefined,
        ...draft,
      },
    })

  const columns = useMemo<ColumnDef<TimetableSlot>[]>(
    () => [
      {
        id: 'period',
        header: 'Jam',
        accessorFn: (s) => `${s.shiftCode}-${String(s.periodStart).padStart(2, '0')}`,
        cell: ({ row }) => (
          <div className="grid">
            <span className="font-semibold tabular-nums">{periodRangeLabel(row.original)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{slotTimeLabel(row.original, periods.data)}</span>
          </div>
        ),
      },
      { id: 'shift', header: 'Shift', accessorFn: (s) => lookups.shiftName(s.shiftCode) },
      { id: 'class', header: 'Kelas', accessorFn: (s) => lookups.classById.get(s.classId)?.name ?? '—' },
      { id: 'subject', header: 'Mata Pelajaran', accessorFn: (s) => lookups.subjectById.get(s.subjectId)?.name ?? '—' },
      { id: 'teacher', header: 'Guru', accessorFn: (s) => lookups.teacherById.get(s.teacherId)?.name ?? '—' },
      { accessorKey: 'periodCount', header: 'JML', cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-12', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions
            label={`jadwal ${lookups.subjectById.get(row.original.subjectId)?.name ?? ''} ${periodRangeLabel(row.original)}`}
            onEdit={() => setTarget({ slot: row.original })}
            onDelete={() => askDelete(row.original)}
          />
        ),
      },
    ],
    [lookups, periods.data, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Susun jadwal per hari untuk semester aktif. Sistem menolak guru atau kelas yang dijadwalkan ganda pada jam yang beririsan."
        actions={<AddButton onClick={() => openCreate()}>Tambah Slot</AddButton>}
      />
      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <FilterSelect
          label="Shift"
          value={filters.values.tshift}
          onChange={(tshift) => filters.set({ tshift, tclass: '' })}
          allLabel="Semua shift"
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
        />
        <FilterSelect
          label="Kelas"
          value={filters.values.tclass}
          onChange={(tclass) => filters.set({ tclass })}
          allLabel="Semua kelas"
          options={shiftClasses.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SegmentedControl
          ariaLabel="Tampilan jadwal"
          value={view}
          onChange={(v) => filters.set({ view: v })}
          options={[
            {
              value: 'list',
              label: (
                <>
                  <List aria-hidden className="size-3.5" /> Daftar
                </>
              ),
            },
            {
              value: 'grid',
              label: (
                <>
                  <LayoutGrid aria-hidden className="size-3.5" /> Grid
                </>
              ),
            },
          ]}
        />
      </FilterBar>

      <DayTabs value={dayOfWeek} onChange={(d) => filters.set({ day: String(d) })} />

      {slots.isPending ? (
        <TableSkeleton rows={8} cols={6} />
      ) : slots.isError ? (
        <ErrorState error={slots.error} onRetry={() => void slots.refetch()} />
      ) : view === 'grid' ? (
        <TimetableGrid
          slots={slots.data}
          classes={shiftClasses.filter((c) => !filters.values.tclass || c.id === filters.values.tclass)}
          periods={periods.data ?? []}
          onEdit={(slot) => setTarget({ slot })}
          onAdd={(classId, shiftCode, n) => openCreate({ classId, shiftCode, periodStart: n, periodEnd: n })}
        />
      ) : (
        <DataTable
          columns={columns}
          data={slots.data}
          getRowId={(r) => r.id}
          caption={`Jadwal hari ${dayName(dayOfWeek)}`}
          pageSize={50}
          emptyState={
            <EmptyState
              icon={<CalendarClock className="size-5" />}
              title={`Belum ada jadwal hari ${dayName(dayOfWeek)}`}
              description="Tambahkan slot jadwal: pilih kelas, mata pelajaran, guru, dan rentang jam ke-."
              action={<AddButton onClick={() => openCreate()}>Tambah Slot</AddButton>}
            />
          }
          renderMobileCard={(s) => (
            <MobileCard
              title={`${periodRangeLabel(s)} · ${lookups.classById.get(s.classId)?.name ?? '—'}`}
              lines={[
                lookups.subjectById.get(s.subjectId)?.name ?? '—',
                lookups.teacherById.get(s.teacherId)?.name ?? '—',
                `${slotTimeLabel(s, periods.data)} · ${s.periodCount} jam`,
              ]}
              actions={
                <RowActions label={`jadwal ${periodRangeLabel(s)}`} onEdit={() => setTarget({ slot: s })} onDelete={() => crud.askDelete(s)} />
              }
            />
          )}
        />
      )}

      {target && (
        <TimetableDialog
          key={'slot' in target ? target.slot.id : 'new'}
          slot={'slot' in target ? target.slot : null}
          draft={'draft' in target ? target.draft : {}}
          onClose={() => setTarget(null)}
          onRequestDelete={(s) => {
            setTarget(null)
            crud.askDelete(s)
          }}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus slot jadwal?"
        description={
          crud.toDelete && (
            <>
              <strong>
                {lookups.subjectById.get(crud.toDelete.subjectId)?.name} — {lookups.classById.get(crud.toDelete.classId)?.name}
              </strong>{' '}
              ({dayName(crud.toDelete.dayOfWeek)}, {periodRangeLabel(crud.toDelete)}) akan dihapus. Jurnal dan absensi yang sudah
              tercatat tidak terpengaruh.
            </>
          )
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Slot jadwal dihapus.')
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ grid */

function TimetableGrid({
  slots,
  classes,
  periods,
  onEdit,
  onAdd,
}: {
  slots: TimetableSlot[]
  classes: { id: string; name: string; shiftCode: string }[]
  periods: Period[]
  onEdit: (slot: TimetableSlot) => void
  onAdd: (classId: string, shiftCode: string, periodNumber: number) => void
}) {
  const lookups = useLookupMaps()
  const byShift = useMemo(() => {
    const groups = new Map<string, typeof classes>()
    for (const c of classes) groups.set(c.shiftCode, [...(groups.get(c.shiftCode) ?? []), c])
    return [...groups.entries()]
  }, [classes])

  if (classes.length === 0) {
    return <EmptyState title="Tidak ada kelas" description="Pilih shift lain atau tambahkan kelas terlebih dahulu." />
  }

  return (
    <div className="grid gap-4">
      {byShift.map(([shiftCode, shiftClasses]) => {
        const ps = periods.filter((p) => p.shiftCode === shiftCode).sort((a, b) => a.number - b.number)
        return (
          <FramedCard
            key={shiftCode}
            headingLevel="h3"
            icon={<CalendarClock />}
            title={`Shift ${lookups.shiftName(shiftCode)}`}
            titleBadge={<CountChip>{shiftClasses.length}</CountChip>}
            bodyClassName="p-0 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <caption className="sr-only">Grid jadwal shift {lookups.shiftName(shiftCode)}</caption>
                <thead>
                  <tr className="bg-muted/55">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 w-24 border-b border-border/70 bg-muted px-2.5 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      Jam
                    </th>
                    {shiftClasses.map((c) => (
                      <th
                        key={c.id}
                        scope="col"
                        className="border-b border-l border-border/70 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ps.map((p) => (
                    <tr key={p.id}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-border/60 bg-card px-2.5 py-1.5 text-left align-top font-normal"
                      >
                        <span className="block text-[13px] font-medium tabular-nums">Ke-{p.number}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatWallTime(p.startTime)}–{formatWallTime(p.endTime)}
                        </span>
                      </th>
                      {shiftClasses.map((c) => {
                        const slot = slots.find(
                          (s) => s.classId === c.id && s.periodStart <= p.number && s.periodEnd >= p.number,
                        )
                        if (slot && slot.periodStart !== p.number) return null // tercakup rowSpan
                        if (slot) {
                          return (
                            <td key={c.id} rowSpan={slot.periodCount} className="border-b border-l border-border/60 p-1 align-top">
                              <button
                                type="button"
                                onClick={() => onEdit(slot)}
                                className="flex h-full min-h-12 w-full flex-col items-start gap-0.5 rounded-md border border-border/80 bg-card p-2 text-left shadow-2xs transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                              >
                                <span className="text-[13px] font-medium">{lookups.subjectById.get(slot.subjectId)?.name ?? '—'}</span>
                                <span className="text-xs text-muted-foreground">{lookups.teacherById.get(slot.teacherId)?.name ?? '—'}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{slot.periodCount} jam</span>
                              </button>
                            </td>
                          )
                        }
                        return (
                          <td key={c.id} className="border-b border-l border-border/60 p-1">
                            <button
                              type="button"
                              onClick={() => onAdd(c.id, shiftCode, p.number)}
                              aria-label={`Tambah jadwal ${c.name} jam ke-${p.number}`}
                              className={cn(
                                'flex min-h-12 w-full items-center justify-center rounded-md text-muted-foreground/0 transition-colors',
                                'hover:bg-accent hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                              )}
                            >
                              <Plus className="size-4" />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FramedCard>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ dialog */

const FIELDS = ['dayOfWeek', 'shiftCode', 'classId', 'subjectId', 'teacherId', 'periodStart', 'periodEnd'] as const

function TimetableDialog({
  slot,
  draft,
  onClose,
  onRequestDelete,
}: {
  slot: TimetableSlot | null
  draft: SlotDraft
  onClose: () => void
  onRequestDelete?: (slot: TimetableSlot) => void
}) {
  const { create, update } = useMasterMutations('timetables')
  const shifts = useShifts()
  const classes = useClasses()
  const subjects = useSubjects()
  const teachers = useTeachers()
  const periods = usePeriods()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const form = useForm<TimetableForm>({
    resolver: zodResolver(timetableSchema),
    defaultValues: {
      dayOfWeek: slot?.dayOfWeek ?? draft.dayOfWeek ?? 1,
      shiftCode: slot?.shiftCode ?? draft.shiftCode ?? shifts.data?.[0]?.code ?? '',
      classId: slot?.classId ?? draft.classId ?? '',
      subjectId: slot?.subjectId ?? '',
      teacherId: slot?.teacherId ?? '',
      periodStart: slot?.periodStart ?? draft.periodStart ?? 1,
      periodEnd: slot?.periodEnd ?? draft.periodEnd ?? draft.periodStart ?? 2,
    },
  })
  const { register, handleSubmit, setError, watch, setValue, formState } = form
  const { errors, isDirty, isSubmitting } = formState
  const [shiftCode, subjectId, periodStart, periodEnd] = watch(['shiftCode', 'subjectId', 'periodStart', 'periodEnd'])

  const shiftPeriods = (periods.data ?? []).filter((p) => p.shiftCode === shiftCode).sort((a, b) => a.number - b.number)
  const shiftClasses = (classes.data ?? []).filter((c) => c.shiftCode === shiftCode && c.status === 'ACTIVE')
  const activeTeachers = (teachers.data ?? []).filter((t) => t.status === 'ACTIVE')
  // Guru pengampu mapel didahulukan agar pemilihan cepat; guru lain tetap dapat dipilih.
  const qualified = activeTeachers.filter((t) => subjectId && t.subjectIds.includes(subjectId))
  const others = activeTeachers.filter((t) => !qualified.includes(t))
  const count = Number.isFinite(periodStart) && Number.isFinite(periodEnd) && periodEnd >= periodStart ? periodEnd - periodStart + 1 : null

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    setConflicts([])
    try {
      if (slot) await update.mutateAsync({ id: slot.id, body: v })
      else await create.mutateAsync({ body: v, idempotencyKey: submitKey(v) })
      toast.success(slot ? 'Slot jadwal diperbarui.' : 'Slot jadwal ditambahkan.')
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SCHEDULE_CONFLICT') {
        const list = Object.entries(e.details)
          .filter(([k]) => k.startsWith('conflicts.'))
          .map(([, msg]) => msg)
        setConflicts(list.length ? list : [e.message])
        if (e.details.teacherId) setError('teacherId', { type: 'server', message: 'Guru bentrok pada jam ini.' })
        if (e.details.classId) setError('classId', { type: 'server', message: 'Kelas sudah terisi pada jam ini.' })
        return
      }
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={slot ? 'Ubah Slot Jadwal' : 'Tambah Slot Jadwal'}
      description="Jumlah jam (JML) dihitung otomatis dari rentang jam ke-."
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={
        conflicts.length
          ? {
              title: 'Jadwal bentrok',
              message: (
                <ul className="list-disc space-y-0.5 pl-4">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ),
            }
          : formError
      }
      wide
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Hari" required error={errors.dayOfWeek?.message}>
          <NativeSelect {...register('dayOfWeek', { valueAsNumber: true })}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <option key={d} value={d}>
                {dayName(d)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Shift" required error={errors.shiftCode?.message}>
          <NativeSelect
            {...register('shiftCode', {
              onChange: () => setValue('classId', '', { shouldDirty: true }),
            })}
          >
            {(shifts.data ?? []).map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Kelas" required error={errors.classId?.message}>
          <NativeSelect {...register('classId')}>
            <option value="">Pilih kelas</option>
            {shiftClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mata pelajaran" required error={errors.subjectId?.message}>
          <NativeSelect {...register('subjectId')}>
            <option value="">Pilih mapel</option>
            {(subjects.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Guru" required error={errors.teacherId?.message}>
          <NativeSelect {...register('teacherId')}>
            <option value="">Pilih guru</option>
            {qualified.length > 0 && (
              <optgroup label="Pengampu mapel ini">
                {qualified.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={qualified.length ? 'Guru lain' : 'Semua guru'}>
              {others.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </NativeSelect>
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <FormField label="Dari jam ke-" required error={errors.periodStart?.message}>
          <NativeSelect {...register('periodStart', { valueAsNumber: true })}>
            {shiftPeriods.map((p) => (
              <option key={p.id} value={p.number}>
                {p.number} ({formatWallTime(p.startTime)})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Sampai jam ke-" required error={errors.periodEnd?.message}>
          <NativeSelect {...register('periodEnd', { valueAsNumber: true })}>
            {shiftPeriods.map((p) => (
              <option key={p.id} value={p.number}>
                {p.number} ({formatWallTime(p.endTime)})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="col-span-2 grid content-end gap-1 sm:col-span-1">
          <span className="text-sm font-medium">Jumlah jam (JML)</span>
          <span className="flex h-8 items-center rounded-md border border-input bg-muted/50 px-2.5 text-[13px] font-semibold tabular-nums" aria-live="polite">
            {count ?? '—'}
          </span>
        </div>
      </div>
      {shiftPeriods.length === 0 && (
        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CircleAlert aria-hidden className="size-3.5 shrink-0 text-tone-warning" />
          Shift ini belum memiliki periode jam. Tambahkan di tab Periode Jam.
        </p>
      )}
      {slot && onRequestDelete && (
        <div className="flex justify-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={isSubmitting}
            onClick={() => onRequestDelete(slot)}
          >
            Hapus slot ini…
          </Button>
        </div>
      )}
    </FormDialog>
  )
}
