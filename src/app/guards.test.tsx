import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth/auth-context'
import { createTestQueryClient, loginAs } from '@/test/utils'
import { RedirectIfAuthenticated } from './guards'

function renderGuardRoute(initialUrl: string) {
  const qc = createTestQueryClient()
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: (
          <RedirectIfAuthenticated>
            <p>Login Form</p>
          </RedirectIfAuthenticated>
        ),
      },
      { path: '/absensi-siswa', element: <p>Halaman Absensi Siswa</p> },
      { path: '/', element: <p>Halaman Dashboard</p> },
    ],
    { initialEntries: [initialUrl] },
  )
  render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  )
}

describe('RedirectIfAuthenticated', () => {
  it('mengarahkan user terautentikasi ke parameter ?next yang aman', async () => {
    await loginAs('piket')
    renderGuardRoute('/login?next=%2Fabsensi-siswa%3Fshift%3DMORNING')
    expect(await screen.findByText('Halaman Absensi Siswa')).toBeInTheDocument()
  })

  it('menolak ?next eksternal dan mengembalikan ke dashboard', async () => {
    await loginAs('piket')
    renderGuardRoute('/login?next=%2F%2Fevil.example')
    expect(await screen.findByText('Halaman Dashboard')).toBeInTheDocument()
  })
})

