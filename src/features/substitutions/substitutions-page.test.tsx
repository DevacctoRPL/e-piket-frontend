import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { slotsOn } from '@/mocks/domain'
import { loginAs, renderWithProviders } from '@/test/utils'
import { substitutionsApi } from './api'
import { SubstitutionsPage } from './pages/substitutions-page'

const today = todayISO()
const ABSENT_TODAY = ['tch_4', 'tch_6', 'tch_12']
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const WAIT = { timeout: 15_000 }

describe('SubstitutionsPage', () => {
  it('assigns a busy substitute only after explicit override with reason', async () => {
    await loginAs('piket')
    const unhandled = await substitutionsApi.slots({ date: today, status: 'UNHANDLED' })
    const slot = unhandled[0]!
    const clash = slotsOn(today, { shiftCode: slot.shiftCode }).find(
      (s) =>
        s.teacherId !== slot.absentTeacherId &&
        !ABSENT_TODAY.includes(s.teacherId) &&
        s.periodStart <= slot.periodEnd &&
        s.periodEnd >= slot.periodStart,
    )!
    const busyName = db().teachers.find((t) => t.id === clash.teacherId)!.name

    const user = userEvent.setup()
    renderWithProviders(<SubstitutionsPage />, { route: '/jam-kosong', path: '/jam-kosong' })

    // Ringkasan + kelompok "Belum tertangani" tampil.
    expect(await screen.findByText('Jam terdampak', undefined, WAIT)).toBeInTheDocument()
    const group = await screen.findByRole('region', { name: /Belum tertangani/ }, WAIT)
    const assignButtons = within(group).getAllByRole('button', { name: /Tetapkan pengganti/ })
    expect(assignButtons).toHaveLength(unhandled.length)

    await user.click(assignButtons[0]!)
    const dialog = await screen.findByRole('dialog', { name: /Tetapkan guru pengganti/ })

    // Konflik jadwal diperlihatkan sebelum simpan (PRD §9.3).
    const busyRadio = await within(dialog).findByRole('radio', { name: new RegExp(escape(busyName)) }, WAIT)
    await user.click(busyRadio)
    expect(within(dialog).getByText(new RegExp(`${escape(busyName)} bentrok jadwal`))).toBeInTheDocument()

    // Submit tanpa override → ditolak di klien, belum ada request.
    await user.click(within(dialog).getByRole('button', { name: /Simpan pengganti/ }))
    expect(await within(dialog).findByText(/Centang override/)).toBeInTheDocument()
    expect(db().substitutions.some((r) => r.timetableSlotId === slot.timetableSlotId && r.date === today && r.status === 'ACTIVE')).toBe(false)

    // Override + alasan → tersimpan.
    await user.click(within(dialog).getByRole('checkbox', { name: /override konflik jadwal/i }))
    await user.type(within(dialog).getByLabelText(/Alasan override/), 'Kelas digabung di aula')
    await user.type(within(dialog).getByLabelText(/Kegiatan \/ materi/), 'Latihan soal bab 2')
    await user.click(within(dialog).getByRole('button', { name: /Simpan dengan override/ }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT)
    const record = db().substitutions.find(
      (r) => r.timetableSlotId === slot.timetableSlotId && r.date === today && r.status === 'ACTIVE',
    )
    expect(record).toMatchObject({
      substituteTeacherId: clash.teacherId,
      conflictOverridden: true,
      overrideReason: 'Kelas digabung di aula',
      activity: 'Latihan soal bab 2',
    })

    // Slot pindah ke kelompok "Sudah digantikan" setelah invalidasi.
    const handledGroup = screen.getByRole('region', { name: /Sudah digantikan/ })
    expect(await within(handledGroup).findByText(busyName, undefined, WAIT)).toBeInTheDocument()
    await waitFor(
      () =>
        expect(
          within(screen.getByRole('region', { name: /Belum tertangani/ })).queryAllByRole('button', {
            name: /Tetapkan pengganti/,
          }),
        ).toHaveLength(unhandled.length - 1),
      WAIT,
    )
  }, 90_000)

  it('hides write actions for read-only roles', async () => {
    await loginAs('kepsek')
    renderWithProviders(<SubstitutionsPage />, { route: '/jam-kosong', path: '/jam-kosong' })
    await screen.findByRole('region', { name: /Belum tertangani/ }, WAIT)
    expect(screen.queryByRole('button', { name: /Tetapkan pengganti/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Batalkan/ })).not.toBeInTheDocument()
  }, 60_000)
})
