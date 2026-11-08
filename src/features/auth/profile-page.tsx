import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Pencil, Save, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { Page, PageHeader } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useClasses, useSubjects, useTeachers } from '@/features/master-data/lookups'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import { ROLE_META } from '@/lib/enums'
import type { CurrentUser } from '@/types/entities'
import { useCurrentUser } from './auth-context'
import { profileSchema, type ProfileFormValues } from './profile-schema'
import { useUpdateProfile } from './profile-queries'

function initials(name: string) {
  return (
    name
      .replace(/[^A-Za-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function ProfilePage() {
  const user = useCurrentUser()
  const [editing, setEditing] = useState(false)

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Profil Saya" description="Identitas akun, peran, dan keterkaitan dengan data guru." />

      <Card>
        <CardContent className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-lg font-semibold break-words">{user.name}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Peran">
              {user.roles.map((r) => (
                <li key={r}>
                  <StatusBadge meta={ROLE_META} value={r} />
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Akun</CardTitle>
            <CardDescription>Nama dan email dapat Anda ubah sendiri.</CardDescription>
            {!editing && (
              <CardAction>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil /> Ubah
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <ProfileForm user={user} onDone={() => setEditing(false)} />
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="font-medium break-words">{user.name}</dd>
                <dt className="text-muted-foreground">Nama pengguna</dt>
                <dd className="font-mono break-all">{user.username}</dd>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all">{user.email ?? <span className="text-muted-foreground">Belum diisi</span>}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <TeacherInfoCard user={user} />

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" /> Keamanan
            </CardTitle>
            <CardDescription>
              Perubahan kata sandi dan nama pengguna dikelola oleh Admin/TU sekolah. Hubungi admin bila Anda lupa kata
              sandi atau menduga akun digunakan orang lain. Selalu keluar dari aplikasi setelah memakai perangkat
              bersama.
            </CardDescription>
          </CardHeader>
        </Card>
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
      <Card>
        <CardHeader>
          <CardTitle>Data Guru</CardTitle>
          <CardDescription>Akun ini tidak terhubung dengan data guru.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <UserRound className="size-5 shrink-0" />
            Akun staf/pimpinan tanpa jadwal mengajar. Bila Anda juga mengajar, minta admin menautkan akun ke data guru.
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Data Guru</CardTitle>
        <CardDescription>Ditautkan oleh admin dari data master guru.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : teachers.isError ? (
          <p className="text-sm text-muted-foreground">Data guru tidak dapat dimuat. {getErrorMessage(teachers.error)}</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
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
      </CardContent>
    </Card>
  )
}
