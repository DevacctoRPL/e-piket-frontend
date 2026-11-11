import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, KeyRound, Pencil, Save, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { FormField } from '@/components/form-field'
import { FramedCard } from '@/components/framed-card'
import { Page, PageHeader } from '@/components/page'
import { MetaTag } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/ui/misc'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useClasses, useSubjects, useTeachers } from '@/features/master-data/lookups'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import { ROLE_META } from '@/lib/enums'
import type { CurrentUser } from '@/types/entities'
import { authApi, authKeys } from './api'
import { useCurrentUser } from './auth-context'
import { profileSchema, type ProfileFormValues } from './profile-schema'
import { useUpdateProfile } from './profile-queries'

export function ProfilePage() {
  const user = useCurrentUser()
  const [editing, setEditing] = useState(false)

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Profil Saya" description="Identitas akun, peran, dan keterkaitan dengan data guru." />

      <section
        aria-label="Ringkasan akun"
        className="flex items-center gap-4 rounded-xl border border-border/85 bg-card p-4 shadow-2xs"
      >
        <Avatar name={user.name} size="lg" variant="solid" />
        <div className="min-w-0 space-y-1">
          <p className="text-[15px] font-semibold tracking-tight break-words">{user.name}</p>
          <p className="text-[13px] text-muted-foreground">@{user.username}</p>
          <ul className="flex flex-wrap gap-1.5 pt-0.5" aria-label="Peran">
            {user.roles.map((r) => (
              <li key={r}>
                <MetaTag>{ROLE_META[r].label}</MetaTag>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <FramedCard
          icon={<UserRound />}
          title="Informasi Akun"
          description="Nama dan email dapat Anda ubah sendiri."
          headerRight={
            !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> Ubah
              </Button>
            )
          }
        >
            {editing ? (
              <ProfileForm user={user} onDone={() => setEditing(false)} />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="font-medium break-words">{user.name}</dd>
                <dt className="text-muted-foreground">Nama pengguna</dt>
                <dd className="font-mono break-all">{user.username}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{user.email ?? <span className="text-muted-foreground">Belum diisi</span>}</dd>
              </dl>
            )}
        </FramedCard>

        <TeacherInfoCard user={user} />

        <ChangePasswordCard mustChange={!!user.mustChangePassword} />
      </div>
    </Page>
  )
}

function ProfileForm({ user, onDone }: { user: CurrentUser; onDone: () => void }) {
  const mutation = useUpdateProfile()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email ?? '' },
  })
  const {
    register,
    formState: { errors, isDirty },
  } = form

  useEffect(() => {
    form.setFocus('name')
  }, [form])

  const onSubmit = form.handleSubmit((v) => {
    if (mutation.isPending) return
    mutation.mutate(
      { name: v.name.trim(), email: v.email.trim() || null },
      {
        onSuccess: (me) => {
          form.reset({ name: me.name, email: me.email ?? '' })
          toast.success('Profil berhasil diperbarui.')
          onDone()
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError, ['name', 'email'])) toast.error(getErrorMessage(err))
        },
      },
    )
  })

  return (
    <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-4">
      <UnsavedChangesGuard when={isDirty && !mutation.isPending} />
      <FormField label="Nama" required error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </FormField>
      <FormField label="Email" hint="Opsional. Dipakai untuk pemberitahuan dari sekolah." error={errors.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" disabled={mutation.isPending || !isDirty}>
          <Save /> {mutation.isPending ? 'Menyimpan…' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}

function TeacherInfoCard({ user }: { user: CurrentUser }) {
  const teachers = useTeachers()
  const subjects = useSubjects()
  const classes = useClasses()

  if (!user.teacherId) {
    return (
      <FramedCard icon={<GraduationCap />} title="Data Guru" description="Akun ini tidak terhubung dengan data guru.">
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border/90 p-4 text-[13px] text-muted-foreground">
          <UserRound className="size-4 shrink-0" />
          Akun staf/pimpinan tanpa jadwal mengajar. Bila Anda juga mengajar, minta Super Admin sekolah menautkan akun ke data guru.
        </div>
      </FramedCard>
    )
  }

  const teacher = teachers.data?.find((t) => t.id === user.teacherId)
  const subjectNames = (teacher?.subjectIds ?? [])
    .map((id) => subjects.data?.find((s) => s.id === id)?.name)
    .filter((n): n is string => !!n)
  const homeroom = user.homeroomClassIds
    .map((id) => classes.data?.find((c) => c.id === id)?.name)
    .filter((n): n is string => !!n)
  const loading = teachers.isPending || subjects.isPending || classes.isPending

  return (
    <FramedCard icon={<GraduationCap />} title="Data Guru" description="Ditautkan oleh Super Admin dari data master guru.">
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : teachers.isError ? (
          <p className="text-[13px] text-muted-foreground">Data guru tidak dapat dimuat. {getErrorMessage(teachers.error)}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
            <dt className="text-muted-foreground">NIP</dt>
            <dd className="font-mono tabular-nums break-all">{teacher?.nip || '—'}</dd>
            <dt className="text-muted-foreground">Mata pelajaran</dt>
            <dd>{subjectNames.length ? subjectNames.join(', ') : '—'}</dd>
            <dt className="text-muted-foreground">Wali kelas</dt>
            <dd>{homeroom.length ? homeroom.join(', ') : <span className="text-muted-foreground">Bukan wali kelas</span>}</dd>
            <dt className="text-muted-foreground">Kelas diajar</dt>
            <dd className="tabular-nums">{user.teachingClassIds.length} kelas</dd>
          </dl>
        )}
    </FramedCard>
  )
}

/* ------------------------------------------------------------------ ganti kata sandi */

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
    newPassword: z.string().min(8, 'Minimal 8 karakter.').max(128, 'Maksimal 128 karakter.'),
    confirmPassword: z.string().min(1, 'Ulangi kata sandi baru.'),
  })
  .superRefine((v, ctx) => {
    if (v.newPassword && v.newPassword === v.currentPassword)
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Harus berbeda dari kata sandi saat ini.' })
    if (v.confirmPassword && v.confirmPassword !== v.newPassword)
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Konfirmasi tidak sama dengan kata sandi baru.' })
  })
type ChangePasswordValues = z.input<typeof changePasswordSchema>

const EMPTY_PASSWORDS: ChangePasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * POST /auth/me/password (204). Nilai kata sandi hanya hidup di state form dan langsung dikosongkan
 * setelah berhasil; tidak pernah masuk cache query (mutasi di-reset) maupun log.
 */
function ChangePasswordCard({ mustChange }: { mustChange: boolean }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => authApi.changePassword(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me }),
  })
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_PASSWORDS,
  })
  const {
    register,
    formState: { errors, isDirty },
  } = form

  const onSubmit = form.handleSubmit((v) => {
    if (mutation.isPending) return
    mutation.mutate(
      { currentPassword: v.currentPassword, newPassword: v.newPassword },
      {
        onSuccess: () => {
          form.reset(EMPTY_PASSWORDS)
          mutation.reset()
          toast.success('Kata sandi berhasil diganti.')
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError, ['currentPassword', 'newPassword'])) toast.error(getErrorMessage(err))
          mutation.reset()
        },
      },
    )
  })

  return (
    <FramedCard icon={<KeyRound />} title="Keamanan" className="md:col-span-2">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-6">
        <div className="grid content-start gap-3">
          <p className="text-[13px] text-pretty text-muted-foreground">
            Perubahan kata sandi dapat Anda lakukan sendiri di sini. Nama pengguna, peran, dan reset kata sandi yang lupa
            dikelola oleh Super Admin sekolah. Selalu keluar dari aplikasi setelah memakai perangkat bersama.
          </p>
          {mustChange && (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>Ganti kata sandi sementara</AlertTitle>
              <AlertDescription>Akun Anda masih memakai kata sandi sementara dari Super Admin.</AlertDescription>
            </Alert>
          )}
        </div>
        <form
          onSubmit={(e) => void onSubmit(e)}
          noValidate
          aria-label="Ganti kata sandi"
          className="grid gap-3"
        >
          <UnsavedChangesGuard when={isDirty && !mutation.isPending} />
          <FormField label="Kata sandi saat ini" required error={errors.currentPassword?.message}>
            <Input type="password" autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Kata sandi baru" required hint="Minimal 8 karakter." error={errors.newPassword?.message}>
              <Input type="password" autoComplete="new-password" {...register('newPassword')} />
            </FormField>
            <FormField label="Ulangi kata sandi baru" required error={errors.confirmPassword?.message}>
              <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !isDirty}>
              <KeyRound /> {mutation.isPending ? 'Menyimpan…' : 'Ganti kata sandi'}
            </Button>
          </div>
        </form>
      </div>
    </FramedCard>
  )
}
