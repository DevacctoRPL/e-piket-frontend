import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  FolderKanban,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  PanelLeft,
  RotateCcw,
  Search,
  Settings,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { Logo } from '@/components/logo'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CountChip } from '@/components/framed-card'
import { SearchField } from '@/components/search-field'
import { TableSkeleton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { useDashboardSummary } from '@/features/dashboard/queries'
import { useActiveAcademicYear } from '@/features/master-data/lookups'
import { useOnline } from '@/hooks/use-online'
import { api } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { ROLE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import { findNavContext, NAV_GROUPS, type NavItem } from './navigation'

/** Label pintasan pencarian sesuai platform. */
const SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
    ? '⌘K'
    : 'Ctrl K'

/** Penanda sub-menu "↳" bersudut membulat (seperti referensi), selebar ikon induk agar label sejajar. */
function SubItemArrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-muted-foreground/80"
    >
      <path d="M3.5 2.5v5.25a3 3 0 0 0 3 3h6.5" />
      <path d="M10.5 8.25 13 10.75l-2.5 2.5" />
    </svg>
  )
}

function useVisibleNav() {
  const { can } = useAuth()
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter(
    (g) => g.items.length > 0,
  )
}

const PARENT_ICONS: Record<string, typeof Layers> = {
  'Kehadiran Harian': Layers,
  'KBM & Operasional': FolderKanban,
}

function NavList({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void
  collapsed?: boolean
}) {
  const groups = useVisibleNav()
  const location = useLocation()
  const [closedParents, setClosedParents] = useState<Record<string, boolean>>({})

  const toggleParent = (parent: string) => {
    setClosedParents((prev) => ({ ...prev, [parent]: !prev[parent] }))
  }

  return (
    <nav className="flex flex-col gap-4 px-3 py-3" aria-label="Menu utama">
      {groups.map((g) => {
        // Kelompokkan item berurutan yang memiliki parentGroup sama
        const blocks: Array<
          | { type: 'single'; item: NavItem }
          | { type: 'parent'; name: string; items: NavItem[] }
        > = []
        for (const item of g.items) {
          if (!item.parentGroup || collapsed) {
            blocks.push({ type: 'single', item })
          } else {
            const last = blocks[blocks.length - 1]
            if (last && last.type === 'parent' && last.name === item.parentGroup) {
              last.items.push(item)
            } else {
              blocks.push({ type: 'parent', name: item.parentGroup, items: [item] })
            }
          }
        }

        return (
          <div key={g.label} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/85 uppercase">
                {g.label}
              </p>
            )}
            {blocks.map((block) => {
              if (block.type === 'single') {
                const item = block.item
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-card/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                        collapsed && 'justify-center px-2 py-2',
                        isActive && 'bg-card text-foreground shadow-2xs ring-1 ring-border/90',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
                  </NavLink>
                )
              }

              const isOpen = !closedParents[block.name]
              const hasActiveChild = block.items.some((i) =>
                i.to === '/'
                  ? location.pathname === '/'
                  : location.pathname === i.to || location.pathname.startsWith(`${i.to}/`),
              )
              const ParentIcon = PARENT_ICONS[block.name] ?? Layers

              return (
                <div key={block.name} className="space-y-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => toggleParent(block.name)}
                    aria-expanded={isOpen}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-card/60 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                      hasActiveChild && 'text-foreground',
                    )}
                  >
                    <ParentIcon className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{block.name}</span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-in-out)]',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {/* Sub-menu bergaya referensi Nuvio: penanda "↳" abu + label, sejajar ikon induk */}
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none',
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}
                    inert={!isOpen}
                  >
                    <div className="min-h-0 space-y-0.5 overflow-hidden">
                      {block.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/'}
                          onClick={onNavigate}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-sidebar-foreground/90 transition-colors hover:bg-card/70 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                              isActive && 'bg-card font-medium text-foreground shadow-2xs ring-1 ring-border/90',
                            )
                          }
                        >
                          <SubItemArrow />
                          <item.icon className="-ml-1 size-4 shrink-0 opacity-80" aria-hidden />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="E-Piket — ke Dashboard"
      className="flex min-w-0 items-center rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Logo collapsed={collapsed} markClassName="size-8" />
    </Link>
  )
}

function SidebarProfileCard({ collapsed = false }: { collapsed?: boolean }) {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Profil sidebar"
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border border-border/80 bg-card p-1.5 text-left shadow-2xs transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              collapsed && 'justify-center',
            )}
          >
            <Avatar name={user.name} variant="solid" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {user.email ?? `@${user.username}`}
                  </span>
                </span>
                <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuLabel className="space-y-0.5">
            <p className="truncate text-xs font-semibold">{user.name}</p>
            {user.roles.length > 0 && (
              <p className="text-xs font-normal text-muted-foreground">
                {user.roles.map((r) => ROLE_META[r].label).join(' · ')}
              </p>
            )}
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

function TaskNotificationsMenu() {
  const navigate = useNavigate()
  const summaryQ = useDashboardSummary({ date: todayISO(), shiftCode: null })
  const tasks = summaryQ.data?.pendingTasks ?? []
  const count = tasks.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Ringkasan & pengingat tugas"
          aria-label="Notifikasi tugas"
          className="relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-accent data-[state=open]:text-foreground"
        >
          <Bell className="size-4" aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-tone-danger ring-2 ring-card"
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span>Pengingat Tugas Hari Ini</span>
          <CountChip>{count}</CountChip>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="flex items-center gap-2.5 px-3 py-4 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-tone-success" aria-hidden />
            <span>Semua tugas operasional hari ini sudah diselesaikan.</span>
          </div>
        ) : (
          tasks.slice(0, 6).map((task) => (
            <DropdownMenuItem
              key={task.id}
              onSelect={() => navigate(task.href)}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="line-clamp-1 text-xs font-semibold text-foreground">
                {task.title}
              </span>
              <span className="line-clamp-1 text-[11px] text-muted-foreground">
                {task.description}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate('/')}
          className="justify-center text-xs font-semibold text-primary"
        >
          Lihat semua di Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Menu akun"
          >
            <Avatar name={user.name} size="sm" variant="solid" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-0.5">
            <p className="truncate">{user.name}</p>
            {user.roles.length > 0 && (
              <p className="text-xs font-normal text-muted-foreground">
                {user.roles.map((r) => ROLE_META[r].label).join(' · ')}
              </p>
            )}
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

function CommandSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const groups = useVisibleNav()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(term) ||
            (i.parentGroup && i.parentGroup.toLowerCase().includes(term)) ||
            g.label.toLowerCase().includes(term),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, q])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQ('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md gap-3 p-4">
        <DialogHeader className="sr-only">
          <DialogTitle>Cari menu navigasi</DialogTitle>
          <DialogDescription>Ketik nama modul untuk berpindah halaman dengan cepat.</DialogDescription>
        </DialogHeader>
        <SearchField
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Cari halaman…"
          aria-label="Cari halaman atau fitur"
        />
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tidak ada menu yang cocok dengan &ldquo;{q}&rdquo;.
            </p>
          ) : (
            filtered.map((g) => (
              <div key={g.label} className="space-y-1">
                <p className="px-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {g.label}
                </p>
                {g.items.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      setQ('')
                      navigate(item.to)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.parentGroup && (
                      <span className="text-xs text-muted-foreground">{item.parentGroup}</span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
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
                  isActive && 'font-semibold text-foreground',
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
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary/70 transition-opacity duration-300',
        busy ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}

/** Pengingat kecil netral bila akun memakai kata sandi sementara (disembunyikan di halaman profil). */
function MustChangePasswordBanner() {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user.mustChangePassword || location.pathname === '/profil') return null
  return (
    <div
      role="status"
      className="no-print flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/60 bg-card px-4 py-2 text-[13px] sm:px-6"
    >
      <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-foreground/85">Anda masih memakai kata sandi sementara.</span>
      <Link to="/profil" className="font-medium text-foreground underline underline-offset-2 hover:no-underline">
        Ganti kata sandi
      </Link>
    </div>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const online = useOnline()
  const { year, semester } = useActiveAcademicYear()
  const location = useLocation()
  const navigate = useNavigate()
  const { can } = useAuth()
  const navContext = findNavContext(location.pathname)
  const BreadcrumbIcon = navContext.icon

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="min-h-dvh bg-background">
      <GlobalActivity />
      <CommandSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Lompat ke konten
      </a>

      {/* Sidebar desktop bergaya Nuvio */}
      <aside
        className={cn(
          'no-print fixed inset-y-0 left-0 z-30 hidden flex-col bg-sidebar transition-[width] duration-[260ms] ease-[var(--ease-in-out)] motion-reduce:transition-none md:flex',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center justify-between px-4',
            collapsed && 'justify-center px-2',
          )}
        >
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Lipat sidebar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
        </div>

        {/* Pencarian cepat ⌘K */}
        <div className="px-3 pb-1">
          {collapsed ? (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={`Cari menu (${SHORTCUT})`}
              title={`Cari menu (${SHORTCUT})`}
              className="flex h-8 w-full items-center justify-center rounded-md border border-border/80 bg-card text-muted-foreground shadow-2xs hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Search className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-full items-center gap-2 rounded-md border border-border/80 bg-card px-2.5 text-xs text-muted-foreground shadow-2xs transition-colors hover:border-border hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Search className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1 text-left">Cari menu</span>
              <kbd className="rounded-sm border border-border bg-muted/60 px-1 font-sans text-[10px] font-medium text-muted-foreground">
                {SHORTCUT}
              </kbd>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>

        <div className="space-y-2 p-3">
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Bentangkan sidebar"
              className="flex w-full items-center justify-center rounded-md py-1.5 text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
          <SidebarProfileCard collapsed={collapsed} />
        </div>
      </aside>

      {/* Sheet menu ponsel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="h-14 justify-center border-b px-4">
            <SheetTitle asChild>
              <div>
                <Brand />
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t p-3">
            <SidebarProfileCard />
          </div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          'min-h-dvh transition-[padding] duration-[260ms] ease-[var(--ease-in-out)] motion-reduce:transition-none md:py-2 md:pr-2 print:m-0 print:p-0',
          collapsed ? 'md:pl-[68px]' : 'md:pl-64',
        )}
      >
        <div className="flex min-h-dvh flex-col bg-card md:min-h-[calc(100dvh-1rem)] md:rounded-xl md:border md:border-border/85 md:shadow-2xs print:min-h-0 print:rounded-none print:border-0 print:shadow-none">
          <header className="no-print sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border/60 bg-card/95 px-3 backdrop-blur sm:px-6 md:rounded-t-xl">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
            >
              <Menu />
            </Button>

            {/* Breadcrumb kontekstual bergaya Nuvio */}
            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-2 text-[13px]">
              <BreadcrumbIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="hidden truncate text-muted-foreground sm:inline">{navContext.category}</span>
              <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
                /
              </span>
              <span aria-current="page" className="truncate font-medium text-foreground">
                {navContext.label}
              </span>
            </nav>

            <div className="flex items-center gap-1">
              {(year || semester) && (
                <>
                  <span className="hidden items-center text-xs text-muted-foreground tabular-nums lg:inline-flex">
                    {year ? `Tahun Ajaran ${year.name}` : ''}
                    {semester ? `${year ? ' · ' : ''}Semester ${semester.name}` : ''}
                  </span>
                  <span aria-hidden className="mx-2 hidden h-4 w-px bg-border lg:block" />
                </>
              )}
              <TaskNotificationsMenu />
              <button
                type="button"
                onClick={() => navigate(can('settings:write') ? '/pengaturan' : '/profil')}
                title={can('settings:write') ? 'Pengaturan sekolah' : 'Profil & preferensi'}
                aria-label="Pengaturan cepat"
                className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:flex"
              >
                <Settings className="size-4" aria-hidden />
              </button>
              {/* Desktop: akun cukup lewat kartu profil sidebar; menu akun topbar untuk ponsel */}
              <div className="md:hidden">
                <UserMenu />
              </div>
            </div>
          </header>

          {!online && (
            <div
              role="status"
              className="no-print flex items-center gap-2 border-b border-l-2 border-border/60 border-l-tone-warning bg-card px-4 py-2 text-[13px] sm:px-6"
            >
              <WifiOff className="size-4 shrink-0 text-tone-warning" aria-hidden /> Anda sedang offline. Isian tetap tersimpan di halaman;
              kirim ulang setelah koneksi pulih.
            </div>
          )}
          <MustChangePasswordBanner />
          <main id="main" className="flex-1 px-3 pt-4 pb-24 sm:px-6 sm:pt-5 md:pb-10 print:p-0">
            <Suspense key={location.pathname} fallback={<TableSkeleton />}>
              {/* Konten rute baru masuk halus (fade + geser 4px) */}
              <div key={location.pathname} className="page-enter">
                <Outlet />
              </div>
            </Suspense>
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  )
}
