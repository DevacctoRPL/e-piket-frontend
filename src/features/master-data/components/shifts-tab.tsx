import { zodResolver } from '@hookform/resolvers/zod'
import { Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FormField } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/misc'
import { formatWallTime } from '@/lib/date'
import type { Shift } from '@/types/entities'
import { useShifts } from '../lookups'
import { useMasterMutations } from '../queries'
import { shiftSchema, type ShiftForm } from '../schemas'
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

export function ShiftsTab() {
  const shifts = useShifts()
  const crud = useCrudState<Shift>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('shifts')

  const columns = useMemo<ColumnDef<Shift>[]>(
    () => [
      { accessorKey: 'code', header: 'Kode', cell: ({ getValue }) => <span className="font-mono text-xs font-semibold">{getValue<string>()}</span> },
      { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: 'time',
        header: 'Jam',
        accessorFn: (s) => s.startTime,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatWallTime(row.original.startTime)}–{formatWallTime(row.original.endTime)}
          </span>
        ),
      },
      {
        accessorKey: 'lateToleranceMinutes',
        header: 'Toleransi Terlambat',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()} menit</span>,
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) =>
          getValue<boolean>() ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="neutral">Nonaktif</ToneBadge>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-24', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions label={`shift ${row.original.name}`} onEdit={() => openEdit(row.original)} onDelete={() => askDelete(row.original)} />
        ),
      },
    ],
    [openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Shift menentukan jam masuk dan batas keterlambatan guru/siswa. Guru dianggap terlambat setelah jam mulai + toleransi."
        actions={<AddButton onClick={crud.openCreate}>Tambah Shift</AddButton>}
      />
      <QueryBoundary query={shifts}>
        {(data) => (
          <DataTable
            columns={columns}
            data={data}
            getRowId={(r) => r.id}
            caption="Daftar shift"
            emptyState={
              <EmptyState
                icon={<Clock className="size-5" />}
                title="Belum ada shift"
                description="Tambahkan shift (mis. Pagi dan Siang) sebelum membuat kelas dan periode jam."
                action={<AddButton onClick={crud.openCreate}>Tambah Shift</AddButton>}
              />
            }
            renderMobileCard={(s) => (
              <MobileCard
                title={`${s.name} (${s.code})`}
                badge={s.isActive ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="neutral">Nonaktif</ToneBadge>}
                lines={[`${formatWallTime(s.startTime)}–${formatWallTime(s.endTime)} · toleransi ${s.lateToleranceMinutes} menit`]}
                actions={<RowActions label={`shift ${s.name}`} onEdit={() => crud.openEdit(s)} onDelete={() => crud.askDelete(s)} />}
              />
            )}
          />
        )}
      </QueryBoundary>

      {crud.dialog && (
        <ShiftDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          shift={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus shift?"
        description={
          <>
            Shift <strong>{crud.toDelete?.name}</strong> beserta periode jamnya akan dihapus. Shift yang masih dipakai kelas
            atau jadwal tidak dapat dihapus — nonaktifkan saja.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Shift dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['code', 'name', 'startTime', 'endTime', 'lateToleranceMinutes', 'isActive'] as const

function ShiftDialog({ shift, onClose }: { shift: Shift | null; onClose: () => void }) {
  const { create, update } = useMasterMutations('shifts')
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      code: shift?.code ?? '',
      name: shift?.name ?? '',
      startTime: shift?.startTime ?? '07:00',
      endTime: shift?.endTime ?? '12:00',
      lateToleranceMinutes: shift?.lateToleranceMinutes ?? 10,
      isActive: shift?.isActive ?? true,
    },
  })
  const { register, handleSubmit, setError, control, formState } = form
  const { errors, isDirty, isSubmitting } = formState

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = { ...v, code: v.code.trim().toUpperCase(), name: v.name.trim() }
    try {
      if (shift) await update.mutateAsync({ id: shift.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(shift ? 'Shift diperbarui.' : 'Shift ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={shift ? `Ubah Shift ${shift.name}` : 'Tambah Shift'}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
    >
      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <FormField label="Kode" required error={errors.code?.message} hint="Mis. MORNING">
          <Input {...register('code')} autoComplete="off" className="font-mono uppercase" maxLength={20} />
        </FormField>
        <FormField label="Nama shift" required error={errors.name?.message} hint="Mis. Pagi">
          <Input {...register('name')} autoComplete="off" maxLength={40} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Jam mulai" required error={errors.startTime?.message}>
          <Input type="time" {...register('startTime')} />
        </FormField>
        <FormField label="Jam selesai" required error={errors.endTime?.message}>
          <Input type="time" {...register('endTime')} />
        </FormField>
      </div>
      <FormField
        label="Toleransi keterlambatan (menit)"
        required
        error={errors.lateToleranceMinutes?.message}
        hint="Check-in setelah jam mulai + toleransi dicatat terlambat."
      >
        <Input type="number" inputMode="numeric" min={0} max={120} {...register('lateToleranceMinutes', { valueAsNumber: true })} />
      </FormField>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="shift-active">Shift aktif</Label>
              <p className="text-xs text-muted-foreground">Shift nonaktif tidak ditawarkan pada pilihan harian.</p>
            </div>
            <Switch id="shift-active" checked={field.value} onCheckedChange={field.onChange} />
          </div>
        )}
      />
    </FormDialog>
  )
}
