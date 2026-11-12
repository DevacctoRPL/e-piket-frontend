import { zodResolver } from '@hookform/resolvers/zod'
import { GraduationCap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { MetaTag, StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import type { Teacher } from '@/types/entities'
import { useLookupMaps, useSubjects, useTeachers } from '../lookups'
import { DAYS_MON_SAT } from '../presence-matrix-template'
import { useMasterMutations } from '../queries'
import { teacherSchema, type TeacherForm } from '../schemas'
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
import { MultiCheckList } from './multi-check-list'

export function TeachersTab() {
  const teachers = useTeachers()
  const subjects = useSubjects()
  const { subjectById } = useLookupMaps()
  const crud = useCrudState<Teacher>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('teachers')
  const filters = useFilters({ tsubject: '', tstatus: '', tq: '' })

  const rows = useMemo(() => {
    const q = filters.values.tq.trim().toLowerCase()
    return (teachers.data ?? []).filter(
      (t) =>
        (!filters.values.tsubject || t.subjectIds.includes(filters.values.tsubject)) &&
        (!filters.values.tstatus || t.status === filters.values.tstatus) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.nip.toLowerCase().includes(q) ||
          (t.code ?? '').toLowerCase().includes(q)),
    )
  }, [teachers.data, filters.values.tsubject, filters.values.tstatus, filters.values.tq])

  const subjectNames = (t: Teacher) =>
    t.subjectIds.map((id) => subjectById.get(id)?.name).filter(Boolean).join(', ') || '—'

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Kode',
        cell: ({ row }) =>
          row.original.code ? (
            <span className="inline-flex min-w-8 items-center justify-center rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums">
              {row.original.code}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { accessorKey: 'nip', header: 'NIP', cell: ({ getValue }) => <span className="font-mono text-xs tabular-nums">{getValue<string>()}</span> },
      { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: 'attendanceDays',
        header: 'Hari Hadir',
        enableSorting: false,
        cell: ({ row }) => {
          const days = row.original.attendanceDays ?? []
          if (days.length === 0) return <span className="text-muted-foreground">—</span>
          return (
            <div className="flex flex-wrap items-center gap-1">
              {DAYS_MON_SAT.filter((d) => days.includes(d.day)).map((d) => (
                <MetaTag key={d.day} className="font-mono text-[11px]">
                  {d.short}
                </MetaTag>
              ))}
            </div>
          )
        },
      },
      {
        id: 'subjects',
        header: 'Mata Pelajaran',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex max-w-80 flex-wrap gap-1">
            {row.original.subjectIds.length === 0 && <span className="text-muted-foreground">—</span>}
            {row.original.subjectIds.map((id) => (
              <MetaTag key={id}>{subjectById.get(id)?.name ?? id}</MetaTag>
            ))}
          </div>
        ),
      },
      { accessorKey: 'phone', header: 'Telepon', cell: ({ getValue }) => <span className="tabular-nums">{getValue<string | null>() ?? '—'}</span> },
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
    [subjectById, openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Guru beserta mata pelajaran yang diampu. Guru nonaktif tidak dapat dijadwalkan atau ditugaskan piket."
        actions={<AddButton onClick={crud.openCreate}>Tambah Guru</AddButton>}
      />
      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <SearchInput label="Cari guru" placeholder="Nama atau NIP" value={filters.values.tq} onChange={(tq) => filters.set({ tq })} />
        <FilterSelect
          label="Mata pelajaran"
          value={filters.values.tsubject}
          onChange={(tsubject) => filters.set({ tsubject })}
          allLabel="Semua mapel"
          options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label="Status"
          value={filters.values.tstatus}
          onChange={(tstatus) => filters.set({ tstatus })}
          allLabel="Semua status"
          options={[
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'INACTIVE', label: 'Nonaktif' },
          ]}
        />
      </FilterBar>
      <QueryBoundary query={teachers}>
        {() => (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(r) => r.id}
            caption="Daftar guru"
            initialSorting={[{ id: 'name', desc: false }]}
            emptyState={
              filters.isDirty ? (
                <EmptyState title="Tidak ada guru yang cocok" description="Ubah atau reset filter." />
              ) : (
                <EmptyState
                  icon={<GraduationCap className="size-5" />}
                  title="Belum ada data guru"
                  description="Tambahkan guru agar dapat dijadwalkan mengajar dan ditugaskan piket."
                  action={<AddButton onClick={crud.openCreate}>Tambah Guru</AddButton>}
                />
              )
            }
            renderMobileCard={(t) => (
              <MobileCard
                title={t.name}
                badge={<StatusBadge meta={ACTIVE_STATUS_META} value={t.status} />}
                lines={[`NIP ${t.nip}`, subjectNames(t), t.phone]}
                actions={<RowActions label={t.name} onEdit={() => crud.openEdit(t)} onDelete={() => crud.askDelete(t)} />}
              />
            )}
          />
        )}
      </QueryBoundary>

      {crud.dialog && (
        <TeacherDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          teacher={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus data guru?"
        description={
          <>
            <strong>{crud.toDelete?.name}</strong> akan dihapus. Guru yang masih memiliki jadwal mengajar atau menjadi wali
            kelas tidak dapat dihapus — ubah statusnya menjadi <em>Nonaktif</em> bila sudah tidak bertugas.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Data guru dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['nip', 'code', 'name', 'phone', 'subjectIds', 'attendanceDays', 'status'] as const

function TeacherDialog({ teacher, onClose }: { teacher: Teacher | null; onClose: () => void }) {
  const { create, update } = useMasterMutations('teachers')
  const subjects = useSubjects()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const form = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      nip: teacher?.nip ?? '',
      code: teacher?.code ?? '',
      name: teacher?.name ?? '',
      phone: teacher?.phone ?? '',
      subjectIds: teacher?.subjectIds ?? [],
      attendanceDays: teacher?.attendanceDays ?? [1, 2, 3, 4, 5],
      status: teacher?.status ?? 'ACTIVE',
    },
  })
  const { register, handleSubmit, setError, control, formState } = form
  const { errors, isDirty, isSubmitting } = formState

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = {
      nip: v.nip.trim(),
      code: v.code.trim() ? v.code.trim().toUpperCase() : null,
      name: v.name.trim(),
      phone: v.phone.trim() || null,
      subjectIds: v.subjectIds,
      attendanceDays: v.attendanceDays,
      status: v.status,
    }
    try {
      if (teacher) await update.mutateAsync({ id: teacher.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(teacher ? 'Data guru diperbarui.' : 'Guru ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={teacher ? 'Ubah Data Guru' : 'Tambah Guru'}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Kode Guru" error={errors.code?.message} hint="Mis. 21, 14, A71">
          <Input {...register('code')} autoComplete="off" className="font-mono uppercase" maxLength={16} />
        </FormField>
        <FormField label="NIP / nomor pegawai" required error={errors.nip?.message}>
          <Input {...register('nip')} autoComplete="off" inputMode="numeric" className="font-mono" maxLength={30} />
        </FormField>
        <FormField label="Nama lengkap & gelar" required error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" maxLength={120} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nomor telepon" error={errors.phone?.message}>
          <Input {...register('phone')} type="tel" inputMode="tel" autoComplete="off" placeholder="08xxxxxxxxxx" />
        </FormField>
        <FormField label="Status" required error={errors.status?.message}>
          <NativeSelect {...register('status')}>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </NativeSelect>
        </FormField>
      </div>
      <Controller
        control={control}
        name="attendanceDays"
        render={({ field }) => (
          <MultiCheckList
            label="Hari kehadiran terjadwal (Senin–Sabtu)"
            options={DAYS_MON_SAT.map((d) => ({ value: String(d.day), label: d.label, hint: d.short }))}
            value={field.value.map(String)}
            onChange={(vals) => field.onChange(vals.map(Number).sort((a, b) => a - b))}
            error={errors.attendanceDays?.message}
            emptyText="Pilih hari kehadiran guru."
          />
        )}
      />
      <Controller
        control={control}
        name="subjectIds"
        render={({ field }) => (
          <MultiCheckList
            label="Mata pelajaran yang diampu"
            options={(subjects.data ?? []).map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
            value={field.value}
            onChange={field.onChange}
            error={errors.subjectIds?.message}
            emptyText="Belum ada mata pelajaran. Tambahkan di tab Mata Pelajaran."
          />
        )}
      />
    </FormDialog>
  )
}
