import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { loginAs, renderWithProviders } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { SchoolSettings } from '@/types/entities'
import { SettingsPage } from './pages/settings-page'

describe('SettingsPage', () => {
  it('live-previews the letterhead, saves, and surfaces a version conflict', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />, { route: '/pengaturan', path: '/pengaturan' })

    const line1 = await screen.findByRole('textbox', { name: 'Baris kop 1' }, { timeout: 5000 })
    await user.clear(line1)
    await user.type(line1, 'PEMERINTAH PROVINSI UJI')
    const preview = screen.getByRole('region', { name: 'Pratinjau kop cetak' })
    expect(within(preview).getByText('PEMERINTAH PROVINSI UJI')).toBeInTheDocument()
    expect(screen.getByText('Ada perubahan yang belum disimpan.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Tersimpan · versi 2', undefined, { timeout: 5000 })).toBeInTheDocument()
    const saved = await api.get<DataResponse<SchoolSettings>>('/settings')
    expect(saved.data.letterheadLines[0]).toBe('PEMERINTAH PROVINSI UJI')

    // Pengguna lain menyimpan → versi di form menjadi basi.
    await api.patch('/settings', { city: 'Kota Lain', version: 2 })
    await user.click(screen.getByRole('tab', { name: /Kepulangan/ }))
    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(
      await screen.findByText('Pengaturan telah diubah pengguna lain', undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Muat versi terbaru/ })).toBeInTheDocument()
  }, 30_000)

  it('blocks deactivating Hadir and validates required fields client-side', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />, { route: '/pengaturan?tab=status-absensi', path: '/pengaturan' })
    const tablist = await screen.findByRole('tablist', undefined, { timeout: 5000 })
    expect(within(tablist).getByRole('tab', { name: /Status Absensi/ })).toHaveAttribute('data-state', 'active')

    const switches = await screen.findAllByRole('switch')
    expect(switches[0]).toBeDisabled() // PRESENT

    await user.click(within(tablist).getByRole('tab', { name: /Identitas/ }))
    const schoolName = screen.getByLabelText(/^Nama sekolah/)
    await user.clear(schoolName)
    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Nama sekolah wajib diisi.')).toBeInTheDocument()
  }, 20_000)
})
