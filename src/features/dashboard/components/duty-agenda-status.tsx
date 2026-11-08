import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card aria-labelledby="duty-title" className="gap-3">
      <CardHeader>
        <CardTitle id="duty-title" className="text-base">
          <h2>Agenda piket</h2>
        </CardTitle>
        <CardDescription>Status laporan harian petugas piket per shift.</CardDescription>
      </CardHeader>
      <CardContent>
        {agendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada shift aktif untuk filter ini.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {agendas.map((a) => (
              <li key={a.shiftCode}>
                <Link
                  to={withQuery('/agenda-piket', { date, shift: a.shiftCode })}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium">Shift {shiftName(a.shiftCode)}</span>
                  {a.status ? (
                    <StatusBadge meta={RECORD_STATUS_META} value={a.status} />
                  ) : (
                    <ToneBadge tone="warning">Belum dibuat</ToneBadge>
                  )}
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
