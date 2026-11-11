import { ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import type { Permission } from '@/types/entities'

export function FullPageLoader({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <span className="size-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        {label}
      </div>
    </div>
  )
}

/** Wajib login; simpan tujuan di ?next= (FR-AUTH-03). */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'booting') return <FullPageLoader label="Memeriksa sesi…" />
  if (status === 'anonymous') {
    const next = location.pathname + location.search
    return <Navigate to={`/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />
  }
  return <Outlet />
}

export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'booting') return <FullPageLoader label="Memeriksa sesi…" />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <>{children}</>
}

/** Route guard berbasis permission (FR-AUTH-02, AC-13). */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission | Permission[]
  children?: ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) return <ForbiddenPage />
  return <>{children ?? <Outlet />}</>
}

export function ForbiddenPage({ message }: { message?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-lg border border-border/85 bg-card text-tone-danger shadow-2xs">
        <ShieldX className="size-5" />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Akses ditolak</h1>
        <p className="text-[13px] text-pretty text-muted-foreground">
          {message ?? 'Anda tidak memiliki izin untuk membuka halaman ini. Hubungi admin sekolah bila Anda merasa memerlukan akses.'}
        </p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Kembali ke dashboard</Link>
      </Button>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="text-4xl font-semibold tracking-tight text-muted-foreground/40 tabular-nums">404</p>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="text-[13px] text-pretty text-muted-foreground">Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
      </div>
      <Button asChild variant="outline">
        <Link to="/">Kembali ke dashboard</Link>
      </Button>
    </div>
  )
}
