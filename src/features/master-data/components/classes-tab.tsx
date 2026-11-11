import { zodResolver } from '@hookform/resolvers/zod'
import { School } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import type { ClassRoom } from '@/types/entities'
import { useActiveAcademicYear, useClasses, useLookupMaps, useShifts, useTeachers } from '../lookups'
import { useMasterMutations } from '../queries'
import { classSchema, type ClassForm } from '../schemas'
import {
  ACTIVE_STATUS_META,
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

export function ClassesTab() {
  const classes = useClasses()
  const lookups = useLookupMaps()
  const shifts = useShifts()
  const crud = useCrudState<ClassRoom>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('classes')
  const filters = useFilters({ cshift: '', cstatus: '', cq: '' })

  const rows = useMemo(() => {
    const q = filters.values.cq.trim().toLowerCase()
    return (classes.data ?? []).filter(
      (c) =>
        (!filters.values.cshift || c.shiftCode === filters.values.cshift) &&
        (!filters.values.cstatus || c.status === filters.values.cstatus) &&
        (!q || c.name.toLowerCase().includes(q) || c.program.toLowerCase().includes(q)),
    )
  }, [classes.data, filters.values.cshift, filters.values.cstatus, filters.values.cq])

  const columns = useMemo<ColumnDef<ClassRoom>[]>(
    () => [
      { accessorKey: 'name', header: 'Kelas', cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
      { accessorKey: 'grade', header: 'Tingkat', cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
      { accessorKey: 'program', header: 'Program', meta: { className: 'max-w-64 truncate' } },
      { accessorKey: 'shiftCode', header: 'Shift', cell: ({ row }) => lookups.shiftName(row.original.shiftCode) },
      {
        id: 'homeroom',
        header: 'Wali Kelas',
        accessorFn: (c) => (c.homeroomTeacherId ? lookups.teacherById.get(c.homeroomTeacherId)?.name ?? '—' : '—'),
      },
      {
        accessorKey: 'studentCount',
        header: 'Siswa Aktif',
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number | undefined>() ?? 0}</span>,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge meta={ACTIVE_STATUS_META} value={row.original.status} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-12', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions label={row.original.name} onEdit={() => openEdit(row.original)} onDelete={() => askDelete(row.original)} />
        ),
      },
    ],
    [lookups, openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Kelas pada tahun ajaran aktif. Shift kelas menentukan jam pelajaran dan roster absensi."
        actions={<AddButton onClick={crud.openCreate}>Tambah Kelas</AddButton>}
      />
      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <SearchInput label="Cari kelas" placeholder="Nama kelas / program" value={filters.values.cq} onChange={(cq) => filters.set({ cq })} />
        <FilterSelect
          label="Shift"
          value={filters.values.cshift}
          onChange={(cshift) => filters.set({ cshift })}
          allLabel="Semua shift"
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
        />
        <FilterSelect
          label="Status"
          value={filters.values.cstatus}
          onChange={(cstatus) => filters.set({ cstatus })}
          allLabel="Semua status"
          options={[
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'INACTIVE', label: 'Nonaktif' },
          ]}
        />
      </FilterBar>
      <QueryBoundary query={classes}>
        {() => (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            caption="Daftar kelas"
            emptyState={
              filters.isDirty ? (
                <EmptyState title="Tidak ada kelas yang cocok" description="Ubah atau reset filter untuk melihat kelas lain." />
              ) : (
                <EmptyState
                  icon={<School className="size-5" />}
                  title="Belum ada kelas"
                  description="Tambahkan kelas untuk tahun ajaran aktif agar siswa dan jadwal dapat disusun."
                  action={<AddButton onClick={crud.openCreate}>Tambah Kelas</AddButton>}
                />
              )
            }
            renderMobileCard={(c) => (
              <MobileCard
                title={c.name}
                badge={<StatusBadge meta={ACTIVE_STATUS_META} value={c.status} />}
                lines={[
                  `${lookups.shiftName(c.shiftCode)} · ${c.studentCount ?? 0} siswa aktif`,
                  c.program,
                  `Wali kelas: ${c.homeroomTeacherId ? lookups.teacherById.get(c.homeroomTeacherId)?.name ?? '—' : '—'}`,
                ]}
                actions={<RowActions label={c.name} onEdit={() => crud.openEdit(c)} onDelete={() => crud.askDelete(c)} />}
              />
            )}
          />
        )}
      </QueryBoundary>

      {crud.dialog && (
        <ClassDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          cls={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          allClasses={classes.data ?? []}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus kelas?"
        description={
          <>
            Kelas <strong>{crud.toDelete?.name}</strong> beserta slot jadwalnya akan dihapus. Kelas yang masih memiliki siswa
            aktif tidak dapat dihapus — pindahkan atau nonaktifkan siswanya terlebih dahulu.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Kelas dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['name', 'grade', 'program', 'shiftCode', 'homeroomTeacherId', 'status'] as const

function ClassDialog({
  cls,
  allClasses,
  onClose,
}: {
  cls: ClassRoom | null
  allClasses: ClassRoom[]
  onClose: () => void
}) {
  const { create, update } = useMasterMutations('classes')
  const shifts = useShifts()
  const teachers = useTeachers()
  const { year } = useActiveAcademicYear()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const form = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: cls?.name ?? '',
      grade: cls?.grade ?? 10,
      program: cls?.program ?? '',
      shiftCode: cls?.shiftCode ?? shifts.data?.[0]?.code ?? '',
      homeroomTeacherId: cls?.homeroomTeacherId ?? '',
      status: cls?.status ?? 'ACTIVE',
    },
  })
  const { register, handleSubmit, setError, formState } = form
  const { errors, isDirty, isSubmitting } = formState

  const takenHomeroom = useMemo(
    () => new Map(allClasses.filter((c) => c.id !== cls?.id && c.homeroomTeacherId).map((c) => [c.homeroomTeacherId, c.name])),
    [allClasses, cls?.id],
  )

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = {
      name: v.name.trim(),
      grade: v.grade,
      program: v.program.trim(),
      shiftCode: v.shiftCode,
      homeroomTeacherId: v.homeroomTeacherId || null,
      status: v.status,
      academicYearId: cls?.academicYearId ?? year?.id ?? '',
    }
    try {
      if (cls) await update.mutateAsync({ id: cls.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(cls ? 'Kelas diperbarui.' : 'Kelas ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={cls ? `Ubah Kelas ${cls.name}` : 'Tambah Kelas'}
      description={year ? `Tahun ajaran ${year.name}` : undefined}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField label="Nama kelas" required error={errors.name?.message} hint="Mis. X TKJ 1">
          <Input {...register('name')} autoComplete="off" maxLength={40} />
        </FormField>
        <FormField label="Tingkat" required error={errors.grade?.message}>
          <Input type="number" inputMode="numeric" min={1} max={13} {...register('grade', { valueAsNumber: true })} />
        </FormField>
      </div>
      <FormField label="Program / kompetensi keahlian" required error={errors.program?.message}>
        <Input {...register('program')} autoComplete="off" maxLength={120} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Shift" required error={errors.shiftCode?.message}>
          <NativeSelect {...register('shiftCode')}>
            <option value="">Pilih shift</option>
            {(shifts.data ?? []).map((s) => (
              <option key={s.id} value={s.code}>
                {s.name} ({s.startTime}–{s.endTime})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Status" required error={errors.status?.message}>
          <NativeSelect {...register('status')}>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField label="Wali kelas" error={errors.homeroomTeacherId?.message} hint="Satu guru hanya dapat menjadi wali satu kelas.">
        <NativeSelect {...register('homeroomTeacherId')}>
          <option value="">Belum ditentukan</option>
          {(teachers.data ?? [])
            .filter((t) => t.status === 'ACTIVE')
            .map((t) => {
              const taken = takenHomeroom.get(t.id)
              return (
                <option key={t.id} value={t.id} disabled={!!taken}>
                  {t.name}
                  {taken ? ` — wali ${taken}` : ''}
                </option>
              )
            })}
        </NativeSelect>
      </FormField>
    </FormDialog>
  )
}
