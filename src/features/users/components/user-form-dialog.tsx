import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField, NativeSelect } from '@/components/form-field'
import { Input } from '@/components/ui/input'
import { useCurrentUser } from '@/features/auth/auth-context'
import { useActiveAcademicYear, useClasses, useTeachers } from '@/features/master-data/lookups'
import {
  mapMutationError,
  useSubmitKey,
  type FormError,
} from '@/features/master-data/components/crud-kit'
import { FormDialog } from '@/features/master-data/components/form-dialog'
import { canGrantRole, PRIVILEGED_ROLES } from '@/lib/permissions'
import type { Role, UserAccount } from '@/types/entities'
import type { useUserMutations } from '../queries'
import { needsTeacherLink, userFormSchema, type UserFormOutput, type UserFormValues } from '../schemas'
import { RoleChecklist, type RoleLock } from './role-checklist'

const FIELDS = ['username', 'name', 'email', 'roles', 'teacherId', 'homeroomClassId'] as const

type Mutations = ReturnType<typeof useUserMutations>

/**
 * Dialog buat/ubah akun. Username terkunci setelah akun dibuat. Peran Super Admin & Admin/TU terkunci
 * bila pelaku tidak berhak; peran Super Admin pada akun sendiri selalu terkunci (cegah menurunkan diri).
 * Setelah akun dibuat, `onCreated` menerima kata sandi sementara untuk ditampilkan sekali.
 */
export function UserFormDialog({
  account,
  mutations,
  onClose,
  onCreated,
}: {
  account: UserAccount | null
  mutations: Mutations
  onClose: () => void
  onCreated: (result: { user: UserAccount; temporaryPassword: string }) => void
}) {
  const me = useCurrentUser()
  const teachers = useTeachers()
  const classes = useClasses()
  const { year } = useActiveAcademicYear()
  const submitKey = useSubmitKey()
  const [formError, setFormError] = useState<FormError>(null)
  const isSelf = !!account && account.id === me.id

  const form = useForm<UserFormValues, unknown, UserFormOutput>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: account?.username ?? '',
      name: account?.name ?? '',
      email: account?.email ?? '',
      roles: account?.roles ?? [],
      teacherId: account?.teacherId ?? '',
      homeroomClassId: account?.homeroomClassId ?? '',
    },
  })
  const { register, handleSubmit, setError, control, formState, watch, getValues, setValue } = form
  const { errors, isDirty, isSubmitting } = formState
  const roles = watch('roles')

  const locks = useMemo<RoleLock[]>(() => {
    const out: RoleLock[] = []
    for (const role of PRIVILEGED_ROLES as readonly Role[]) {
      if (role === 'SUPER_ADMIN' && isSelf) {
        out.push({ role, reason: 'Tidak dapat mengubah peran Super Admin pada akun sendiri.' })
      } else if (!canGrantRole(me.roles, role)) {
        out.push({ role, reason: 'Hanya Super Admin yang dapat memberi atau mencabut peran ini.' })
      }
    }
    return out
  }, [isSelf, me.roles])

  const teacherOptions = useMemo(
    () =>
      [...(teachers.data ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
        .map((t) => {
          const linkedElsewhere = !!t.userId && t.userId !== account?.id
          const inactive = t.status !== 'ACTIVE' && t.id !== account?.teacherId
          return {
            value: t.id,
            label: `${t.name} (${t.nip})${linkedElsewhere ? ' · sudah tertaut akun lain' : inactive ? ' · nonaktif' : ''}`,
            name: t.name,
            disabled: linkedElsewhere || inactive,
          }
        }),
    [teachers.data, account?.id, account?.teacherId],
  )

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null)
    const common = {
      name: v.name,
      email: v.email || null,
      roles: v.roles,
      teacherId: v.teacherId || null,
      homeroomClassId: v.homeroomClassId || null,
    }
    try {
      if (account) {
        await mutations.update.mutateAsync({ id: account.id, body: { ...common, version: account.version } })
        toast.success('Akun diperbarui.')
        onClose()
      } else {
        const body = { username: v.username, ...common }
        const result = await mutations.create.mutateAsync({ body, idempotencyKey: submitKey(body) })
        toast.success('Akun dibuat.')
        onCreated(result)
      }
    } catch (e) {
      setFormError(mapMutationError(e, setError, FIELDS))
    }
  })

  const linkRequired = needsTeacherLink(roles)
  const homeroomRequired = roles.includes('HOMEROOM')
  const takenClassIds = useMemo(
    () => new Set((classes.data ?? []).filter((c) => c.homeroomTeacherId && c.homeroomTeacherId !== account?.teacherId).map((c) => c.id)),
    [classes.data, account?.teacherId],
  )

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={account ? 'Ubah Akun' : 'Tambah Akun'}
      description={
        account
          ? 'Ubah identitas, peran, dan tautan data guru. Nama pengguna tidak dapat diubah.'
          : 'Kata sandi sementara dibuat otomatis dan ditampilkan sekali setelah akun disimpan.'
      }
      onSubmit={onSubmit}
      pending={isSubmitting}
      isDirty={isDirty}
      formError={formError}
      submitLabel={account ? 'Simpan' : 'Buat akun'}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Nama pengguna"
          required={!account}
          error={errors.username?.message}
          hint={account ? 'Terkunci setelah akun dibuat.' : 'Huruf kecil, angka, titik, garis bawah, tanda hubung.'}
        >
          <Input
            {...register('username')}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={account ? 'bg-muted/40 font-mono text-muted-foreground' : 'font-mono'}
            maxLength={32}
            readOnly={!!account}
            aria-readonly={!!account || undefined}
          />
        </FormField>
        <FormField label="Nama lengkap" required error={errors.name?.message}>
          <Input {...register('name')} autoComplete="off" maxLength={120} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Email" error={errors.email?.message} hint="Opsional.">
          <Input {...register('email')} type="email" inputMode="email" autoComplete="off" maxLength={120} />
        </FormField>
        <FormField
          label="Tautan data guru"
          required={linkRequired}
          error={errors.teacherId?.message}
          hint={
            linkRequired
              ? 'Wajib untuk peran Guru, Guru Piket, dan Wali Kelas.'
              : 'Opsional untuk staf/pimpinan yang juga mengajar.'
          }
        >
          <NativeSelect
            {...register('teacherId', {
              onChange: (e: { target: { value: string } }) => {
                const picked = teacherOptions.find((o) => o.value === e.target.value)
                if (picked && !getValues('name').trim()) {
                  setValue('name', picked.name, { shouldDirty: true, shouldValidate: true })
                }
              },
            })}
            disabled={teachers.isPending}
          >
            <option value="">{teachers.isPending ? 'Memuat data guru…' : 'Tidak ditautkan'}</option>
            {teacherOptions.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      {homeroomRequired && (
        <FormField
          label="Kelas binaan"
          required
          error={errors.homeroomClassId?.message}
          hint={year ? `Satu akun hanya boleh memimpin satu kelas aktif pada ${year.name}.` : 'Satu akun hanya boleh memimpin satu kelas aktif.'}
        >
          <NativeSelect {...register('homeroomClassId')} disabled={classes.isPending}>
            <option value="">{classes.isPending ? 'Memuat kelas…' : 'Pilih satu kelas'}</option>
            {(classes.data ?? [])
              .filter((c) => c.status === 'ACTIVE' && (!year || c.academicYearId === year.id))
              .map((c) => (
                <option key={c.id} value={c.id} disabled={takenClassIds.has(c.id)}>
                  {c.name}{takenClassIds.has(c.id) ? ' — sudah memiliki wali' : ''}
                </option>
              ))}
          </NativeSelect>
        </FormField>
      )}
      <Controller
        control={control}
        name="roles"
        render={({ field }) => (
          <RoleChecklist
            value={field.value}
            onChange={(next) => {
              field.onChange(next)
              if (!next.includes('HOMEROOM')) setValue('homeroomClassId', '', { shouldDirty: true })
            }}
            locked={locks}
            error={errors.roles?.message}
          />
        )}
      />
    </FormDialog>
  )
}
