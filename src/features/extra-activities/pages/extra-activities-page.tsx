import { CalendarDays, CalendarPlus, ChevronRight, Plus, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useLookupMaps, useShifts, useTeachers } from '@/features/master-data/lookups'
import { addDays, formatDate, formatDateShort, todayISO } from '@/lib/date'
import { EXTRA_ACTIVITY_TYPE_META, enumOptions } from '@/lib/enums'
import type { ExtraActivity } from '@/types/entities'
import { ActivityFormDialog } from '../components/activity-form-dialog'
import {
  ACTIVITY_STATUS_OPTIONS,
  ActivityStatusBadge,
  ClassChips,
  timeRange,
  TypeBadge,
} from '../components/activity-bits'
import { useExtraActivities } from '../queries'
import type { ExtraActivityListParams, ExtraActivityType } from '../types'

const PAGE_SIZE = 20

/** Daftar Kursus / Jam Tambahan (PRD §6.9, §8.1). */
export function ExtraActivitiesPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const today = todayISO()
  const defaults = useMemo(
    () => ({
      dateFrom: addDays(today, -30),
      dateTo: addDays(today, 30),
      classId: '',
      type: '',
      instructorTeacherId: '',
      shiftCode: '',
      status: '',
      search: '',
      page: '1',
    }),
    [today],
  )
  const filters = useFilters(defaults)
  const f = filters.values
  const [createOpen, setCreateOpen] = useState(false)
  // Navigasi ke detail setelah dialog tertutup & form ter-reset (agar UnsavedChangesGuard tidak memblokir).
  const [createdId, setCreatedId] = useState<string | null>(null)
  useEffect(() => {
    if (createdId) navigate(createdId)
  }, [createdId, navigate])

  const params: ExtraActivityListParams = {
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    classId: f.classId || undefined,
    type: (f.type || undefined) as ExtraActivityType | undefined,
    instructorTeacherId: f.instructorTeacherId || undefined,
    shiftCode: f.shiftCode || undefined,
    status: (f.status || undefined) as ExtraActivityListParams['status'],
    search: f.search || undefined,
    page: Number(f.page) || 1,
    pageSize: PAGE_SIZE,
  }
  const query = useExtraActivities(params)
  const classes = useClasses()
  const teachers = useTeachers()
  const shifts = useShifts()
  const { shiftName } = useLookupMaps()
  const canWrite = can('extra_activity:write')

  const columns = useMemo<ColumnDef<ExtraActivity, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Tanggal',
        accessorKey: 'date',
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="font-medium">{formatDateShort(row.original.date)}</p>
            {timeRange(row.original) && (
              <p className="text-xs text-muted-foreground tabular-nums">{timeRange(row.original)}</p>
            )}
          </div>
        ),
      },
      {
        id: 'shift',
        header: 'Shift',
        accessorKey: 'shiftCode',
        cell: ({ row }) => shiftName(row.original.shiftCode),
      },
      {
        id: 'name',
        header: 'Kegiatan',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-48 space-y-1">
            <Link
              to={row.original.id}
              className="font-semibold hover:underline focus-visible:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.name}
            </Link>
            <TypeBadge type={row.original.type} />
          </div>
        ),
      },
      { id: 'instructor', header: 'Pengampu', accessorKey: 'instructorName' },
      {
        id: 'classes',
        header: 'Kelas',
        enableSorting: false,
        cell: ({ row }) => <ClassChips names={row.original.classNames} max={3} />,
      },
      {
        id: 'topic',
        header: 'Materi',
        enableSorting: false,
        cell: ({ row }) => <span className="line-clamp-2 max-w-56">{row.original.topic ?? '—'}</span>,
      },
      {
        id: 'note',
        header: 'Keterangan',
        enableSorting: false,
        meta: { hideOnMobile: true },
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-48 text-muted-foreground">{row.original.note ?? '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <ActivityStatusBadge status={row.original.status} />,
      },
    ],
    [shiftName],
  )

  // /reports/export mewajibkan rentang tanggal: pakai rentang default bila filter tanggal dikosongkan.
  const exportFrom = params.dateFrom ?? defaults.dateFrom
  const exportTo = params.dateTo ?? defaults.dateTo
  const exportFilters = {
    dateFrom: exportFrom,
    dateTo: exportTo,
    classId: params.classId,
    type: params.type,
    instructorTeacherId: params.instructorTeacherId,
    shiftCode: params.shiftCode,
    status: params.status,
  }

  return (
    <Page>
      <PageHeader
        title="Kursus / Jam Tambahan"
        description="Agenda kegiatan di luar jadwal reguler: pengampu, kelas peserta, materi, dan presensi peserta bila diperlukan."
        actions={
          <>
            <ExportMenu
              report="extra-activities"
              filters={exportFilters}
              period={exportFrom === exportTo ? exportFrom : `${exportFrom}_${exportTo}`}
            />
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)} className="hidden sm:inline-flex">
                <Plus /> Tambah kegiatan
              </Button>
            )}
          </>
        }
      />

      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <FilterDate label="Dari tanggal" value={f.dateFrom} max={f.dateTo || undefined} onChange={(v) => filters.set({ dateFrom: v })} />
        <FilterDate label="Sampai tanggal" value={f.dateTo} min={f.dateFrom || undefined} onChange={(v) => filters.set({ dateTo: v })} />
        <FilterSelect
          label="Jenis"
          value={f.type}
          onChange={(v) => filters.set({ type: v })}
          allLabel="Semua jenis"
          options={enumOptions(EXTRA_ACTIVITY_TYPE_META)}
        />
        <FilterSelect
          label="Kelas"
          value={f.classId}
          onChange={(v) => filters.set({ classId: v })}
          allLabel="Semua kelas"
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Pengampu"
          value={f.instructorTeacherId}
          onChange={(v) => filters.set({ instructorTeacherId: v })}
          allLabel="Semua pengampu"
          options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
        <FilterSelect
          label="Shift"
          value={f.shiftCode}
          onChange={(v) => filters.set({ shiftCode: v })}
          allLabel="Semua shift"
          options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
        />
        <FilterSelect
          label="Status"
          value={f.status}
          onChange={(v) => filters.set({ status: v })}
          allLabel="Semua status"
          options={ACTIVITY_STATUS_OPTIONS}
        />
        <SearchInput
          label="Cari"
          placeholder="Nama kegiatan, materi, pengampu…"
          value={f.search}
          onChange={(v) => filters.set({ search: v })}
          className="lg:min-w-64"
        />
      </FilterBar>

      {query.isPending ? (
        <TableSkeleton cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <DataTable
            title="Daftar kegiatan"
            icon={<CalendarDays />}
            caption="Daftar kursus dan jam tambahan"
            columns={columns}
            data={query.data.data}
            getRowId={(r) => r.id}
            onRowClick={(r) => navigate(r.id)}
            serverPagination={{ meta: query.data.meta, onPageChange: (p) => filters.set({ page: String(p) }) }}
            renderMobileCard={(a) => <MobileCard a={a} shiftName={shiftName(a.shiftCode)} />}
            emptyState={
              <EmptyState
                icon={<CalendarPlus className="size-5" />}
                title="Belum ada kegiatan pada rentang ini"
                description={
                  filters.isDirty
                    ? 'Tidak ada kursus atau jam tambahan yang cocok dengan filter. Ubah rentang tanggal atau reset filter.'
                    : 'Kursus dan jam tambahan yang dijadwalkan akan tampil di sini.'
                }
                action={
                  canWrite ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus /> Tambah kegiatan
                    </Button>
                  ) : filters.isDirty ? (
                    <Button variant="outline" onClick={filters.reset}>
                      Reset filter
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </div>
      )}

      {canWrite && (
        <div className="sticky bottom-16 z-10 -mx-3 border-t border-border/80 bg-background/95 px-3 py-2.5 backdrop-blur sm:hidden">
          <Button className="w-full" onClick={() => setCreateOpen(true)}>
            <Plus /> Tambah kegiatan
          </Button>
        </div>
      )}

      {canWrite && (
        <ActivityFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={(a) => setCreatedId(a.id)}
        />
      )}
    </Page>
  )
}

function MobileCard({ a, shiftName }: { a: ExtraActivity; shiftName: string }) {
  return (
    <Link to={a.id} className="block space-y-2 focus-visible:outline-none" aria-label={`Buka ${a.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="leading-snug font-semibold">{a.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatDate(a.date)} · {shiftName}
            {timeRange(a) ? ` · ${timeRange(a)}` : ''}
          </p>
        </div>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeBadge type={a.type} />
        <ActivityStatusBadge status={a.status} />
        {a.participantAttendanceEnabled && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <Users className="size-3.5" /> {a.participants.length} peserta
          </span>
        )}
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Pengampu: </span>
        {a.instructorName}
      </p>
      <ClassChips names={a.classNames} />
      {a.topic && <p className="line-clamp-2 text-sm text-muted-foreground">{a.topic}</p>}
    </Link>
  )
}
