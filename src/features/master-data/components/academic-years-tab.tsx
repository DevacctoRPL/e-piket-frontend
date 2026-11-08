import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarRange, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormField } from '@/components/form-field'
import { EmptyState, QueryBoundary } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, todayISO } from '@/lib/date'
import { getErrorMessage } from '@/lib/error-mapping'
import type { AcademicYear, Semester } from '@/types/entities'
import { useAcademicYears } from '../lookups'
import { useMasterMutations } from '../queries'
import { academicYearSchema, type AcademicYearForm } from '../schemas'
import {
  AddButton,
  DeleteDialog,
  RowActions,
  TabToolbar,
  mapMutationError,
  useCrudState,
  useSubmitKey,
  type FormError,
} from './crud-kit'
import { FormDialog } from './form-dialog'

export function AcademicYearsTab() {
  const years = useAcademicYears()
  const crud = useCrudState<AcademicYear>()
  const { update, remove } = useMasterMutations('academicYears')
  const [toActivate, setToActivate] = useState<{ year: AcademicYear; semester: Semester } | null>(null)

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Hanya satu tahun ajaran dan satu semester yang aktif. Semua catatan operasional baru terhubung ke semester aktif."
        actions={<AddButton onClick={crud.openCreate}>Tambah Tahun Ajaran</AddButton>}
      />
      <QueryBoundary
        query={years}
        empty={(d) => d.length === 0}
        emptyState={
          <EmptyState
            icon={<CalendarRange className="size-5" />}
            title="Belum ada tahun ajaran"
            description="Buat tahun ajaran beserta semester Ganjil dan Genap, lalu aktifkan semester yang sedang berjalan."
            action={<AddButton onClick={crud.openCreate}>Tambah Tahun Ajaran</AddButton>}
          />
        }
      >
        {(data) => (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.map((y) => (
              <li key={y.id} className="rounded-xl border bg-card p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold tabular-nums">{y.name}</h3>
                      {y.isActive ? <ToneBadge tone="success">Aktif</ToneBadge> : <ToneBadge tone="neutral">Tidak aktif</ToneBadge>}
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(y.startDate)} – {formatDate(y.endDate)}
                    </p>
                  </div>
                  <RowActions
                    label={`tahun ajaran ${y.name}`}
                    onEdit={() => crud.openEdit(y)}
                    onDelete={y.isActive ? undefined : () => crud.askDelete(y)}
                  />
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {y.semesters.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Semester {s.name}</span>
                        {s.isActive && <ToneBadge tone="success">Berjalan</ToneBadge>}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDate(s.startDate)} – {formatDate(s.endDate)}
                      </span>
                      {!s.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-fit"
                          onClick={() => setToActivate({ year: y, semester: s })}
                        >
                          <CheckCircle2 /> Jadikan aktif
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      {crud.dialog && (
        <AcademicYearDialog
          key={crud.dialog.mode === 'edit' ? crud.dialog.item.id : 'new'}
          year={crud.dialog.mode === 'edit' ? crud.dialog.item : null}
          onClose={crud.close}
        />
      )}

      <ConfirmDialog
        open={!!toActivate}
        onOpenChange={(o) => !o && setToActivate(null)}
        title="Aktifkan semester?"
        description={
          toActivate && (
            <>
              <strong>
                {toActivate.year.name} semester {toActivate.semester.name}
              </strong>{' '}
              akan menjadi periode aktif. Tahun ajaran/semester lain otomatis dinonaktifkan dan jadwal yang dipakai
              absensi mengikuti semester ini.
            </>
          )
        }
        confirmLabel="Aktifkan"
        pending={update.isPending}
        onConfirm={async () => {
          if (!toActivate) return
          try {
            await update.mutateAsync({
              id: toActivate.year.id,
              body: { isActive: true, activeSemesterId: toActivate.semester.id },
            })
            toast.success(`Semester ${toActivate.semester.name} ${toActivate.year.name} kini aktif.`)
            setToActivate(null)
          } catch (e) {
            toast.error(getErrorMessage(e))
          }
        }}
      />

      <DeleteDialog
        open={!!crud.toDelete}
        onOpenChange={(o) => !o && crud.cancelDelete()}
        title="Hapus tahun ajaran?"
        description={
          <>
            Tahun ajaran <strong>{crud.toDelete?.name}</strong> akan dihapus. Tahun ajaran yang masih memiliki kelas tidak dapat
            dihapus.
          </>
        }
        pending={remove.isPending}
        onConfirm={async () => {
          if (!crud.toDelete) return
          await remove.mutateAsync(crud.toDelete.id)
          toast.success('Tahun ajaran dihapus.')
        }}
      />
    </div>
  )
}

const FIELD_MAP: Record<string, keyof AcademicYearForm> = {
  name: 'name',
  startDate: 'startDate',
  endDate: 'endDate',
  'semesters.0.startDate': 'sem1Start',
  'semesters.0.endDate': 'sem1End',
  'semesters.1.startDate': 'sem2Start',
  'semesters.1.endDate': 'sem2End',
}

function suggestedYear(): AcademicYearForm {
  const today = todayISO()
  const y = Number(today.slice(5, 7)) >= 7 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1
  return {
    name: `${y}/${y + 1}`,
    startDate: `${y}-07-13`,
    endDate: `${y + 1}-06-26`,
    sem1Start: `${y}-07-13`,
    sem1End: `${y}-12-18`,
    sem2Start: `${y + 1}-01-04`,
    sem2End: `${y + 1}-06-26`,
  }
}

function AcademicYearDialog({ year, onClose }: { year: AcademicYear | null; onClose: () => void }) {
  const { create, update } = useMasterMutations('academicYears')
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const [s1, s2] = year?.semesters ?? []
  const form = useForm<AcademicYearForm>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: year
      ? {
          name: year.name,
          startDate: year.startDate,
          endDate: year.endDate,
          sem1Start: s1?.startDate ?? '',
          sem1End: s1?.endDate ?? '',
          sem2Start: s2?.startDate ?? '',
          sem2End: s2?.endDate ?? '',
        }
      : suggestedYear(),
  })
  const { register, handleSubmit, formState } = form
  const { errors, isDirty, isSubmitting } = formState

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const body = {
      name: v.name.trim(),
      startDate: v.startDate,
      endDate: v.endDate,
      semesters: [
        { id: s1?.id, startDate: v.sem1Start, endDate: v.sem1End },
        { id: s2?.id, startDate: v.sem2Start, endDate: v.sem2End },
      ] as [{ id?: string; startDate: string; endDate: string }, { id?: string; startDate: string; endDate: string }],
    }
    try {
      if (year) await update.mutateAsync({ id: year.id, body })
      else await create.mutateAsync({ body, idempotencyKey: submitKey(body) })
      toast.success(year ? 'Tahun ajaran diperbarui.' : 'Tahun ajaran ditambahkan.')
      onClose()
    } catch (e) {
      // petakan nama field API (semesters.0.startDate) ke field form
      const mapped = mapMutationError(
        e,
        (name, err) => {
          const target = FIELD_MAP[name as string]
          if (target) form.setError(target, err)
        },
        Object.keys(FIELD_MAP),
      )
      setFormError(mapped)
    }
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={year ? `Ubah Tahun Ajaran ${year.name}` : 'Tambah Tahun Ajaran'}
      description="Tanggal semester harus berada dalam rentang tahun ajaran."
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Nama tahun ajaran" required error={errors.name?.message} hint="Format 2026/2027">
          <Input {...register('name')} inputMode="numeric" autoComplete="off" />
        </FormField>
        <FormField label="Tanggal mulai" required error={errors.startDate?.message}>
          <Input type="date" {...register('startDate')} />
        </FormField>
        <FormField label="Tanggal selesai" required error={errors.endDate?.message}>
          <Input type="date" {...register('endDate')} />
        </FormField>
      </div>
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Semester Ganjil</legend>
        <FormField label="Mulai" required error={errors.sem1Start?.message}>
          <Input type="date" {...register('sem1Start')} />
        </FormField>
        <FormField label="Selesai" required error={errors.sem1End?.message}>
          <Input type="date" {...register('sem1End')} />
        </FormField>
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Semester Genap</legend>
        <FormField label="Mulai" required error={errors.sem2Start?.message}>
          <Input type="date" {...register('sem2Start')} />
        </FormField>
        <FormField label="Selesai" required error={errors.sem2End?.message}>
          <Input type="date" {...register('sem2End')} />
        </FormField>
      </fieldset>
    </FormDialog>
  )
}
