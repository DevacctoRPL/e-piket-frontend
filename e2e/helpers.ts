/// <reference lib="dom" />
// page.evaluate() callbacks run in the browser, so DOM globals (localStorage) are needed here;
// tsconfig.node.json only ships the ES2023 lib.
import { expect, type Page } from '@playwright/test'

export type DemoUser =
  | 'superadmin'
  | 'admin'
  | 'kepsek'
  | 'piket'
  | 'guru'
  | 'walikelas'
  | 'koordinator'

/** Login lewat form; data mock direset dulu agar tiap test mulai dari seed yang sama. */
export async function login(page: Page, username: DemoUser, next = '/') {
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.removeItem('epiket-mock-db-v1')
    localStorage.removeItem('epiket-mock-refresh')
  })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Nama pengguna').fill(username)
  await page.getByLabel('Kata sandi', { exact: true }).fill('password')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

export function nav(page: Page) {
  return page.getByRole('navigation').first()
}
