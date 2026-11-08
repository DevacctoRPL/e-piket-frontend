import {
  CalendarClock,
  ChevronRight,
  CircleCheckBig,
  ClipboardList,
  LogOut,
  NotebookPen,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Tone } from '@/lib/enums'
import type { PendingTask } from '@/types/entities'
import { sortTasks } from '../utils'

const KIND_META: Record<PendingTask['kind'], { label: string; tone: Tone; icon: LucideIcon }> = {
  SUBSTITUTION_UNHANDLED: { label: 'Jam kosong', tone: 'danger', icon: CalendarClock },
  DUTY_AGENDA_DRAFT: { label: 'Agenda piket', tone: 'warning', icon: ShieldCheck },
  ATTENDANCE_NOT_SUBMITTED: { label: 'Absensi siswa', tone: 'warning', icon: ClipboardList },
  CHECK_OUT_MISSING: { label: 'Check-out', tone: 'info', icon: LogOut },
  TEACHING_LOG_MISSING: { label: 'Jurnal', tone: 'info', icon: NotebookPen },
}

const COLLAPSED_LIMIT = 6

/** "Tugas yang perlu diselesaikan" — PRD §15.2: cegah petugas lupa mengirim/finalisasi. */
export function PendingTasks({ tasks }: { tasks: PendingTask[] }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = sortTasks(tasks)
  const shown = expanded ? sorted : sorted.slice(0, COLLAPSED_LIMIT)
  const hidden = sorted.length - shown.length

  return (
    <Card aria-labelledby="pending-title" className="gap-3">
      <CardHeader>
        <CardTitle id="pending-title" className="flex items-center gap-2 text-base">
          <h2>Tugas yang perlu diselesaikan</h2>
          {tasks.length > 0 && (
            <span className="rounded-full bg-tone-warning-bg px-2 py-0.5 text-xs font-semibold text-tone-warning tabular-nums">
              {tasks.length}
              <span className="sr-only"> tugas</span>
            </span>
          )}
        </CardTitle>
        <CardDescription>Pekerjaan yang belum diisi, dikirim, atau difinalisasi pada konteks ini.</CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={<CircleCheckBig className="size-5 text-tone-success" />}
            title="Semua beres"
            description="Tidak ada tugas tertunda untuk tanggal & shift ini. Tugas baru akan muncul di sini bila ada yang perlu ditindaklanjuti."
          />
        ) : (
          <>
            <ul className="-mx-2 flex flex-col">
              {shown.map((t) => {
                const meta = KIND_META[t.kind]
                const Icon = meta.icon
                return (
                  <li key={t.id}>
                    <Link
                      to={t.href}
                      className="group flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-pretty">{t.title}</span>
                          <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                        </span>
                        <span className="mt-0.5 block text-xs text-pretty text-muted-foreground">
                          {t.description}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden
                        className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                )
              })}
            </ul>
            {sorted.length > COLLAPSED_LIMIT && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-1 w-full rounded-md py-2 text-sm font-medium text-primary hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan ${hidden} tugas lainnya`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
