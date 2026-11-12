import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth-context'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { MasterDataPage } from './pages/master-data-page'

function AuthReady({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? <>{children}</> : null
}

const UI_TIMEOUT = 30_000
const WAIT = { timeout: 8000 }

describe('MasterDataPage — Tab Kehadiran Guru (Senin–Sabtu)', () => {
  it('menampilkan matriks 6 hari dari data bawaan SMK Plus Pelita Nusantara Bogor dan beralih ke mode Checklist per Guru', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(
      <AuthReady>
        <MasterDataPage />
      </AuthReady>,
      { route: '/master?tab=kehadiran-guru', path: '/master' },
    )

    expect(
      await screen.findByText('Tabel Matriks Jadwal Kehadiran Guru (Senin–Sabtu)', {}, WAIT),
    ).toBeInTheDocument()
    expect((await screen.findAllByText(/Septianto Raharso/, {}, WAIT)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('A71', {}, WAIT)).length).toBeGreaterThan(0)

    // Beralih ke mode Checklist per Guru
    await user.click(screen.getByRole('radio', { name: /Checklist per Guru/i }))
    expect(await screen.findByText('Checklist Hari Kehadiran per Guru', {}, WAIT)).toBeInTheDocument()

    // Toggle hari Selasa untuk Raden Roro (A71) yang awalnya hanya hadir hari Sabtu (6)
    const roroBefore = db().teachers.find((t) => t.code === 'A71')!
    expect(roroBefore.attendanceDays).toEqual([6])

    const selasaBtn = await screen.findByRole('button', { name: /Selasa untuk Raden Roro/i }, WAIT)
    await user.click(selasaBtn)

    await waitFor(() => {
      const roroAfter = db().teachers.find((t) => t.code === 'A71')!
      expect(roroAfter.attendanceDays).toEqual([2, 6])
    }, WAIT)
  }, UI_TIMEOUT)

  it('mengimpor matriks 6 hari dari dialog Impor Matriks sekaligus membuat akun guru baru', async () => {
    await loginAs('admin')
    const user = userEvent.setup()
    renderWithProviders(
      <AuthReady>
        <MasterDataPage />
      </AuthReady>,
      { route: '/master?tab=kehadiran-guru', path: '/master' },
    )

    await screen.findByText('Tabel Matriks Jadwal Kehadiran Guru (Senin–Sabtu)', {}, WAIT)
    await user.click(screen.getByRole('button', { name: /Impor Matriks/i }))

    const dialog = await screen.findByRole('dialog', {}, WAIT)
    await user.click(within(dialog).getByRole('button', { name: /Tempel dari Excel/i }))

    const pasteArea = within(dialog).getByLabelText(/Salin blok tabel/i)
    const matrixSample = [
      'NO\tSENIN\tKODE\tSELASA\tKODE\tRABU\tKODE\tKAMIS\tKODE\tJUMAT\tKODE\tSABTU\tKODE',
      '1\tSeptianto Raharso, S.Kom., M.Pd.\t21\tBudi Hartono, S.Kom.\tB99\tBudi Hartono, S.Kom.\tB99\t-\t\t-\t\t-\t',
    ].join('\n')

    await user.type(pasteArea, matrixSample)

    expect(await within(dialog).findByText(/2 guru terdeteksi/i, {}, WAIT)).toBeInTheDocument()

    // Centang pembuatan akun otomatis
    const createAccCheckbox = within(dialog).getByRole('checkbox', {
      name: /Sekaligus buatkan akun login/i,
    })
    await user.click(createAccCheckbox)

    const saveBtn = within(dialog).getByRole('button', { name: /Simpan Jadwal \(2 Guru\)/i })
    await user.click(saveBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT)

    const newTeacher = db().teachers.find((t) => t.code === 'B99')
    expect(newTeacher).toBeDefined()
    expect(newTeacher?.name).toBe('Budi Hartono, S.Kom.')
    expect(newTeacher?.attendanceDays).toEqual([2, 3])
    expect(newTeacher?.userId).toBeTruthy()
    expect(db().users.some((u) => u.id === newTeacher?.userId)).toBe(true)
  }, UI_TIMEOUT)
})

