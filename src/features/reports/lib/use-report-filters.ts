import { useMemo } from 'react'
import { useFilters } from '@/components/filter-bar'
import { useActiveAcademicYear } from '@/features/master-data/lookups'
import { addDays, endOfMonth, isoDayOfWeek, startOfMonth, todayISO } from '@/lib/date'
import type { QueryParams } from '@/lib/api-client'
import type { PeriodPreset, ReportDef } from '../catalog'
import type { AttendanceGroupBy, ReportQuery } from '../types'
import { periodLabel, periodSlug } from './format'

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'semester', label: 'Semester aktif' },
  { value: 'custom', label: 'Rentang tanggal' },
]

const FILTER_DEFAULTS = {
  period: '',
  dateFrom: '',
  dateTo: '',
  classId: '',
  shiftCode: '',
  teacherId: '',
  studentId: '',
  subjectId: '',
  status: '',
  type: '',
  groupBy: '',
}
export type ReportFilterValues = typeof FILTER_DEFAULTS

const OPTIONAL_KEYS = ['classId', 'shiftCode', 'teacherId', 'studentId', 'subjectId', 'status', 'type'] as const

/** Rentang tanggal untuk preset periode (zona sekolah). null = semester belum dimuat. */
export function presetRange(
  preset: PeriodPreset,
  today: string,
  semester: { startDate: string; endDate: string } | null,
): { dateFrom: string; dateTo: string } | null {
  switch (preset) {
    case 'today':
      return { dateFrom: today, dateTo: today }
    case 'week': {
      const monday = addDays(today, 1 - isoDayOfWeek(today))
      return { dateFrom: monday, dateTo: addDays(monday, 6) }
    }
    case 'month':
      return { dateFrom: startOfMonth(today), dateTo: endOfMonth(today) }
    case 'semester':
      return semester ? { dateFrom: semester.startDate, dateTo: semester.endDate } : null
    case 'custom':
      return null
  }
}

const isPreset = (v: string): v is PeriodPreset => PERIOD_OPTIONS.some((o) => o.value === v)

/**
 * Filter laporan tersimpan di URL (PRD §8.1). Menghasilkan query API yang SAMA untuk layar,
 * cetak, dan ekspor sehingga angka di ketiganya identik (AC-12).
 */
export function useReportFilters(def: ReportDef, opts: { defaultGroupBy?: AttendanceGroupBy } = {}) {
  const filters = useFilters(FILTER_DEFAULTS)
  const { values } = filters
  const { semester, isPending: semesterPending } = useActiveAcademicYear()
  const today = todayISO()

  const preset: PeriodPreset = isPreset(values.period) ? values.period : def.defaultPeriod
  const groupBy = (values.groupBy || opts.defaultGroupBy || 'class') as AttendanceGroupBy

  const range = useMemo(() => {
    if (preset === 'custom') {
      const from = values.dateFrom || today
      const to = values.dateTo || from
      return { dateFrom: from, dateTo: to }
    }
    return presetRange(preset, today, semester)
  }, [preset, values.dateFrom, values.dateTo, today, semester])

  const rangeError =
    range && range.dateFrom > range.dateTo ? 'Tanggal akhir harus setelah tanggal awal.' : null

  const query = useMemo<ReportQuery | null>(() => {
    if (!range || rangeError) return null
    const q: ReportQuery = { dateFrom: range.dateFrom, dateTo: range.dateTo }
    for (const k of OPTIONAL_KEYS) if (values[k]) q[k] = values[k]
    if (def.slug === 'student-attendance') q.groupBy = groupBy
    return q
  }, [range, rangeError, values, def.slug, groupBy])

  /** Ubah preset: preset kustom mempertahankan rentang yang sedang tampil. */
  const setPreset = (next: PeriodPreset) => {
    if (next === 'custom' && range) filters.set({ period: next, dateFrom: range.dateFrom, dateTo: range.dateTo })
    else filters.set({ period: next === def.defaultPeriod ? '' : next, dateFrom: '', dateTo: '' })
  }

  return {
    ...filters,
    preset,
    setPreset,
    groupBy,
    range,
    rangeError,
    /** Menunggu semester aktif dimuat. */
    rangePending: preset === 'semester' && !range && semesterPending,
    query,
    periodText: range ? periodLabel(range.dateFrom, range.dateTo) : '—',
    periodFile: range ? periodSlug(range.dateFrom, range.dateTo) : today,
    exportFilters: (query ?? {}) as QueryParams,
  }
}

export type ReportFilters = ReturnType<typeof useReportFilters>

/** Bangun URL halaman operasional dengan filter yang cocok (penelusuran FR-RPT-01). */
export function drillHref(path: string, params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `${path}?${s}` : path
}
