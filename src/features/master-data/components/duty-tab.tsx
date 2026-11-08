import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarCheck, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { dayName, formatDateLong, isoDayOfWeek, todayISO } from '@/lib/date'
import type { DutyAssignment } from '@/types/entities'
import { useDutyAssignments, useLookupMaps, useShifts, useTeachers } from '../lookups'
import { useMasterMutations } from '../queries'
import { dutySchema, type DutyForm } from '../schemas'
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
import { MultiCheckList } from './multi-check-list'
import { DAYS } from './schedule-shared'

type Target = { item: DutyAssignment } | { draft: Partial<DutyAssignment> }

export function DutyTab() {
  const routine = useDutyAssignments({ type: 'routine' })
  const today = todayISO()
  const overrides = useDutyAssignments({ type: 'override', dateFrom: today })
  const shifts = useShifts()
  const lookups = useLookupMaps()
  const crud = useCrudState<DutyAssignment>()
  const { askDelete } = crud
  const { remove } = useMasterMutations('dutyAssignments')
  const [target, setTarget] = useState<Target | null>(null)

  const teacherNames = (ids: string[]) => ids.map((id) => lookups.teacherById.get(id)?.name ?? '—')
  const activeShifts = (shifts.data ?? []).filter((s) => s.isActive)
  const todayDow = isoDayOfWeek(today)

  const overrideColumns = useMemo<ColumnDef<DutyAssignment>[]>(
    () => [
      { accessorKey: 'date', header: 'Tanggal', cell: ({ row }) => <span className="font-medium">{row.original.date ? formatDateLong(row.original.date) : '—'}</span> },
      { accessorKey: 'shiftCode', header: 'Shift', cell: ({ row }) => lookups.shiftName(row.original.shiftCode) },
      {
        id: 'teachers',
        header: 'Petugas',
        enableSorting: false,
        cell: ({ row }) => row.original.teacherIds.map((id) => lookups.teacherById.get(id)?.name ?? '—').join(', '),
      },
      { accessorKey: 'note', header: 'Catatan', enableSorting: false, cell: ({ getValue }) => getValue<string | null>() ?? '—' },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-24', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions
            label={`piket ${row.original.date ?? ''}`}
            onEdit={() => setTarget({ item: row.original })}
            onDelete={() => askDelete(row.original)}
          />
        ),
      },
    ],
    [lookups, askDelete],
  )

  return (
    <div className="grid gap-5">
      <TabToolbar
        description="Jadwal piket rutin per hari dan shift. Penugasan tanggal khusus menggantikan jadwal rutin pada tanggal tersebut. Semua perubahan tercatat di log audit."
        actions={
          <AddButton onClick={() => setTarget({ draft: { date: today, dayOfWeek: null } })}>Penugasan Tanggal Khusus</AddButton>
        }
      />

      <section className="grid gap-3" aria-labelledby="duty-routine">
        <h3 id="duty-routine" className="text-base font-semibold">
          Piket rutin mingguan
        </h3>
        {routine.isPending || shifts.isPending ? (
          <TableSkeleton rows={7} cols={3} />
        ) : routine.isError ? (
          <ErrorState error={routine.error} onRetry={() => void routine.refetch()} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {DAYS.map((d) => (
              <div key={d} className="grid gap-2 rounded-xl border bg-card p-3 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{dayName(d)}</span>
                  {d === todayDow && <ToneBadge tone="info">Hari ini</ToneBadge>}
                </div>
                {activeShifts.map((sh) => {
                  const a = routine.data.find((x) => x.dayOfWeek === d && x.shiftCode === sh.code)
                  return (
                    <div key={sh.code} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">{sh.name}</p>
                        {a ? (
                          <ul className="text-sm">
                            {teacherNames(a.teacherIds).map((n, i) => (
                              <li key={i} className="truncate">
                                {n}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-tone-warning">Belum ada petugas</p>
                        )}
                      </div>
                      {a ? (
                        <RowActions
                          label={`piket ${dayName(d)} ${sh.name}`}
                          onEdit={() => setTarget({ item: a })}
                          onDelete={() => crud.askDelete(a)}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTarget({ draft: { dayOfWeek: d, date: null, shiftCode: sh.code } })}
                          aria-label={`Atur piket ${dayName(d)} ${sh.name}`}
                        >
                          Atur
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="duty-override">
        <h3 id="duty-override" className="text-base font-semibold">
          Penugasan tanggal khusus (mendatang)
        </h3>
        {overrides.isPending ? (
          <TableSkeleton rows={3} cols={4} />
        ) : overrides.isError ? (
          <ErrorState error={overrides.error} onRetry={() => void overrides.refetch()} />
        ) : (
          <DataTable
            columns={overrideColumns}
            data={overrides.data}
            getRowId={(r) => r.id}
            caption="Penugasan piket tanggal khusus"
            emptyState={
              <EmptyState
                icon={<CalendarCheck className="size-5" />}
                title="Tidak ada penugasan tanggal khusus"
                description="Gunakan penugasan tanggal khusus untuk tukar jadwal, pengganti petugas yang berhalangan, atau acara sekolah."
                action={
                  <AddButton onClick={() => setTarget({ draft: { date: today, dayOfWeek: null } })}>Penugasan Tanggal Khusus</AddButton>
                }
              />
            }
            renderMobileCard={(a) => (
              <MobileCard
                title={a.date ? formatDateLong(a.date) : '—'}
                badge={<ToneBadge tone="purple">{lookups.shiftName(a.shiftCode)}</ToneBadge>}
                lines={[teacherNames(a.teacherIds).join(', '), a.note]}
                actions={<RowActions label={`piket ${a.date ?? ''}`} onEdit={() => setTarget({ item: a })} onDelete={() => crud.askDelete(a)} />}
              />
            )}
          />
        )}
      </section>

      {target && (
        <DutyDialog
          key={'item' in target ? target.item.id : 'new'}
          item={'item' in target ? target.item : null}
          draft={'draft' in target ? target.draft : {}}
          onClose={() => setTarget(null)}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus penugasan piket?"
        description={
          crud.toDelete && (
            <>
              Penugasan piket{' '}
              <strong>
                {crud.toDelete.date ? formatDateLong(crud.toDelete.date) : dayName(crud.toDelete.dayOfWeek ?? 0)} —{' '}
                {lookups.shiftName(crud.toDelete.shiftCode)}
              </strong>{' '}
              akan dihapus.{' '}
              {crud.toDelete.date
                ? 'Tanggal tersebut kembali memakai jadwal rutin.'
                : 'Hari tersebut tidak memiliki petugas piket rutin sampai diatur ulang.'}
            </>
          )
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Penugasan piket dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['dayOfWeek', 'date', 'shiftCode', 'teacherIds', 'note'] as const

function DutyDialog({
  item,
  draft,
  onClose,
}: {
  item: DutyAssignment | null
  draft: Partial<DutyAssignment>
  onClose: () => void
}) {
  const { create, update } = useMasterMutations('dutyAssignments')
  const shifts = useShifts()
  const teachers = useTeachers()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const source = item ?? draft
  const form = useForm<DutyForm>({
    resolver: zodResolver(dutySchema),
    defaultValues: {
      kind: source.date ? 'override' : 'routine',
      dayOfWeek: source.dayOfWeek ?? 1,
      date: source.date ?? todayISO(),
      shiftCode: source.shiftCode ?? shifts.data?.[0]?.code ?? '',
      teacherIds: source.teacherIds ?? [],
      note: source.note ?? '',
    },
  })
  const { register, handleSubmit, setError, control, watch, formState } = form
  const { errors, isDirty, isSubmitting } = formState
  const kind = watch('kind')

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = {
      dayOfWeek: v.kind === 'routine' ? v.dayOfWeek : null,
      date: v.kind === 'override' ? v.date : null,
      shiftCode: v.shiftCode,
      teacherIds: v.teacherIds,
      note: v.note.trim() || null,
    }
    try {
      if (item) await update.mutateAsync({ id: item.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(item ? 'Penugasan piket diperbarui.' : 'Penugasan piket disimpan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Ubah Petugas Piket' : 'Atur Petugas Piket'}
      description="Petugas piket tampil pada agenda piket harian dan mendapat akses menu piket pada hari tersebut."
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      wide
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Jenis penugasan</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['routine', 'Rutin mingguan', 'Berlaku setiap minggu'],
              ['override', 'Tanggal khusus', 'Menggantikan jadwal rutin'],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" value={value} {...register('kind')} disabled={!!item} className="mt-1 accent-primary" />
              <span className="grid">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'routine' ? (
          <FormField label="Hari" required error={errors.dayOfWeek?.message}>
            <NativeSelect {...register('dayOfWeek', { valueAsNumber: true })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {dayName(d)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        ) : (
          <FormField label="Tanggal" required error={errors.date?.message}>
            <Input type="date" {...register('date')} />
          </FormField>
        )}
        <FormField label="Shift" required error={errors.shiftCode?.message}>
          <NativeSelect {...register('shiftCode')}>
            {(shifts.data ?? []).map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <Controller
        control={control}
        name="teacherIds"
        render={({ field }) => (
          <MultiCheckList
            label="Guru piket"
            required
            options={(teachers.data ?? [])
              .filter((t) => t.status === 'ACTIVE')
              .map((t) => ({ value: t.id, label: t.name }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.teacherIds?.message}
          />
        )}
      />
      <FormField label="Catatan" error={errors.note?.message} hint="Mis. tukar jadwal dengan Bu Rina.">
        <Textarea {...register('note')} rows={2} maxLength={300} />
      </FormField>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Perubahan penugasan dicatat di log audit beserta pelakunya.
      </p>
    </FormDialog>
  )
}
