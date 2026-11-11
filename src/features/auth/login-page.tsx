import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Clock3, Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { LogoMark } from '@/components/logo'
import { MetaTag } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { env } from '@/config/env'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import gedungBg from '../../../Gedung.png'
import { useAuth } from './auth-context'

const schema = z.object({
  username: z.string().trim().min(1, 'Nama pengguna wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
})
type FormValues = z.infer<typeof schema>

const TOP_DEMO_ACCOUNTS = [
  ['superadmin', 'Super Admin'],
  ['admin', 'Admin/TU'],
  ['kepsek', 'Pimpinan'],
] as const

const BOTTOM_DEMO_ACCOUNTS = [
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
  const [forgotOpen, setForgotOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const usernameId = useId()
  const passwordId = useId()
  const usernameErrorId = `${usernameId}-error`
  const passwordErrorId = `${passwordId}-error`

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } })

  const activeUser = watch('username')

  const fillDemo = (username: string) => {
    setFormError(null)
    setValue('username', username, { shouldValidate: true })
    setValue('password', 'password', { shouldValidate: true })
  }

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-900 p-4 sm:p-6">
      {/* Foto latar Gedung SMK Plus Pelita Nusantara */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <img
          src={gedungBg}
          alt=""
          draggable={false}
          className="size-full object-cover object-center select-none"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(15, 23, 42, 0.10) 0%, rgba(15, 23, 42, 0.42) 100%)',
          }}
        />
      </div>

      {/* Kartu login berbingkai (nested frame bergaya Nuvio) tepat di tengah */}
      <main className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-[20px] border border-white/55 bg-background/95 p-1.5 shadow-[0_28px_70px_-12px_rgba(15,23,42,0.48),0_0_0_1px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          {/* Header identitas terintegrasi di dalam bingkai atas kartu */}
          <div className="bg-hatch flex items-center justify-between gap-3 rounded-t-[14px] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/85 bg-card shadow-2xs">
                <LogoMark tone="dark" className="size-5" decorative />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-bold tracking-tight text-foreground">E-Piket</p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">SMK Plus Pelita Nusantara</p>
              </div>
            </div>
            <MetaTag className="bg-card/90">Portal Sekolah</MetaTag>
          </div>

          {/* Permukaan utama form login */}
          <div className="rounded-[14px] border border-border/85 bg-card px-6 py-6 shadow-2xs sm:px-7 sm:py-7">
            <div className="mb-6 space-y-1 text-center">
              <h1 className="text-[21px] font-bold tracking-tight text-foreground">Masuk</h1>
              <p className="text-xs text-muted-foreground">Masukkan detail akun Anda untuk melanjutkan</p>
            </div>

            {sessionExpired && !formError && (
              <Alert variant="warning" className="mb-4">
                <Clock3 />
                <AlertDescription>Sesi Anda telah berakhir. Silakan masuk kembali.</AlertDescription>
              </Alert>
            )}
            {formError && (
              <Alert variant="destructive" className="mb-4">
                <CircleAlert />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* Field Nama pengguna */}
              <div className="grid gap-1.5">
                <Label htmlFor={usernameId} className="text-xs font-medium text-foreground/85">
                  Nama pengguna
                </Label>
                <div className="relative">
                  <UserRound
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={usernameId}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoFocus
                    placeholder="Masukkan nama pengguna"
                    aria-required="true"
                    aria-invalid={errors.username ? true : undefined}
                    aria-describedby={errors.username ? usernameErrorId : undefined}
                    className="h-10 pl-9 pr-3.5 text-[13px]"
                    {...register('username')}
                  />
                </div>
                {errors.username?.message && (
                  <p id={usernameErrorId} className="text-xs font-medium text-destructive" role="alert">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Field Kata sandi */}
              <div className="grid gap-1.5">
                <Label htmlFor={passwordId} className="text-xs font-medium text-foreground/85">
                  Kata sandi
                </Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    aria-required="true"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? passwordErrorId : undefined}
                    className="h-10 pl-9 pr-9 text-[13px]"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {errors.password?.message && (
                  <p id={passwordErrorId} className="text-xs font-medium text-destructive" role="alert">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Baris Lupa kata sandi */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setForgotOpen((v) => !v)}
                  aria-expanded={forgotOpen}
                  className="rounded-sm text-xs font-medium text-foreground/80 underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Lupa kata sandi?
                </button>
              </div>

              {forgotOpen && (
                <p className="rounded-lg border border-border/80 bg-muted/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Hubungi <strong className="font-medium text-foreground">Super Admin</strong> sekolah untuk mereset
                  kata sandi akun Anda.
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-10 w-full rounded-lg text-[13px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(15,23,42,0.18)]"
                disabled={isSubmitting}
              >
                <LogIn className="size-4" />
                {isSubmitting ? 'Memproses…' : 'Masuk'}
              </Button>
            </form>
          </div>

          {/* Bagian bawah bingkai: pemilih akun demo terstruktur */}
          {env.enableMockApi && (
            <div className="px-3.5 pt-2.5 pb-2">
              <div className="flex items-center justify-between px-0.5 text-[11px] text-muted-foreground">
                <span className="font-medium">Akun demo (klik untuk isi)</span>
                <span>
                  Sandi:{' '}
                  <code className="rounded border border-border/80 bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                    password
                  </code>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {TOP_DEMO_ACCOUNTS.map(([u, label]) => {
                  const selected = activeUser === u
                  return (
                    <Button
                      key={u}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      className={cn('h-7 w-full px-2 text-xs', !selected && 'bg-card/90 hover:bg-card')}
                      onClick={() => fillDemo(u)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {BOTTOM_DEMO_ACCOUNTS.map(([u, label]) => {
                  const selected = activeUser === u
                  return (
                    <Button
                      key={u}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      className={cn('h-7 w-full px-2 text-xs', !selected && 'bg-card/90 hover:bg-card')}
                      onClick={() => fillDemo(u)}
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
