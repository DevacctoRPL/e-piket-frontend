import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { DashboardPage } from './pages/dashboard-page'

describe('DashboardPage (5-panel operasional)', () => {
  it('menampilkan KPI 4 modul aktif dengan label TTD read-only tanpa tab Sistem maupun label paraf lama', async () => {
    await loginAs('piket')
    renderWithProviders(<DashboardPage />, { route: '/', path: '/' })

    expect(await screen.findByRole('heading', { level: 1, name: /^Selamat /i })).toBeInTheDocument()
    expect(await screen.findByText('Kehadiran Guru')).toBeInTheDocument()
    expect(screen.getByText('Jam Kosong Terisi')).toBeInTheDocument()
    expect(screen.getAllByText('Siswa Tidak Hadir').length).toBeGreaterThan(0)
    expect(screen.getByText('Agenda Guru')).toBeInTheDocument()
    expect(screen.getByText('Jam Tambahan')).toBeInTheDocument()
    expect(screen.getByText('Tren Operasional 7 Hari')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Agenda TTD' })).toBeInTheDocument()
    expect(screen.getByText('Pembaruan Terkini')).toBeInTheDocument()
    expect(screen.getByText('Tugas yang perlu diselesaikan')).toBeInTheDocument()

    // Tidak ada label paraf lama ataupun tab Sistem/panel terhapus
    expect(screen.queryByText('Agenda Guru Diparaf')).not.toBeInTheDocument()
    expect(screen.queryByText('Jam Tambahan Diparaf')).not.toBeInTheDocument()
    expect(screen.queryByText('Jam Kosong Belum Diisi')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'Sistem' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Kepulangan/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Agenda Piket/i)).not.toBeInTheDocument()
  })
})
