import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn, School } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { env } from '@/config/env'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import { useAuth } from './auth-context'

const schema = z.object({
  username: z.string().trim().min(1, 'Nama pengguna wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})
type FormValues = z.infer<typeof schema>

const DEMO_ACCOUNTS = [
  ['admin', 'Admin/TU'],
  ['kepsek', 'Pimpinan'],
  ['piket', 'Guru Piket'],
  ['guru', 'Guru'],
  ['walikelas', 'Wali Kelas'],
  ['koordinator', 'Koordinator'],
] as const

/** Hanya izinkan redirect ke path internal (cegah open redirect). */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export function LoginPage() {
  const { login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values)
      navigate(safeNext(sp.get('next')), { replace: true })
    } catch (e) {
      if (!applyServerErrors(e, setError, ['username', 'password'])) {
        setFormError(
          e instanceof ApiError && e.status === 422 ? e.message : getErrorMessage(e),
        )
      }
    }
  })

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
            <School className="size-5" />
          </span>
          <span className="text-lg font-bold">E-Piket</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-bold text-balance">Catat sekali, gunakan berkali-kali.</h2>
          <p className="text-pretty text-primary-foreground/80">
            Absensi siswa dan guru, agenda piket, jurnal mengajar, dan penanganan jam kosong dalam satu
            sumber data — rekap harian siap tanpa menyalin ulang buku.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">{env.appName}</p>
        <div aria-hidden className="absolute -right-24 -bottom-24 size-96 rounded-full bg-white/5" />
        <div aria-hidden className="absolute -top-16 right-24 size-48 rounded-full bg-white/5" />
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <School className="size-5" />
              </span>
              <span className="font-bold">E-Piket</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Masuk</h1>
            <p className="text-sm text-muted-foreground">Gunakan akun yang diberikan sekolah.</p>
          </div>

          {sessionExpired && !formError && (
            <Alert variant="warning">
              <AlertDescription>Sesi Anda telah berakhir. Silakan masuk kembali.</AlertDescription>
            </Alert>
          )}
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField label="Nama pengguna" error={errors.username?.message} required>
              <Input autoComplete="username" autoCapitalize="none" autoFocus {...register('username')} />
            </FormField>
            <FormField label="Kata sandi" error={errors.password?.message} required>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              <LogIn /> {isSubmitting ? 'Memproses…' : 'Masuk'}
            </Button>
          </form>

          {env.enableMockApi && (
            <div className="space-y-2 rounded-xl border border-dashed p-4">
              <p className="text-xs font-semibold text-muted-foreground">
                Akun demo (kata sandi: <span className="font-mono">password</span>)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_ACCOUNTS.map(([u, label]) => (
                  <Button
                    key={u}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setValue('username', u)
                      setValue('password', 'password')
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
