import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { TeacherAttendancePage } from './pages/teacher-attendance-page'

describe('TeacherAttendancePage (Absensi Guru + Jam Kosong)', () => {
  it('hanya menampilkan jam kosong yang sudah ada penggantinya dan mendukung + Tambah (quick-pick & manual) dengan Guru Piket wajib', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(<TeacherAttendancePage />, { route: '/absensi-guru', path: '/absensi-guru' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Absensi Guru' })).toBeInTheDocument()
    expect(await screen.findByText('Kehadiran Guru')).toBeInTheDocument()
    expect(screen.getByText('Data otomatis dari presensi guru (Read-only)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sinkron Presensi/i })).toBeInTheDocument()

    // Kartu kanan: Jam Kosong tanpa baris "Belum ditugaskan"
    expect(screen.getByRole('heading', { name: 'Jam Kosong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tambah/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Simpan$/i })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/Belum ditugaskan/i)).not.toBeInTheDocument()
    })

    // 1. Uji validasi Guru Piket wajib + quick-pick slot guru tidak hadir
    await user.click(screen.getByRole('button', { name: /Tambah/i }))
    expect(await screen.findByRole('heading', { name: 'Tambah Jam Kosong' })).toBeInTheDocument()

    const sourceSelect = screen.getByLabelText(/^Sumber Jadwal/i) as HTMLSelectElement
    expect(sourceSelect.options.length).toBeGreaterThan(1)
    const firstUnhandledValue = sourceSelect.options[1]!.value
    await user.selectOptions(sourceSelect, firstUnhandledValue)

    // Submit tanpa isi Guru Piket harus menampilkan error validasi
    await user.click(screen.getByRole('button', { name: /^Tambah$/i }))
    expect(await screen.findByText(/Nama guru piket\/pengganti wajib diisi/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Guru Piket/i), 'Pak QuickPick Pengganti')
    await user.click(screen.getByRole('button', { name: /^Tambah$/i }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tambah Jam Kosong' })).not.toBeInTheDocument())
    expect((await screen.findAllByText('Pak QuickPick Pengganti')).length).toBeGreaterThan(0)

    // 2. Uji tambah jam kosong manual
    await user.click(screen.getByRole('button', { name: /Tambah/i }))
    expect(await screen.findByRole('heading', { name: 'Tambah Jam Kosong' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Kelas/i), 'cls_1')
    await user.type(screen.getByLabelText(/^Guru Tidak Hadir/i), 'Pak Dedi')
    await user.type(screen.getByLabelText(/^Guru Piket/i), 'Ibu Piket Bebas')
    await user.click(screen.getByRole('button', { name: /^Tambah$/i }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Tambah Jam Kosong' })).not.toBeInTheDocument())
    expect((await screen.findAllByText('Ibu Piket Bebas')).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Belum ditugaskan/i)).not.toBeInTheDocument()
  })
})
