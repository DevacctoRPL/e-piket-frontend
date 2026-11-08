import { useMemo } from 'react'
import { useFilters } from '@/components/filter-bar'
import { todayISO } from '@/lib/date'
import { NON_PRESENT_STATUSES } from '@/lib/enums'
import type { AttendanceStatus, Shift } from '@/types/entities'
import type { AbsenteeQuery } from './types'

/** Ubah 'SICK,ABSENT' (URL) menjadi daftar status valid, urut sesuai NON_PRESENT_STATUSES. */
export function parseStatusParam(raw: string): AttendanceStatus[] {
  const set = new Set(raw.split(',').map((s) => s.trim()))
  return NON_PRESENT_STATUSES.filter((s) => set.has(s))
}

export function serializeStatuses(list: readonly AttendanceStatus[]): string {
  return NON_PRESENT_STATUSES.filter((s) => list.includes(s)).join(',')
}

/**
 * Filter halaman siswa tidak hadir yang disimpan di URL (tanggal, kelas, shift, status, konfirmasi, draft, halaman).
 * Kata kunci nama sengaja TIDAK disimpan di URL (PRD §12.2).
 */
export function useAbsenteeFilters() {
  const today = todayISO()
  const filters = useFilters({
    dateFrom: today,
    dateTo: today,
    classId: '',
    shiftCode: '',
    status: '',
    contacted: '',
    draft: '',
    page: '1',
  })
  const { values } = filters
  const statuses = useMemo(() => parseStatusParam(values.status), [values.status])

  /** Query dasar (tanpa search/paginasi) — dipakai juga oleh ringkasan, ekspor, dan cetak. */
  const baseQuery = useMemo<Omit<AbsenteeQuery, 'page' | 'pageSize' | 'search'>>(() => {
    const dateFrom = values.dateFrom || today
    const dateTo = values.dateTo && values.dateTo >= dateFrom ? values.dateTo : dateFrom
    return {
      dateFrom,
      dateTo,
      classId: values.classId || undefined,
      shiftCode: values.shiftCode || undefined,
      status: statuses.length > 0 ? statuses : undefined,
      contacted: values.contacted === 'true' || values.contacted === 'false' ? values.contacted : undefined,
      includeDraft: values.draft === '1' || undefined,
    }
  }, [values.dateFrom, values.dateTo, values.classId, values.shiftCode, values.contacted, values.draft, statuses, today])

  const page = Math.max(1, Number(values.page) || 1)

  const toggleStatus = (s: AttendanceStatus) => {
    const next = statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s]
    filters.set({ status: serializeStatuses(next) })
  }

  return { ...filters, statuses, baseQuery, page, toggleStatus, today }
}

/** String periode untuk nama file ekspor. */
export function periodLabel(q: { dateFrom: string; dateTo: string }) {
  return q.dateFrom === q.dateTo ? q.dateFrom : `${q.dateFrom}_${q.dateTo}`
}

/** Query string untuk halaman cetak dengan filter yang sama (tanpa kata kunci nama). */
export function printSearch(sp: URLSearchParams) {
  const next = new URLSearchParams(sp)
  next.delete('page')
  const s = next.toString()
  return s ? `?${s}` : ''
}

/**
 * Nama shift dari kode. Identitas fungsi stabil selama data shift tidak berubah — penting karena
 * DataTable merender sel sebagai komponen; kolom baru = sel di-remount (fokus/klik hilang).
 */
export function useShiftName(shifts: Shift[] | undefined) {
  return useMemo(() => {
    const map = new Map((shifts ?? []).map((s) => [s.code, s.name]))
    return (code: string) => map.get(code) ?? code
  }, [shifts])
}
