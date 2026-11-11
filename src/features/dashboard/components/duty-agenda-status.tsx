import { ChevronRight, CircleDashed, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { FramedCard } from '@/components/framed-card'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { useLookupMaps } from '@/features/master-data/lookups'
import { RECORD_STATUS_META } from '@/lib/enums'
import type { DashboardSummary, ISODate } from '@/types/entities'
import { withQuery } from '../utils'

/** Status agenda piket per shift (PRD §15.2: agenda yang belum difinalisasi terlihat jelas). */
export function DutyAgendaStatus({
  agendas,
  date,
}: {
  agendas: DashboardSummary['dutyAgenda']
  date: ISODate
}) {
  const { shiftName } = useLookupMaps()
  return (
    <FramedCard
      title="Agenda piket"
      titleId="duty-title"
      icon={<ShieldCheck />}
      className="h-full"
      bodyClassName="p-1.5"
    >
      {agendas.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">Tidak ada shift aktif untuk filter ini.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {agendas.map((a) => (
            <li key={a.shiftCode}>
              <Link
                to={
                  a.id
                    ? `/agenda-piket/${encodeURIComponent(a.id)}`
                    : withQuery('/agenda-piket', { dateFrom: date, dateTo: date, shiftCode: a.shiftCode })
                }
                className="flex items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 text-[13px] font-medium">Shift {shiftName(a.shiftCode)}</span>
                {a.status ? (
                  <StatusBadge meta={RECORD_STATUS_META} value={a.status} />
                ) : (
                  <ToneBadge tone="warning" icon={CircleDashed}>
                    Belum dibuat
                  </ToneBadge>
                )}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/70" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FramedCard>
  )
}
