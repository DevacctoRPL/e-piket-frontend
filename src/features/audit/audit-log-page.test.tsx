import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { AuditLogPage } from './pages/audit-log-page'

describe('AuditLogPage', () => {
  it('filters by action via URL params and opens the before/after detail sheet', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    const { router } = renderWithProviders(<AuditLogPage />, { route: '/audit', path: '/audit' })

    const table = await screen.findByRole('table', { name: 'Daftar riwayat audit' }, { timeout: 5000 })
    // Seed: ada entri LOGIN (dari loginAs), FINALIZE, dan CORRECT.
    await waitFor(() => expect(within(table).getAllByText('Masuk').length).toBeGreaterThan(0))

    await user.selectOptions(screen.getByRole('combobox', { name: 'Aksi' }), 'CORRECT')
    await waitFor(() => expect(router.state.location.search).toContain('action=CORRECT'))
    await waitFor(() => expect(within(table).queryByText('Masuk')).not.toBeInTheDocument(), { timeout: 5000 })
    const row = within(table).getByText('Koreksi status absensi siswa dari Alpa menjadi Sakit')

    await user.click(row)
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('Detail Riwayat Audit')).toBeInTheDocument()
    expect(within(sheet).getByText('Orang tua mengirim surat keterangan dokter')).toBeInTheDocument()
    expect(within(sheet).getByText('req_seed01')).toBeInTheDocument()

    const diff = within(sheet).getByRole('table', { name: /sebelum dan sesudah/i })
    const statusRow = within(diff).getByRole('rowheader', { name: /Status/ }).closest('tr')
    expect(statusRow).toHaveAttribute('data-changed', 'true')
    expect(within(statusRow!).getByText('Alpa')).toBeInTheDocument()
    expect(within(statusRow!).getByText('Sakit')).toBeInTheDocument()
  }, 20_000)

  it('searches without writing the keyword to the URL (privacy)', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    const { router } = renderWithProviders(<AuditLogPage />, { route: '/audit', path: '/audit' })
    const table = await screen.findByRole('table', { name: 'Daftar riwayat audit' }, { timeout: 5000 })
    await user.type(screen.getByRole('searchbox', { name: 'Cari' }), 'agenda piket')
    await waitFor(() => expect(within(table).queryByText('Masuk')).not.toBeInTheDocument(), { timeout: 5000 })
    expect(within(table).getByText('Finalisasi agenda piket shift Pagi')).toBeInTheDocument()
    expect(router.state.location.search).not.toContain('agenda')
  }, 20_000)

  it('shows a filtered empty state with reset action', async () => {
    await loginAs('kepsek')
    const user = userEvent.setup()
    renderWithProviders(<AuditLogPage />, { route: '/audit?dateFrom=2999-01-01', path: '/audit' })
    expect(await screen.findByText('Tidak ada riwayat yang cocok', undefined, { timeout: 5000 })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Reset filter/ })[0]!)
    expect(await screen.findByRole('table', { name: 'Daftar riwayat audit' }, { timeout: 5000 })).toBeInTheDocument()
  }, 20_000)
})
