import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth-context'
import { ApiError } from '@/lib/api-client'
import { addDays, todayISO } from '@/lib/date'
import { db } from '@/mocks/db'
import { loginAs, renderWithProviders } from '@/test/utils'
import { dashboardApi } from './api'
import { DashboardPage } from './pages/dashboard-page'

const today = () => todayISO()

describe('GET /dashboard/summary (mock handler)', () => {
  it('piket: includes unhandled substitution & duty agenda tasks with drill-down hrefs', async () => {
    await loginAs('piket')
    const s = await dashboardApi.summary({ date: today() })
    expect(s.date).toBe(today())
    expect(s.substitutions.unhandledSlots).toBeGreaterThan(0)
    const subTask = s.pendingTasks.find((t) => t.kind === 'SUBSTITUTION_UNHANDLED')
    expect(subTask?.href).toMatch(new RegExp(`^/jam-kosong\\?date=${today()}&shift=`))
    // tch_2 piket setiap hari & agenda hari ini belum dibuat (PRD §15.2)
    const duty = s.pendingTasks.find((t) => t.kind === 'DUTY_AGENDA_DRAFT')
    expect(duty?.href).toMatch(/^\/agenda-piket\?/)
    expect(s.me?.isDutyToday).toBe(true)
    // absensi siswa: piket boleh mengisi → tugas per kelas yang belum dikirim
    const att = s.pendingTasks.filter((t) => t.kind === 'ATTENDANCE_NOT_SUBMITTED')
    expect(att.length).toBe(s.studentAttendance.classesScheduled - s.studentAttendance.sessionsSubmitted)
    expect(att[0]?.href).toMatch(/^\/absensi-siswa\?date=.+&shift=.+&classId=/)
    // guru tidak hadir hari ini: tch_4, tch_6, tch_12
    expect(s.teacherAttendance.absent).toBe(3)
    expect(s.teacherAttendance.present + s.teacherAttendance.absent + s.teacherAttendance.notCheckedIn).toBe(
      s.teacherAttendance.scheduled,
    )
  })

  it('guru: scoped to own classes (≤ admin) and lists TEACHING_LOG_MISSING', async () => {
    await loginAs('admin')
    const admin = await dashboardApi.summary({ date: today() })
    await loginAs('guru')
    const guru = await dashboardApi.summary({ date: today() })

    expect(guru.studentAttendance.classesScheduled).toBeLessThanOrEqual(admin.studentAttendance.classesScheduled)
    expect(guru.studentAttendance.counts.total).toBeLessThanOrEqual(admin.studentAttendance.counts.total)
    expect(guru.dismissals.total).toBeLessThanOrEqual(admin.dismissals.total)
    expect(guru.substitutions.affectedSlots).toBeLessThanOrEqual(admin.substitutions.affectedSlots)
    expect(guru.teachingLogs.expected).toBeLessThan(admin.teachingLogs.expected)
    // guru tanpa teacher_attendance:read hanya melihat dirinya sendiri
    expect(guru.teacherAttendance.scheduled).toBeLessThanOrEqual(1)

    const logTasks = guru.pendingTasks.filter((t) => t.kind === 'TEACHING_LOG_MISSING')
    expect(logTasks.length).toBeGreaterThan(0)
    expect(logTasks.length).toBe(guru.me!.todaySlots - guru.me!.logsFilled)
    expect(logTasks[0]?.href).toBe(`/jurnal-mengajar?date=${today()}`)
    // guru bukan piket & tanpa substitution:write → tidak ada tugas agenda/jam kosong
    expect(guru.pendingTasks.some((t) => t.kind === 'SUBSTITUTION_UNHANDLED')).toBe(false)
    expect(guru.pendingTasks.some((t) => t.kind === 'DUTY_AGENDA_DRAFT')).toBe(false)
    // admin tidak punya teacherId → tanpa ringkasan pribadi
    expect(admin.me).toBeNull()
    expect(guru.me?.teacherAttendance).toBeNull()
  })

  it('never exposes guardian phone numbers in the payload', async () => {
    for (const account of ['admin', 'piket', 'guru', 'walikelas'] as const) {
      await loginAs(account)
      const s = await dashboardApi.summary({ date: today() })
      const json = JSON.stringify(s)
      expect(json).not.toMatch(/guardian/i)
      for (const st of db().students.slice(0, 50)) {
        if (st.guardianPhone) expect(json).not.toContain(st.guardianPhone)
      }
    }
  })

  it('filters by shift and reports CHECK_OUT_MISSING for a past day', async () => {
    const yesterday = addDays(today(), -1)
    const rec = db().teacherAttendance.find((a) => a.teacherId === 'tch_1' && a.date === yesterday)
    if (rec) {
      rec.checkInAt = `${yesterday}T06:55:00+07:00`
      rec.checkOutAt = null
      rec.status = 'PRESENT'
    } else {
      db().teacherAttendance.push({
        id: 'tatt_test',
        teacherId: 'tch_1',
        teacherName: 'Guru',
        date: yesterday,
        shiftCode: 'MORNING',
        checkInAt: `${yesterday}T06:55:00+07:00`,
        checkOutAt: null,
        status: 'PRESENT',
        reason: null,
        affectedPeriodsComputed: 0,
        affectedPeriodsOverride: null,
        overrideReason: null,
        affectedPeriods: 0,
        lateMinutes: null,
        source: 'SELF',
        updatedAt: `${yesterday}T06:55:00+07:00`,
        updatedByName: 'Guru',
        version: 1,
      })
    }
    await loginAs('guru')
    const s = await dashboardApi.summary({ date: today(), shiftCode: 'MORNING' })
    expect(s.shiftCode).toBe('MORNING')
    expect(s.dutyAgenda.map((a) => a.shiftCode)).toEqual(['MORNING'])
    const task = s.pendingTasks.find((t) => t.id === `checkout:${yesterday}`)
    expect(task?.kind).toBe('CHECK_OUT_MISSING')
    expect(task?.href).toBe(`/absensi-guru?date=${yesterday}`)
  })

  it('returns 422 for an invalid date or unknown shift', async () => {
    await loginAs('admin')
    const err = await dashboardApi.summary({ date: '08-11-2026' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(422)
    expect((err as ApiError).details).toHaveProperty('date')
    const err2 = await dashboardApi.summary({ date: today(), shiftCode: 'MALAM' }).catch((e: unknown) => e)
    expect((err2 as ApiError).status).toBe(422)
    expect((err2 as ApiError).details).toHaveProperty('shiftCode')
  })

  it('returns 403 for a user without dashboard:read', async () => {
    db().users.push({
      id: 'usr_noperm',
      username: 'tanpaperan',
      password: 'password',
      name: 'Tanpa Peran',
      email: null,
      roles: [],
      teacherId: null,
      status: 'ACTIVE',
    })
    const { api } = await import('@/lib/api-client')
    const { authToken } = await import('@/lib/auth-token')
    const res = await api.post<{ data: { accessToken: string } }>(
      '/auth/login',
      { username: 'tanpaperan', password: 'password' },
      { skipAuthRefresh: true },
    )
    authToken.set(res.data.accessToken)
    const err = await dashboardApi.summary({ date: today() }).catch((e: unknown) => e)
    expect((err as ApiError).status).toBe(403)
  })
})

/** DashboardPage memakai useCurrentUser → tunggu sesi termuat (di aplikasi: RequireAuth). */
function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? <>{children}</> : <p>memuat sesi</p>
}

describe('DashboardPage', () => {
  it('admin sees school-wide sections without the personal "Hari ini" card', async () => {
    await loginAs('admin')
    renderWithProviders(
      <AuthGate>
        <DashboardPage />
      </AuthGate>,
    )
    expect(await screen.findByRole('heading', { name: 'Tugas yang perlu diselesaikan' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Yulia Rahman/ })).toBeInTheDocument()
    expect(screen.getByText(/Peran:/)).toBeInTheDocument()

    const absentCard = screen.getByRole('link', { name: /Siswa tidak hadir/ })
    expect(absentCard.getAttribute('href')).toBe(`/siswa-tidak-hadir?dateFrom=${today()}&dateTo=${today()}`)
    expect(screen.getByRole('link', { name: /Kepulangan/ })).toHaveAttribute('href', `/kepulangan?date=${today()}`)
    const unhandledCard = screen.getByRole('link', { name: /Jam kosong belum tertangani/ })
    expect(unhandledCard).toBeInTheDocument()
    expect(within(unhandledCard).getByText('Detail')).toBeInTheDocument()
    expect(within(unhandledCard).getByText('Detail').closest('[data-slot="status"]')).toBeNull()
    const absentTeacherCard = screen.getByRole('link', { name: /Guru tidak hadir/ })
    expect(absentTeacherCard).toBeInTheDocument()
    expect(within(absentTeacherCard).getByText('3')).toHaveClass('text-tone-danger')
    expect(screen.getByRole('heading', { name: 'Agenda piket' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Distribusi status/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hari ini' })).not.toBeInTheDocument()

    // admin melihat agenda piket yang belum final sebagai tugas
    const tasks = screen.getByRole('heading', { name: 'Tugas yang perlu diselesaikan' }).closest('[data-slot="card"]')
    expect(within(tasks as HTMLElement).getAllByText(/Agenda piket shift/).length).toBeGreaterThan(0)
  })

  it('guru sees the personal card, own journal stats and no school-wide dismissal card', async () => {
    await loginAs('guru')
    renderWithProviders(
      <AuthGate>
        <DashboardPage />
      </AuthGate>,
    )
    expect(await screen.findByRole('heading', { name: 'Hari ini' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Check-in/ })).toHaveAttribute('href', '/absensi-guru')
    expect(screen.getByRole('link', { name: /Isi jurnal/ })).toHaveAttribute('href', `/jurnal-mengajar?date=${today()}`)
    expect(screen.getByRole('link', { name: /Jurnal saya/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Kehadiran saya/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Kepulangan/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Guru tidak hadir/ })).not.toBeInTheDocument()
    // tidak punya absentees:read → kartu tidak dapat ditelusuri ke daftar siswa tidak hadir
    expect(screen.queryByRole('link', { name: /Siswa tidak hadir/ })).not.toBeInTheDocument()
    expect(screen.getAllByText(/belum diisi/).length).toBeGreaterThan(0)
  })

  it('renders Nuvio 7-day trend chart, latest updates tabs, and task monitoring search', async () => {
    await loginAs('piket')
    const user = userEvent.setup()
    renderWithProviders(
      <AuthGate>
        <DashboardPage />
      </AuthGate>,
    )

    expect(await screen.findByRole('heading', { name: 'Tren Kehadiran' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pembaruan Terkini' })).toBeInTheDocument()
    expect(screen.getByText('Bertugas piket').closest('[data-slot="status"]')).toBeNull()
    expect(screen.getByRole('link', { name: /Buka agenda piket/ })).toBeInTheDocument()

    // Grafik: data 7 hari tersedia untuk pembaca layar
    const chart = screen.getByRole('figure', { name: 'Tren Kehadiran' })
    expect(chart.querySelector('figcaption')?.textContent?.split(';')).toHaveLength(7)

    // Beralih metrik grafik ke S/I/A (kontrol segmen)
    const metric = screen.getByRole('radiogroup', { name: 'Metrik grafik' })
    await user.click(within(metric).getByRole('radio', { name: 'S/I/A' }))
    expect(within(metric).getByRole('radio', { name: 'S/I/A' })).toHaveAttribute('aria-checked', 'true')

    // Beralih periode aktivitas terkini ke Minggu ini
    const periods = screen.getByRole('radiogroup', { name: 'Rentang waktu aktivitas' })
    const weekTab = within(periods).getByRole('radio', { name: 'Minggu ini' })
    await user.click(weekTab)
    expect(weekTab).toHaveAttribute('aria-checked', 'true')

    // Cari tugas pada tabel monitoring
    const taskSearch = screen.getByLabelText('Cari tugas tertunda')
    await user.type(taskSearch, 'Agenda piket')
    const tasksCard = screen
      .getByRole('heading', { name: 'Tugas yang perlu diselesaikan' })
      .closest('[data-slot="card"]') as HTMLElement
    expect(within(tasksCard).getAllByText(/Agenda piket shift/).length).toBeGreaterThan(0)

    // Pengurutan kolom (aria-sort) & menu aksi baris (kebab) pada tabel monitoring
    const priorityHeader = within(tasksCard).getByRole('columnheader', { name: /Prioritas/ })
    await user.click(within(priorityHeader).getByRole('button', { name: /Prioritas/ }))
    expect(priorityHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(within(tasksCard).getAllByRole('button', { name: /^Aksi untuk / }).length).toBeGreaterThan(0)

    // Kontrol periode: satu tombol yang membuka tanggal & shift
    await user.click(screen.getByRole('button', { name: /^Periode: Hari ini · Semua shift/ }))
    expect(await screen.findByLabelText('Tanggal')).toHaveValue(today())
    expect(screen.getByLabelText('Shift')).toHaveValue('')
  })
})
