import { DoorOpen, History, LogOut, Plus, SearchX, TimerReset, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ContextHeader } from '@/components/context-header'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, StatCard, TableSkeleton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses } from '@/features/master-data/lookups'
import { addDays, formatDate, todayISO } from '@/lib/date'
import { DISMISSAL_META, enumOptions } from '@/lib/enums'
import { DISMISSAL_TYPES, type DismissalType } from '@/types/entities'
import { isAwaitingReturn } from '../components/dismissal-actions'
import { DismissalFormSheet } from '../components/dismissal-form-sheet'
import { DismissalTable } from '../components/dismissal-table'
import { useDismissals } from '../queries'

const TYPE_OPTIONS = enumOptions(DISMISSAL_META)

function asType(v: string): DismissalType | '' {
  return (DISMISSAL_TYPES as readonly string[]).includes(v) ? (v as DismissalType) : ''
}

/** Halaman Kepulangan Siswa (PRD §6.4 FR-OUT-01/02/04, §7.2). */
export function DismissalPage() {
  const today = todayISO()
  const { can } = useAuth()
  const canWrite = can('dismissal:write')
  const filters = useFilters({
    tab: 'hari-ini',
    date: today,
    shift: '',
    classId: '',
    type: '',
    from: addDays(today, -6),
    to: today,
    page: '1',
  })
  const f = filters.values
  const [formOpen, setFormOpen] = useState(false)
  const classes = useClasses({ scope: 'mine' })
  const classOptions = useMemo(
    () =>
      (classes.data ?? [])
        .filter((c) => !f.shift || c.shiftCode === f.shift)
        .map((c) => ({ value: c.id, label: c.name })),
    [classes.data, f.shift],
  )

  const openForm = () => setFormOpen(true)

  return (
    <Page className="pb-20 md:pb-0">
      <PageHeader
        title="Kepulangan Siswa"
        description="Catat siswa yang pulang normal, pulang lebih awal, atau izin keluar sementara. Catatan ini terpisah dari absensi kedatangan."
        actions={
          canWrite && (
            <Button onClick={openForm} className="hidden md:inline-flex">
              <Plus /> Catat kepulangan
            </Button>
          )
        }
      />

      <Tabs value={f.tab === 'riwayat' ? 'riwayat' : 'hari-ini'} onValueChange={(v) => filters.set({ tab: v })}>
        <TabsList aria-label="Tampilan kepulangan">
          <TabsTrigger value="hari-ini">
            <DoorOpen /> Harian
          </TabsTrigger>
          <TabsTrigger value="riwayat">
            <History /> Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hari-ini" className="grid gap-4">
          <TodayView
            date={f.date}
            shift={f.shift}
            classId={f.classId}
            type={asType(f.type)}
            classOptions={classOptions}
            onChange={filters.set}
            onReset={filters.isDirty ? filters.reset : undefined}
            onCreate={canWrite ? openForm : undefined}
          />
        </TabsContent>

        <TabsContent value="riwayat" className="grid gap-4">
          <HistoryView
            from={f.from}
            to={f.to}
            classId={f.classId}
            type={asType(f.type)}
            page={Math.max(1, Number(f.page) || 1)}
            classOptions={classOptions}
            onChange={filters.set}
            onReset={filters.reset}
          />
        </TabsContent>
      </Tabs>

      {canWrite && (
        <div className="no-print sticky bottom-16 z-20 -mx-3 border-t bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <Button onClick={openForm} className="h-11 w-full">
            <Plus /> Catat kepulangan
          </Button>
        </div>
      )}

      {canWrite && (
        <DismissalFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          date={f.tab === 'riwayat' ? today : f.date}
          shiftCode={f.shift || undefined}
          defaultClassId={f.classId || undefined}
        />
      )}
    </Page>
  )
}

/* ------------------------------------------------------------------ harian */

type SetFilters = (patch: Partial<Record<'tab' | 'date' | 'shift' | 'classId' | 'type' | 'from' | 'to' | 'page', string>>) => void

function TodayView({
  date,
  shift,
  classId,
  type,
  classOptions,
  onChange,
  onReset,
  onCreate,
}: {
  date: string
  shift: string
  classId: string
  type: DismissalType | ''
  classOptions: { value: string; label: string }[]
  onChange: SetFilters
  onReset?: () => void
  onCreate?: () => void
}) {
  // Ambil semua kepulangan tanggal & shift ini sekaligus; filter kelas/jenis di klien agar ringkasan tetap utuh.
  const query = useDismissals({ date, shiftCode: shift || undefined, pageSize: 500 })
  const all = useMemo(() => query.data?.data ?? [], [query.data])
  const rows = useMemo(
    () => all.filter((d) => (!classId || d.classId === classId) && (!type || d.type === type)),
    [all, classId, type],
  )
  const stats = useMemo(
    () => ({
      total: all.length,
      early: all.filter((d) => d.type === 'EARLY_LEAVE').length,
      temporary: all.filter((d) => d.type === 'TEMPORARY_EXIT').length,
      awaiting: all.filter(isAwaitingReturn).length,
    }),
    [all],
  )
  const isToday = date === todayISO()
  const filtered = !!classId || !!type

  return (
    <>
      <ContextHeader
        date={date}
        onDateChange={(d) => onChange({ date: d })}
        shiftCode={shift}
        onShiftChange={(s) => onChange({ shift: s, classId: '' })}
        allowAllShifts
        extra={
          <ExportMenu
            report="dismissals"
            filters={{ dateFrom: date, dateTo: date, shiftCode: shift || undefined, classId: classId || undefined, type: type || undefined }}
            period={date}
          />
        }
      />

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[6.5rem] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        !query.isError && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total tercatat" value={stats.total} icon={<Users />} />
            <StatCard label="Pulang lebih awal" value={stats.early} icon={<LogOut />} tone="warning" />
            <StatCard label="Izin keluar" value={stats.temporary} icon={<DoorOpen />} tone="info" />
            <StatCard
              label="Belum kembali"
              value={stats.awaiting}
              icon={<TimerReset />}
              tone={stats.awaiting > 0 ? 'danger' : 'success'}
              hint={stats.awaiting > 0 ? 'Izin keluar tanpa waktu kembali' : 'Semua izin keluar sudah kembali'}
            />
          </div>
        )
      )}

      <FilterBar onReset={onReset}>
        <FilterSelect
          label="Kelas"
          value={classId}
          onChange={(v) => onChange({ classId: v })}
          options={classOptions}
          allLabel="Semua kelas"
        />
        <FilterSelect
          label="Jenis kepulangan"
          value={type}
          onChange={(v) => onChange({ type: v })}
          options={TYPE_OPTIONS}
          allLabel="Semua jenis"
        />
      </FilterBar>

      {query.isPending ? (
        <TableSkeleton rows={4} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DismissalTable
          data={rows}
          caption={`Daftar kepulangan siswa ${formatDate(date)}`}
          emptyState={
            filtered && all.length > 0 ? (
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="Tidak ada yang cocok dengan filter"
                description="Ubah atau reset filter kelas/jenis untuk melihat catatan lainnya."
                action={
                  onReset && (
                    <Button variant="outline" size="sm" onClick={onReset}>
                      Reset filter
                    </Button>
                  )
                }
              />
            ) : (
              <EmptyState
                icon={<DoorOpen className="size-5" />}
                title={isToday ? 'Belum ada kepulangan hari ini' : 'Tidak ada kepulangan pada tanggal ini'}
                description={
                  onCreate
                    ? 'Catat siswa yang pulang lebih awal, izin keluar, atau pulang normal dengan penjemput.'
                    : 'Catatan kepulangan dibuat oleh guru piket atau TU.'
                }
                action={
                  onCreate && (
                    <Button size="sm" onClick={onCreate}>
                      <Plus /> Catat kepulangan
                    </Button>
                  )
                }
              />
            )
          }
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ riwayat (FR-OUT-04) */

function HistoryView({
  from,
  to,
  classId,
  type,
  page,
  classOptions,
  onChange,
  onReset,
}: {
  from: string
  to: string
  classId: string
  type: DismissalType | ''
  page: number
  classOptions: { value: string; label: string }[]
  onChange: SetFilters
  onReset: () => void
}) {
  // Kata kunci pencarian sengaja TIDAK disimpan di URL (bisa berisi nama siswa — PRD §12.2).
  const [search, setSearch] = useState('')
  const today = todayISO()
  const rangeInvalid = !!from && !!to && from > to
  const params = {
    dateFrom: from || undefined,
    dateTo: to || undefined,
    classId: classId || undefined,
    type,
    search: search.trim() || undefined,
    page,
    pageSize: 20,
  }
  const query = useDismissals(params, { enabled: !rangeInvalid })

  return (
    <>
      <FilterBar
        onReset={() => {
          setSearch('')
          onReset()
        }}
      >
        <FilterDate label="Dari tanggal" value={from} max={to || today} onChange={(v) => onChange({ from: v })} />
        <FilterDate label="Sampai tanggal" value={to} min={from} max={today} onChange={(v) => onChange({ to: v })} />
        <FilterSelect
          label="Kelas"
          value={classId}
          onChange={(v) => onChange({ classId: v })}
          options={classOptions}
          allLabel="Semua kelas"
        />
        <FilterSelect
          label="Jenis kepulangan"
          value={type}
          onChange={(v) => onChange({ type: v })}
          options={TYPE_OPTIONS}
          allLabel="Semua jenis"
        />
        <SearchInput
          label="Cari siswa"
          placeholder="Nama, NIS, atau penjemput…"
          value={search}
          onChange={(v) => {
            setSearch(v)
            if (page !== 1) onChange({ page: '1' })
          }}
          className="lg:min-w-56"
        />
        <div className="lg:ml-auto">
          <ExportMenu
            report="dismissals"
            filters={{
              // /reports/export mewajibkan rentang tanggal.
              dateFrom: from || addDays(to || today, -6),
              dateTo: to || today,
              classId: classId || undefined,
              type: type || undefined,
            }}
            period={`${from || addDays(to || today, -6)}_${to || today}`}
          />
        </div>
      </FilterBar>

      {rangeInvalid ? (
        <EmptyState
          title="Rentang tanggal tidak valid"
          description="Tanggal awal harus sebelum atau sama dengan tanggal akhir."
        />
      ) : query.isPending ? (
        <TableSkeleton rows={6} cols={7} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <DismissalTable
            data={query.data.data}
            showDate
            caption="Riwayat kepulangan siswa"
            serverPagination={{ meta: query.data.meta, onPageChange: (p) => onChange({ page: String(p) }) }}
            emptyState={
              <EmptyState
                icon={<SearchX className="size-5" />}
                title="Tidak ada riwayat kepulangan"
                description={`Tidak ada catatan pada ${formatDate(from)} – ${formatDate(to)} dengan filter ini. Coba perluas rentang tanggal atau ubah filter.`}
              />
            }
          />
        </div>
      )}
    </>
  )
}
