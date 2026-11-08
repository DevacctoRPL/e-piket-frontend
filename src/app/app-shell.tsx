import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { LogOut, Menu, RotateCcw, School, UserRound, WifiOff } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { TableSkeleton } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { env } from '@/config/env'
import { useAuth, useCurrentUser } from '@/features/auth/auth-context'
import { useActiveAcademicYear } from '@/features/master-data/lookups'
import { useOnline } from '@/hooks/use-online'
import { api } from '@/lib/api-client'
import { ROLE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { NAV_GROUPS, type NavItem } from './navigation'

function useVisibleNav() {
  const { can } = useAuth()
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter(
    (g) => g.items.length > 0,
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useVisibleNav()
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Menu utama">
      {groups.map((g) => (
        <div key={g.label} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {g.label}
          </p>
          {g.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/70',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <School className="size-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-bold">E-Piket</span>
        <span className="block truncate text-xs text-muted-foreground">{env.appName}</span>
      </span>
    </Link>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)
  const initials = user.name
    .replace(/[,.].*$/, '')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Menu akun"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </span>
            <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{user.name}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-1.5">
            <p className="truncate">{user.name}</p>
            <div className="flex flex-wrap gap-1">
              {user.roles.map((r) => (
                <ToneBadge key={r} tone={ROLE_META[r].tone}>
                  {ROLE_META[r].label}
                </ToneBadge>
              ))}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/profil')}>
            <UserRound /> Profil saya
          </DropdownMenuItem>
          {env.enableMockApi && (
            <DropdownMenuItem onSelect={() => setResetOpen(true)}>
              <RotateCcw /> Reset data demo
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset data demo?"
        description="Semua data mock akan dikembalikan ke kondisi awal dan Anda akan keluar."
        confirmLabel="Reset"
        destructive
        onConfirm={async () => {
          await api.post('/__mock/reset')
          toast.success('Data demo direset.')
          window.location.assign('/login')
        }}
      />
    </>
  )
}

function MobileBottomNav() {
  const groups = useVisibleNav()
  const primary: NavItem[] = groups
    .flatMap((g) => g.items)
    .filter((i) => i.mobilePrimary)
    .slice(0, 4)
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Navigasi cepat"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0,1fr))` }}>
        {primary.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground',
                  isActive && 'text-primary',
                )
              }
            >
              <item.icon className="size-5" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function GlobalActivity() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const busy = fetching + mutating > 0
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary transition-opacity duration-300',
        busy ? 'animate-pulse opacity-100' : 'opacity-0',
      )}
    />
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const online = useOnline()
  const { year, semester } = useActiveAcademicYear()
  const location = useLocation()
  return (
    <div className="min-h-dvh bg-background">
      <GlobalActivity />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Lompat ke konten
      </a>
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        {env.enableMockApi && (
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">Mode demo · data tiruan (mock API)</p>
        )}
      </aside>

      {/* Sheet menu ponsel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="h-16 justify-center border-b p-0">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="md:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:h-16 sm:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {year ? `Tahun Ajaran ${year.name}` : ''}
              {semester ? ` · Semester ${semester.name}` : ''}
            </p>
          </div>
          <UserMenu />
        </header>
        {!online && (
          <div role="status" className="no-print flex items-center gap-2 bg-tone-warning-bg px-4 py-2 text-sm text-tone-warning sm:px-6">
            <WifiOff className="size-4" /> Anda sedang offline. Isian tetap tersimpan di halaman; kirim ulang setelah koneksi pulih.
          </div>
        )}
        <main id="main" className="px-3 pt-4 pb-24 sm:px-6 sm:pt-6 md:pb-10 print:p-0">
          <Suspense key={location.pathname} fallback={<TableSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
