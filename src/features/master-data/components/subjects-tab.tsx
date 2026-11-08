import { zodResolver } from '@hookform/resolvers/zod'
import { BookOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FormField } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { Input } from '@/components/ui/input'
import type { Subject } from '@/types/entities'
import { useSubjects, useTeachers } from '../lookups'
import { useMasterMutations } from '../queries'
import { subjectSchema, type SubjectForm } from '../schemas'
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

export function SubjectsTab() {
  const subjects = useSubjects()
  const teachers = useTeachers()
  const crud = useCrudState<Subject>()
  const { openEdit, askDelete } = crud
  const { remove } = useMasterMutations('subjects')

  const teacherCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of teachers.data ?? []) for (const id of t.subjectIds) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }, [teachers.data])

  const columns = useMemo<ColumnDef<Subject>[]>(
    () => [
      { accessorKey: 'code', header: 'Kode', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
      { accessorKey: 'name', header: 'Mata Pelajaran', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        id: 'teachers',
        header: 'Guru Pengampu',
        accessorFn: (s) => teacherCount.get(s.id) ?? 0,
        cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()} guru</span>,
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
    [teacherCount, openEdit, askDelete],
  )

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Mata pelajaran dipakai pada jadwal, jurnal mengajar, dan penugasan guru. Kode harus unik."
        actions={<AddButton onClick={crud.openCreate}>Tambah Mapel</AddButton>}
      />
      <QueryBoundary query={subjects}>
        {(data) => (
          <DataTable
            columns={columns}
            data={data}
            getRowId={(r) => r.id}
            caption="Daftar mata pelajaran"
            initialSorting={[{ id: 'name', desc: false }]}
            emptyState={
              <EmptyState
                icon={<BookOpen className="size-5" />}
                title="Belum ada mata pelajaran"
                description="Tambahkan mata pelajaran agar dapat dipilih saat menyusun jadwal dan data guru."
                action={<AddButton onClick={crud.openCreate}>Tambah Mapel</AddButton>}
              />
            }
            renderMobileCard={(s) => (
              <MobileCard
                title={s.name}
                badge={<span className="font-mono text-xs text-muted-foreground">{s.code}</span>}
                lines={[`${teacherCount.get(s.id) ?? 0} guru pengampu`]}
                actions={<RowActions label={s.name} onEdit={() => crud.openEdit(s)} onDelete={() => crud.askDelete(s)} />}
              />
            )}
          />
        )}
      </QueryBoundary>

      {crud.dialog && (
        <SubjectDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          subject={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          onClose={crud.close}
        />
      )}
      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus mata pelajaran?"
        description={
          <>
            <strong>{crud.toDelete?.name}</strong> akan dihapus dari daftar. Mapel yang masih dipakai jadwal tidak dapat dihapus.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Mata pelajaran dihapus.')
        }}
      />
    </div>
  )
}

const FIELDS = ['code', 'name'] as const

function SubjectDialog({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const { create, update } = useMasterMutations('subjects')
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const form = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { code: subject?.code ?? '', name: subject?.name ?? '' },
  })
  const { register, handleSubmit, setError, formState } = form
  const { errors, isDirty, isSubmitting } = formState

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = { code: v.code.trim().toUpperCase(), name: v.name.trim() }
    try {
      if (subject) await update.mutateAsync({ id: subject.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(subject ? 'Mata pelajaran diperbarui.' : 'Mata pelajaran ditambahkan.')
      onClose()
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={subject ? 'Ubah Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
    >
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <FormField label="Kode" required error={errors.code?.message} hint="Mis. MTK">
          <Input {...register('code')} autoComplete="off" className="font-mono uppercase" maxLength={12} />
        </FormField>
        <FormField label="Nama mata pelajaran" required error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" maxLength={80} />
        </FormField>
      </div>
    </FormDialog>
  )
}
