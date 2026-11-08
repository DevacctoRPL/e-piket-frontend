import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { ExtraActivitiesPage } from './pages/extra-activities-page'
import { ExtraActivityDetailPage } from './pages/extra-activity-detail-page'

// Mock API memakai latensi realistis; beri ruang untuk test alur.
vi.setConfig({ testTimeout: 30_000 })
const T = { timeout: 5000 }

describe('ExtraActivitiesPage', () => {
  it('lists activities with class chips', async () => {
    await loginAs('kepsek')
    renderWithProviders(<ExtraActivitiesPage />, { route: '/kegiatan-tambahan', path: '/kegiatan-tambahan' })
    expect((await screen.findAllByText('Kursus Persiapan Sertifikasi Jaringan', {}, T)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('XI TKJ 1').length).toBeGreaterThan(0)
    // pimpinan hanya melihat
    expect(screen.queryByRole('button', { name: /tambah kegiatan/i })).not.toBeInTheDocument()
  })

  it('creates a multi-class activity through the dialog', async () => {
    const user = userEvent.setup()
    await loginAs('koordinator')
    const before = db().extraActivities.length
    const { router } = renderWithProviders(<ExtraActivitiesPage />, {
      route: '/kegiatan-tambahan',
      path: '/kegiatan-tambahan',
    })
    await screen.findAllByText('Kursus Persiapan Sertifikasi Jaringan', {}, T)
    await user.click(screen.getAllByRole('button', { name: /tambah kegiatan/i })[0]!)

    const dialog = await screen.findByRole('dialog', {}, T)
    // submit kosong → validasi klien
    await user.click(within(dialog).getByRole('button', { name: 'Simpan kegiatan' }))
    expect(await within(dialog).findByText('Nama kegiatan wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText('Pilih minimal satu kelas peserta.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/nama kegiatan/i), 'Kursus Bahasa Jepang')
    await user.selectOptions(within(dialog).getByLabelText(/^jenis/i), 'COURSE')
    await user.type(within(dialog).getByLabelText(/jam mulai/i), '13:00')
    await user.type(within(dialog).getByLabelText(/jam selesai/i), '14:30')
    await user.click(await within(dialog).findByRole('checkbox', { name: /^X TKJ 1/ }, T))
    await user.click(within(dialog).getByRole('checkbox', { name: /XI AKL 1/ }))
    expect(within(dialog).getByText('2 kelas dipilih')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Materi'), 'Hiragana dasar')

    await user.click(within(dialog).getByRole('button', { name: 'Simpan kegiatan' }))

    await waitFor(() => expect(db().extraActivities.length).toBe(before + 1), T)
    const created = db().extraActivities[0]!
    expect(created.name).toBe('Kursus Bahasa Jepang')
    expect(created.classNames).toEqual(expect.arrayContaining(['X TKJ 1', 'XI AKL 1']))
    expect(created.instructorTeacherId).toBe('tch_10')
    await waitFor(() => expect(router.state.location.pathname).toBe(`/kegiatan-tambahan/${created.id}`), T)
  })
})

describe('ExtraActivityDetailPage', () => {
  it('marks all present and saves participant attendance', async () => {
    const user = userEvent.setup()
    await loginAs('koordinator')
    db().extraActivities.find((a) => a.id === 'ext_2')!.participants[0]!.status = 'ABSENT'
    renderWithProviders(<ExtraActivityDetailPage />, {
      route: '/kegiatan-tambahan/ext_2',
      path: '/kegiatan-tambahan/:id',
    })
    await screen.findByRole('heading', { name: 'Jam Tambahan Matematika Kelas XII' }, T)
    await user.click(screen.getByRole('button', { name: /tandai semua hadir/i }))
    await user.click(screen.getByRole('button', { name: /simpan draft/i }))
    await waitFor(() =>
      expect(db().extraActivities.find((a) => a.id === 'ext_2')!.participants.every((p) => p.status === 'PRESENT')).toBe(true),
      T,
    )
  })
})
