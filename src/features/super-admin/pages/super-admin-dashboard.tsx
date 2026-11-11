import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ErrorState, Page } from '@/components/page'
import { SegmentedControl } from '@/components/segmented-control'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useCurrentUser } from '@/features/auth/auth-context'
import { OperationalDashboard } from '@/features/dashboard/pages/dashboard-page'
import { dashboardKeys } from '@/features/dashboard/queries'
import { greeting } from '@/features/dashboard/utils'
import { formatDateLong, todayISO } from '@/lib/date'
import { ROLE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { SystemOverview } from '@/types/entities'
import { AccountSummaryCard } from '../components/account-summary-card'
import { DataHealthCard } from '../components/data-health-card'
import { ImportantEventsCard } from '../components/important-events-card'
import { MasterGapsCard } from '../components/master-gaps-card'
import { OperationalStrip } from '../components/operational-strip'
import { SecurityCard } from '../components/security-card'
import { SystemCard } from '../components/system-card'
import { systemKeys, useSystemOverview } from '../queries'

type View = 'sistem' | 'operasional'

const VIEWS = [
  { value: 'sistem' as const, label: 'Sistem' },
  { value: 'operasional' as const, label: 'Operasional' },
]

/**
 * Dashboard Super Admin (pemilik sistem satu sekolah): tampilan "Sistem" berisi akun, keamanan,
 * kesehatan data, celah data master, kejadian penting, dan info sistem; tampilan "Operasional"
 * memakai dashboard operasional yang sama dengan Admin/TU.
 */
export function SuperAdminDashboard() {
  const user = useCurrentUser()
  const qc = useQueryClient()
  const [sp, setSp] = useSearchParams()
  const view: View = sp.get('view') === 'operasional' ? 'operasional' : 'sistem'
  const today = todayISO()
  const fetching = useIsFetching({ queryKey: systemKeys.all }) + useIsFetching({ queryKey: dashboardKeys.all }) > 0

  const setView = (v: View) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (v === 'sistem') next.delete('view')
        else next.set('view', v)
        return next
      },
      { replace: true },
    )

  const reload = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: systemKeys.all, type: 'active' }),
      qc.refetchQueries({ queryKey: dashboardKeys.all, type: 'active' }),
    ])
    // refetchQueries tidak melempar galat — periksa status query aktif agar tidak menampilkan sukses palsu.
    const failed = [systemKeys.all, dashboardKeys.all].some((queryKey) =>
      qc.getQueryCache().findAll({ queryKey, type: 'active' }).some((q) => q.state.status === 'error'),
    )
    if (failed) toast.error('Sebagian ringkasan gagal dimuat ulang.')
    else toast.success('Dashboard diperbarui.')
  }

  return (
    <Page className="gap-5">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-[22px]">
            {greeting()}, {user.name}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {formatDateLong(today)}
            {user.roles.length > 0 && (
              <>
                <span aria-hidden> · </span>
                Peran:{' '}
                <span className="font-medium text-foreground/85">
                  {user.roles.map((r) => ROLE_META[r].label).join(', ')}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl ariaLabel="Tampilan dashboard" value={view} onChange={setView} options={VIEWS} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => void reload()}
            disabled={fetching}
            aria-label="Muat ulang dashboard"
            title="Muat ulang"
          >
            <RefreshCw className={cn(fetching && 'animate-spin')} aria-hidden />
          </Button>
        </div>
      </div>

      {view === 'sistem' ? <SystemView date={today} /> : <OperationalDashboard hideGreeting />}
    </Page>
  )
}

function SystemView({ date }: { date: string }) {
  const q = useSystemOverview(date)
  return (
    <div className="flex flex-col gap-5">
      <OperationalStrip />
      <p className="sr-only" role="status" aria-live="polite">
        {q.isFetching && q.data ? 'Memperbarui ringkasan sistem…' : ''}
      </p>
      {q.isPending ? (
        <SystemSkeleton />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <SystemGrid overview={q.data} stale={q.isPlaceholderData} />
      )}
    </div>
  )
}

function SystemGrid({ overview, stale }: { overview: SystemOverview; stale: boolean }) {
  return (
    <div className={cn('grid gap-5 transition-opacity lg:grid-cols-12', stale && 'opacity-60')}>
      <AccountSummaryCard accounts={overview.accounts} className="lg:col-span-6" />
      <SecurityCard security={overview.security} className="lg:col-span-6" />
      <DataHealthCard health={overview.dataHealth} className="lg:col-span-8" />
      <MasterGapsCard gaps={overview.dataHealth.gaps} className="lg:col-span-4" />
      <ImportantEventsCard events={overview.importantEvents} className="lg:col-span-8" />
      <SystemCard system={overview.system} className="lg:col-span-4" />
    </div>
  )
}

function SystemSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-12" aria-busy="true" aria-label="Memuat ringkasan sistem">
      <Skeleton className="h-72 rounded-xl lg:col-span-6" />
      <Skeleton className="h-72 rounded-xl lg:col-span-6" />
      <Skeleton className="h-64 rounded-xl lg:col-span-8" />
      <Skeleton className="h-64 rounded-xl lg:col-span-4" />
      <Skeleton className="h-80 rounded-xl lg:col-span-8" />
      <Skeleton className="h-80 rounded-xl lg:col-span-4" />
    </div>
  )
}
