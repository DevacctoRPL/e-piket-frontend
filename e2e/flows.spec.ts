/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.describe('alur operasional 5 panel Guru Piket', () => {
  test('Absensi Guru: Jam Kosong hanya tampilkan yang sudah ada pengganti + tambah (quick-pick & manual), edit, hapus', async ({
    page,
  }) => {
    await login(page, 'piket', '/absensi-guru')
    await expect(page.getByRole('heading', { level: 1, name: 'Absensi Guru' })).toBeVisible()
    await expect(page.getByText('Data otomatis dari presensi guru (Read-only)')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sinkron Presensi/i })).toBeVisible()

    // Kartu Jam Kosong: tidak menampilkan "Belum ditugaskan" dan tombol "+ Tambah" tersedia
    await expect(page.getByRole('heading', { name: 'Jam Kosong' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Simpan$/i })).toBeHidden()
    await expect(page.getByText(/Belum ditugaskan/i)).toHaveCount(0)

    // 1. Tambah lewat quick-pick jadwal guru tidak hadir
    await page.getByRole('button', { name: /Tambah/i }).click()
    const quickDialog = page.getByRole('dialog')
    await expect(quickDialog).toBeVisible()
    const sourceSelect = quickDialog.getByLabel(/^Sumber Jadwal/i)
    const firstSlotVal = await sourceSelect.locator('option').nth(1).getAttribute('value')
    await sourceSelect.selectOption(firstSlotVal!)
    await quickDialog.getByLabel(/^Guru Piket/i).fill('Pak Quick E2E')
    await quickDialog.getByRole('button', { name: /^Tambah$/i }).click()
    await expect(quickDialog).toBeHidden()
    await expect(page.getByText('Pak Quick E2E').first()).toBeVisible()

    // 2. Tambah manual dengan Guru Piket wajib
    await page.getByRole('button', { name: /Tambah/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/^Kelas/i).selectOption('cls_1')
    await dialog.getByLabel(/^Guru Tidak Hadir/i).fill('Pak Andi Mapel')
    await dialog.getByLabel(/^Guru Piket/i).fill('Ibu Siska Piket')
    await dialog.getByRole('button', { name: /^Tambah$/i }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByText('Ibu Siska Piket').first()).toBeVisible()
    await expect(page.getByText('Pak Andi Mapel').first()).toBeVisible()

    // 3. Edit penugasan jam kosong lalu Hapus (baris langsung hilang)
    const addedRow = page.locator('tr', { hasText: 'Pak Andi Mapel' }).first()
    await addedRow.getByRole('button', { name: /Edit/i }).click()
    const editDialog = page.getByRole('dialog')
    await editDialog.getByLabel(/^Guru Piket/i).fill('Pak Roni Pengganti')
    await editDialog.getByRole('button', { name: /^Simpan$/i }).click()
    await expect(editDialog).toBeHidden()
    await expect(page.getByText('Pak Roni Pengganti').first()).toBeVisible()

    const editedRow = page.locator('tr', { hasText: 'Pak Andi Mapel' }).first()
    await editedRow.getByRole('button', { name: /Hapus/i }).click()
    const confirmDialog = page.getByRole('alertdialog')
    await confirmDialog.getByRole('button', { name: /^Hapus$/i }).click()
    await expect(page.getByText('Pak Andi Mapel')).toHaveCount(0)
    await expect(page.getByText(/Belum ditugaskan/i)).toHaveCount(0)
  })

  test('Agenda Guru: tanpa Status & Guru Piket, menampilkan kolom TTD read-only dengan pratinjau', async ({ page }) => {
    await login(page, 'piket', '/agenda-guru')
    await expect(page.getByRole('heading', { level: 1, name: 'Agenda Guru' })).toBeVisible()

    await expect(page.getByRole('columnheader', { name: 'TTD' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /^Status$/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /Guru Piket/i })).toHaveCount(0)
    await expect(page.getByLabel('Input nama guru piket')).toHaveCount(0)

    // Klik thumbnail TTD untuk membuka pratinjau read-only
    await page.getByRole('button', { name: /^Lihat tanda tangan /i }).first().click()
    const ttdDialog = page.getByRole('dialog')
    await expect(ttdDialog).toBeVisible()
    await expect(ttdDialog.getByRole('heading', { name: 'Tanda Tangan Guru' })).toBeVisible()
    await ttdDialog.getByRole('button', { name: 'Tutup' }).first().click()
    await expect(ttdDialog).toBeHidden()
  })

  test('Absensi Siswa (Siswa Tidak Hadir): catat status PKL, edit ke Dispensasi, lalu hapus (kembali ke Hadir)', async ({
    page,
  }) => {
    await login(page, 'piket', '/absensi-siswa')
    await expect(page.getByRole('heading', { level: 1, name: 'Siswa Tidak Hadir' })).toBeVisible()

    // Catat ketidakhadiran baru berstatus PKL
    await page.getByRole('button', { name: /Catat Ketidakhadiran/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/^Kelas/i).selectOption('cls_5')
    const studentSelect = dialog.getByLabel(/^Nama Siswa/i)
    await expect(studentSelect.locator('option')).not.toHaveCount(1)
    const firstStudentVal = await studentSelect.locator('option').nth(1).getAttribute('value')
    await studentSelect.selectOption(firstStudentVal!)
    await dialog.getByLabel(/^Status Kehadiran/i).selectOption('PKL')
    await dialog.getByLabel(/^Keterangan/i).fill('PKL di PT Mitra Industri')
    await dialog.getByRole('button', { name: /^Catat$/i }).click()
    await expect(dialog).toBeHidden()

    await expect(page.getByText('PKL di PT Mitra Industri').first()).toBeVisible()

    // Edit ke Dispensasi
    const row = page.locator('tr', { hasText: 'PKL di PT Mitra Industri' }).first()
    await row.getByRole('button', { name: /Edit/i }).click()
    const editDialog = page.getByRole('dialog')
    await editDialog.getByLabel(/^Status Kehadiran/i).selectOption('EXCUSED')
    await editDialog.getByLabel(/^Keterangan/i).fill('Dispensasi upacara kota')
    await editDialog.getByRole('button', { name: /^Simpan$/i }).click()
    await expect(editDialog).toBeHidden()
    await expect(page.getByText('Dispensasi upacara kota').first()).toBeVisible()

    // Hapus -> kembali ke Hadir
    const updatedRow = page.locator('tr', { hasText: 'Dispensasi upacara kota' }).first()
    await updatedRow.getByRole('button', { name: /Hapus/i }).click()
    const alertDialog = page.getByRole('alertdialog')
    await alertDialog.getByRole('button', { name: /Hapus & Tandai Hadir/i }).click()
    await expect(page.getByText('Dispensasi upacara kota')).toHaveCount(0)
  })

  test('Jam Tambahan: kolom Nama Guru / Kegiatan, multi-kelas, Materi, dan TTD read-only tanpa Waktu/Jam, Status, Guru Piket', async ({
    page,
  }) => {
    await login(page, 'piket', '/jam-tambahan')
    await expect(page.getByRole('heading', { level: 1, name: 'Jam Tambahan' })).toBeVisible()

    await expect(page.getByRole('columnheader', { name: /Nama Guru \/ Kegiatan/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Kelas' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Materi' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'TTD' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Waktu/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /^Status$/i })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: /Guru Piket/i })).toHaveCount(0)
    await expect(page.getByLabel('Input nama guru piket')).toHaveCount(0)

    // Verifikasi baris multi-kelas (3 kelas) dan pratinjau TTD
    const multiClassRow = page.locator('tr', { hasText: 'Bimbingan Persiapan LKS Jaringan' }).first()
    await expect(multiClassRow).toBeVisible()
    await expect(multiClassRow.getByText('X TKJ 1')).toBeVisible()
    await expect(multiClassRow.getByText('XI TKJ 1')).toBeVisible()
    await expect(multiClassRow.getByText('XII TKJ 1')).toBeVisible()

    await page.getByRole('button', { name: /^Lihat tanda tangan /i }).first().click()
    const ttdDialog = page.getByRole('dialog')
    await expect(ttdDialog).toBeVisible()
    await expect(ttdDialog.getByRole('heading', { name: 'Tanda Tangan Guru' })).toBeVisible()
    await ttdDialog.getByRole('button', { name: 'Tutup' }).first().click()
    await expect(ttdDialog).toBeHidden()
  })
})
