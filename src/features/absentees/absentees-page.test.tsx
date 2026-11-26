import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { loginAs, renderWithProviders } from '@/test/utils'
import { AbsenteesPage } from './pages/absentees-page'

describe('AbsenteesPage (Siswa Tidak Hadir)', () => {
  it('menampilkan 5 status S/I/A/D/P, form + Catat Ketidakhadiran, Edit, dan Hapus tanpa Konfirmasi Wali', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(<AbsenteesPage />, { route: '/absensi-siswa', path: '/absensi-siswa' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Siswa Tidak Hadir' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /PKL \(P\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Dispensasi \(D\)/i })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Konfirmasi wali/i })).not.toBeInTheDocument()

    // Buka dialog + Catat Ketidakhadiran
    await user.click(screen.getByRole('button', { name: /Catat Ketidakhadiran/i }))
    expect(await screen.findByRole('heading', { name: 'Catat Ketidakhadiran Siswa' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Kelas/i), 'cls_5')
    const studentSelect = screen.getByLabelText(/^Nama Siswa/i) as HTMLSelectElement
    await waitFor(() => expect(studentSelect.options.length).toBeGreaterThan(1))
    const chosenStudentId = studentSelect.options[1]!.value
    await user.selectOptions(studentSelect, chosenStudentId)
    await user.selectOptions(screen.getByLabelText(/^Status Kehadiran/i), 'PKL')
    await user.type(screen.getByLabelText(/^Keterangan/i), 'PKL gelombang 1')
    await user.click(screen.getByRole('button', { name: /^Catat$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Catat Ketidakhadiran Siswa' })).not.toBeInTheDocument(),
    )
    expect((await screen.findAllByText('PKL gelombang 1')).length).toBeGreaterThan(0)
  })
})
