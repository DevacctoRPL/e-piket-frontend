import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { TeachingLogsPage } from './pages/teaching-logs-page'

describe('TeachingLogsPage (Agenda Guru)', () => {
  it('menampilkan tabel read-only tanpa Status & Guru Piket serta membuka pratinjau TTD', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(<TeachingLogsPage />, { route: '/agenda-guru', path: '/agenda-guru' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda Guru' })).toBeInTheDocument()
    expect(await screen.findByText('Kegiatan Mengajar')).toBeInTheDocument()

    // Kolom wajib ada: No, Nama Guru, Kelas, Mata Pelajaran, Jam Ke-, Materi / Catatan, TTD
    expect(screen.getByRole('columnheader', { name: 'No' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Nama Guru/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Kelas/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Mata Pelajaran/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Jam Ke-/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Materi \/ Catatan/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'TTD' })).toBeInTheDocument()

    // Status & input paraf Guru Piket sudah dihilangkan
    expect(screen.queryByRole('columnheader', { name: /^Status$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Guru Piket/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filter status kegiatan')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Input nama guru piket')).not.toBeInTheDocument()

    // Thumbnail TTD dapat diklik untuk pratinjau read-only
    const signButtons = await screen.findAllByRole('button', { name: /^Lihat tanda tangan /i })
    expect(signButtons.length).toBeGreaterThan(0)
    await user.click(signButtons[0]!)
    expect(await screen.findByRole('heading', { name: 'Tanda Tangan Guru' })).toBeInTheDocument()
    expect(screen.getByText('Presensi Guru (hanya baca)')).toBeInTheDocument()
  })
})
