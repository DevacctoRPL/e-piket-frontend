import { expect, test } from '@playwright/test'
import { login, nav } from './helpers'

test.describe('autentikasi', () => {
  test('login salah menampilkan pesan aman', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Nama pengguna').fill('admin')
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

test.describe('menu per peran (PRD §4.1)', () => {
  test('admin melihat Data Master dan Audit', async ({ page }) => {
    await login(page, 'admin')
    await expect(nav(page).getByRole('link', { name: 'Data Master' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Audit Log' })).toBeVisible()
  })

  test('guru tidak melihat Data Master', async ({ page }) => {
    await login(page, 'guru')
    await expect(nav(page).getByRole('link', { name: 'Jurnal Mengajar' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Data Master' })).toHaveCount(0)
  })
})

test('AC-13: guru membuka halaman admin → 403', async ({ page }) => {
  await login(page, 'guru')
  await page.goto('/audit')
  await expect(page.getByRole('heading', { name: 'Akses ditolak' })).toBeVisible()
})

test('halaman tidak dikenal → 404', async ({ page }) => {
  await login(page, 'admin')
  await page.goto('/tidak-ada-halaman-ini')
  await expect(page.getByText(/tidak ditemukan/i).first()).toBeVisible()
})

test('AC-14: banner offline muncul saat koneksi terputus', async ({ page, context }) => {
  await login(page, 'piket')
  await context.setOffline(true)
  await expect(page.getByText(/offline|tidak ada koneksi/i).first()).toBeVisible()
  await context.setOffline(false)
})

test('@mobile tampilan ponsel memakai bottom nav', async ({ page }) => {
  await login(page, 'piket')
  await expect(page.getByRole('link', { name: 'Absensi Siswa' }).first()).toBeVisible()
})
