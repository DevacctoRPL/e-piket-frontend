import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { todayISO } from '@/lib/date'
import { loginAs, renderWithProviders } from '@/test/utils'
import { TeacherAttendancePage } from './pages/teacher-attendance-page'

const ui = (
  <>
    <TeacherAttendancePage />
    <Toaster />
  </>
)

describe('TeacherAttendancePage', () => {
  it('guru melakukan check-in lalu check-out (AC-07)', async () => {
    const user = userEvent.setup()
    await loginAs('guru')
    renderWithProviders(ui, { route: '/absensi-guru', path: '/absensi-guru' })

    const card = await screen.findByRole('region', { name: 'Kehadiran Saya' })
    // Guru biasa tidak melihat daftar guru terjadwal.
    expect(screen.queryByRole('heading', { name: 'Guru Terjadwal' })).not.toBeInTheDocument()

    const checkIn = await within(card).findByRole('button', { name: /check-in sekarang/i })
    expect(within(card).getByText('Belum check-in')).toBeInTheDocument()
    await user.click(checkIn)
    expect(await screen.findByText(/Check-in tercatat pukul/, undefined, { timeout: 5_000 })).toBeInTheDocument()

    const checkOut = await within(card).findByRole('button', { name: /check-out/i })
    expect(within(card).queryByRole('button', { name: /check-in sekarang/i })).not.toBeInTheDocument()
    await user.click(checkOut)
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Ya, check-out' }))

    expect(await within(card).findByText('Kehadiran hari ini lengkap.')).toBeInTheDocument()
    const rec = db().teacherAttendance.filter((a) => a.teacherId === 'tch_1' && a.date === todayISO())
    expect(rec).toHaveLength(1)
    expect(rec[0]?.checkInAt).toBeTruthy()
    expect(rec[0]?.checkOutAt).toBeTruthy()

    // Riwayat pribadi memuat hari ini.
    expect(await screen.findByRole('heading', { name: 'Riwayat 14 hari terakhir' })).toBeInTheDocument()
  }, 30_000)

  it('piket mencatat status Sakit dengan alasan wajib (AC-08)', async () => {
    const user = userEvent.setup()
    await loginAs('piket')
    renderWithProviders(ui, { route: '/absensi-guru?shift=MORNING', path: '/absensi-guru' })

    expect(await screen.findByRole('heading', { name: 'Guru Terjadwal' })).toBeInTheDocument()
    const teacherName = db().teachers.find((t) => t.id === 'tch_1')!.name
    const label = `Catat status ${teacherName}`
    await screen.findAllByRole('button', { name: label }, { timeout: 10_000 })
    // Tunggu lookup kelas termuat agar baris tidak dirender ulang di tengah interaksi.
    await screen.findAllByText(/X TKJ 1/, undefined, { timeout: 10_000 })
    await user.click(screen.getAllByRole('button', { name: label })[0]!)

    const dialog = await screen.findByRole('dialog', undefined, { timeout: 5_000 })
    await user.selectOptions(within(dialog).getByLabelText(/Status/), 'SICK')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Alasan wajib diisi untuk status ini.')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText(/Alasan/), 'Demam tinggi')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText(/tersimpan sebagai Sakit/, undefined, { timeout: 5_000 })).toBeInTheDocument()

    await waitFor(() => {
      const rec = db().teacherAttendance.find((a) => a.teacherId === 'tch_1' && a.date === todayISO())
      expect(rec?.status).toBe('SICK')
      expect(rec?.reason).toBe('Demam tinggi')
      expect(rec?.affectedPeriods).toBeGreaterThan(0)
    })
  }, 30_000)

  it('pimpinan hanya melihat (tanpa aksi tulis)', async () => {
    await loginAs('kepsek')
    renderWithProviders(ui, { route: '/absensi-guru', path: '/absensi-guru' })
    expect(await screen.findByRole('heading', { name: 'Guru Terjadwal' })).toBeInTheDocument()
    await screen.findAllByText(/NIP/, undefined, { timeout: 10_000 })
    expect(screen.queryByRole('button', { name: /Catat status/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Kehadiran Saya' })).not.toBeInTheDocument()
  }, 30_000)
})
