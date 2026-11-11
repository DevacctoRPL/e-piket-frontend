import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useAuth } from '@/features/auth/auth-context'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { loginAs, renderWithProviders } from '@/test/utils'

function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  return status === 'authenticated' ? <>{children}</> : <p>memuat sesi</p>
}

const HEADINGS = [
  'Akun & Peran',
  'Keamanan & Aktivitas',
  'Kesehatan Data',
  'Celah Data Master',
  'Kejadian Penting',
  'Sistem',
] as const

describe('Dashboard Super Admin', () => {
  it('menampilkan tampilan Sistem lengkap dan beralih ke Operasional', async () => {
    await loginAs('superadmin')
    const { router } = renderWithProviders(
      <AuthGate>
        <DashboardPage />
      </AuthGate>,
    )

    expect(await screen.findByRole('heading', { name: 'Akun & Peran' }, { timeout: 8000 })).toBeInTheDocument()
    for (const name of HEADINGS) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 1, name: /Dimas Prasetyo/ })).toBeInTheDocument()

    // strip KPI operasional hari ini
    expect(await screen.findByRole('link', { name: /Absensi kelas terkirim/ }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Agenda piket belum final/ })).toBeInTheDocument()

    // baris per peran menautkan ke Kelola Pengguna terfilter
    const roles = screen.getByRole('list', { name: 'Jumlah akun per peran' })
    expect(within(roles).getByRole('link', { name: /Super Admin/ })).toHaveAttribute(
      'href',
      '/pengguna?role=SUPER_ADMIN',
    )
    expect(screen.getByRole('link', { name: /Nonaktif/ })).toHaveAttribute('href', '/pengguna?status=INACTIVE')

    // filter kejadian penting
    expect(screen.getByRole('radiogroup', { name: 'Jenis kejadian' })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Operasional' }))
    expect(router.state.location.search).toBe('?view=operasional')
    expect(
      await screen.findByRole('heading', { name: 'Tugas yang perlu diselesaikan' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Akun & Peran' })).not.toBeInTheDocument()
    // sapaan tidak ganda di tampilan Operasional
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('Admin/TU tetap melihat dashboard operasional', async () => {
    await loginAs('admin')
    renderWithProviders(
      <AuthGate>
        <DashboardPage />
      </AuthGate>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Tugas yang perlu diselesaikan' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Akun & Peran' })).not.toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Tampilan dashboard' })).not.toBeInTheDocument()
  })
})
