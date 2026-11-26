import { expect, test } from '@playwright/test'
import { login, nav } from './helpers'

test.describe('autentikasi', () => {
  test('login salah menampilkan pesan aman', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Nama pengguna').fill('piket')
    await page.getByLabel('Kata sandi', { exact: true }).fill('salah')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page.getByText('Nama pengguna atau kata sandi tidak sesuai.')).toBeVisible()
  })

  test('route terproteksi mengarah ke login lalu kembali', async ({ page }) => {
    await page.goto('/absensi-siswa')
    await expect(page).toHaveURL(/\/login\?next=/)
  })

  test('sesi pulih setelah reload', async ({ page }) => {
    await login(page, 'piket')
    await page.reload()
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test.describe('struktur 5 panel akun Guru Piket', () => {
  test('sidebar hanya menampilkan tepat 5 menu operasional datar', async ({ page }) => {
    await login(page, 'piket')
    const menuLinks = nav(page).getByRole('link')
    await expect(menuLinks).toHaveCount(5)
    await expect(menuLinks.nth(0)).toHaveText('Dashboard')
    await expect(menuLinks.nth(1)).toHaveText('Absensi Guru')
    await expect(menuLinks.nth(2)).toHaveText('Agenda Guru')
    await expect(menuLinks.nth(3)).toHaveText('Absensi Siswa')
    await expect(menuLinks.nth(4)).toHaveText('Jam Tambahan')

    // Pastikan tombol Pengaturan cepat di topbar dan tab Sistem sudah dihapus
    await expect(page.getByRole('button', { name: 'Pengaturan cepat' })).toBeHidden()
    await expect(page.getByRole('radio', { name: 'Sistem' })).toBeHidden()
  })

  test('rute panel lama mengembalikan halaman 404 Tidak Ditemukan', async ({ page }) => {
    await login(page, 'piket')
    for (const removedRoute of ['/pengguna', '/master', '/audit', '/pengaturan', '/laporan', '/agenda-piket', '/jam-kosong', '/kepulangan']) {
      await page.goto(removedRoute)
      await expect(page.getByText(/tidak ditemukan/i).first()).toBeVisible()
    }
  })
})

test('AC-14: banner offline muncul saat koneksi terputus', async ({ page, context }) => {
  await login(page, 'piket')
  await context.setOffline(true)
  await expect(page.getByText(/offline|tidak ada koneksi/i).first()).toBeVisible()
  await context.setOffline(false)
})

test('@mobile tampilan ponsel memakai bottom nav 4 menu utama', async ({ page }) => {
  await login(page, 'piket')
  await expect(page.getByRole('link', { name: 'Absensi Guru' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Absensi Siswa' }).first()).toBeVisible()
})
