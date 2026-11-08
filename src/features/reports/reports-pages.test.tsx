import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { addDays, todayISO } from '@/lib/date'
import { loginAs, renderWithProviders } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import { formatNumber, formatPercent, periodSlug } from './lib/format'
import { presetRange } from './lib/use-report-filters'
import { ReportCatalogPage } from './pages/report-catalog-page'
import { StudentAttendanceReportPage } from './pages/student-attendance-report-page'
import { SubstitutionsReportPage } from './pages/substitutions-report-page'
import type { AttendanceReport, SubstitutionReport } from './types'

const today = todayISO()
const from = addDays(today, -14)
const WAIT = { timeout: 8000 }

describe('helpers', () => {
  it('preset periode & slug nama file', () => {
    expect(presetRange('week', '2026-11-08', null)).toEqual({ dateFrom: '2026-11-02', dateTo: '2026-11-08' })
    expect(presetRange('month', '2026-11-08', null)).toEqual({ dateFrom: '2026-11-01', dateTo: '2026-11-30' })
    expect(presetRange('semester', '2026-11-08', null)).toBeNull()
    expect(periodSlug('2026-11-01', '2026-11-30')).toBe('2026-11')
    expect(periodSlug('2026-11-08', '2026-11-08')).toBe('2026-11-08')
    expect(periodSlug('2026-11-02', '2026-11-08')).toBe('2026-11-02_2026-11-08')
  })
})

describe('halaman laporan', () => {
  it('katalog hanya menampilkan laporan yang boleh dilihat role', async () => {
    await loginAs('guru')
    renderWithProviders(<ReportCatalogPage />, { route: '/laporan' })
    expect(await screen.findByText('Rekap Absensi Siswa', undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByText('Rekap Agenda Kegiatan Mengajar')).toBeInTheDocument()
    // guru tidak memiliki absentees:read / dismissal:read
    expect(screen.queryByText('Daftar Siswa Tidak Hadir')).not.toBeInTheDocument()
    expect(screen.queryByText('Rekap Kepulangan Siswa')).not.toBeInTheDocument()
  })

  it('rekap absensi siswa menampilkan angka server, filter dari URL, dan tautan penelusuran', async () => {
    await loginAs('kepsek')
    const route = `/laporan/absensi-siswa?period=custom&dateFrom=${from}&dateTo=${today}&classId=cls_2`
    const expected = await api
      .get<DataResponse<AttendanceReport>>('/reports/attendance-summary', { dateFrom: from, dateTo: today, classId: 'cls_2', groupBy: 'class' })
      .then((r) => r.data)
    renderWithProviders(<StudentAttendanceReportPage />, { route, path: '/laporan/absensi-siswa' })

    expect(await screen.findByRole('heading', { name: 'Rekap Absensi Siswa' }, WAIT)).toBeInTheDocument()
    const pct = formatPercent(expected.totals.percentPresent)
    await waitFor(() => expect(screen.getAllByText(pct).length).toBeGreaterThan(0), WAIT)

    // satu baris kelas X AKL 1 di tabel
    const table = screen.getByRole('table')
    expect(within(table).getByText('X AKL 1')).toBeInTheDocument()
    // baris total memakai angka server
    const totals = screen.getAllByLabelText('Total')[0]!
    expect(within(totals).getByText(formatNumber(expected.totals.total))).toBeInTheDocument()

    // penelusuran ke daftar siswa tidak hadir dengan filter kelas & rentang
    const drill = within(table).getByRole('link', { name: /Tidak hadir/ })
    expect(drill.getAttribute('href')).toBe(`/siswa-tidak-hadir?classId=cls_2&dateFrom=${from}&dateTo=${today}`)

    // admin/pimpinan boleh ekspor
    expect(screen.getByRole('button', { name: /Ekspor/ })).toBeInTheDocument()
    // filter terpilih dari URL
    await waitFor(() => expect((screen.getByLabelText('Kelas') as HTMLSelectElement).value).toBe('cls_2'), WAIT)
    expect((screen.getByLabelText('Periode') as HTMLSelectElement).value).toBe('custom')
  })

  it('guru tidak melihat tombol Ekspor (hanya Cetak)', async () => {
    await loginAs('guru')
    renderWithProviders(<StudentAttendanceReportPage />, { route: '/laporan/absensi-siswa', path: '/laporan/absensi-siswa' })
    expect(await screen.findByRole('button', { name: /Cetak/ }, WAIT)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ekspor/ })).not.toBeInTheDocument()
    expect(await screen.findByText(/Data dibatasi/, undefined, WAIT)).toBeInTheDocument()
  })

  it('cetak jam kosong memuat periode, tanda tangan kepala sekolah, dan total yang sama', async () => {
    await loginAs('piket')
    const expected = await api
      .get<DataResponse<SubstitutionReport>>('/reports/substitutions', { dateFrom: today, dateTo: today })
      .then((r) => r.data)
    renderWithProviders(<SubstitutionsReportPage mode="print" />, {
      route: '/laporan/jam-kosong/cetak?period=today',
      path: '/laporan/jam-kosong/cetak',
    })
    expect(await screen.findByText('Rekap Jam Kosong & Guru Pengganti', undefined, WAIT)).toBeInTheDocument()
    expect(await screen.findByText('Drs. Hartono, M.Pd.', undefined, WAIT)).toBeInTheDocument()
    expect(screen.getByText('Mengetahui, Kepala Sekolah')).toBeInTheDocument()
    const summary = `${expected.totals.affectedPeriods} jam terdampak · ${expected.totals.handledPeriods} tertangani · ${expected.totals.unhandledPeriods} belum tertangani`
    expect(screen.getByText(summary)).toBeInTheDocument()
    const slotRows = screen.getAllByRole('table').flatMap((t) => [...t.querySelectorAll('tbody tr')])
    expect(slotRows.length).toBeGreaterThanOrEqual(expected.slots.length)
    expect(screen.getByText(`Belum: ${expected.totals.unhandledPeriods} JP`)).toBeInTheDocument()
  })
})
