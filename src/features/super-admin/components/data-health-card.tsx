import { CircleAlert, CircleCheck, CircleDashed, HeartPulse, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { CountChip, FramedCard } from '@/components/framed-card'
import { formatDateShort } from '@/lib/date'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Completeness, SystemOverview } from '@/types/entities'
import { InlineEmpty, SubHeading } from './metric'

type Day = SystemOverview['dataHealth']['days'][number]

const ROWS: { key: 'attendance' | 'teachingLogs' | 'dutyAgendas'; label: string; href: string }[] = [
  { key: 'attendance', label: 'Absensi siswa', href: '/absensi-siswa' },
  { key: 'teachingLogs', label: 'Jurnal', href: '/jurnal-mengajar' },
  { key: 'dutyAgendas', label: 'Agenda piket', href: '/agenda-piket' },
]

function cellState(c: Completeness): { icon: LucideIcon | null; className: string; label: string } {
  if (c.expected <= 0) return { icon: null, className: 'text-muted-foreground', label: 'tidak terjadwal' }
  if (c.done >= c.expected) return { icon: CircleCheck, className: 'text-tone-success', label: 'lengkap' }
  if (c.done > 0) return { icon: CircleDashed, className: 'text-tone-warning', label: 'sebagian' }
  return { icon: CircleAlert, className: 'text-tone-danger', label: 'belum ada' }
}

/** Kartu "Kesehatan Data": kelengkapan absensi, jurnal, dan agenda piket 7 hari sekolah terakhir. */
export function DataHealthCard({
  health,
  className,
}: {
  health: SystemOverview['dataHealth']
  className?: string
}) {
  const days: Day[] = health.days
  return (
    <FramedCard
      title="Kesehatan Data"
      titleId="sa-health-title"
      icon={<HeartPulse />}
      titleBadge={<CountChip>{formatPercent(health.completenessPct)}</CountChip>}
      description="Kelengkapan 7 hari sekolah terakhir"
      className={className}
      bodyClassName="gap-4"
    >
      {days.length === 0 ? (
        <InlineEmpty>Belum ada hari sekolah dalam rentang ini.</InlineEmpty>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-xs">
            <caption className="sr-only">
              Kelengkapan data per hari, kelengkapan total {formatPercent(health.completenessPct)}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-28 pb-2 text-left font-medium text-muted-foreground">
                  <span className="sr-only">Jenis data</span>
                </th>
                {days.map((d) => (
                  <th
                    key={d.date}
                    scope="col"
                    className="pb-2 text-center font-medium whitespace-nowrap text-muted-foreground"
                    title={formatDateShort(d.date)}
                  >
                    {d.dayShort}
                    <span className="block text-[10px] font-normal tabular-nums text-muted-foreground/80">
                      {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="border-t border-border/60 py-2 pr-2 text-left font-medium text-foreground">
                    <Link to={row.href} className="rounded-sm hover:underline focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                      {row.label}
                    </Link>
                  </th>
                  {days.map((d) => {
                    const c = d[row.key]
                    const s = cellState(c)
                    const Icon = s.icon
                    return (
                      <td key={d.date} className="border-t border-border/60 px-1 py-2 text-center">
                        <span
                          className="inline-flex items-center gap-1 tabular-nums text-foreground/85"
                          title={`${row.label} ${formatDateShort(d.date)}: ${c.done}/${c.expected} (${s.label})`}
                        >
                          {Icon ? (
                            <Icon aria-hidden className={cn('size-3.5 shrink-0', s.className)} />
                          ) : null}
                          {c.expected <= 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span>
                              {formatNumber(c.done)}
                              <span className="text-muted-foreground">/{formatNumber(c.expected)}</span>
                            </span>
                          )}
                          <span className="sr-only"> ({s.label})</span>
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5">
        <SubHeading right="hari tanpa absensi">Kelas paling tertinggal</SubHeading>
        {health.classes.length === 0 ? (
          <InlineEmpty>Semua kelas sudah mengirim absensi.</InlineEmpty>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60" aria-label="Kelas paling tertinggal">
            {health.classes.map((c) => (
              <li key={c.classId}>
                <Link
                  to={`/absensi-siswa?classId=${encodeURIComponent(c.classId)}`}
                  className="-mx-1.5 flex items-center gap-2.5 rounded-md px-1.5 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <CircleAlert
                    aria-hidden
                    className={cn(
                      'size-3.5 shrink-0',
                      c.attendanceMissingDays > 0 ? 'text-tone-warning' : 'text-muted-foreground',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.className}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(c.attendanceMissingDays)} hari
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FramedCard>
  )
}
