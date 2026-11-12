import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck2, CheckSquare, FileSpreadsheet, Grid3x3, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { FilterBar, FilterSelect, SearchInput, useFilters } from '@/components/filter-bar'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, QueryBoundary } from '@/components/page'
import { SegmentedControl } from '@/components/segmented-control'
import { MetaTag, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Metric } from '@/features/super-admin/components/metric'
import { getErrorMessage } from '@/lib/error-mapping'
import { downloadBlob } from '@/lib/export'
import { cn } from '@/lib/utils'
import type { Teacher } from '@/types/entities'
import { masterApi } from '../api'
import { masterKeys, useActiveAcademicYear, useTeachers } from '../lookups'
import {
  DAYS_MON_SAT,
  buildPresenceMatrixExcel,
  buildPresenceMatrixRows,
} from '../presence-matrix-template'
import { TabToolbar } from './crud-kit'
import { PresenceMatrixImportDialog } from './presence-matrix-import-dialog'

type PresenceViewMode = 'matrix' | 'checklist'

const CODE_BADGE_STYLES = [
  'bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30',
  'bg-sky-500/15 text-sky-900 dark:text-sky-200 border-sky-500/30',
  'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30',
  'bg-violet-500/15 text-violet-900 dark:text-violet-200 border-violet-500/30',
  'bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30',
  'bg-teal-500/15 text-teal-900 dark:text-teal-200 border-teal-500/30',
  'bg-orange-500/15 text-orange-900 dark:text-orange-200 border-orange-500/30',
  'bg-indigo-500/15 text-indigo-900 dark:text-indigo-200 border-indigo-500/30',
] as const

function codeBadgeStyle(code: string): string {
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) | 0
  }
  return CODE_BADGE_STYLES[Math.abs(hash) % CODE_BADGE_STYLES.length] ?? CODE_BADGE_STYLES[0]
}

export function TeacherPresenceTab() {
  const teachersQuery = useTeachers()
  const { year, semester } = useActiveAcademicYear()
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<PresenceViewMode>('matrix')
  const [importOpen, setImportOpen] = useState(false)
  const filters = useFilters({ pq: '', pday: '' })

  const activeTeachers = useMemo(
    () => (teachersQuery.data ?? []).filter((t) => t.status === 'ACTIVE'),
    [teachersQuery.data],
  )

  const dayCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    for (const t of activeTeachers) {
      for (const d of t.attendanceDays ?? []) {
        if (counts[d] !== undefined) counts[d] += 1
      }
    }
    return counts
  }, [activeTeachers])

  const scheduledTeachersCount = useMemo(
    () => activeTeachers.filter((t) => (t.attendanceDays?.length ?? 0) > 0).length,
    [activeTeachers],
  )

  const matrixRows = useMemo(() => buildPresenceMatrixRows(activeTeachers), [activeTeachers])

  const queryText = filters.values.pq.trim().toLowerCase()
  const selectedDay = filters.values.pday ? Number(filters.values.pday) : null

  const filteredMatrixRows = useMemo(() => {
    if (!queryText && !selectedDay) return matrixRows
    return matrixRows.filter((row) => {
      const daysToCheck = selectedDay ? [selectedDay] : [1, 2, 3, 4, 5, 6]
      return daysToCheck.some((d) => {
        const cell = row.cells[d]
        if (!cell) return false
        if (!queryText) return true
        return cell.name.toLowerCase().includes(queryText) || cell.code.toLowerCase().includes(queryText)
      })
    })
  }, [matrixRows, queryText, selectedDay])

  const filteredChecklistTeachers = useMemo(() => {
    return [...activeTeachers]
      .filter((t) => {
        if (selectedDay && !(t.attendanceDays ?? []).includes(selectedDay)) return false
        if (!queryText) return true
        return (
          t.name.toLowerCase().includes(queryText) ||
          (t.code ?? '').toLowerCase().includes(queryText) ||
          t.nip.toLowerCase().includes(queryText)
        )
      })
      .sort((a, b) => {
        const numA = Number.parseInt(a.code ?? '', 10)
        const numB = Number.parseInt(b.code ?? '', 10)
        if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) return numA - numB
        return (a.code ?? a.name).localeCompare(b.code ?? b.name, 'id', { numeric: true })
      })
  }, [activeTeachers, queryText, selectedDay])

  const toggleDayMutation = useMutation({
    mutationFn: ({ teacher, day }: { teacher: Teacher; day: number }) => {
      const current = teacher.attendanceDays ?? []
      const exists = current.includes(day)
      const nextDays = exists ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b)
      return masterApi.teachers.update(teacher.id, { attendanceDays: nextDays })
    },
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: masterKeys.teachers() })
      void qc.invalidateQueries({ queryKey: ['teacher-attendance'] })
      toast.success(`Jadwal hadir ${updated.name} diperbarui (${updated.attendanceDays?.length ?? 0} hari/pekan).`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })

  const handleExportExcel = () => {
    const xls = buildPresenceMatrixExcel(activeTeachers, {
      schoolName: 'SMK PLUS PELITA NUSANTARA BOGOR',
      academicYear: year?.name ?? '2026/2027',
      semester: semester?.name ?? 'Ganjil',
    })
    downloadBlob(
      new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8' }),
      'jadwal-kehadiran-guru-senin-sabtu.xls',
    )
  }

  return (
    <div className="grid gap-4">
      <TabToolbar
        description="Jadwal kehadiran mingguan guru (Senin–Sabtu) sebagai acuan daftar guru terjadwal pada Absensi Guru Harian."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<PresenceViewMode>
              ariaLabel="Mode tampilan jadwal kehadiran guru"
              value={viewMode}
              onChange={setViewMode}
              options={[
                {
                  value: 'matrix',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Grid3x3 className="size-3.5" />
                      Matriks 6 Hari
                    </span>
                  ),
                },
                {
                  value: 'checklist',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <CheckSquare className="size-3.5" />
                      Checklist per Guru
                    </span>
                  ),
                },
              ]}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="size-4" />
              Ekspor Excel (.xls)
            </Button>
            <Button type="button" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Impor Matriks
            </Button>
          </div>
        }
      />

      <FramedCard
        title="Ringkasan Kehadiran Guru per Hari (Senin–Sabtu)"
        description={
          year
            ? `Tahun Ajaran ${year.name}${semester ? ` · Semester ${semester.name}` : ''}`
            : 'Jumlah guru wajib hadir setiap hari kerja'
        }
        headerRight={<CountChip>{scheduledTeachersCount} guru terjadwal</CountChip>}
        bodyClassName="p-0"
      >
        <div className="grid grid-cols-2 divide-y divide-border/70 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0">
          {DAYS_MON_SAT.map((d) => (
            <Metric key={d.day} label={d.label} value={dayCounts[d.day] ?? 0} hint="guru wajib hadir" />
          ))}
        </div>
      </FramedCard>

      <FilterBar onReset={filters.isDirty ? filters.reset : undefined}>
        <SearchInput
          label="Cari guru atau kode"
          placeholder="Nama guru atau kode (mis. 21, A71)"
          value={filters.values.pq}
          onChange={(pq) => filters.set({ pq })}
        />
        <FilterSelect
          label="Filter hari"
          value={filters.values.pday}
          onChange={(pday) => filters.set({ pday })}
          allLabel="Semua hari (Senin–Sabtu)"
          options={DAYS_MON_SAT.map((d) => ({
            value: String(d.day),
            label: `${d.label} (${dayCounts[d.day] ?? 0} guru)`,
          }))}
        />
      </FilterBar>

      <QueryBoundary query={teachersQuery}>
        {() =>
          viewMode === 'matrix' ? (
            <FramedCard
              title="Tabel Matriks Jadwal Kehadiran Guru (Senin–Sabtu)"
              description="Format matriks 6 kolom hari beserta Kode Guru sesuai dokumen jadwal kehadiran sekolah"
              headerRight={<CountChip>{filteredMatrixRows.length} baris</CountChip>}
              bodyClassName="p-0"
            >
              {filteredMatrixRows.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<CalendarCheck2 className="size-5" />}
                    title="Tidak ada jadwal kehadiran yang cocok"
                    description="Ubah kata kunci pencarian atau impor matriks kehadiran guru."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-12 border-r border-border/70 text-center font-mono text-xs">
                          NO
                        </TableHead>
                        {DAYS_MON_SAT.map((d) => (
                          <TableHead
                            key={d.day}
                            colSpan={2}
                            className={cn(
                              'border-r border-border/70 text-center text-xs font-semibold tracking-wider',
                              selectedDay === d.day && 'bg-primary/10 text-primary',
                            )}
                          >
                            {d.upper}{' '}
                            <span className="font-mono text-[11px] font-normal text-muted-foreground">
                              ({dayCounts[d.day] ?? 0})
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                      <TableRow className="bg-muted/20">
                        <TableHead className="w-12 border-r border-border/70 text-center font-mono text-[11px] text-muted-foreground">
                          #
                        </TableHead>
                        {DAYS_MON_SAT.flatMap((d) => [
                          <TableHead
                            key={`${d.day}-name`}
                            className="min-w-44 border-r border-border/50 text-[11px] text-muted-foreground"
                          >
                            Nama Guru
                          </TableHead>,
                          <TableHead
                            key={`${d.day}-code`}
                            className="w-14 border-r border-border/70 text-center font-mono text-[11px] text-muted-foreground"
                          >
                            KODE
                          </TableHead>,
                        ])}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMatrixRows.map((row) => (
                        <TableRow key={row.no}>
                          <TableCell className="border-r border-border/70 bg-muted/20 text-center font-mono text-xs font-semibold tabular-nums">
                            {row.no}
                          </TableCell>
                          {DAYS_MON_SAT.flatMap((d) => {
                            const cell = row.cells[d.day]
                            const isHighlighted =
                              Boolean(queryText) &&
                              Boolean(cell) &&
                              (cell!.name.toLowerCase().includes(queryText) ||
                                cell!.code.toLowerCase().includes(queryText))

                            return [
                              <TableCell
                                key={`${row.no}-${d.day}-name`}
                                className={cn(
                                  'border-r border-border/40 py-2 text-xs',
                                  isHighlighted && 'bg-primary/10 font-semibold text-foreground',
                                  !cell && 'text-muted-foreground/40',
                                )}
                              >
                                {cell ? cell.name : '—'}
                              </TableCell>,
                              <TableCell
                                key={`${row.no}-${d.day}-code`}
                                className="border-r border-border/70 py-1.5 text-center"
                              >
                                {cell ? (
                                  <span
                                    className={cn(
                                      'inline-flex min-w-8 items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
                                      codeBadgeStyle(cell.code),
                                    )}
                                  >
                                    {cell.code}
                                  </span>
                                ) : (
                                  <span className="font-mono text-xs text-muted-foreground/30">—</span>
                                )}
                              </TableCell>,
                            ]
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </FramedCard>
          ) : (
            <FramedCard
              title="Checklist Hari Kehadiran per Guru"
              description="Klik tombol hari (Sen–Sab) untuk menambah atau menghapus jadwal wajib hadir guru secara langsung"
              headerRight={<CountChip>{filteredChecklistTeachers.length} guru</CountChip>}
              bodyClassName="p-0"
            >
              {filteredChecklistTeachers.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<CalendarCheck2 className="size-5" />}
                    title="Tidak ada guru yang cocok"
                    description="Coba ubah filter pencarian atau hari kehadiran."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Kode</TableHead>
                        <TableHead>Nama Guru & NIP</TableHead>
                        <TableHead>Hari Kehadiran (Klik untuk Ubah)</TableHead>
                        <TableHead className="w-28 text-right">Total Hari</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChecklistTeachers.map((t) => {
                        const days = t.attendanceDays ?? []
                        return (
                          <TableRow key={t.id}>
                            <TableCell>
                              {t.code ? (
                                <span
                                  className={cn(
                                    'inline-flex min-w-9 items-center justify-center rounded border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums',
                                    codeBadgeStyle(t.code),
                                  )}
                                >
                                  {t.code}
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{t.name}</p>
                                <p className="font-mono text-xs text-muted-foreground tabular-nums">NIP {t.nip}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {DAYS_MON_SAT.map((d) => {
                                  const active = days.includes(d.day)
                                  return (
                                    <Button
                                      key={d.day}
                                      type="button"
                                      size="sm"
                                      variant={active ? 'default' : 'outline'}
                                      aria-pressed={active}
                                      aria-label={`${d.label} untuk ${t.name}`}
                                      disabled={toggleDayMutation.isPending}
                                      onClick={() => toggleDayMutation.mutate({ teacher: t, day: d.day })}
                                      className={cn(
                                        'h-7 min-w-12 px-2 font-mono text-xs',
                                        !active && 'text-muted-foreground hover:text-foreground',
                                      )}
                                    >
                                      {d.short}
                                    </Button>
                                  )
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {days.length > 0 ? (
                                <MetaTag className="font-mono tabular-nums">{days.length} hari/pekan</MetaTag>
                              ) : (
                                <ToneBadge tone="neutral">Belum dijadwalkan</ToneBadge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </FramedCard>
          )
        }
      </QueryBoundary>

      <PresenceMatrixImportDialog
        open={importOpen}
        teachers={teachersQuery.data ?? []}
        onClose={() => setImportOpen(false)}
      />
    </div>
  )
}
