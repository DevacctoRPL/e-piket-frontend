import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth-context'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { UsersPage } from './pages/users-page'

/** Di aplikasi, RequireAuth menunda render sampai sesi siap; test meniru hal itu. */
function AuthReady({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? <>{children}</> : null
}

const UI_TIMEOUT = 30_000
const WAIT = { timeout: 8000 }

function renderPage(route = '/pengguna') {
  return renderWithProviders(
    <AuthReady>
      <UsersPage />
    </AuthReady>,
    { route, path: '/pengguna' },
  )
}

describe('UsersPage (Kelola Pengguna)', () => {
  it('menampilkan daftar akun; aksi berbahaya pada akun sendiri dinonaktifkan', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()

    expect((await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Yulia Rahman (TU)').length).toBeGreaterThan(0)

    await user.click(screen.getAllByRole('button', { name: 'Aksi untuk Dimas Prasetyo (Super Admin)' })[0]!)
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Nonaktifkan \(akun sendiri\)/ })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /Reset kata sandi \(akun sendiri\)/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const history = within(menu).getByRole('menuitem', { name: /Riwayat aktivitas/ })
    expect(history).toHaveAttribute('href', '/audit?actorId=usr_superadmin')
  }, UI_TIMEOUT)

  it('filter status dari URL: hanya akun nonaktif', async () => {
    await loginAs('superadmin')
    renderPage('/pengguna?status=INACTIVE')
    expect((await screen.findAllByText('Siti Aminah (TU)', {}, WAIT)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Yulia Rahman (TU)')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Nonaktif' })).toHaveAttribute('aria-checked', 'true')
  }, UI_TIMEOUT)

  it('membuat akun → kata sandi sementara tampil sekali dan tidak masuk audit', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)

    await user.click(screen.getByRole('button', { name: /Tambah Akun/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Nama pengguna/), 'wakasek')
    await user.type(within(dialog).getByLabelText(/Nama lengkap/), 'Bu Wakasek')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Pimpinan' }))
    await user.click(within(dialog).getByRole('button', { name: 'Buat akun' }))

    const pwd = await screen.findByTestId('temporary-password', {}, WAIT)
    const value = pwd.textContent ?? ''
    expect(value.length).toBeGreaterThanOrEqual(8)
    expect(screen.getByText(/hanya ditampilkan sekali/)).toBeInTheDocument()

    const created = db().users.find((u) => u.username === 'wakasek')
    expect(created?.roles).toEqual(['PRINCIPAL'])
    expect(created?.password).toBe(value)
    expect(JSON.stringify(db().auditLogs)).not.toContain(value)

    await user.click(screen.getByRole('button', { name: 'Selesai' }))
    await waitFor(() => expect(screen.queryByTestId('temporary-password')).not.toBeInTheDocument())
    expect((await screen.findAllByText('Bu Wakasek', {}, WAIT)).length).toBeGreaterThan(0)
  }, UI_TIMEOUT)

  it('validasi klien: peran guru wajib ditautkan ke data guru', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)

    await user.click(screen.getByRole('button', { name: /Tambah Akun/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Nama pengguna/), 'guru.baru')
    await user.type(within(dialog).getByLabelText(/Nama lengkap/), 'Guru Baru')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Guru' }))
    await user.click(within(dialog).getByRole('button', { name: 'Buat akun' }))
    expect(await within(dialog).findByText(/wajib ditautkan ke data guru/)).toBeInTheDocument()
  }, UI_TIMEOUT)

  it('admin (tanpa user:read) mendapat akses ditolak dari API', async () => {
    await loginAs('admin')
    renderPage()
    expect(await screen.findByText('Akses ditolak', {}, WAIT)).toBeInTheDocument()
  }, UI_TIMEOUT)
})
