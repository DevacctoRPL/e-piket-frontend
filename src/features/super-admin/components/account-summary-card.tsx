import { ChevronRight, UserRoundX, UsersRound } from 'lucide-react'
import { Link } from 'react-router'
import { FramedCard } from '@/components/framed-card'
import { Button } from '@/components/ui/button'
import { ROLE_META } from '@/lib/enums'
import { formatNumber } from '@/lib/format'
import type { SystemOverview } from '@/types/entities'
import { Metric, SubHeading } from './metric'

/** Kartu "Akun & Peran": jumlah akun dan rincian per peran yang dapat ditelusuri ke Kelola Pengguna. */
export function AccountSummaryCard({
  accounts,
  className,
}: {
  accounts: SystemOverview['accounts']
  className?: string
}) {
  return (
    <FramedCard
      title="Akun & Peran"
      titleId="sa-accounts-title"
      icon={<UsersRound />}
      className={className}
      bodyClassName="gap-4"
      headerRight={
        <Button asChild variant="ghost" size="sm">
          <Link to="/pengguna">
            Kelola <ChevronRight className="text-muted-foreground" />
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Total akun" value={formatNumber(accounts.total)} href="/pengguna" />
        <Metric label="Aktif" value={formatNumber(accounts.active)} href="/pengguna?status=ACTIVE" />
        <Metric
          label="Nonaktif"
          value={formatNumber(accounts.inactive)}
          icon={<UserRoundX />}
          href="/pengguna?status=INACTIVE"
        />
        <Metric
          label="Belum pernah masuk"
          value={formatNumber(accounts.neverLoggedIn)}
          hint={accounts.mustChangePassword > 0 ? `${accounts.mustChangePassword} wajib ganti sandi` : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <SubHeading right="aktif / total">Per peran</SubHeading>
        <ul className="flex flex-col divide-y divide-border/60" aria-label="Jumlah akun per peran">
          {accounts.byRole.map((r) => {
            const meta = ROLE_META[r.role]
            const Icon = meta.icon
            return (
              <li key={r.role}>
                <Link
                  to={`/pengguna?role=${encodeURIComponent(r.role)}`}
                  className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
                    {Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-border" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{meta.label}</span>
                  <span className="tabular-nums text-foreground">
                    {formatNumber(r.active)}
                    <span className="text-muted-foreground">/{formatNumber(r.total)}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </FramedCard>
  )
}
