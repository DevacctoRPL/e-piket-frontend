import { LogIn, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react'
import { FramedCard } from '@/components/framed-card'
import { Sparkline } from '@/components/sparkline'
import { formatDateTime } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import type { SystemOverview } from '@/types/entities'
import { InlineEmpty, Metric, SubHeading } from './metric'

/** Kartu "Keamanan & Aktivitas": login hari ini, login gagal, pengguna aktif, percobaan gagal berulang. */
export function SecurityCard({
  security,
  className,
}: {
  security: SystemOverview['security']
  className?: string
}) {
  const failedBad = security.failedToday > 0
  const successSeries = security.series.map((d) => d.success)
  const failedSeries = security.series.map((d) => d.failed)
  return (
    <FramedCard
      title="Keamanan & Aktivitas"
      titleId="sa-security-title"
      icon={<ShieldCheck />}
      className={className}
      bodyClassName="gap-4"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Metric
          label="Login hari ini"
          icon={<LogIn />}
          value={formatNumber(security.loginsToday)}
          hint="Masuk berhasil"
          aside={<Sparkline points={successSeries} tone="good" width={56} height={24} />}
        />
        <Metric
          label="Login gagal"
          icon={<ShieldAlert />}
          iconClassName={failedBad ? 'text-tone-danger' : undefined}
          value={formatNumber(security.failedToday)}
          hint={`${formatNumber(security.failed7d)} dalam 7 hari`}
          aside={<Sparkline points={failedSeries} tone={failedBad ? 'bad' : 'flat'} width={56} height={24} />}
        />
        <Metric
          label="Pengguna aktif"
          icon={<UserCheck />}
          value={formatNumber(security.activeUsers7d)}
          hint="Masuk dalam 7 hari"
        />
      </div>

      <div className="space-y-1.5">
        <SubHeading right="≥3 gagal dalam 24 jam">Percobaan gagal berulang</SubHeading>
        {security.repeatedFailures.length === 0 ? (
          <InlineEmpty>Tidak ada percobaan masuk mencurigakan.</InlineEmpty>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60" aria-label="Percobaan gagal berulang">
            {security.repeatedFailures.map((f) => (
              <li key={`${f.userId ?? 'x'}:${f.username}`} className="flex items-center gap-2.5 py-2 text-xs">
                <ShieldAlert aria-hidden className="size-3.5 shrink-0 text-tone-danger" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono font-medium text-foreground">{f.username}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {f.userId ? 'Akun terdaftar' : 'Username tidak dikenal'} · terakhir {formatDateTime(f.lastAt)}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatNumber(f.count)}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FramedCard>
  )
}
