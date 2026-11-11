import {
  CalendarOff,
  CircleCheck,
  ChevronRight,
  Link2Off,
  PhoneOff,
  Puzzle,
  School,
  ShieldQuestion,
  UserRoundX,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { CountChip, FramedCard } from '@/components/framed-card'
import { ToneBadge } from '@/components/status-badge'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DataGapKey, SystemOverview } from '@/types/entities'

const GAP_ICON: Record<DataGapKey, LucideIcon> = {
  TEACHER_NO_ACCOUNT: UserRoundX,
  TEACHER_NO_SCHEDULE: CalendarOff,
  TEACHER_ROLE_NO_LINK: Link2Off,
  CLASS_NO_HOMEROOM: School,
  CLASS_NO_SCHEDULE: CalendarOff,
  CLASS_NO_STUDENTS: UsersRound,
  STUDENT_NO_GUARDIAN_PHONE: PhoneOff,
  DUTY_SLOT_UNASSIGNED: ShieldQuestion,
}

/** Kartu "Celah Data Master": jumlah data yang belum lengkap beserta tautan perbaikannya. */
export function MasterGapsCard({
  gaps,
  className,
}: {
  gaps: SystemOverview['dataHealth']['gaps']
  className?: string
}) {
  const open = gaps.filter((g) => g.count > 0).length
  return (
    <FramedCard
      title="Celah Data Master"
      titleId="sa-gaps-title"
      icon={<Puzzle />}
      titleBadge={open > 0 ? <CountChip>{open}</CountChip> : undefined}
      className={className}
      bodyClassName="p-1.5"
    >
      {gaps.length === 0 ? (
        <p className="p-3 text-xs text-muted-foreground">Tidak ada pemeriksaan data master.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60" aria-label="Celah data master">
          {gaps.map((g) => {
            const Icon = GAP_ICON[g.key] ?? Puzzle
            const complete = g.count === 0
            return (
              <li key={g.key}>
                <Link
                  to={g.href}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <Icon
                    aria-hidden
                    className={cn('size-3.5 shrink-0', complete ? 'text-muted-foreground' : 'text-tone-warning')}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{g.label}</span>
                  {complete ? (
                    <ToneBadge tone="success" icon={CircleCheck}>
                      Lengkap
                    </ToneBadge>
                  ) : (
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatNumber(g.count)}</span>
                  )}
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </FramedCard>
  )
}
