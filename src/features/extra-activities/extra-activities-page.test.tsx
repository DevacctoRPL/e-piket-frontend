import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { ExtraActivitiesPage } from './pages/extra-activities-page'

describe('ExtraActivitiesPage (Jam Tambahan)', () => {
  it('menampilkan kolom Nama Guru / Kegiatan, multi-kelas, Materi, dan TTD read-only tanpa Waktu/Jam, Status, maupun Guru Piket', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(<ExtraActivitiesPage />, { route: '/jam-tambahan', path: '/jam-tambahan' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Jam Tambahan' })).toBeInTheDocument()
    expect(await screen.findByText('Daftar Jam Tambahan')).toBeInTheDocument()

    // Struktur 5 kolom: No | Nama Guru / Kegiatan | Kelas | Materi | TTD
    expect(screen.getByRole('columnheader', { name: 'No' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Nama Guru \/ Kegiatan/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Kelas' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Materi' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'TTD' })).toBeInTheDocument()

    // Kolom & kontrol terhapus
    expect(screen.queryByRole('columnheader', { name: /Waktu/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^Status$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Guru Piket/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filter status jam tambahan')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Input nama guru piket')).not.toBeInTheDocument()

    // Menampilkan kegiatan dengan multi-kelas & Belum TTD + pratinjau TTD
    expect(screen.getAllByText('Bimbingan Persiapan LKS Jaringan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Belum TTD').length).toBeGreaterThan(0)

    const signButtons = await screen.findAllByRole('button', { name: /^Lihat tanda tangan /i })
    expect(signButtons.length).toBeGreaterThan(0)
    await user.click(signButtons[0]!)
    expect(await screen.findByRole('heading', { name: 'Tanda Tangan Guru' })).toBeInTheDocument()
  })
})
