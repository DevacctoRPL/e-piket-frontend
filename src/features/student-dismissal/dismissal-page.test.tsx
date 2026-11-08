import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { DismissalPage } from './pages/dismissal-page'

const today = todayISO()

function freeStudent(classId: string) {
  const taken = new Set(db().dismissals.filter((d) => d.date === today).map((d) => d.studentId))
  const s = db().students.find((x) => x.classId === classId && x.status === 'ACTIVE' && !taken.has(x.id))
  if (!s) throw new Error('tidak ada siswa uji')
  return s
}

describe('DismissalPage', { timeout: 40_000 }, () => {
  it('records an early leave through the form, validating pickup first', async () => {
    const user = userEvent.setup()
    await loginAs('piket')
    const recordsBefore = JSON.stringify(db().studentRecords)
    const target = freeStudent('cls_2')
    const countBefore = db().dismissals.length

    renderWithProviders(<DismissalPage />, { route: '/kepulangan', path: '/kepulangan' })

    // daftar hari ini termuat (seed: 3 kepulangan hari ini)
    expect(await screen.findByRole('heading', { name: 'Kepulangan Siswa' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText('Memuat data')).not.toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /Catat kepulangan/ })[0]!)
    const sheet = await screen.findByRole('dialog', { name: 'Catat kepulangan' })
    const s = within(sheet)

    // kelas → siswa
    const classSelect = s.getByLabelText(/Kelas/)
    await waitFor(() => expect(within(classSelect).getByRole('option', { name: 'X AKL 1' })).toBeInTheDocument())
    await user.selectOptions(classSelect, 'cls_2')
    await user.type(await s.findByRole('searchbox', { name: 'Cari siswa' }), target.nis)
    await user.click(await s.findByRole('radio', { name: new RegExp(target.name) }))

    // ringkasan absensi kedatangan siswa tampil (sesi FINAL hari ini)
    const ctx = await s.findByRole('region', { name: 'Ringkasan absensi siswa' })
    await waitFor(() => expect(within(ctx).getByText(/Sesi Harian/)).toBeInTheDocument())

    // jenis default pulang lebih awal; kirim tanpa penjemput & alasan → error validasi klien
    expect(s.getByRole('radio', { name: 'Pulang Lebih Awal' })).toBeChecked()
    await user.click(s.getByRole('button', { name: 'Simpan' }))
    expect(await s.findByText(/Nama penjemput\/penerima wajib diisi/)).toBeInTheDocument()
    expect(s.getByText(/Tuliskan alasan pulang lebih awal/)).toBeInTheDocument()
    expect(db().dismissals.length).toBe(countBefore)

    await user.clear(s.getByLabelText(/Waktu keluar/))
    await user.type(s.getByLabelText(/Waktu keluar/), '09:45')
    await user.type(s.getByLabelText(/Penjemput\/penerima/), 'Bapak Darmawan')
    await user.type(s.getByLabelText(/Hubungan/), 'Ayah')
    await user.type(s.getByLabelText(/Alasan pulang lebih awal/), 'Demam, dijemput ayah')
    await user.click(s.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Catat kepulangan' })).not.toBeInTheDocument())
    const saved = db().dismissals.find((d) => d.studentId === target.id && d.date === today)
    expect(saved).toMatchObject({
      type: 'EARLY_LEAVE',
      pickupName: 'Bapak Darmawan',
      pickupRelation: 'Ayah',
      note: 'Demam, dijemput ayah',
      exitTime: `${today}T09:45:00+07:00`,
    })
    // absensi kedatangan tidak berubah (PRD §9.2)
    expect(JSON.stringify(db().studentRecords)).toBe(recordsBefore)
    // daftar ter-invalidasi & menampilkan record baru
    expect((await screen.findAllByText(target.name)).length).toBeGreaterThan(0)
    // nama siswa tidak pernah masuk URL
    expect(window.location.href).not.toContain(encodeURIComponent(target.name))
  })

  it('hides write actions for walikelas (read-only)', async () => {
    await loginAs('walikelas')
    renderWithProviders(<DismissalPage />, { route: '/kepulangan', path: '/kepulangan' })
    expect(await screen.findByRole('heading', { name: 'Kepulangan Siswa' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText('Memuat data')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Catat kepulangan/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tandai kembali/ })).not.toBeInTheDocument()
  })

  it('history tab paginates from the server and filters by type', async () => {
    const user = userEvent.setup()
    await loginAs('piket')
    const { router } = renderWithProviders(<DismissalPage />, {
      route: `/kepulangan?tab=riwayat&from=${'2000-01-01'}`,
      path: '/kepulangan',
    })
    expect(await screen.findByRole('navigation', { name: 'Paginasi' })).toBeInTheDocument()
    expect(screen.getByText(/Halaman 1 dari/)).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Jenis kepulangan' }), 'TEMPORARY_EXIT')
    await waitFor(() => expect(router.state.location.search).toContain('type=TEMPORARY_EXIT'))
    await waitFor(() => {
      const table = screen.getAllByRole('table')[0]!
      const badges = within(table).queryAllByText(/^(Pulang Normal|Pulang Lebih Awal)$/)
      expect(badges).toHaveLength(0)
      expect(within(table).getAllByText('Izin Keluar').length).toBeGreaterThan(0)
    })
  })
})
