import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth-context'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { MasterDataPage } from './pages/master-data-page'
import { SchedulePage } from './pages/schedule-page'

/** Di aplikasi, RequireAuth menunda render sampai sesi siap; test meniru hal itu. */
function AuthReady({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? <>{children}</> : null
}

const UI_TIMEOUT = 30_000
const WAIT = { timeout: 8000 }

describe('MasterDataPage — Mata Pelajaran', () => {
  it('membuat mata pelajaran baru dan menampilkannya di tabel', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(<AuthReady><MasterDataPage /></AuthReady>, { route: '/master?tab=mapel', path: '/master' })

    expect(await screen.findAllByText('Matematika', {}, WAIT)).not.toHaveLength(0)
    await user.click(screen.getAllByRole('button', { name: /Tambah Mapel/ })[0]!)

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Kode/), 'kim')
    await user.type(within(dialog).getByLabelText(/Nama mata pelajaran/), 'Kimia Dasar')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT)
    expect((await screen.findAllByText('Kimia Dasar', {}, WAIT)).length).toBeGreaterThan(0)
    expect(db().subjects.some((s) => s.code === 'KIM' && s.name === 'Kimia Dasar')).toBe(true)
  }, UI_TIMEOUT)

  it('menampilkan error 422 dari server pada field (kode duplikat)', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(<AuthReady><MasterDataPage /></AuthReady>, { route: '/master?tab=mapel', path: '/master' })
    await screen.findAllByText('Matematika', {}, WAIT)
    await user.click(screen.getAllByRole('button', { name: /Tambah Mapel/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Kode/), 'MTK')
    await user.type(within(dialog).getByLabelText(/Nama mata pelajaran/), 'Matematika Lagi')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Data sudah ada.', {}, WAIT)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/Kode/)).toHaveAttribute('aria-invalid', 'true')
  }, UI_TIMEOUT)

  it('validasi klien: field wajib', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(<AuthReady><MasterDataPage /></AuthReady>, { route: '/master?tab=mapel', path: '/master' })
    await screen.findAllByText('Matematika', {}, WAIT)
    await user.click(screen.getAllByRole('button', { name: /Tambah Mapel/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Kode wajib diisi.')).toBeInTheDocument()
  }, UI_TIMEOUT)
})

describe('MasterDataPage — tab lain', () => {
  it('tab Kelas menampilkan daftar kelas', async () => {
    await loginAs('admin')
    renderWithProviders(<AuthReady><MasterDataPage /></AuthReady>, { route: '/master?tab=kelas', path: '/master' })
    expect((await screen.findAllByText('X TKJ 1', {}, WAIT)).length).toBeGreaterThan(0)
  }, UI_TIMEOUT)
})

describe('SchedulePage', () => {
  it('guru melihat "Jadwal Saya" berisi hanya jadwalnya sendiri', async () => {
    await loginAs('guru')
    const day = [1, 2, 3, 4, 5, 6, 7].find((d) => db().timetable.some((s) => s.teacherId === 'tch_1' && s.dayOfWeek === d))!
    const mine = db().timetable.filter((s) => s.teacherId === 'tch_1' && s.dayOfWeek === day)
    expect(mine.length).toBeGreaterThan(0)
    renderWithProviders(<AuthReady><SchedulePage /></AuthReady>, { route: `/jadwal?day=${day}`, path: '/jadwal' })
    expect(await screen.findByRole('heading', { name: 'Jadwal Saya' }, WAIT)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`${mine.length} pertemuan`))).toBeInTheDocument(),
    WAIT)
  }, UI_TIMEOUT)

  it('admin melihat "Jadwal Sekolah"', async () => {
    await loginAs('admin')
    renderWithProviders(<AuthReady><SchedulePage /></AuthReady>, { route: '/jadwal?day=2', path: '/jadwal' })
    expect(await screen.findByRole('heading', { name: 'Jadwal Sekolah' }, WAIT)).toBeInTheDocument()
    const count = db().timetable.filter((s) => s.dayOfWeek === 2).length
    await waitFor(() => expect(screen.getByText(new RegExp(`${count} pertemuan`))).toBeInTheDocument(), WAIT)
  }, UI_TIMEOUT)
})
