import { CalendarCheck2, ClipboardList, PhoneOff, UserX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable } from '@/components/data-table'
import { ExportMenu } from '@/components/export-menu'
import { FilterBar, FilterDate, FilterField, FilterSelect, SearchInput } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useShifts } from '@/features/master-data/lookups'
import { formatDate, formatDateLong } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { AbsenteeRow } from '@/types/entities'
import { AbsenteeMobileCard, absenteeColumns } from '../components/absentee-columns'
import { ContactDialog } from '../components/contact-dialog'
import { StatusChips } from '../components/status-chips'
import { useAbsentees, useAbsenteeSummary } from '../queries'
import { periodLabel, printSearch, useAbsenteeFilters, useShiftName } from '../use-absentee-filters'

const PAGE_SIZE = 25

/** Daftar siswa tidak hadir otomatis (FR-STU-05) + pencatatan konfirmasi wali (FR-STU-06). */
export function AbsenteesPage() {
  const { can } = useAuth()
  const canWrite = can('absentees:write')
  const [sp] = useSearchParams()
  const filters = useAbsenteeFilters()
  const { values, baseQuery, statuses, page, toggleStatus } = filters
  // Kata kunci nama tidak disimpan di URL (PRD §12.2).
  const [search, setSearch] = useState('')
  const [contactRow, setContactRow] = useState<AbsenteeRow | null>(null)

  const classes = useClasses({ scope: 'mine' })
  const shifts = useShifts()
  const shiftName = useShiftName(shifts.data)

  const listQuery = useAbsentees({ ...baseQuery, search: search || undefined, page, pageSize: PAGE_SIZE })
  const summaryQuery = useAbsenteeSummary({ ...baseQuery, search: search || undefined })

  const multiDay = baseQuery.dateFrom !== baseQuery.dateTo
  const columns = useMemo(
    () => absenteeColumns({ canWrite, onContact: setContactRow, multiDay, shiftName }),
    [canWrite, multiDay, shiftName],
  )

  const onSearch = useCallback(
    (v: string) => {
      setSearch(v)
      if (page !== 1) filters.set({ page: '1' })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page],
  )

  // Sama dengan filter layar (kecuali kata kunci nama — tidak dikirim demi privasi, PRD §12.2).
  const exportFilters = {
    dateFrom: baseQuery.dateFrom,
    dateTo: baseQuery.dateTo,
    classId: baseQuery.classId,
    shiftCode: baseQuery.shiftCode,
    status: baseQuery.status,
    contacted: baseQuery.contacted,
    includeDraft: baseQuery.includeDraft,
  }
  const printHref = `/siswa-tidak-hadir/cetak${printSearch(sp)}`
  const summary = summaryQuery.data
  const rows = listQuery.data?.data ?? []
  const meta = listQuery.data?.meta

  const periodText = multiDay
    ? `${formatDate(baseQuery.dateFrom)} – ${formatDate(baseQuery.dateTo)}`
    : formatDateLong(baseQuery.dateFrom)

  return (
    <Page>
      <PageHeader
        title="Siswa Tidak Hadir"
        description="Daftar otomatis dari absensi kelas yang sudah dikirim. Catat konfirmasi wali tanpa menyalin ulang."
        actions={
          <ExportMenu
            report="absentees"
            filters={exportFilters}
            period={periodLabel(baseQuery)}
            printHref={printHref}
          />
        }
      />

      <FilterBar onReset={filters.isDirty || search ? () => { filters.reset(); setSearch('') } : undefined}>
        <FilterDate
          label="Dari tanggal"
          value={baseQuery.dateFrom}
          max={filters.today}
          onChange={(v) => filters.set({ dateFrom: v, ...(v && v > baseQuery.dateTo ? { dateTo: v } : {}) })}
        />
        <FilterDate
          label="Sampai tanggal"
          value={baseQuery.dateTo}
          min={baseQuery.dateFrom}
          onChange={(v) => filters.set({ dateTo: v })}
        />
        <FilterSelect
          label="Kelas"
          value={values.classId}
          onChange={(v) => filters.set({ classId: v })}
          allLabel={classes.isPending ? 'Memuat kelas…' : 'Semua kelas'}
          options={(classes.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Shift"
          value={values.shiftCode}
          onChange={(v) => filters.set({ shiftCode: v })}
          allLabel="Semua shift"
          options={(shifts.data ?? []).filter((s) => s.isActive).map((s) => ({ value: s.code, label: s.name }))}
        />
        <FilterSelect
          label="Konfirmasi wali"
          value={values.contacted}
          onChange={(v) => filters.set({ contacted: v })}
          allLabel="Semua"
          options={[
            { value: 'false', label: 'Belum dikonfirmasi' },
            { value: 'true', label: 'Sudah dikonfirmasi' },
          ]}
        />
        <SearchInput label="Cari siswa" placeholder="Nama atau NIS…" value={search} onChange={onSearch} />
        <FilterField label="Sesi draft">
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              id="absentees-include-draft"
              checked={values.draft === '1'}
              onCheckedChange={(c) => filters.set({ draft: c === true ? '1' : '' })}
            />
            <Label htmlFor="absentees-include-draft" className="text-sm font-normal">
              Sertakan absensi draft
            </Label>
          </div>
        </FilterField>
      </FilterBar>

      <section aria-label="Ringkasan" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{periodText}</span>
            {summary && (
              <>
                {' · '}
                <span className="tabular-nums">{summary.total}</span> siswa
              </>
            )}
          </p>
          {summary && summary.total + summary.contacted > 0 && (
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                className={cn('inline-flex items-center gap-1.5 rounded-md px-1 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none', values.contacted === 'false' && 'font-semibold text-tone-warning')}
                onClick={() => filters.set({ contacted: values.contacted === 'false' ? '' : 'false' })}
                aria-pressed={values.contacted === 'false'}
              >
                <PhoneOff className="size-3.5" aria-hidden />
                <span className="tabular-nums">{summary.notContacted}</span> belum dikonfirmasi
              </button>
              <button
                type="button"
                className={cn('inline-flex items-center gap-1.5 rounded-md px-1 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none', values.contacted === 'true' && 'font-semibold text-tone-success')}
                onClick={() => filters.set({ contacted: values.contacted === 'true' ? '' : 'true' })}
                aria-pressed={values.contacted === 'true'}
              >
                <CalendarCheck2 className="size-3.5" aria-hidden />
                <span className="tabular-nums">{summary.contacted}</span> sudah dikonfirmasi
              </button>
            </div>
          )}
        </div>
        <StatusChips
          selected={statuses}
          counts={summary?.byStatus}
          loading={summaryQuery.isFetching}
          onToggle={toggleStatus}
          onClear={() => filters.set({ status: '' })}
        />
      </section>

      {listQuery.isPending ? (
        <TableSkeleton rows={6} cols={7} />
      ) : listQuery.isError ? (
        <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : (
        <div className={cn('transition-opacity duration-150', listQuery.isPlaceholderData && 'opacity-60')} aria-busy={listQuery.isFetching}>
          <DataTable
            caption="Daftar siswa tidak hadir"
            columns={columns}
            data={rows}
            getRowId={(r) => r.recordId}
            serverPagination={meta ? { meta, onPageChange: (p) => filters.set({ page: String(p) }) } : undefined}
            renderMobileCard={(r) => (
              <AbsenteeMobileCard row={r} canWrite={canWrite} onContact={setContactRow} shiftName={shiftName} />
            )}
            emptyState={
              <AbsenteesEmpty
                filtered={filters.isDirty || !!search}
                includeDraft={values.draft === '1'}
                onIncludeDraft={() => filters.set({ draft: '1' })}
                onReset={() => {
                  filters.reset()
                  setSearch('')
                }}
              />
            }
          />
        </div>
      )}

      <ContactDialog
        row={contactRow}
        open={contactRow !== null}
        onOpenChange={(o) => {
          if (!o) setContactRow(null)
        }}
      />
    </Page>
  )
}

function AbsenteesEmpty({
  filtered,
  includeDraft,
  onIncludeDraft,
  onReset,
}: {
  filtered: boolean
  includeDraft: boolean
  onIncludeDraft: () => void
  onReset: () => void
}) {
  return (
    <EmptyState
      icon={<UserX className="size-5" />}
      title="Tidak ada siswa tidak hadir"
      description={
        <>
          Belum ada siswa berstatus sakit, izin, alpa, terlambat, atau dispensasi pada filter ini.
          {!includeDraft && ' Daftar hanya memuat absensi kelas yang sudah dikirim — kelas yang absensinya masih draft atau belum diisi tidak tampil.'}
        </>
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {!includeDraft && (
            <Button variant="outline" size="sm" onClick={onIncludeDraft}>
              Sertakan absensi draft
            </Button>
          )}
          {filtered && (
            <Button variant="outline" size="sm" onClick={onReset}>
              Reset filter
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link to="/absensi-siswa">
              <ClipboardList /> Buka absensi siswa
            </Link>
          </Button>
        </div>
      }
    />
  )
}
