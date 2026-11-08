import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { loginAs, renderWithProviders } from '@/test/utils'
import type { DataResponse } from '@/types/api'
import type { CurrentUser } from '@/types/entities'
import { useAuth } from './auth-context'
import { ProfilePage } from './profile-page'

/** Di aplikasi, RequireAuth menunggu sesi; di test kita tiru dengan gerbang sederhana. */
function Gate() {
  const { status } = useAuth()
  return status === 'authenticated' ? <ProfilePage /> : <p>memuat sesi</p>
}

describe('ProfilePage', () => {
  it('shows account + teacher info and saves name/email edits', async () => {
    await loginAs('walikelas')
    const user = userEvent.setup()
    renderWithProviders(<Gate />, { route: '/profil', path: '/profil' })

    expect(await screen.findByText('@walikelas', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText('Wali Kelas')).toBeInTheDocument()
    expect(screen.getByText(/Perubahan kata sandi/)).toBeInTheDocument()
    // NIP dari data master guru
    await waitFor(() => expect(screen.getByText('NIP').nextElementSibling?.textContent).toMatch(/\d{6,}/), {
      timeout: 5000,
    })

    await user.click(screen.getByRole('button', { name: /Ubah/ }))
    const name = screen.getByLabelText(/^Nama/)
    const email = screen.getByLabelText(/^Email/)

    await user.clear(email)
    await user.type(email, 'bukan-email')
    await user.click(screen.getByRole('button', { name: /Simpan/ }))
    expect(await screen.findByText('Format email tidak valid.')).toBeInTheDocument()

    await user.clear(name)
    await user.type(name, 'Bu Rina Wali')
    await user.clear(email)
    await user.type(email, 'rina@sekolah.example.id')
    await user.click(screen.getByRole('button', { name: /Simpan/ }))

    // Form tertutup dan tampilan baca menampilkan nilai baru.
    expect(await screen.findByText('rina@sekolah.example.id', undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^Email/ })).not.toBeInTheDocument()
    expect(screen.getAllByText('Bu Rina Wali').length).toBeGreaterThan(0)

    const me = await api.get<DataResponse<CurrentUser>>('/auth/me')
    expect(me.data.name).toBe('Bu Rina Wali')
    expect(me.data.email).toBe('rina@sekolah.example.id')
  }, 25_000)
})
