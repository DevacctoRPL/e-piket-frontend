import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  CircleCheckBig,
  CircleDashed,
  ClipboardList,
  Clock3,
  FilePen,
  Filter,
  ListChecks,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/components/avatar'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState } from '@/components/page'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { SearchField } from '@/components/search-field'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Tone } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { PendingTask } from '@/types/entities'
import { sortTasks, TASK_PRIORITY } from '../utils'

type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

interface KindMeta {
  codePrefix: string
  label: string
  icon: LucideIcon
  priority: Priority
  assignee: string
  status: { label: string; tone: Tone; icon: LucideIcon }
  /** Target penyelesaian (sintetis untuk demo — PRD §15.2). */
  target: string
  module: string
}

const KIND_META: Record<PendingTask['kind'], KindMeta> = {
  SUBSTITUTION_UNHANDLED: {
    codePrefix: 'JMK',
    label: 'Jam kosong',
    icon: CalendarClock,
    priority: 'HIGH',
    assignee: 'Petugas Piket',
    status: { label: 'Belum tertangani', tone: 'danger', icon: CircleDashed },
    target: 'Segera · < 15 mnt',
    module: '/jam-kosong',
  },
  DUTY_AGENDA_DRAFT: {
    codePrefix: 'PKT',
    label: 'Agenda piket',
    icon: ShieldCheck,
    priority: 'HIGH',
    assignee: 'Guru Piket',
    status: { label: 'Menunggu finalisasi', tone: 'warning', icon: FilePen },
    target: 'Akhir shift',
    module: '/agenda-piket',
  },
  ATTENDANCE_NOT_SUBMITTED: {
    codePrefix: 'ABS',
    label: 'Absensi siswa',
    icon: ClipboardList,
    priority: 'MEDIUM',
    assignee: 'Piket Pengampu',
    status: { label: 'Belum dikirim', tone: 'warning', icon: Clock3 },
    target: 'Jam ke-2',
    module: '/absensi-siswa',
  },
  CHECK_OUT_MISSING: {
    codePrefix: 'CHK',
    label: 'Check-out',
    icon: LogOut,
    priority: 'MEDIUM',
    assignee: 'Kehadiran Guru',
    status: { label: 'Belum check-out', tone: 'info', icon: Clock3 },
    target: 'Hari H · 16.00',
    module: '/absensi-guru',
  },
  TEACHING_LOG_MISSING: {
    codePrefix: 'JRN',
    label: 'Jurnal',
    icon: NotebookPen,
    priority: 'LOW',
    assignee: 'Guru Mapel',
    status: { label: 'Belum diisi', tone: 'neutral', icon: CircleDashed },
    target: 'Hari H · 15.30',
    module: '/jurnal-mengajar',
  },
}

const PRIORITY: Record<Priority, { label: string; rank: number; bars: number; color: string }> = {
  HIGH: { label: 'Tinggi', rank: 3, bars: 3, color: 'bg-tone-danger' },
  MEDIUM: { label: 'Sedang', rank: 2, bars: 2, color: 'bg-tone-warning' },
  LOW: { label: 'Rendah', rank: 1, bars: 1, color: 'bg-muted-foreground' },
}

/** Ikon sinyal 3 batang untuk prioritas (gaya tabel referensi). */
function PriorityBars({ level }: { level: Priority }) {
  const p = PRIORITY[level]
  return (
    <span aria-hidden className="inline-flex h-3.5 items-end gap-[2px]">
      {[2, 2.5, 3.5].map((h, i) => (
        <span
          key={i}
          className={cn('w-[3px] rounded-[1px]', i < p.bars ? p.color : 'bg-border')}
          style={{ height: `${h * 4}px` }}
        />
      ))}
    </span>
  )
}

/** Kode baris stabil dari id tugas (tidak berubah saat diurutkan/difilter). */
function taskCode(t: PendingTask) {
  let h = 0
  for (const ch of t.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `#${KIND_META[t.kind].codePrefix}-${String(h % 1000).padStart(3, '0')}`
}

type SortField = 'code' | 'title' | 'priority' | 'status' | 'assignee'
type SortDir = 'asc' | 'desc'

/** Header kolom yang dapat diurutkan (komponen stabil agar fokus tidak hilang saat diklik). */
function SortHead({
  dir,
  onToggle,
  children,
  className,
}: {
  dir: SortDir | null
  onToggle: () => void
  children: string
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn('h-9 px-3 text-left font-medium whitespace-nowrap', className)}
      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        onClick={onToggle}
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {children}
        {dir === 'asc' ? (
          <ChevronUp aria-hidden className="size-3.5 text-foreground" />
        ) : dir === 'desc' ? (
          <ChevronDown aria-hidden className="size-3.5 text-foreground" />
        ) : (
          <ChevronsUpDown aria-hidden className="size-3 opacity-50" />
        )}
      </button>
    </th>
  )
}

const COLLAPSED_LIMIT = 8

/**
 * Tabel "Tugas yang perlu diselesaikan" (setara "SLA Monitoring" referensi Nuvio).
 * PRD §15.2: mencegah petugas lupa mengirim/finalisasi absensi, jam kosong, agenda, atau jurnal.
 */
export function PendingTasks({ tasks }: { tasks: PendingTask[]; dateLabel?: string }) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<PendingTask['kind'] | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir } | null>(null)

  const toggleSort = (field: SortField) =>
    setSort((s) =>
      s?.field !== field ? { field, dir: 'asc' } : s.dir === 'asc' ? { field, dir: 'desc' } : null,
    )

  const sorted = useMemo(() => {
    const base = sortTasks(tasks)
    if (!sort) return base
    const key = (t: PendingTask): string | number => {
      const m = KIND_META[t.kind]
      switch (sort.field) {
        case 'code':
          return TASK_PRIORITY[t.kind] * 1000 + base.indexOf(t)
        case 'title':
          return t.title
        case 'priority':
          return PRIORITY[m.priority].rank
        case 'status':
          return m.status.label
        case 'assignee':
          return m.assignee
      }
    }
    return [...base].sort((a, b) => {
      const ka = key(a)
      const kb = key(b)
      const cmp = typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb), 'id')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [tasks, sort])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sorted.filter((t) => {
      if (kindFilter !== 'ALL' && t.kind !== kindFilter) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        KIND_META[t.kind].label.toLowerCase().includes(q)
      )
    })
  }, [sorted, search, kindFilter])

  const shown = expanded ? filtered : filtered.slice(0, COLLAPSED_LIMIT)
  const hidden = filtered.length - shown.length
  const kinds = (Object.keys(KIND_META) as PendingTask['kind'][]).filter((k) => tasks.some((t) => t.kind === k))

  const headProps = (field: SortField) => ({
    dir: sort?.field === field ? sort.dir : null,
    onToggle: () => toggleSort(field),
  })

  return (
    <FramedCard
      titleId="pending-title"
      title="Tugas yang perlu diselesaikan"
      icon={<ListChecks />}
      titleBadge={
        tasks.length > 0 ? (
          <CountChip>
            {tasks.length}
            <span className="sr-only"> tugas</span>
          </CountChip>
        ) : undefined
      }
      headerRight={
        tasks.length > 0 && (
          <>
            <SearchField
              value={search}
              onValueChange={setSearch}
              placeholder="Cari tugas"
              aria-label="Cari tugas tertunda"
              className="w-40 sm:w-52"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn(kindFilter !== 'ALL' && 'border-foreground/30')}>
                  <Filter className="text-muted-foreground" />
                  {kindFilter === 'ALL' ? 'Filter' : KIND_META[kindFilter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Kategori tugas</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={kindFilter}
                  onValueChange={(v) => setKindFilter(v as PendingTask['kind'] | 'ALL')}
                >
                  <DropdownMenuRadioItem value="ALL">
                    Semua kategori <span className="ml-auto text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
                  </DropdownMenuRadioItem>
                  {kinds.map((k) => (
                    <DropdownMenuRadioItem key={k} value={k}>
                      {KIND_META[k].label}
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {tasks.filter((t) => t.kind === k).length}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Opsi tabel tugas">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    setSearch('')
                    setKindFilter('ALL')
                    setSort(null)
                  }}
                >
                  Reset pencarian &amp; urutan
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setExpanded((v) => !v)}>
                  {expanded ? 'Ringkas daftar' : 'Tampilkan semua tugas'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
      bodyClassName="p-0 overflow-hidden"
    >
      {tasks.length === 0 ? (
        <div className="p-3">
          <EmptyState
            className="border-0 bg-transparent py-6"
            icon={<CircleCheckBig className="text-tone-success" />}
            title="Semua beres"
            description="Tidak ada tugas tertunda untuk tanggal & shift ini."
          />
        </div>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Tidak ada tugas yang cocok dengan pencarian atau filter ini.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/70 bg-muted/55 text-xs text-muted-foreground">
                  <SortHead {...headProps('code')} className="pl-4">
                    Kode
                  </SortHead>
                  <SortHead {...headProps('title')}>Tugas</SortHead>
                  <SortHead {...headProps('priority')} className="hidden md:table-cell">
                    Prioritas
                  </SortHead>
                  <SortHead {...headProps('assignee')} className="hidden lg:table-cell">
                    Penanggung jawab
                  </SortHead>
                  <SortHead {...headProps('status')}>Status</SortHead>
                  <th scope="col" className="hidden h-9 px-3 text-left font-medium whitespace-nowrap xl:table-cell">
                    Target
                  </th>
                  <th scope="col" className="h-9 w-10 pr-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {shown.map((t) => {
                  const m = KIND_META[t.kind]
                  const Icon = m.icon
                  const p = PRIORITY[m.priority]
                  return (
                    <tr key={t.id} className="group transition-colors hover:bg-muted/35">
                      <td className="py-2.5 pr-3 pl-4 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums">
                          <Icon aria-hidden className="size-3.5" />
                          {taskCode(t)}
                        </span>
                      </td>
                      <td className="max-w-md px-3 py-2.5 align-middle">
                        <Link
                          to={t.href}
                          className="block rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="font-medium text-foreground group-hover:underline">{t.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{t.description}</span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 align-middle whitespace-nowrap md:table-cell">
                        <span className="inline-flex items-center gap-2 text-xs font-medium">
                          <PriorityBars level={m.priority} />
                          {p.label}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2.5 align-middle whitespace-nowrap lg:table-cell">
                        <span className="inline-flex items-center gap-2 text-xs">
                          <Avatar name={m.assignee} size="xs" />
                          {m.assignee}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                        <ToneBadge tone={m.status.tone} icon={m.status.icon}>
                          {m.status.label}
                        </ToneBadge>
                      </td>
                      <td className="hidden px-3 py-2.5 align-middle text-xs whitespace-nowrap text-muted-foreground xl:table-cell">
                        {m.target}
                      </td>
                      <td className="py-2.5 pr-3 text-right align-middle">
                        <RowActionsMenu
                          label={`Aksi untuk ${t.title}`}
                          actions={[
                            { label: 'Buka', icon: ArrowUpRight, href: t.href },
                            { label: `Buka modul ${m.label}`, href: m.module },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > COLLAPSED_LIMIT && (
            <div className="border-t border-border/60 px-4 py-2 text-center">
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? 'Tampilkan lebih sedikit' : `Tampilkan ${hidden} tugas lainnya`}
              </Button>
            </div>
          )}
        </>
      )}
    </FramedCard>
  )
}
