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

  it('tambah akun massal (upload template CSV) otomatis membuat akun & data guru baru dari NIP', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)

    await user.click(screen.getByRole('button', { name: /Tambah Massal/ }))
    const dialog = await screen.findByRole('dialog')

    const csvContent = [
      'username,nama_lengkap,nip,peran,email,telepon,password',
      'farhan.akbar,"Farhan Akbar, S.Pd.",199502142021011003,"Guru; Guru Piket",farhan@sekolah.sch.id,081234560001,',
      ',"Lestari Putri, M.Pd.",199603182022022005,Guru,lestari@sekolah.sch.id,081234560002,',
    ].join('\n')

    const file = new File([csvContent], 'daftar-guru-baru.csv', { type: 'text/csv' })
    const fileInput = within(dialog).getByTestId('bulk-file-input')
    await user.upload(fileInput, file)

    expect(await within(dialog).findByText('Farhan Akbar, S.Pd.', {}, WAIT)).toBeInTheDocument()
    expect(within(dialog).getByText('lestari.putri')).toBeInTheDocument()
    expect(within(dialog).getByText('2 siap dibuat')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Buat 2 Akun' }))

    expect(await within(dialog).findByText('2 Akun Berhasil Dibuat', {}, WAIT)).toBeInTheDocument()
    const tempPwds = within(dialog).getAllByTestId('bulk-temporary-password')
    expect(tempPwds).toHaveLength(2)

    await user.click(within(dialog).getByRole('button', { name: 'Selesai' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect((await screen.findAllByText('Farhan Akbar, S.Pd.', {}, WAIT)).length).toBeGreaterThan(0)
    expect(db().teachers.some((t) => t.nip === '199502142021011003')).toBe(true)
    expect(db().teachers.some((t) => t.nip === '199603182022022005')).toBe(true)
  }, UI_TIMEOUT)

  it('mendukung hapus akun satuan dan aksi massal lewat checkbox tabel', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)

    // Pilih baris Siti Aminah (TU) melalui checkbox untuk hapus massal
    const checkbox = screen.getByRole('checkbox', { name: 'Pilih akun Siti Aminah (TU)' })
    await user.click(checkbox)

    const bulkBar = await screen.findByRole('region', { name: 'Aksi massal pengguna' })
    expect(within(bulkBar).getByText('1 akun dipilih')).toBeInTheDocument()

    await user.click(within(bulkBar).getByRole('button', { name: /Hapus \(1\)/ }))
    const alertDialog = await screen.findByRole('alertdialog')
    await user.click(within(alertDialog).getByRole('button', { name: 'Hapus 1 akun' }))

    await waitFor(() => expect(screen.queryByText('Siti Aminah (TU)')).not.toBeInTheDocument(), WAIT)
    expect(db().users.find((u) => u.id === 'usr_tu_lama')).toBeUndefined()
  }, UI_TIMEOUT)

  it('dialog impor massal menampilkan kartu berbingkai Nuvio, tombol Excel (.xls), dan mendukung tempel langsung dari Excel', async () => {
    await loginAs('superadmin')
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByText('Dimas Prasetyo (Super Admin)', {}, WAIT)

    await user.click(screen.getByRole('button', { name: /Tambah Massal/ }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText('Template & Data Guru')).toBeInTheDocument()
    expect(within(dialog).getByTestId('download-template-xls')).toBeInTheDocument()
    expect(within(dialog).getByTestId('download-template-csv')).toBeInTheDocument()

    await user.click(within(dialog).getByTestId('toggle-paste-mode'))
    const pasteArea = within(dialog).getByTestId('bulk-paste-textarea')
    await user.type(
      pasteArea,
      '1\tRatna Sari, S.Pd.\t199405102020122008\tGuru; Wali Kelas\tratna@sekolah.sch.id\t081299998888',
    )

    expect(await within(dialog).findByText('Ratna Sari, S.Pd.', {}, WAIT)).toBeInTheDocument()
    expect(within(dialog).getByText('ratna.sari')).toBeInTheDocument()
  }, UI_TIMEOUT)
})
