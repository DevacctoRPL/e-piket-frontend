import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/auth-context'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { slotsOn } from '@/mocks/domain'
import { createTestQueryClient, loginAs } from '@/test/utils'
import { TeachingLogDetailPage } from './pages/teaching-log-detail-page'
import { TeachingLogNewPage } from './pages/teaching-log-new-page'
import { TeachingLogsPage } from './pages/teaching-logs-page'

function renderFeature(route: string) {
  const router = createMemoryRouter(
    [
      { path: '/jurnal-mengajar', element: <TeachingLogsPage /> },
      { path: '/jurnal-mengajar/baru', element: <TeachingLogNewPage /> },
      { path: '/jurnal-mengajar/:id', element: <TeachingLogDetailPage /> },
    ],
    { initialEntries: [route] },
  )
  const qc = createTestQueryClient()
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
  render(<RouterProvider router={router} />, { wrapper: Wrapper })
  return router
}

describe('Jurnal Mengajar — alur guru', () => {
  it('fills and finalizes a journal from today’s schedule', async () => {
    const user = userEvent.setup()
    await loginAs('guru')
    // jadwal sendiri + tugas pengganti aktif (seed menugaskan guru sebagai pengganti hari ini)
    const total =
      slotsOn(todayISO(), { teacherId: 'tch_1' }).length +
      db().substitutions.filter(
        (r) => r.date === todayISO() && r.status === 'ACTIVE' && r.substituteTeacherId === 'tch_1',
      ).length
    const router = renderFeature('/jurnal-mengajar')

    // jadwal hari ini + kemajuan
    const progress = await screen.findByText(/jurnal terisi/, {}, { timeout: 8000 })
    expect(progress).toHaveTextContent(`0 dari ${total} jurnal terisi`)
    const fillLinks = screen.getAllByRole('link', { name: /^Isi jurnal/ })
    expect(fillLinks).toHaveLength(total)
    await user.click(fillLinks[0]!)

    // form terisi konteks dari jadwal
    const topic = await screen.findByLabelText(/^Materi/, {}, { timeout: 8000 })
    expect(router.state.location.pathname).toBe('/jurnal-mengajar/baru')
    expect(screen.getByText(/Diisi otomatis dari jadwal/)).toBeInTheDocument()

    // validasi klien: materi wajib bila terlaksana
    await user.click(screen.getByRole('button', { name: /Simpan & Finalisasi/ }))
    expect(await screen.findByText('Materi wajib diisi bila pertemuan terlaksana.')).toBeInTheDocument()

    // tidak terlaksana → alasan wajib
    await user.click(screen.getByLabelText('Tidak Terlaksana'))
    await user.click(screen.getByRole('button', { name: /Simpan & Finalisasi/ }))
    expect(await screen.findByText('Alasan wajib diisi bila pertemuan tidak terlaksana.')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Terlaksana'))

    // koreksi JML wajib alasan
    await user.click(screen.getByRole('switch', { name: 'Koreksi JML' }))
    const jml = screen.getByLabelText(/JML koreksi/)
    await user.clear(jml)
    await user.type(jml, '1')
    await user.type(topic, 'Sistem persamaan linear')
    await user.type(screen.getByLabelText(/Kegiatan pembelajaran/), 'Diskusi kelompok')
    await user.click(screen.getByRole('button', { name: /Simpan & Finalisasi/ }))
    expect(await screen.findByText(/Alasan koreksi JML wajib diisi/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Alasan koreksi JML/), 'Satu jam dipakai upacara')

    const sick = screen.getByLabelText('Sakit (S)')
    await user.clear(sick)
    await user.type(sick, '2')

    // konfirmasi finalisasi
    await user.click(screen.getByRole('button', { name: /Simpan & Finalisasi/ }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Finalisasi' }))

    // kembali ke jadwal; kemajuan bertambah
    await waitFor(() => expect(router.state.location.pathname).toBe('/jurnal-mengajar'), { timeout: 8000 })
    await waitFor(
      () => expect(screen.getByText(/jurnal terisi/)).toHaveTextContent(`1 dari ${total} jurnal terisi`),
      { timeout: 8000 },
    )

    const saved = db().teachingLogs.find((l) => l.date === todayISO() && l.teacherId === 'tch_1')
    expect(saved).toMatchObject({
      status: 'FINAL',
      topic: 'Sistem persamaan linear',
      activity: 'Diskusi kelompok',
      periodCount: 1,
      periodCountOverrideReason: 'Satu jam dipakai upacara',
      studentSick: 2,
      execution: 'HELD',
    })
  }, 60_000)

  it('shows a read-only view of a final journal to its owner', async () => {
    await loginAs('guru')
    const log = db().teachingLogs.find((l) => l.teacherId === 'tch_1' && l.status === 'FINAL')!
    renderFeature(`/jurnal-mengajar/${log.id}`)
    expect(await screen.findByText('Hanya baca', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Simpan/ })).not.toBeInTheDocument()
  }, 30_000)

  it('lets a principal approve a final journal (FR-TEACH-06)', async () => {
    const user = userEvent.setup()
    await loginAs('kepsek')
    const log = db().teachingLogs.find((l) => l.status === 'FINAL' && !l.approvedAt)!
    renderFeature(`/jurnal-mengajar/${log.id}`)
    await user.click(await screen.findByRole('button', { name: /Sahkan/ }, { timeout: 8000 }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Sahkan' }))
    await waitFor(() => expect(db().teachingLogs.find((l) => l.id === log.id)?.approvedByName).toBe('Drs. Hartono, M.Pd.'), {
      timeout: 8000,
    })
  }, 30_000)
})
