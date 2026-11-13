import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newIdempotencyKey } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { dutyAgendaApi } from './api'
import { DutyAgendaDetailPage } from './pages/duty-agenda-detail-page'
import { DutyAgendaListPage } from './pages/duty-agenda-list-page'

const today = todayISO()
// mock API memakai latensi realistis (150–400 ms/permintaan)
const WAIT = { timeout: 8000 }
const TEST_TIMEOUT = 40_000

describe('Agenda Guru Piket pages', () => {
  it('shows the today card for the duty teacher and creates the agenda', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    const { router } = renderWithProviders(<DutyAgendaListPage />, { route: '/agenda-piket', path: '/agenda-piket/*' })

    expect(await screen.findByRole('heading', { name: 'Agenda piket hari ini' }, WAIT)).toBeInTheDocument()
    const openButtons = await screen.findAllByRole('button', { name: /Buka agenda piket/ }, WAIT)
    await user.click(openButtons[0]!)

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/agenda-piket\/dag_/), WAIT)
    expect(db().dutyAgendas.filter((a) => a.date === today)).toHaveLength(1)
  }, TEST_TIMEOUT)

  it('blocks finalization while incomplete, then finalizes after marking "Tidak ada catatan"', async () => {
    await loginAs('piket')
    const agenda = await dutyAgendaApi.create({ date: today, shiftCode: 'MORNING' }, newIdempotencyKey())
    const user = userEvent.setup()
    renderWithProviders(<DutyAgendaDetailPage />, {
      route: `/agenda-piket/${agenda.id}`,
      path: '/agenda-piket/:id',
    })

    // bagian guru tidak hadir terisi dari absensi guru hari ini
    expect(await screen.findByRole('heading', { name: /Guru tidak hadir/ }, WAIT)).toBeInTheDocument()
    expect((await screen.findAllByText('Sakit', undefined, WAIT)).length).toBeGreaterThan(0)

    // finalisasi saat belum lengkap → 422 dari server, ditampilkan sebagai daftar kekurangan
    await user.click(screen.getByRole('button', { name: /Finalisasi/ }))
    const dialog = await screen.findByRole('alertdialog', undefined, WAIT)
    expect(within(dialog).getByText(/Masih ada bagian yang belum lengkap/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Finalisasi' }))
    expect(await screen.findByText('Agenda belum lengkap', undefined, WAIT)).toBeInTheDocument()
    expect(db().dutyAgendas.find((a) => a.id === agenda.id)?.status).toBe('DRAFT')

    // tandai tidak ada catatan lalu finalisasi
    await user.click(screen.getByRole('checkbox', { name: 'Tidak ada catatan hal penting' }))
    await user.click(screen.getByRole('button', { name: /Finalisasi/ }))
    const dialog2 = await screen.findByRole('alertdialog', undefined, WAIT)
    await user.click(within(dialog2).getByRole('button', { name: 'Finalisasi' }))

    expect(await screen.findByText('Agenda sudah final', undefined, WAIT)).toBeInTheDocument()
    const stored = db().dutyAgendas.find((a) => a.id === agenda.id)
    expect(stored?.status).toBe('FINAL')
    expect(stored?.noImportantNotes).toBe(true)
    // petugas piket tidak punya hak koreksi → tombol Koreksi tidak tampil
    expect(screen.queryByRole('button', { name: /Koreksi/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Simpan Draft/ })).not.toBeInTheDocument()
  }, TEST_TIMEOUT)

  it('lets the principal correct a final agenda with a reason', async () => {
    await loginAs('kepsek')
    const user = userEvent.setup()
    const finalAgenda = db().dutyAgendas.find((a) => a.status === 'FINAL')!
    renderWithProviders(<DutyAgendaDetailPage />, {
      route: `/agenda-piket/${finalAgenda.id}`,
      path: '/agenda-piket/:id',
    })

    await user.click(await screen.findByRole('button', { name: /Koreksi/ }, WAIT))
    const textarea = screen.getByLabelText('Catatan penanggulangan')
    await user.clear(textarea)
    await user.type(textarea, 'Koreksi: tugas mandiri diawasi piket.')
    await user.click(screen.getByRole('button', { name: /Simpan koreksi/ }))
    const dialog = await screen.findByRole('alertdialog', undefined, WAIT)
    await user.type(within(dialog).getByLabelText(/Alasan koreksi/), 'Melengkapi catatan')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan koreksi' }))

    await waitFor(() =>
      expect(db().dutyAgendas.find((a) => a.id === finalAgenda.id)?.substitutionSummary).toBe(
        'Koreksi: tugas mandiri diawasi piket.',
      ),
      WAIT,
    )
    expect(
      db().auditLogs.some((l) => l.entityId === finalAgenda.id && l.action === 'CORRECT' && l.reason === 'Melengkapi catatan'),
    ).toBe(true)
  }, TEST_TIMEOUT)
})
