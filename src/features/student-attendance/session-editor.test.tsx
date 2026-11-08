import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { studentAttendanceApi } from './api'
import { SessionEditorPage } from './pages/session-editor-page'
import { draftStorageKey } from './roster-model'

describe('SessionEditorPage', () => {
  it('marks all present, changes one to Sakit and requires a reason before saving (AC-02)', async () => {
    await loginAs('piket')
    const session = await studentAttendanceApi.openSession({ date: todayISO(), shiftCode: 'MORNING', classId: 'cls_1' })
    const user = userEvent.setup()
    renderWithProviders(<SessionEditorPage />, {
      route: `/absensi-siswa/sesi/${session.id}`,
      path: '/absensi-siswa/sesi/:id',
    })

    const markAll = await screen.findByRole('button', { name: /tandai semua hadir/i }, { timeout: 8000 })
    const list = screen.getByRole('list', { name: 'Daftar siswa' })
    const rows = within(list).getAllByRole('listitem')
    expect(rows.length).toBe(session.summary.total)

    await user.click(markAll)
    // every radio group now has Hadir selected
    const groups = within(list).getAllByRole('radiogroup')
    for (const g of groups) expect(within(g).getByRole('radio', { name: 'Hadir' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(`Belum disimpan · ${rows.length} perubahan`)

    // change the first student to Sakit
    const first = rows[0]!
    await user.click(within(first).getByRole('radio', { name: 'Sakit' }))
    expect(within(first).getByRole('radio', { name: 'Sakit' })).toHaveAttribute('aria-checked', 'true')
    expect(within(first).getByText('diubah')).toBeInTheDocument()
    const reason = within(first).getByLabelText(/alasan/i)
    expect(reason).toHaveAttribute('aria-required', 'true')
    expect(within(first).getByText('Alasan wajib diisi untuk status ini.')).toBeInTheDocument()

    // attempt save → blocked client-side, nothing written
    await user.click(screen.getByRole('button', { name: /simpan draft/i }))
    expect(await within(first).findByRole('alert')).toHaveTextContent(/alasan wajib/i)
    expect(db().studentRecords.filter((r) => r.sessionId === session.id)).toHaveLength(0)

    // local draft persisted by session id only (no names in key)
    expect(sessionStorage.getItem(draftStorageKey(session.id))).toBeTruthy()

    // fill reason → save succeeds, one record per student
    await user.type(reason, 'Demam')
    await user.click(screen.getByRole('button', { name: /simpan draft/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Tersimpan/), { timeout: 8000 })
    const saved = db().studentRecords.filter((r) => r.sessionId === session.id)
    expect(saved).toHaveLength(rows.length)
    expect(saved.filter((r) => r.status === 'SICK')).toHaveLength(1)
    expect(saved.find((r) => r.status === 'SICK')?.reason).toBe('Demam')
  }, 30_000)

  it('shows FINAL sessions read-only for roles without correction rights', async () => {
    await loginAs('piket')
    const final = db().studentSessions.find((s) => s.date === todayISO() && s.status === 'FINAL')!
    renderWithProviders(<SessionEditorPage />, {
      route: `/absensi-siswa/sesi/${final.id}`,
      path: '/absensi-siswa/sesi/:id',
    })
    expect(await screen.findByText('Absensi final', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tandai semua hadir/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finalisasi/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /koreksi absensi/i })).not.toBeInTheDocument()
  }, 20_000)
})
