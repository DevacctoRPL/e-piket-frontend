import { zodResolver } from '@hookform/resolvers/zod'
import { Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, useFilters } from '@/components/filter-bar'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { Input } from '@/components/ui/input'
import { formatWallTime, wallTimeToMinutes } from '@/lib/date'
import type { Period } from '@/types/entities'
import { usePeriods, useShifts } from '../lookups'
import { useMasterMutations } from '../queries'
import { periodSchema, type PeriodForm } from '../schemas'
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

export function PeriodsTab() {
  const periods = usePeriods()
  const shifts = useShifts()
  const crud = useCrudState<Period>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('periods')
  const firstShift = shifts.data?.[0]?.code ?? ''
  const filters = useFilters({ pshift: '' })
  const shiftCode = filters.values.pshift || firstShift
  const shiftName = shifts.data?.find((s) => s.code === shiftCode)?.name ?? shiftCode

  const rows = useMemo(
    () => (periods.data ?? []).filter((p) => p.shiftCode === shiftCode).sort((a, b) => a.number - b.number),
    [periods.data, shiftCode],
  )

  /** Jeda (istirahat) sebelum periode, dari selisih dengan periode sebelumnya. */
  const breakBefore = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((p, i) => {
      const prev = rows[i - 1]
      if (prev) {
        const gap = wallTimeToMinutes(p.startTime) - wallTimeToMinutes(prev.endTime)
        if (gap > 0) m.set(p.id, gap)
      }
    })
    return m
  }, [rows])

  const columns = useMemo<ColumnDef<Period>[]>(
    () => [
      { accessorKey: 'number', header: 'Jam ke-', cell: ({ getValue }) => <span className="font-semibold tabular-nums">{getValue<number>()}</span> },
      {
        id: 'time',
        header: 'Waktu',
        accessorFn: (p) => p.startTime,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatWallTime(row.original.startTime)}–{formatWallTime(row.original.endTime)}
          </span>
        ),
      },
      { accessorKey: 'durationMinutes', header: 'Durasi', cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()} menit</span> },
      {
        id: 'break',
        header: 'Jeda Sebelumnya',
        enableSorting: false,
        cell: ({ row }) => {
          const gap = breakBefore.get(row.original.id)
          return gap ? <span className="text-tone-info tabular-nums">Istirahat {gap} menit</span> : <span className="text-muted-foreground">—</span>
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-12', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions label={`jam ke-${row.original.number}`} onEdit={() => openEdit(row.original)} onDelete={() => askDelete(row.original)} />
        ),
      },
    ],
    [breakBefore, openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Periode jam pelajaran per shift. Jadwal pelajaran mengacu ke nomor jam ini untuk menghitung jumlah jam (JML)."
        actions={<AddButton onClick={crud.openCreate}>Tambah Jam</AddButton>}
      />
      <FilterBar>
        <FilterSelect
          label="Shift"
          value={shiftCode}
          onChange={(pshift) => filters.set({ pshift })}
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
        />
      </FilterBar>
      <QueryBoundary query={periods}>
        {() => (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            caption={`Periode jam shift ${shiftName}`}
            pageSize={50}
            emptyState={
              <EmptyState
                icon={<Timer className="size-5" />}
                title={`Belum ada periode jam untuk shift ${shiftName}`}
                description="Tambahkan jam ke-1, ke-2, dst. beserta waktu mulai dan selesai."
                action={<AddButton onClick={crud.openCreate}>Tambah Jam</AddButton>}
              />
            }
            renderMobileCard={(p) => (
              <MobileCard
                title={`Jam ke-${p.number}`}
                lines={[
                  `${formatWallTime(p.startTime)}–${formatWallTime(p.endTime)} · ${p.durationMinutes} menit`,
                  breakBefore.get(p.id) ? `Setelah istirahat ${breakBefore.get(p.id)} menit` : null,
                ]}
                actions={<RowActions label={`jam ke-${p.number}`} onEdit={() => crud.openEdit(p)} onDelete={() => crud.askDelete(p)} />}
              />
            )}
          />
        )}
      </QueryBoundary>

      {crud.dialog && (
        <PeriodDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          period={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          shiftCode={shiftCode}
          siblings={rows}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus periode jam?"
        description={<>Jam ke-{crud.toDelete?.number} akan dihapus. Jam yang masih dipakai jadwal tidak dapat dihapus.</>}
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Periode jam dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['shiftCode', 'number', 'startTime', 'endTime'] as const

function PeriodDialog({
  period,
  shiftCode,
  siblings,
  onClose,
}: {
  period: Period | null
  shiftCode: string
  siblings: Period[]
  onClose: () => void
}) {
  const { create, update } = useMasterMutations('periods')
  const shifts = useShifts()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const last = siblings[siblings.length - 1]
  const form = useForm<PeriodForm>({
    resolver: zodResolver(periodSchema),
    defaultValues: {
      shiftCode: period?.shiftCode ?? shiftCode,
      number: period?.number ?? (last ? last.number + 1 : 1),
      startTime: period?.startTime ?? last?.endTime ?? shifts.data?.find((s) => s.code === shiftCode)?.startTime ?? '07:00',
      endTime: period?.endTime ?? '',
    },
  })
  const { register, handleSubmit, setError, watch, formState } = form
  const { errors, isDirty, isSubmitting } = formState
  const [start, end] = watch(['startTime', 'endTime'])
  const duration = /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) ? wallTimeToMinutes(end) - wallTimeToMinutes(start) : null

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    try {
      if (period) await update.mutateAsync({ id: period.id, body: v })
      else await create.mutateAsync({ body: v, idempotencyKey: submitKey(v) })
      toast.success(period ? 'Periode jam diperbarui.' : 'Periode jam ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={period ? `Ubah Jam ke-${period.number}` : 'Tambah Periode Jam'}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Shift" required error={errors.shiftCode?.message}>
          <NativeSelect {...register('shiftCode')}>
            {(shifts.data ?? []).map((s) => (
              <option key={s.id} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Jam ke-" required error={errors.number?.message}>
          <Input type="number" inputMode="numeric" min={1} max={20} {...register('number', { valueAsNumber: true })} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Mulai" required error={errors.startTime?.message}>
          <Input type="time" {...register('startTime')} />
        </FormField>
        <FormField label="Selesai" required error={errors.endTime?.message}>
          <Input type="time" {...register('endTime')} />
        </FormField>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Durasi:{' '}
        <span className="font-semibold text-foreground tabular-nums">
          {duration !== null && duration > 0 ? `${duration} menit` : '—'}
        </span>
      </p>
    </FormDialog>
  )
}
