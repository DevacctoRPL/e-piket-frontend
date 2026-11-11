import { ArrowRight, ClipboardCheck, History, ShieldCheck, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ContextHeader } from '@/components/context-header'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { CountChip, FramedCard } from '@/components/framed-card'
import { FilterBar, FilterDate, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useLookupMaps, useShifts } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { addDays, formatDate, formatDateLong, formatDateShort, todayISO } from '@/lib/date'
import { enumOptions, RECORD_STATUS_META } from '@/lib/enums'
import { getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { DutyAgenda, RecordStatus } from '@/types/entities'
import { AgendaStatusBadge } from '../components/agenda-bits'
import { useCreateDutyAgenda, useDutyAgendas, useTodayDutyAgendas } from '../queries'
import type { TodayDutyAgenda } from '../types'

const STATUS_OPTIONS = enumOptions(RECORD_STATUS_META, ['DRAFT', 'SUBMITTED', 'FINAL'] as const)

/** Halaman Agenda Guru Piket: kartu agenda hari ini + riwayat (FR-DUTY-02, FR-DUTY-05). */
export function DutyAgendaListPage() {
  const today = todayISO()
  const { values, set, reset, isDirty } = useFilters({
    dateFrom: addDays(today, -13),
    dateTo: today,
    shiftCode: '',
    status: '',
    page: '1',
  })
  const { shiftName } = useLookupMaps()
  const shifts = useShifts()
  const navigate = useNavigate()

  const params = {
    dateFrom: values.dateFrom || undefined,
    dateTo: values.dateTo || undefined,
    shiftCode: values.shiftCode || undefined,
    status: (values.status || undefined) as RecordStatus | undefined,
    page: Number(values.page) || 1,
    pageSize: 20,
  }
  const listQuery = useDutyAgendas(params)

  const columns = useMemo<ColumnDef<DutyAgenda, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Hari/Tanggal',
        accessorFn: (a) => a.date,
        cell: ({ row }) => <span className="font-medium whitespace-nowrap">{formatDateLong(row.original.date)}</span>,
      },
      {
        id: 'shift',
        header: 'Shift',
        accessorFn: (a) => shiftName(a.shiftCode),
      },
      {
        id: 'officers',
        header: 'Petugas Piket',
        enableSorting: false,
        accessorFn: (a) => a.dutyTeacherNames.join(', '),
        cell: ({ row }) => (
          <span className="line-clamp-2">{row.original.dutyTeacherNames.join(', ') || '—'}</span>
        ),
      },
      {
        id: 'teachers',
        header: 'Guru Hadir',
        enableSorting: false,
        accessorFn: (a) => a.presentTeacherCount,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.presentTeacherCount}/{row.original.scheduledTeacherCount}
          </span>
        ),
        meta: { className: 'text-right', headerClassName: 'text-right' },
      },
      {
        id: 'absent',
        header: 'Tidak Hadir',
        enableSorting: false,
        accessorFn: (a) => a.absentTeachers.length,
        cell: ({ row }) => <span className="tabular-nums">{row.original.absentTeachers.length}</span>,
        meta: { className: 'text-right', headerClassName: 'text-right' },
      },
      {
        id: 'notes',
        header: 'Catatan',
        enableSorting: false,
        accessorFn: (a) => a.notes.length,
        cell: ({ row }) => <span className="tabular-nums">{row.original.notes.length}</span>,
        meta: { className: 'text-right', headerClassName: 'text-right', hideOnMobile: true },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (a) => a.status,
        cell: ({ row }) => <AgendaStatusBadge status={row.original.status} />,
      },
      {
        id: 'open',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button asChild variant="ghost" size="sm">
            <Link to={row.original.id} onClick={(e) => e.stopPropagation()}>
              Buka <ArrowRight />
            </Link>
          </Button>
        ),
        meta: { className: 'text-right', hideOnMobile: true },
      },
    ],
    [shiftName],
  )

  return (
    <Page>
      <PageHeader
        title="Agenda Guru Piket"
        description="Rekap harian petugas piket: guru tidak hadir, hal penting, dan penanggulangan jam kosong."
      />

      <ContextHeader date={today} />

      <TodayAgendas />

      <section aria-label="Riwayat agenda" className="flex flex-col gap-3">
        <FilterBar onReset={isDirty ? reset : undefined}>
          <FilterDate
            label="Dari tanggal"
            value={values.dateFrom}
            max={values.dateTo || today}
            onChange={(v) => set({ dateFrom: v })}
          />
          <FilterDate
            label="Sampai tanggal"
            value={values.dateTo}
            min={values.dateFrom}
            max={today}
            onChange={(v) => set({ dateTo: v })}
          />
          <FilterSelect
            label="Shift"
            value={values.shiftCode}
            onChange={(v) => set({ shiftCode: v })}
            allLabel="Semua shift"
            options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
          />
          <FilterSelect
            label="Status"
            value={values.status}
            onChange={(v) => set({ status: v })}
            allLabel="Semua status"
            options={STATUS_OPTIONS}
          />
        </FilterBar>

        {listQuery.isPending ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : (
          <div
            className={cn('transition-opacity duration-150', listQuery.isPlaceholderData && 'opacity-60')}
            aria-busy={listQuery.isFetching}
          >
            <DataTable
              title="Riwayat agenda"
              icon={<History />}
              caption="Riwayat agenda guru piket"
              columns={columns}
              data={listQuery.data.data}
              getRowId={(a) => a.id}
              onRowClick={(a) => void navigate(a.id)}
              serverPagination={{
                meta: listQuery.data.meta,
                onPageChange: (p) => set({ page: String(p) }),
              }}
              renderMobileCard={(a) => (
                <Link to={a.id} className="flex flex-col gap-2 rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{formatDateShort(a.date)}</p>
                      <p className="text-xs text-muted-foreground">Shift {shiftName(a.shiftCode)}</p>
                    </div>
                    <AgendaStatusBadge status={a.status} />
                  </div>
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    Petugas: {a.dutyTeacherNames.join(', ') || '—'}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground tabular-nums">
                    <span>Hadir {a.presentTeacherCount}/{a.scheduledTeacherCount}</span>
                    <span>Tidak hadir {a.absentTeachers.length}</span>
                    <span>Catatan {a.notes.length}</span>
                  </div>
                </Link>
              )}
              emptyState={
                <EmptyState
                  icon={<ClipboardCheck className="size-5" />}
                  title="Belum ada agenda pada rentang ini"
                  description={
                    isDirty
                      ? 'Tidak ada agenda yang cocok dengan filter. Ubah rentang tanggal, shift, atau status.'
                      : 'Agenda dibuat oleh guru piket yang bertugas setiap hari melalui kartu "Agenda piket hari ini".'
                  }
                  action={
                    isDirty ? (
                      <Button variant="outline" size="sm" onClick={reset}>
                        Reset filter
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
        )}
      </section>
    </Page>
  )
}

/** Kartu agenda hari ini per shift (FR-DUTY-02). Menonjol bila user adalah petugas piket. */
function TodayAgendas() {
  const todayQuery = useTodayDutyAgendas()
  if (todayQuery.isPending) {
    return (
      <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Memuat agenda hari ini">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }
  if (todayQuery.isError) {
    return <ErrorState error={todayQuery.error} onRetry={() => void todayQuery.refetch()} title="Gagal memuat agenda hari ini" />
  }
  const entries = [...todayQuery.data].sort((a, b) => Number(b.isDutyTeacher) - Number(a.isDutyTeacher))
  if (entries.length === 0) return null
  return (
    <FramedCard
      titleId="agenda-hari-ini"
      title="Agenda piket hari ini"
      icon={<ShieldCheck />}
      titleBadge={
        <CountChip>
          {entries.length}
          <span className="sr-only"> shift</span>
        </CountChip>
      }
      bodyClassName="overflow-hidden p-0"
    >
      <div className="grid divide-y divide-border/60 md:grid-cols-2 md:divide-x md:divide-y-0">
        {entries.map((e) => (
          <TodayAgendaCard key={e.shiftCode} entry={e} />
        ))}
      </div>
    </FramedCard>
  )
}

function TodayAgendaCard({ entry }: { entry: TodayDutyAgenda }) {
  const { shiftName } = useLookupMaps()
  const navigate = useNavigate()
  const create = useCreateDutyAgenda()
  const idem = useIdempotencyKey()
  const { agenda } = entry
  const exists = agenda.id !== null
  const highlight = entry.isDutyTeacher && agenda.status !== 'FINAL'

  const open = async () => {
    if (agenda.id) {
      void navigate(agenda.id)
      return
    }
    try {
      const created = await create.mutateAsync({
        date: entry.date,
        shiftCode: entry.shiftCode,
        idempotencyKey: idem.key(),
      })
      idem.reset()
      toast.success('Agenda piket hari ini dibuat.')
      void navigate(created.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <article
      className={cn('flex flex-col gap-3 p-4', highlight && 'border-l-2 border-l-foreground/40')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Shift {shiftName(entry.shiftCode)}</h3>
          <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
        </div>
        {exists ? (
          <AgendaStatusBadge status={agenda.status} />
        ) : (
          <ToneBadge tone="neutral">Belum dibuat</ToneBadge>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Petugas</dt>
        <dd className="min-w-0 break-words">{agenda.dutyTeacherNames.join(', ') || 'Belum ditetapkan'}</dd>
        <dt className="text-muted-foreground">Guru</dt>
        <dd className="flex items-center gap-1.5 tabular-nums">
          <Users className="size-3.5 text-muted-foreground" aria-hidden />
          {agenda.presentTeacherCount}/{agenda.scheduledTeacherCount} hadir · {agenda.absentTeachers.length} tidak hadir
        </dd>
      </dl>

      {entry.isDutyTeacher && !exists && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-tone-info" aria-hidden />
          Anda bertugas sebagai guru piket shift ini.
        </p>
      )}

      <div className="mt-auto flex justify-end">
        {exists ? (
          <Button variant={highlight ? 'default' : 'outline'} onClick={() => void open()}>
            {agenda.status === 'FINAL' ? 'Lihat agenda' : entry.isDutyTeacher ? 'Lanjutkan pengisian' : 'Lihat agenda'}
            <ArrowRight />
          </Button>
        ) : entry.canCreate ? (
          <Button onClick={() => void open()} disabled={create.isPending}>
            {create.isPending ? 'Membuat…' : 'Buka agenda piket'}
            {!create.isPending && <ArrowRight />}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {agenda.dutyTeacherIds.length === 0
              ? 'Petugas piket belum ditetapkan oleh admin.'
              : 'Agenda akan dibuka oleh guru piket yang bertugas.'}
          </p>
        )}
      </div>
    </article>
  )
}
