import { CalendarX2, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { DataTable, type ColumnDef } from '@/components/data-table'
import { FilterBar, FilterSelect, useFilters } from '@/components/filter-bar'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/auth-context'
import { dayName, isoDayOfWeek, todayISO } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TimetableSlot } from '@/types/entities'
import { useActiveAcademicYear, useClasses, useLookupMaps, usePeriods, useShifts, useTeachers, useTimetable } from '../lookups'
import { DayTabs, periodRangeLabel, slotTimeLabel } from '../components/schedule-shared'

/**
 * /jadwal — Jadwal Saya (guru) & Jadwal Sekolah (filter hari/kelas/guru/shift). Hanya baca.
 */
export function SchedulePage() {
  const user = useCurrentUser()
  const isTeacher = !!user.teacherId
  const todayDow = isoDayOfWeek(todayISO())
  const filters = useFilters({
    mode: isTeacher ? 'mine' : 'school',
    day: String(todayDow),
    sclass: '',
    steacher: '',
    sshift: '',
  })
  const mode = isTeacher && filters.values.mode === 'mine' ? 'mine' : 'school'
  const dayOfWeek = Number(filters.values.day) || todayDow

  const { year, semester } = useActiveAcademicYear()
  const shifts = useShifts()
  const classes = useClasses()
  const teachers = useTeachers()
  const periods = usePeriods()
  const lookups = useLookupMaps()

  const teacherId = mode === 'mine' ? (user.teacherId ?? undefined) : filters.values.steacher || undefined
  const classId = mode === 'school' ? filters.values.sclass || undefined : undefined
  const shiftCode = mode === 'school' ? filters.values.sshift || undefined : undefined

  // Seluruh minggu sekali ambil → hitungan per hari pada tab tanpa request tambahan.
  const week = useTimetable({ teacherId, classId, shiftCode })
  const slots = useMemo(
    () =>
      (week.data ?? [])
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .sort((a, b) => a.shiftCode.localeCompare(b.shiftCode) * -1 || a.periodStart - b.periodStart),
    [week.data, dayOfWeek],
  )
  const counts = useMemo(() => {
    const c: Partial<Record<number, number>> = {}
    for (const s of week.data ?? []) c[s.dayOfWeek] = (c[s.dayOfWeek] ?? 0) + 1
    return c
  }, [week.data])
  const totalPeriods = slots.reduce((n, s) => n + s.periodCount, 0)

  const columns = useMemo<ColumnDef<TimetableSlot>[]>(
    () => [
      {
        id: 'period',
        header: 'Jam',
        enableSorting: false,
        cell: ({ row }) => <span className="font-semibold tabular-nums">{periodRangeLabel(row.original)}</span>,
      },
      {
        id: 'time',
        header: 'Waktu',
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{slotTimeLabel(row.original, periods.data)}</span>,
      },
      { id: 'shift', header: 'Shift', enableSorting: false, accessorFn: (s) => lookups.shiftName(s.shiftCode) },
      { id: 'class', header: 'Kelas', enableSorting: false, accessorFn: (s) => lookups.classById.get(s.classId)?.name ?? '—' },
      { id: 'subject', header: 'Mata Pelajaran', enableSorting: false, accessorFn: (s) => lookups.subjectById.get(s.subjectId)?.name ?? '—' },
      { id: 'teacher', header: 'Guru', enableSorting: false, accessorFn: (s) => lookups.teacherById.get(s.teacherId)?.name ?? '—' },
      { accessorKey: 'periodCount', header: 'JML', enableSorting: false, cell: ({ getValue }) => <span className="tabular-nums">{getValue<number>()}</span> },
    ],
    [lookups, periods.data],
  )

  const groups = useMemo(() => {
    const m = new Map<string, TimetableSlot[]>()
    for (const s of slots) {
      const key = `${s.shiftCode}|${s.periodStart}|${s.periodEnd}`
      m.set(key, [...(m.get(key) ?? []), s])
    }
    return [...m.values()]
  }, [slots])

  const shiftClasses = (classes.data ?? []).filter((c) => !filters.values.sshift || c.shiftCode === filters.values.sshift)

  return (
    <Page>
      <PageHeader
        title={mode === 'mine' ? 'Jadwal Saya' : 'Jadwal Sekolah'}
        description={
          year
            ? `Tahun ajaran ${year.name}${semester ? ` · Semester ${semester.name}` : ''}`
            : 'Jadwal pelajaran per hari, kelas, guru, dan shift.'
        }
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> Cetak
          </Button>
        }
      />

      {isTeacher && (
        <div className="no-print inline-flex w-full rounded-lg bg-muted p-1 sm:w-fit" role="tablist" aria-label="Jenis jadwal">
          {(
            [
              ['mine', 'Jadwal Saya'],
              ['school', 'Jadwal Sekolah'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => filters.set({ mode: value })}
              className={cn(
                'min-h-9 flex-1 rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none',
                mode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'school' && (
        <FilterBar
          onReset={
            filters.values.sclass || filters.values.steacher || filters.values.sshift
              ? () => filters.set({ sclass: '', steacher: '', sshift: '' })
              : undefined
          }
        >
          <FilterSelect
            label="Shift"
            value={filters.values.sshift}
            onChange={(sshift) => filters.set({ sshift, sclass: '' })}
            allLabel="Semua shift"
            options={(shifts.data ?? []).map((s) => ({ value: s.code, label: s.name }))}
          />
          <FilterSelect
            label="Kelas"
            value={filters.values.sclass}
            onChange={(sclass) => filters.set({ sclass })}
            allLabel="Semua kelas"
            options={shiftClasses.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FilterSelect
            label="Guru"
            value={filters.values.steacher}
            onChange={(steacher) => filters.set({ steacher })}
            allLabel="Semua guru"
            options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
        </FilterBar>
      )}

      <DayTabs value={dayOfWeek} onChange={(d) => filters.set({ day: String(d) })} counts={week.data ? counts : undefined} today={todayDow} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {dayName(dayOfWeek)}
          {dayOfWeek === todayDow && <span className="ml-2 text-sm font-normal text-muted-foreground">(hari ini)</span>}
        </h2>
        {week.data && slots.length > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {slots.length} pertemuan · {totalPeriods} jam pelajaran
          </p>
        )}
      </div>

      {week.isPending ? (
        <TableSkeleton rows={6} cols={6} />
      ) : week.isError ? (
        <ErrorState error={week.error} onRetry={() => void week.refetch()} />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={<CalendarX2 className="size-5" />}
          title={mode === 'mine' ? `Tidak ada jadwal mengajar hari ${dayName(dayOfWeek)}` : `Tidak ada jadwal hari ${dayName(dayOfWeek)}`}
          description={
            mode === 'mine'
              ? 'Anda tidak terjadwal mengajar pada hari ini. Pilih hari lain atau lihat Jadwal Sekolah.'
              : 'Tidak ada slot jadwal yang cocok dengan filter. Pilih hari lain atau ubah filter.'
          }
        />
      ) : (
        <>
          <div className="hidden md:block print:block">
            <DataTable columns={columns} data={slots} getRowId={(r) => r.id} pageSize={200} caption={`Jadwal ${dayName(dayOfWeek)}`} />
          </div>
          <ol className="grid gap-3 md:hidden print:hidden" aria-label={`Jadwal ${dayName(dayOfWeek)} per jam`}>
            {groups.map((g) => {
              const first = g[0] as TimetableSlot
              return (
                <li key={`${first.shiftCode}-${first.periodStart}-${first.periodEnd}`} className="grid gap-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold tabular-nums">{periodRangeLabel(first)}</span>
                    <span className="text-muted-foreground tabular-nums">{slotTimeLabel(first, periods.data)}</span>
                    {!shiftCode && <ToneBadge tone="neutral">{lookups.shiftName(first.shiftCode)}</ToneBadge>}
                  </div>
                  <ul className="grid gap-1.5">
                    {g.map((s) => (
                      <li key={s.id} className="rounded-xl border bg-card p-3 shadow-xs">
                        <p className="font-semibold">{lookups.subjectById.get(s.subjectId)?.name ?? '—'}</p>
                        <p className="text-sm text-muted-foreground">
                          {lookups.classById.get(s.classId)?.name ?? '—'}
                          {mode === 'school' && ` · ${lookups.teacherById.get(s.teacherId)?.name ?? '—'}`}
                          {` · ${s.periodCount} jam`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </Page>
  )
}
