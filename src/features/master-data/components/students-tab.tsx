import { zodResolver } from '@hookform/resolvers/zod'
import { Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { FormField, NativeSelect } from '@/components/form-field'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { formatDate, todayISO } from '@/lib/date'
import type { Student } from '@/types/entities'
import { useClasses, useLookupMaps } from '../lookups'
import { useMasterMutations, useStudentsPage } from '../queries'
import { studentSchema, type StudentForm } from '../schemas'
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

const PAGE_SIZE = 20

export function StudentsTab() {
  const { classById } = useLookupMaps()
  const classes = useClasses()
  const crud = useCrudState<Student>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('students')
  // Kelas/status/halaman di URL; kata kunci pencarian (bisa berupa nama siswa) TIDAK disimpan di URL (PRD §12.2).
  const filters = useFilters({ sclass: '', sstatus: '', page: '1' })
  const [search, setSearch] = useState('')
  const page = Math.max(1, Number(filters.values.page) || 1)

  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    classId: filters.values.sclass || undefined,
    active: filters.values.sstatus === '' ? undefined : filters.values.sstatus === 'ACTIVE' ? 'true' : 'false',
    sort: 'name',
  }
  const students = useStudentsPage(params)
  const isFiltered = filters.values.sclass !== '' || filters.values.sstatus !== '' || search !== ''

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      { accessorKey: 'nis', header: 'NIS', enableSorting: false, cell: ({ getValue }) => <span className="font-mono text-xs tabular-nums">{getValue<string>()}</span> },
      { accessorKey: 'name', header: 'Nama', enableSorting: false, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: 'gender', header: 'L/P', enableSorting: false },
      { id: 'class', header: 'Kelas', enableSorting: false, accessorFn: (s) => classById.get(s.classId)?.name ?? '—' },
      {
        id: 'guardian',
        header: 'Wali Murid',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="grid">
            <span>{row.original.guardianName ?? '—'}</span>
            {row.original.guardianPhone && (
              <span className="text-xs text-muted-foreground tabular-nums">{row.original.guardianPhone}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="grid gap-0.5">
            <StatusBadge meta={ACTIVE_STATUS_META} value={row.original.status} />
            {row.original.status === 'INACTIVE' && row.original.inactiveFrom && (
              <span className="text-xs text-muted-foreground">sejak {formatDate(row.original.inactiveFrom)}</span>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Aksi</span>,
        enableSorting: false,
        meta: { headerClassName: 'w-24', className: 'text-right' },
        cell: ({ row }) => (
          <RowActions label={row.original.name} onEdit={() => openEdit(row.original)} onDelete={() => askDelete(row.original)} />
        ),
      },
    ],
    [classById, openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Siswa nonaktif tidak muncul di roster absensi mulai tanggal efektifnya. NIS harus unik."
        actions={<AddButton onClick={crud.openCreate}>Tambah Siswa</AddButton>}
      />
      <FilterBar
        onReset={
          isFiltered
            ? () => {
                setSearch('')
                filters.reset()
              }
            : undefined
        }
      >
        <SearchInput
          label="Cari siswa"
          placeholder="Nama atau NIS"
          value={search}
          onChange={(v) => {
            setSearch(v)
            filters.set({ page: '1' })
          }}
        />
        <FilterSelect
          label="Kelas"
          value={filters.values.sclass}
          onChange={(sclass) => filters.set({ sclass })}
          allLabel="Semua kelas"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Status"
          value={filters.values.sstatus}
          onChange={(sstatus) => filters.set({ sstatus })}
          allLabel="Semua status"
          options={[
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'INACTIVE', label: 'Nonaktif' },
          ]}
        />
      </FilterBar>

      {students.isPending ? (
        <TableSkeleton rows={8} cols={6} />
      ) : students.isError ? (
        <ErrorState error={students.error} onRetry={() => void students.refetch()} />
      ) : (
        <div className={students.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined} aria-busy={students.isFetching}>
          <DataTable
            columns={columns}
            data={students.data.data}
            getRowId={(r) => r.id}
            caption="Daftar siswa"
            serverPagination={{ meta: students.data.meta, onPageChange: (p) => filters.set({ page: String(p) }) }}
            emptyState={
              isFiltered ? (
                <EmptyState title="Tidak ada siswa yang cocok" description="Ubah kata kunci atau filter kelas/status." />
              ) : (
                <EmptyState
                  icon={<Users className="size-5" />}
                  title="Belum ada data siswa"
                  description="Tambahkan siswa ke kelas agar muncul di roster absensi."
                  action={<AddButton onClick={crud.openCreate}>Tambah Siswa</AddButton>}
                />
              )
            }
            renderMobileCard={(s) => (
              <MobileCard
                title={s.name}
                badge={<StatusBadge meta={ACTIVE_STATUS_META} value={s.status} />}
                lines={[
                  `NIS ${s.nis} · ${classById.get(s.classId)?.name ?? '—'} · ${s.gender}`,
                  s.guardianName ? `Wali: ${s.guardianName}${s.guardianPhone ? ` (${s.guardianPhone})` : ''}` : null,
                  s.status === 'INACTIVE' && s.inactiveFrom ? `Nonaktif sejak ${formatDate(s.inactiveFrom)}` : null,
                ]}
                actions={<RowActions label={s.name} onEdit={() => crud.openEdit(s)} onDelete={() => crud.askDelete(s)} />}
              />
            )}
          />
        </div>
      )}

      {crud.dialog && (
        <StudentDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          student={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          defaultClassId={filters.values.sclass}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus data siswa?"
        description={
          <>
            Data siswa <strong>{crud.toDelete?.name}</strong> akan dihapus (riwayat absensi tetap tersimpan untuk audit). Untuk
            siswa pindah/lulus, sebaiknya ubah status menjadi <em>Nonaktif</em> dengan tanggal efektif.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Data siswa dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['nis', 'name', 'gender', 'classId', 'status', 'inactiveFrom', 'guardianName', 'guardianPhone'] as const

function StudentDialog({
  student,
  defaultClassId,
  onClose,
}: {
  student: Student | null
  defaultClassId: string
  onClose: () => void
}) {
  const { create, update } = useMasterMutations('students')
  const classes = useClasses()
  const { can } = useAuth()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const phoneMasked = !!student?.guardianPhone?.includes('*')
  const form = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      nis: student?.nis ?? '',
      name: student?.name ?? '',
      gender: student?.gender ?? 'L',
      classId: student?.classId ?? defaultClassId,
      status: student?.status ?? 'ACTIVE',
      inactiveFrom: student?.inactiveFrom ?? '',
      guardianName: student?.guardianName ?? '',
      guardianPhone: student?.guardianPhone ?? '',
    },
  })
  const { register, handleSubmit, setError, watch, setValue, formState } = form
  const { errors, isDirty, isSubmitting, dirtyFields } = formState
  const status = watch('status')

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = {
      nis: v.nis.trim(),
      name: v.name.trim(),
      gender: v.gender,
      classId: v.classId,
      status: v.status,
      inactiveFrom: v.status === 'INACTIVE' ? v.inactiveFrom : null,
      guardianName: v.guardianName.trim() || null,
      guardianPhone: v.guardianPhone.trim() || null,
    }
    // Nomor dimask jangan dikirim balik (backend juga mengabaikannya).
    const payload =
      student && phoneMasked && !dirtyFields.guardianPhone
        ? (({ guardianPhone: _omit, ...rest }) => rest)(body)
        : body
    try {
      if (student) await update.mutateAsync({ id: student.id, body: payload })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(student ? 'Data siswa diperbarui.' : 'Siswa ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={student ? 'Ubah Data Siswa' : 'Tambah Siswa'}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <FormField label="NIS" required error={errors.nis?.message}>
          <Input {...register('nis')} autoComplete="off" inputMode="numeric" className="font-mono" maxLength={20} />
        </FormField>
        <FormField label="Nama lengkap" required error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" maxLength={120} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Jenis kelamin" required error={errors.gender?.message}>
          <NativeSelect {...register('gender')}>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </NativeSelect>
        </FormField>
        <FormField label="Kelas" required error={errors.classId?.message}>
          <NativeSelect {...register('classId')}>
            <option value="">Pilih kelas</option>
            {(classes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" required error={errors.status?.message}>
          <NativeSelect
            {...register('status', {
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                if (e.target.value === 'INACTIVE' && !form.getValues('inactiveFrom')) {
                  setValue('inactiveFrom', todayISO(), { shouldDirty: true })
                }
              },
            })}
          >
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif (pindah/lulus/keluar)</option>
          </NativeSelect>
        </FormField>
        {status === 'INACTIVE' && (
          <FormField
            label="Nonaktif mulai tanggal"
            required
            error={errors.inactiveFrom?.message}
            hint="Siswa tidak muncul di roster mulai tanggal ini."
          >
            <Input type="date" {...register('inactiveFrom')} />
          </FormField>
        )}
      </div>
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Kontak wali murid</legend>
        <FormField label="Nama wali" error={errors.guardianName?.message}>
          <Input {...register('guardianName')} autoComplete="off" maxLength={120} />
        </FormField>
        <FormField
          label="Nomor telepon wali"
          error={errors.guardianPhone?.message}
          hint={
            phoneMasked
              ? 'Nomor disamarkan sesuai hak akses Anda; biarkan bila tidak diubah.'
              : can('student_contact:read')
                ? undefined
                : 'Nomor hanya ditampilkan utuh untuk peran berwenang.'
          }
        >
          <Input {...register('guardianPhone')} type="tel" inputMode="tel" autoComplete="off" placeholder="08xxxxxxxxxx" />
        </FormField>
      </fieldset>
    </FormDialog>
  )
}
