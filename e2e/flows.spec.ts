/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('alur operasional utama E-Piket', () => {
  test('AC-02 & AC-04: absensi kelas → tandai semua hadir → ubah 2 siswa S/I → finalisasi → tampil di siswa tidak hadir', async ({
    page,
  }) => {
    await login(page, 'piket', '/absensi-siswa')
    await expect(page.getByRole('heading', { name: 'Absensi Siswa' })).toBeVisible()

    // Buka kelas X TKJ 1 (belum ada sesi hari ini pada seed awal)
    await page.getByRole('button', { name: /X TKJ 1/ }).click()
    await expect(page).toHaveURL(/\/absensi-siswa\/sesi\//)
    await expect(page.getByRole('heading', { name: 'X TKJ 1' })).toBeVisible()

    // Tandai semua hadir dalam satu aksi
    await page.getByRole('button', { name: 'Tandai semua hadir' }).click()

    const rows = page.getByRole('list', { name: 'Daftar siswa' }).locator('> li')
    const firstRow = rows.nth(0)
    const secondRow = rows.nth(1)

    const student1Name = (await firstRow.locator('p').first().textContent())?.trim() ?? ''
    const student2Name = (await secondRow.locator('p').first().textContent())?.trim() ?? ''

    // Siswa 1: Sakit + alasan wajib
    await firstRow.getByRole('radio', { name: 'Sakit' }).click()
    await firstRow.getByPlaceholder(/demam/i).fill('Demam tinggi sejak pagi')

    // Siswa 2: Izin + alasan wajib
    await secondRow.getByRole('radio', { name: 'Izin' }).click()
    await secondRow.getByPlaceholder(/demam/i).fill('Acara keluarga di luar kota')

    // Finalisasi sesi absensi
    await page.getByRole('button', { name: 'Finalisasi' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Finalisasi' }).click()

    await expect(page.getByText('Absensi final')).toBeVisible()

    // Pastikan otomatis muncul di daftar Siswa Tidak Hadir tanpa entri ulang (AC-04)
    await page.goto('/siswa-tidak-hadir?classId=cls_1')
    await expect(page.getByRole('heading', { name: 'Siswa Tidak Hadir' })).toBeVisible()
    await expect(page.getByText(student1Name).first()).toBeVisible()
    await expect(page.getByText('Demam tinggi sejak pagi').first()).toBeVisible()
    await expect(page.getByText(student2Name).first()).toBeVisible()
    await expect(page.getByText('Acara keluarga di luar kota').first()).toBeVisible()
  })

  test('AC-03: klik ganda cepat pada Simpan Draft tidak menggandakan record absensi', async ({ page }) => {
    await login(page, 'piket', '/absensi-siswa')
    await page.getByRole('button', { name: /XII TKJ 1/ }).click()
    await expect(page).toHaveURL(/\/absensi-siswa\/sesi\//)

    await page.getByRole('button', { name: 'Tandai semua hadir' }).click()
    const saveDraftBtn = page.getByRole('button', { name: 'Simpan Draft' })
    await saveDraftBtn.dblclick()

    await expect(page.getByText(/Tersimpan/)).toBeVisible()

    // Periksa database mock di localStorage: tidak boleh ada duplikat record per siswa dalam sesi yang sama
    const duplicateCount = await page.evaluate(() => {
      const raw = localStorage.getItem('epiket-mock-db-v1')
      if (!raw) return 0
      const db = JSON.parse(raw) as {
        studentRecords: Array<{ sessionId: string; studentId: string }>
      }
      const seen = new Set<string>()
      let dup = 0
      for (const r of db.studentRecords) {
        const key = `${r.sessionId}:${r.studentId}`
        if (seen.has(key)) dup += 1
        seen.add(key)
      }
      return dup
    })
    expect(duplicateCount).toBe(0)
  })

  test('AC-09: penugasan guru pengganti memvalidasi konflik jadwal lalu menyimpan pengganti yang tersedia', async ({
    page,
  }) => {
    await login(page, 'piket', '/jam-kosong')
    await expect(page.getByRole('heading', { name: 'Jam Kosong & Guru Pengganti' })).toBeVisible()

    await page.getByRole('button', { name: 'Tetapkan pengganti' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Pilih kandidat yang sedang mengajar di kelas lain untuk menguji peringatan konflik
    const conflictingLabel = dialog
      .getByRole('radiogroup', { name: 'Kandidat guru pengganti' })
      .locator('label')
      .filter({ hasText: /Mengajar di kelas lain|Sudah menggantikan/ })
      .first()

    if ((await conflictingLabel.count()) > 0) {
      await conflictingLabel.click()
      await expect(dialog.getByText('Kandidat memiliki konflik jadwal')).toBeVisible()
      // Coba simpan tanpa alasan override -> ditolak validasi
      await dialog.getByRole('button', { name: 'Tetapkan pengganti' }).click()
      await expect(dialog.getByText(/Wajib diisi bila kandidat bentrok/i)).toBeVisible()
    }

    // Pilih kandidat yang tersedia
    const availableLabel = dialog
      .getByRole('radiogroup', { name: 'Kandidat guru pengganti' })
      .locator('label')
      .filter({ hasText: 'Tersedia' })
      .first()
    await availableLabel.click()

    await dialog.getByLabel('Kegiatan di kelas').fill('Mengerjakan latihan soal bab 4 secara mandiri')
    await dialog.getByRole('button', { name: 'Tetapkan pengganti' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByText('Mengerjakan latihan soal bab 4 secara mandiri').first()).toBeVisible()
  })

  test('AC-11: buat, lengkapi, finalisasi, dan cetak agenda piket hari ini', async ({ page }) => {
    await login(page, 'piket', '/agenda-piket')
    await expect(page.getByRole('heading', { name: 'Agenda Piket' })).toBeVisible()

    await page.getByRole('button', { name: /Buka agenda piket|Lanjutkan pengisian/ }).first().click()
    await expect(page).toHaveURL(/\/agenda-piket\/dag_/)

    // Tandai tidak ada catatan hal penting bila belum ada catatan
    const noNotesCheckbox = page.getByLabel('Tidak ada catatan hal penting')
    if (await noNotesCheckbox.isVisible()) {
      await noNotesCheckbox.check()
    }
    const noAbsentCheckbox = page.getByLabel('Tidak ada guru yang tidak hadir')
    if (await noAbsentCheckbox.isVisible()) {
      await noAbsentCheckbox.check()
    }

    await page
      .getByLabel('Catatan penanggulangan')
      .fill('Seluruh kelas terdampak telah diberikan guru pengganti dan tugas terstruktur.')

    await page.getByRole('button', { name: 'Finalisasi' }).click()
    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: 'Finalisasi' }).click()

    await expect(page.getByText('Agenda sudah final')).toBeVisible()

    // Buka tampilan cetak
    await page.getByRole('link', { name: 'Cetak' }).click()
    await expect(page).toHaveURL(/\/agenda-piket\/.*\/cetak/)
    await expect(page.getByText('Agenda Kegiatan Sekolah / Guru Piket')).toBeVisible()
  })

  test('AC-13: guru membuka URL sesi absensi kelas yang bukan ampuannya ditolak (403)', async ({ page }) => {
    await login(page, 'guru')
    // Ambil ID sesi kelas siang (cls_5) dari seed mock yang bukan ampuan guru pagi (tch_1)
    const foreignSessionId = await page.evaluate(() => {
      const raw = localStorage.getItem('epiket-mock-db-v1')
      if (!raw) return 'ses_foreign'
      const db = JSON.parse(raw) as {
        studentSessions: Array<{ id: string; classId: string }>
      }
      return db.studentSessions.find((s) => s.classId === 'cls_5')?.id ?? 'ses_foreign'
    })

    await page.goto(`/absensi-siswa/sesi/${foreignSessionId}`)
    await expect(page.getByText(/Anda tidak memiliki akses ke kelas ini/i)).toBeVisible()
  })
})
