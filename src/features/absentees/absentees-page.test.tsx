import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { addDays, todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { AbsenteesPage } from './pages/absentees-page'

const today = todayISO()
const from = addDays(today, -14)

function desktopTable() {
  return screen.getByRole('table')
}

/** Tunggu baris tampil DAN data master (nama shift) termuat agar sel tidak di-remount saat diklik. */
async function waitForRows() {
  await waitFor(
    () => {
      const table = desktopTable()
      expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
      expect(within(table).queryAllByText(/^(MORNING|AFTERNOON)$/)).toHaveLength(0)
    },
    { timeout: 8000 },
  )
}

function statusCells() {
  return within(desktopTable())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[3]?.textContent ?? '')
}

describe('AbsenteesPage', () => {
  it('filters by status chips and syncs to URL', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    const { router } = renderWithProviders(<AbsenteesPage />, {
      route: `/siswa-tidak-hadir?dateFrom=${from}&dateTo=${today}`,
      path: '/siswa-tidak-hadir',
    })
    await waitForRows()
    expect(statusCells().some((t) => !t.includes('Sakit'))).toBe(true)

    const sickChip = await screen.findByRole('button', { name: /S · Sakit/ })
    await user.click(sickChip)
    await waitFor(() => expect(sickChip).toHaveAttribute('aria-pressed', 'true'))
    expect(router.state.location.search).toContain('status=SICK')
    await waitFor(
      () => {
        const cells = statusCells()
        expect(cells.length).toBeGreaterThan(0)
        expect(cells.every((t) => t.includes('Sakit'))).toBe(true)
      },
      { timeout: 8000 },
    )

    // "Semua" mengembalikan seluruh status
    await user.click(screen.getByRole('button', { name: /^Semua/ }))
    await waitFor(() => expect(router.state.location.search).not.toContain('status='))
  }, 30000)

  it('records guardian confirmation through the dialog', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(<AbsenteesPage />, {
      route: `/siswa-tidak-hadir?dateFrom=${from}&dateTo=${today}&contacted=false`,
      path: '/siswa-tidak-hadir',
    })
    await waitForRows()
    const firstRow = within(desktopTable()).getAllByRole('row')[1]!
    expect(within(firstRow).getByText('Belum dikonfirmasi')).toBeInTheDocument()
    await user.click(within(firstRow).getByRole('button', { name: /Catat konfirmasi/ }))

    const dialog = await screen.findByRole('dialog')
    // Nomor wali terisi otomatis untuk piket (student_contact:read)
    const phone = within(dialog).getByLabelText('Nomor yang dihubungi') as HTMLInputElement
    expect(phone.value).toMatch(/^08\d+$/)
    await user.click(within(dialog).getByRole('button', { name: 'Simpan konfirmasi' }))
    // receiver wajib bila nomor diisi
    expect(await within(dialog).findByText(/Isi siapa yang menerima/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Ibu' }))
    await user.type(within(dialog).getByLabelText('Keterangan'), 'Surat izin menyusul')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan konfirmasi' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 8000 })
    await waitFor(() =>
      expect(db().studentRecords.some((r) => r.contact?.contactNote === 'Surat izin menyusul' && r.contact.receiverName === 'Ibu')).toBe(true),
    )
  }, 30000)

  it('hides the confirmation action for guru and shows masked phones', async () => {
    await loginAs('guru')
    renderWithProviders(<AbsenteesPage />, {
      route: `/siswa-tidak-hadir?dateFrom=${from}&dateTo=${today}`,
      path: '/siswa-tidak-hadir',
    })
    await waitForRows()
    expect(within(desktopTable()).queryByRole('button', { name: /konfirmasi untuk/ })).not.toBeInTheDocument()
    expect(within(desktopTable()).getAllByText(/\*\*\*\*/).length).toBeGreaterThan(0)
  }, 30000)
})
