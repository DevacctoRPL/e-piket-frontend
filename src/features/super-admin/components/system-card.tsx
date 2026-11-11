import {
  ChevronRight,
  Database,
  FileChartColumn,
  RotateCcw,
  ScrollText,
  Server,
  Settings,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FramedCard } from '@/components/framed-card'
import { Button } from '@/components/ui/button'
import { env } from '@/config/env'
import { useAuth } from '@/features/auth/auth-context'
import { formatDate } from '@/lib/date'
import { getErrorMessage } from '@/lib/error-mapping'
import { formatNumber } from '@/lib/format'
import type { Permission, SystemOverview } from '@/types/entities'
import { systemApi } from '../api'
import { SubHeading } from './metric'

type Counts = NonNullable<SystemOverview['system']>['counts']

const COUNT_LABEL: Record<keyof Counts, string> = {
  users: 'Akun',
  teachers: 'Guru',
  students: 'Siswa',
  classes: 'Kelas',
  timetable: 'Slot jadwal',
  auditLogs: 'Audit log',
  loginEvents: 'Riwayat login',
}

const QUICK_LINKS: { to: string; label: string; icon: LucideIcon; permission: Permission }[] = [
  { to: '/pengguna', label: 'Kelola Pengguna', icon: UsersRound, permission: 'user:read' },
  { to: '/master', label: 'Data Master', icon: Database, permission: 'master:write' },
  { to: '/audit', label: 'Audit Log', icon: ScrollText, permission: 'audit:read' },
  { to: '/pengaturan', label: 'Pengaturan', icon: Settings, permission: 'settings:write' },
  { to: '/laporan', label: 'Laporan', icon: FileChartColumn, permission: 'report:read' },
]

/** Kartu "Sistem": versi skema, tanggal seed, jumlah record, reset data demo, dan tautan cepat. */
export function SystemCard({
  system,
  className,
}: {
  system: SystemOverview['system']
  className?: string
}) {
  const { can } = useAuth()
  const [resetOpen, setResetOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const canReset = can('system:manage') && env.enableMockApi
  const links = QUICK_LINKS.filter((l) => can(l.permission))

  return (
    <FramedCard
      title="Sistem"
      titleId="sa-system-title"
      icon={<Server />}
      className={className}
      bodyClassName="gap-4"
    >
      {system ? (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Versi skema</dt>
              <dd className="font-medium text-foreground tabular-nums">v{system.schemaVersion}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-muted-foreground">Tanggal seed</dt>
              <dd className="font-medium text-foreground tabular-nums">{formatDate(system.seedDate)}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-muted-foreground">Sumber data</dt>
              <dd className="font-medium text-foreground">{system.mockApi ? 'Mock API (demo lokal)' : 'API server'}</dd>
            </div>
          </dl>

          <div className="space-y-1.5">
            <SubHeading>Jumlah record</SubHeading>
            <dl className="grid grid-cols-2 gap-x-4 text-xs">
              {(Object.keys(COUNT_LABEL) as (keyof Counts)[]).map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1.5">
                  <dt className="truncate text-muted-foreground">{COUNT_LABEL[k]}</dt>
                  <dd className="font-medium text-foreground tabular-nums">{formatNumber(system.counts[k])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Informasi sistem hanya tersedia untuk pengelola sistem.</p>
      )}

      {links.length > 0 && (
        <div className="space-y-1.5">
          <SubHeading>Tautan cepat</SubHeading>
          <ul className="flex flex-col divide-y divide-border/60" aria-label="Tautan cepat">
            {links.map((l) => {
              const Icon = l.icon
              return (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{l.label}</span>
                    <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {canReset && (
        <>
          <Button variant="outline" className="w-full" onClick={() => setResetOpen(true)}>
            <RotateCcw className="text-tone-danger" /> Reset data demo
          </Button>
          <ConfirmDialog
            open={resetOpen}
            onOpenChange={setResetOpen}
            title="Reset data demo?"
            description="Semua data mock akan dikembalikan ke kondisi awal dan Anda akan keluar."
            confirmLabel="Reset"
            destructive
            pending={pending}
            onConfirm={async () => {
              setPending(true)
              try {
                await systemApi.resetDemo()
                toast.success('Data demo direset.')
                window.location.assign('/login')
              } catch (err) {
                setPending(false)
                toast.error(getErrorMessage(err))
              }
            }}
          />
        </>
      )}
    </FramedCard>
  )
}
