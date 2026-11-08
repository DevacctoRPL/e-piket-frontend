# PRD: Sistem Administrasi Harian Sekolah

*Digitalisasi absensi siswa dan guru, agenda piket, kegiatan mengajar, jam kosong, serta kegiatan tambahan*

| **INFORMASI DOKUMEN** | **KETERANGAN**                                                             |
|-----------------------|----------------------------------------------------------------------------|
| Jenis dokumen         | Product Requirements Document (PRD)                                        |
| Status                | Draft analisis untuk validasi sekolah dan tim pengembang                   |
| Versi                 | 1.1                                                                        |
| Tanggal               | 8 November 2026                                                            |
| Target frontend       | React + Vite + TypeScript                                                  |
| Font UI               | Plus Jakarta Sans                                                          |
| Routing               | React Router                                                               |
| Server state / data   | TanStack Query + Fetch API bawaan browser                                  |
| Integrasi backend     | REST API berbasis JSON; backend dikembangkan terpisah menggunakan Golang   |
| Acuan analisis        | Lima foto formulir agenda dan administrasi sekolah yang diberikan pengguna |

**TUJUAN DOKUMEN**

Menjadi acuan bersama bagi pihak sekolah, UI/UX designer, frontend React developer, dan backend Golang developer mengenai ruang lingkup, perilaku aplikasi, data yang ditampilkan, serta kontrak integrasi API. Dokumen ini berfokus pada analisis produk dan kebutuhan frontend; bukan spesifikasi implementasi backend.

# Daftar Isi

1. [Ringkasan Produk](#1-ringkasan-produk)
2. [Analisis Formulir dan Temuan Lapangan](#2-analisis-formulir-dan-temuan-lapangan)
3. [Tujuan, Sasaran, dan Indikator Keberhasilan](#3-tujuan-sasaran-dan-indikator-keberhasilan)
4. [Pengguna, Peran, dan Hak Akses](#4-pengguna-peran-dan-hak-akses)
5. [Ruang Lingkup Produk](#5-ruang-lingkup-produk)
6. [Kebutuhan Fungsional](#6-kebutuhan-fungsional)
7. [Alur Proses Utama](#7-alur-proses-utama)
8. [Struktur Navigasi dan Daftar Layar](#8-struktur-navigasi-dan-daftar-layar)
9. [Data dan Aturan Bisnis](#9-data-dan-aturan-bisnis)
10. [Kebutuhan Integrasi React dengan Golang](#10-kebutuhan-integrasi-react-dengan-golang)
11. [Arsitektur dan Standar Frontend React](#11-arsitektur-dan-standar-frontend-react)
12. [Kebutuhan Nonfungsional](#12-kebutuhan-nonfungsional)
13. [Laporan, Rekap, dan Keluaran](#13-laporan-rekap-dan-keluaran)
14. [Kriteria Penerimaan MVP](#14-kriteria-penerimaan-mvp)
15. [Tahapan Rilis dan Risiko](#15-tahapan-rilis-dan-risiko)
16. [Asumsi, Keputusan Terbuka, dan Glosarium](#16-asumsi-keputusan-terbuka-dan-glosarium)

> **Catatan pembacaan:** Urutan halaman dan isi dapat diperbarui setelah validasi alur sekolah. Nama, nomor telepon, dan tulisan tangan pada foto tidak disalin ke PRD; yang dipakai adalah struktur formulir dan proses kerjanya.

# 1. Ringkasan Produk

Sistem Administrasi Harian Sekolah adalah aplikasi web responsif untuk menggantikan pencatatan harian yang saat ini tersebar di beberapa buku fisik. Aplikasi menyatukan proses absensi siswa, absensi guru, kepulangan, agenda guru piket, jurnal kegiatan mengajar, penanganan jam kosong, serta kegiatan kursus atau jam tambahan dalam satu sumber data.

Aplikasi dipakai oleh guru, guru piket, wali kelas, tenaga administrasi sekolah, dan pimpinan sekolah. Setiap pengguna memperoleh menu dan tindakan sesuai perannya. Data yang dicatat pada satu modul digunakan kembali untuk membentuk daftar ketidakhadiran, rekap harian, laporan per kelas/guru, serta dokumen cetak yang mempertahankan susunan formulir kertas agar proses transisi lebih mudah.

> **Prinsip produk:** Catat sekali, gunakan berkali-kali. Ketika guru mencatat siswa tidak hadir atau guru berhalangan, informasi itu dapat digunakan kembali pada agenda piket, penggantian jam kosong, dan laporan tanpa mengetik ulang.

## 1.1 Pernyataan visi

Menyediakan administrasi sekolah harian yang mudah digunakan guru melalui ponsel maupun komputer, akurat, dapat ditelusuri, dan tetap menghasilkan rekap yang familier bagi sekolah.

## 1.2 Permasalahan yang ingin diselesaikan

- Informasi absensi tersebar dalam lembar atau buku yang berbeda sehingga rekap membutuhkan pencatatan ulang.

- Ketidakhadiran siswa dan guru sulit ditelusuri secara cepat menurut tanggal, kelas, shift, dan alasan.

- Guru piket harus merangkum guru yang tidak hadir, alasan, serta jumlah jam yang terdampak secara manual.

- Penggantian jam kosong dan kegiatan pembelajaran tidak selalu tercatat dalam satu alur yang saling terhubung.

- Rekap bulanan/semester serta pencarian arsip membutuhkan waktu karena data berupa tulisan tangan.

- Informasi kepulangan dan pihak yang menerima/menjemput siswa perlu dicatat secara konsisten.

# 2. Analisis Formulir dan Temuan Lapangan

Analisis berikut menerjemahkan lima jenis formulir yang terlihat pada foto ke dalam modul aplikasi. Istilah pada formulir dipertahankan sejauh masih relevan. Beberapa tulisan tangan sulit dipastikan, sehingga nama kegiatan spesifik tidak dijadikan asumsi; aplikasi menyediakan kolom yang dapat dikonfigurasi.

| **FORMULIR PADA FOTO**                            | **INFORMASI YANG TERCATAT**                                                                                                       | **TERJEMAHAN KE APLIKASI**                                                                                  |
|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Agenda Kegiatan Sekolah / Guru Piket              | Hari/tanggal, guru piket, daftar guru harus hadir, guru tidak hadir, alasan, jumlah jam, hal penting, penanggulangan jam kosong.  | Agenda Piket Harian, rekap guru tidak hadir, catatan kejadian, dan modul guru pengganti.                    |
| Daftar Siswa yang Tidak Hadir                     | Tanggal, nama siswa, kelas, status absensi, nomor telepon, pihak yang menerima informasi, keterangan, tanda tangan petugas piket. | Absensi siswa, daftar siswa tidak hadir, kontak/konfirmasi wali, catatan, dan pengesahan petugas.           |
| Agenda Kegiatan Mengajar Guru                     | Tanggal, shift pagi/siang, nomor, kelas, nama guru, materi, kegiatan, kolom S/I/A/JML, tanda tangan.                              | Jurnal mengajar per pertemuan dengan status kehadiran, materi, aktivitas, durasi/pertemuan, dan pengesahan. |
| Agenda Kursus/Jam Tambahan                        | Shift, nomor, nama/kegiatan, kelas, materi, keterangan.                                                                           | Agenda kegiatan tambahan, kelas peserta, pengampu, materi, catatan, dan kehadiran bila diperlukan.          |
| Daftar Guru / Rekap Ketidakhadiran dan Jam Kosong | Daftar nama guru, kelas/program, status atau keterangan, guru pengganti, jam pelajaran, jumlah jam.                               | Master guru dan jadwal, kehadiran guru, substitusi jam pelajaran, serta laporan jam mengajar.               |

## 2.1 Temuan desain penting

- Format pagi/siang muncul sebagai pilihan pada beberapa formulir. Shift harus menjadi data master, tidak dikunci hanya dua pilihan agar sekolah dapat menyesuaikan jadwal.

- Daftar ketidakhadiran siswa berisi siswa yang tidak hadir, bukan seluruh siswa. Di aplikasi, guru sebaiknya mengisi absensi untuk seluruh roster kelas dengan cara cepat (semua hadir terlebih dahulu, lalu ubah pengecualian), sedangkan laporan “siswa tidak hadir” dihasilkan otomatis.

- Kolom S/I/A pada agenda mengajar perlu dipetakan ke Sakit, Izin, dan Alpa. Huruf dan label dapat diubah oleh administrator sesuai kebijakan sekolah.

- Kolom “Jumlah Jam” pada guru tidak hadir dan penanggulangan jam kosong perlu dibedakan: jumlah jam yang terdampak karena guru tidak hadir versus jumlah jam yang benar-benar ditangani guru pengganti.

- Kolom “No. Telp”, “Yang Menerima”, dan “Keterangan” pada daftar siswa tidak hadir menunjukkan kebutuhan pencatatan komunikasi/konfirmasi, bukan otomatis berarti sistem harus mengirim pesan.

- Tanda tangan pada buku berfungsi sebagai pengesahan. Pada MVP dapat diganti dengan identitas pengguna, waktu simpan, dan status finalisasi; tanda tangan digital berbasis gambar/PIN dapat menjadi pengembangan jika diwajibkan sekolah.

## 2.2 Pemetaan kebutuhan dari kertas ke digital

| **ELEMEN KERTAS**                                                    | **PERILAKU DIGITAL YANG DISARANKAN**                                                                    |
|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Menulis tanggal dan shift di setiap halaman                          | Tanggal dan shift dipilih satu kali pada konteks halaman; ditampilkan konsisten pada header dan filter. |
| Mengisi nama satu per satu                                           | Data diambil dari master siswa/guru dan jadwal; pengguna hanya memilih atau memperbarui status.         |
| Menulis kelas berulang atau memakai tanda kurung/garis pengelompokan | Kelas terhubung ke master kelas; roster dan pengelompokan tampil otomatis.                              |
| Menghitung jumlah jam secara manual                                  | Sistem menghitung dari periode/jadwal, dengan opsi koreksi manual dan alasan.                           |
| Tanda tangan petugas/guru                                            | Jejak pengguna, timestamp, dan tombol “Kirim/Finalisasi”; opsi tanda tangan digital dapat ditambahkan.  |
| Membuat rekap dengan menyalin beberapa buku                          | Laporan ditarik dari data yang sama, dapat difilter, diunduh, dan dicetak.                              |

# 3. Tujuan, Sasaran, dan Indikator Keberhasilan

## 3.1 Tujuan bisnis dan operasional

- Mengurangi waktu guru piket dan tenaga administrasi dalam mencatat serta merekap data harian.

- Mengurangi kesalahan penyalinan nama, kelas, status kehadiran, dan total jam.

- Menyediakan informasi absensi dan pelaksanaan pembelajaran yang dapat dilihat sesuai kewenangan.

- Membuat histori yang dapat ditelusuri ketika ada koreksi atau pertanyaan dari wali kelas/pimpinan.

- Memudahkan sekolah menghasilkan dokumen rekap dengan format yang dekat dengan administrasi yang sudah berjalan.

## 3.2 Indikator keberhasilan awal

| **INDIKATOR**                        | **TARGET AWAL UNTUK PILOT**                                                  | **CARA UKUR**                                              |
|--------------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------|
| Kelengkapan pencatatan absensi siswa | ≥ 95% sesi/kelas yang dijadwalkan memiliki data absensi pada hari yang sama. | Jumlah sesi absensi lengkap ÷ total sesi yang dijadwalkan. |
| Ketepatan waktu rekap harian         | Rekap harian dapat dilihat setelah petugas menyelesaikan dan mengirim data.  | Waktu penyelesaian input dibanding waktu laporan tersedia. |
| Pengurangan rekap manual             | Waktu pembuatan rekap bulanan berkurang minimal 50% dari baseline sekolah.   | Uji waktu sebelum dan sesudah implementasi.                |
| Kelengkapan jurnal mengajar          | ≥ 90% pertemuan yang berlangsung memiliki jurnal terisi.                     | Pertemuan dengan jurnal ÷ pertemuan terjadwal.             |
| Keterlacakan perubahan               | 100% perubahan data final menyimpan pelaku dan timestamp.                    | Audit log untuk perubahan data yang relevan.               |

Target di atas merupakan target awal untuk diuji pada pilot, bukan angka kinerja sekolah yang sudah terukur. Sekolah perlu menetapkan baseline dan target final sebelum peluncuran.

# 4. Pengguna, Peran, dan Hak Akses

| **PERAN**                     | **KEBUTUHAN UTAMA**                                                                                                             | **AKSES UTAMA**                                                                                         |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Administrator / Tata Usaha    | Mengelola data master, akun, tahun ajaran, shift, kelas, jadwal, serta koreksi administratif.                                   | CRUD master data; pengaturan; seluruh laporan; koreksi sesuai kebijakan; audit log.                     |
| Kepala Sekolah / Pimpinan     | Memantau kehadiran, pelaksanaan pembelajaran, jam kosong, dan laporan sekolah.                                                  | Dashboard seluruh sekolah; laporan; melihat agenda; menyetujui koreksi bila diaktifkan.                 |
| Guru                          | Mengisi jurnal mengajar, melihat jadwal, mencatat absensi kelas yang menjadi tanggung jawabnya, dan mencatat kehadiran pribadi. | Jadwal pribadi; jurnal sendiri; absensi sesuai penugasan; check-in/out; histori sendiri.                |
| Guru Piket                    | Menjalankan agenda piket dan memastikan rekap harian siswa/guru serta kejadian penting.                                         | Roster harian; absensi sesuai penugasan; agenda piket; guru tidak hadir; jam kosong; finalisasi harian. |
| Wali Kelas                    | Memantau absensi dan catatan siswa pada kelas binaannya.                                                                        | Rekap kelas; detail ketidakhadiran; konfirmasi/komentar; koreksi terbatas sesuai izin.                  |
| Koordinator Kegiatan Tambahan | Mengelola kursus/jam tambahan, peserta, pengampu, materi, dan catatan.                                                          | Agenda tambahan yang menjadi tanggung jawabnya; presensi peserta bila diaktifkan.                       |

## 4.1 Matriks akses ringkas

| **MODUL**            | **ADMIN/TU**   | **PIMPINAN** | **GURU**            | **PIKET**              | **WALI KELAS**       |
|----------------------|----------------|--------------|---------------------|------------------------|----------------------|
| Master data          | Kelola         | Lihat        | Terbatas            | Lihat                  | Lihat kelasnya       |
| Absensi siswa        | Kelola/koreksi | Lihat        | Isi sesuai tugas    | Isi/monitor            | Lihat kelasnya       |
| Absensi guru         | Kelola/koreksi | Lihat        | Isi pribadi         | Monitor/isi sesuai SOP | Lihat bila diizinkan |
| Agenda piket         | Lihat/koreksi  | Lihat        | Lihat               | Isi/finalisasi         | Lihat                |
| Jurnal mengajar      | Lihat/koreksi  | Lihat        | Isi milik sendiri   | Lihat                  | Lihat terbatas       |
| Jam kosong/pengganti | Kelola         | Lihat        | Isi bila ditugaskan | Isi/konfirmasi         | Lihat                |
| Kegiatan tambahan    | Kelola         | Lihat        | Isi bila ditugaskan | Lihat                  | Lihat bila relevan   |
| Laporan dan ekspor   | Semua          | Semua        | Pribadi/kelas tugas | Harian sesuai tugas    | Kelas binaan         |

Prinsip akses: hak akses wajib ditegakkan oleh backend, bukan hanya dengan menyembunyikan menu di React. Matriks ini adalah baseline; sekolah dapat menetapkan penugasan per kelas, shift, dan tanggal.

# 5. Ruang Lingkup Produk

## 5.1 Cakupan MVP (prioritas P0)

- Login, profil pengguna, kontrol akses berbasis peran, dan sesi pengguna.

- Master tahun ajaran/semester, kelas, siswa, guru, mata pelajaran, shift, periode jam, serta jadwal mengajar.

- Absensi siswa per kelas dan tanggal dengan input massal, status, alasan/catatan, serta daftar otomatis siswa tidak hadir.

- Pencatatan kepulangan siswa: waktu keluar, pihak penjemput/penerima, metode atau catatan kepulangan sesuai kebijakan.

- Absensi pribadi guru dengan check-in/check-out dan status sakit/izin/alpa/terlambat apabila berlaku.

- Agenda guru piket: penugasan piket, daftar guru hadir/tidak hadir, alasan, jumlah jam terdampak, hal penting, dan finalisasi.

- Jurnal mengajar: kelas, guru, mata pelajaran, materi, aktivitas, tanggal/shift/pertemuan, dan status kehadiran terkait.

- Penanganan jam kosong: kelas, periode, mata pelajaran, guru berhalangan, guru pengganti, jumlah jam, dan catatan.

- Dashboard ringkas, pencarian/filter, laporan absensi siswa/guru, jurnal mengajar, jam kosong, dan unduh/cetak.

- Jejak audit untuk perubahan data penting.

## 5.2 Cakupan rilis lanjutan (P1/P2)

| **PRIORITAS** | **FITUR**                            | **CATATAN**                                                                                                                                                |
|---------------|--------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| P1            | Agenda kursus/jam tambahan           | Termasuk pengampu, kelas, materi, catatan dan kehadiran peserta bila dibutuhkan. Dapat disertakan di MVP jika kegiatan ini operasional sejak hari pertama. |
| P1            | Persetujuan koreksi absensi/jurnal   | Koreksi data yang sudah difinalisasi memerlukan alasan dan persetujuan role tertentu.                                                                      |
| P1            | Notifikasi wali/orang tua            | Pengingat atau pemberitahuan melalui kanal yang disetujui sekolah; perlu integrasi provider terpisah.                                                      |
| P1            | Draft offline / antrean sinkronisasi | Untuk lokasi dengan koneksi tidak stabil; membutuhkan strategi konflik dan indikator sinkronisasi.                                                         |
| P2            | QR/NFC atau perangkat fingerprint    | Hanya setelah kebijakan, perangkat, dan mitigasi penyalahgunaan disepakati.                                                                                |
| P2            | Portal orang tua/siswa               | Akses mandiri untuk melihat ringkasan absensi atau konfirmasi; bukan cakupan awal aplikasi guru.                                                           |
| P2            | Integrasi sistem akademik lain       | Sinkronisasi data dengan sistem sekolah yang sudah tersedia.                                                                                               |

## 5.3 Di luar cakupan

- Pengembangan backend Golang, database, server, dan infrastruktur produksi oleh tim frontend.

- Penggajian, payroll, penilaian akademik, e-learning/LMS, pembayaran sekolah, dan manajemen perpustakaan.

- Pelacakan lokasi/GPS wajib untuk membuktikan kehadiran.

- Pengiriman WhatsApp/SMS otomatis tanpa persetujuan sekolah, nomor resmi, dan penyedia layanan yang sah.

- Pengenalan wajah atau biometrik pada MVP.

# 6. Kebutuhan Fungsional

Setiap kebutuhan diberi ID agar dapat ditautkan ke tiket desain, implementasi frontend, endpoint backend, dan pengujian. P0 wajib untuk MVP; P1/P2 merupakan pengembangan berikutnya.

## 6.1 Autentikasi dan profil pengguna

| **ID**     | **KEBUTUHAN**                                                        | **KRITERIA PENERIMAAN RINGKAS**                                                                   | **PRIO** |
|------------|----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|----------|
| FR-AUTH-01 | Pengguna dapat login menggunakan kredensial yang disediakan sekolah. | Login valid membuka dashboard sesuai peran; login gagal menampilkan pesan yang aman.              | P0       |
| FR-AUTH-02 | Aplikasi memuat profil, role, dan hak akses pengguna setelah login.  | Menu dan tindakan mengikuti hak akses; akses langsung ke halaman terlarang ditolak di UI dan API. | P0       |
| FR-AUTH-03 | Pengguna dapat logout dan sesi kedaluwarsa ditangani.                | Data sesi dibersihkan; pengguna diarahkan ke login saat sesi tidak valid.                         | P0       |
| FR-AUTH-04 | Profil menampilkan nama, peran, dan informasi akun.                  | Pengguna dapat melihat identitas akun dan mengubah data yang diizinkan.                           | P1       |

## 6.2 Data master dan jadwal

| **ID**    | **KEBUTUHAN**                                                                                                            | **KRITERIA PENERIMAAN RINGKAS**                                                                          | **PRIO** |
|-----------|--------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|----------|
| FR-MST-01 | Admin mengelola tahun ajaran dan semester aktif.                                                                         | Setiap catatan operasional terhubung ke periode akademik yang benar.                                     | P0       |
| FR-MST-02 | Admin mengelola kelas/program, tingkat, shift, dan status kelas.                                                         | Kelas dapat dicari dan dipakai pada absensi, jurnal, dan laporan.                                        | P0       |
| FR-MST-03 | Admin mengelola data siswa termasuk NIS/identitas internal, nama, kelas, status aktif, dan kontak wali sesuai kebijakan. | Siswa aktif muncul di roster kelas; siswa nonaktif tidak muncul untuk tanggal setelah status efektifnya. | P0       |
| FR-MST-04 | Admin mengelola guru dan penugasan mengajar.                                                                             | Guru terhubung ke mata pelajaran/kelas/shift bila diperlukan.                                            | P0       |
| FR-MST-05 | Admin mengelola mata pelajaran, periode jam, durasi, dan jadwal pelajaran.                                               | Jadwal dapat menjadi dasar roster absensi dan daftar jam kosong.                                         | P0       |
| FR-MST-06 | Admin dapat mengimpor data siswa/guru dari template spreadsheet.                                                         | Sistem menampilkan validasi baris gagal sebelum data disimpan.                                           | P1       |

## 6.3 Absensi siswa

| **ID**    | **KEBUTUHAN**                                                                                               | **KRITERIA PENERIMAAN RINGKAS**                                                                           | **PRIO** |
|-----------|-------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|----------|
| FR-STU-01 | Guru/piket memilih tanggal, shift, kelas, dan sesi absensi.                                                 | Roster menampilkan siswa aktif pada kelas/sesi yang dipilih.                                              | P0       |
| FR-STU-02 | Pengguna dapat menandai seluruh siswa hadir lalu mengubah siswa yang tidak hadir/terlambat.                 | Input massal tersimpan; perubahan per siswa terlihat jelas sebelum dikirim.                               | P0       |
| FR-STU-03 | Sistem mendukung status Hadir, Sakit, Izin, Alpa, Terlambat, dan status lain yang dikonfigurasi sekolah.    | Setiap record memiliki satu status utama; mapping S/I/A tersedia pada tampilan/ekspor bila dipilih.       | P0       |
| FR-STU-04 | Pengguna dapat mengisi catatan, alasan, waktu datang, dan bukti/attachment bila diizinkan.                  | Kolom tambahan opsional sesuai status dan kebijakan sekolah.                                              | P0       |
| FR-STU-05 | Sistem menghasilkan daftar siswa tidak hadir secara otomatis.                                               | Daftar dapat difilter per tanggal, shift, kelas, status dan dapat dicetak/diunduh.                        | P0       |
| FR-STU-06 | Pengguna dapat mencatat nomor kontak yang dihubungi, pihak yang menerima informasi, dan catatan konfirmasi. | Informasi komunikasi tersimpan pada record ketidakhadiran; sistem tidak mengirim pesan otomatis pada MVP. | P0       |
| FR-STU-07 | Sistem mencegah duplikasi absensi untuk siswa pada sesi yang sama.                                          | Pengiriman ulang tidak membuat record ganda; pengguna dapat memperbarui record yang ada sesuai izin.      | P0       |
| FR-STU-08 | Wali kelas/piket dapat melihat histori absensi siswa.                                                       | Histori memiliki filter rentang tanggal dan ringkasan status.                                             | P0       |

## 6.4 Absensi pulang siswa dan guru

| **ID**    | **KEBUTUHAN**                                                                          | **KRITERIA PENERIMAAN RINGKAS**                                                           | **PRIO** |
|-----------|----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|----------|
| FR-OUT-01 | Petugas dapat mencatat kepulangan siswa pada tanggal/shift yang berlaku.               | Record memuat siswa, waktu keluar, pihak penjemput/penerima, dan catatan bila diperlukan. | P0       |
| FR-OUT-02 | Aplikasi dapat membedakan pulang normal, pulang lebih awal, dan izin keluar sementara. | Jenis peristiwa tampil pada detail dan laporan; waktu pulang tidak menimpa absensi masuk. | P0       |
| FR-OUT-03 | Guru dapat melakukan check-out atau mencatat akhir tugas.                              | Waktu check-out dan status kehadiran guru tersimpan; perubahan manual memiliki alasan.    | P0       |
| FR-OUT-04 | Petugas dapat mencari histori kepulangan berdasarkan nama siswa/kelas/tanggal.         | Pencarian menampilkan hasil sesuai kewenangan dan rentang tanggal.                        | P1       |

## 6.5 Absensi guru dan guru tidak hadir

| **ID**    | **KEBUTUHAN**                                                                                                       | **KRITERIA PENERIMAAN RINGKAS**                                                        | **PRIO** |
|-----------|---------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|----------|
| FR-TCH-01 | Guru dapat check-in/check-out untuk shift atau hari kerja.                                                          | Sistem menyimpan timestamp; keterlambatan dapat dihitung berdasarkan aturan jam masuk. | P0       |
| FR-TCH-02 | Piket/admin dapat mencatat status guru: hadir, sakit, izin, alpa, terlambat, dinas luar, atau kategori konfigurasi. | Setiap status dapat dilengkapi keterangan dan rentang waktu.                           | P0       |
| FR-TCH-03 | Piket dapat mencatat alasan ketidakhadiran serta jumlah jam mengajar yang terdampak.                                | Jumlah jam dapat dihitung dari jadwal dan dapat dikoreksi dengan alasan.               | P0       |
| FR-TCH-04 | Daftar guru harus hadir ditampilkan berdasarkan jadwal dan penugasan.                                               | Guru yang tidak memiliki jadwal/penugasan pada hari tersebut tidak dipaksa muncul.     | P0       |
| FR-TCH-05 | Pimpinan/admin dapat melihat rekap kehadiran guru.                                                                  | Filter berdasarkan guru, tanggal, shift, status, dan periode akademik tersedia.        | P0       |

## 6.6 Agenda guru piket dan catatan harian

| **ID**     | **KEBUTUHAN**                                                                      | **KRITERIA PENERIMAAN RINGKAS**                                                                     | **PRIO** |
|------------|------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------|
| FR-DUTY-01 | Admin dapat mengatur petugas piket berdasarkan hari/shift/tanggal.                 | Petugas tampil pada agenda harian; perubahan jadwal tercatat.                                       | P0       |
| FR-DUTY-02 | Guru piket dapat membuka agenda dengan tanggal dan shift yang terisi dari konteks. | Nama petugas dan daftar guru terjadwal dapat dimuat otomatis.                                       | P0       |
| FR-DUTY-03 | Piket dapat merekap guru hadir/tidak hadir, alasan, dan jumlah jam terdampak.      | Rekap piket mengambil data absensi guru dan memungkinkan catatan tambahan.                          | P0       |
| FR-DUTY-04 | Piket dapat mencatat hal penting/kejadian sekolah.                                 | Catatan memiliki waktu, pembuat, kategori opsional, dan lampiran opsional.                          | P0       |
| FR-DUTY-05 | Piket dapat menyimpan draft dan memfinalisasi agenda harian.                       | Status Draft/Submitted/Final; setelah final perubahan memerlukan izin/koreksi.                      | P0       |
| FR-DUTY-06 | Agenda piket dapat dicetak menyerupai format buku.                                 | Hasil cetak memuat tanggal, shift, petugas, guru tidak hadir, alasan, jam, catatan, dan pengesahan. | P0       |

## 6.7 Agenda kegiatan mengajar / jurnal guru

| **ID**      | **KEBUTUHAN**                                                                | **KRITERIA PENERIMAAN RINGKAS**                                                                         | **PRIO** |
|-------------|------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|----------|
| FR-TEACH-01 | Guru melihat jadwal mengajar hari ini berdasarkan penugasan.                 | Urutan kelas dan jam sesuai jadwal; pertemuan yang berubah dapat diberi penanda.                        | P0       |
| FR-TEACH-02 | Guru mengisi kelas, mata pelajaran, materi, aktivitas/kegiatan, dan catatan. | Field wajib divalidasi; draft dapat disimpan sebelum finalisasi.                                        | P0       |
| FR-TEACH-03 | Jurnal mencatat status kehadiran guru untuk pertemuan tersebut.              | Status Sakit/Izin/Alpa atau pengganti dapat direpresentasikan dan tidak tertukar dengan absensi harian. | P0       |
| FR-TEACH-04 | Aplikasi menghitung jumlah periode/jam berdasarkan jadwal.                   | JML ditampilkan konsisten dengan durasi/periode; koreksi butuh alasan.                                  | P0       |
| FR-TEACH-05 | Guru/pimpinan dapat melihat histori agenda mengajar.                         | Filter tanggal, guru, kelas, mata pelajaran, dan shift tersedia.                                        | P0       |
| FR-TEACH-06 | Jurnal dapat disahkan oleh guru dan/atau pimpinan sesuai kebijakan.          | Identitas dan timestamp pengesahan tersimpan.                                                           | P1       |

## 6.8 Penanggulangan jam kosong / guru pengganti

| **ID**    | **KEBUTUHAN**                                                                           | **KRITERIA PENERIMAAN RINGKAS**                                           | **PRIO** |
|-----------|-----------------------------------------------------------------------------------------|---------------------------------------------------------------------------|----------|
| FR-SUB-01 | Piket melihat daftar jam pelajaran yang berpotensi kosong dari absensi guru dan jadwal. | Sistem menandai slot yang belum memiliki guru pengganti.                  | P0       |
| FR-SUB-02 | Piket menetapkan guru pengganti, kelas, mata pelajaran, periode, dan jumlah jam.        | Sistem memvalidasi konflik jadwal guru pengganti dan kelas.               | P0       |
| FR-SUB-03 | Pengguna dapat mencatat materi/kegiatan yang dilakukan guru pengganti.                  | Catatan substitusi dapat ditautkan ke jurnal mengajar pengganti.          | P0       |
| FR-SUB-04 | Rekap memisahkan jam terdampak, jam belum tertangani, dan jam yang sudah digantikan.    | Total pada laporan konsisten dengan record substitusi dan periode jadwal. | P0       |

## 6.9 Kursus dan jam tambahan

| **ID**    | **KEBUTUHAN**                                                     | **KRITERIA PENERIMAAN RINGKAS**                                                      | **PRIO** |
|-----------|-------------------------------------------------------------------|--------------------------------------------------------------------------------------|----------|
| FR-EXT-01 | Pengguna berwenang dapat membuat agenda kursus/jam tambahan.      | Agenda berisi nama kegiatan/pengampu, shift, kelas, tanggal, materi, dan keterangan. | P1       |
| FR-EXT-02 | Agenda dapat memuat satu atau beberapa kelas dalam satu kegiatan. | Relasi kelas tidak menggandakan agenda induk.                                        | P1       |
| FR-EXT-03 | Kehadiran peserta dan catatan sesi dapat diisi bila dibutuhkan.   | Rekap peserta terpisah dari absensi reguler.                                         | P1       |

## 6.10 Dashboard, laporan, ekspor, dan audit

| **ID**    | **KEBUTUHAN**                                                                                | **KRITERIA PENERIMAAN RINGKAS**                                             | **PRIO** |
|-----------|----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|----------|
| FR-RPT-01 | Dashboard menampilkan ringkasan sesuai role dan tanggal/shift.                               | Angka dashboard dapat ditelusuri ke daftar record yang membentuknya.        | P0       |
| FR-RPT-02 | Laporan absensi siswa dapat difilter per siswa, kelas, status, tanggal, shift, dan semester. | Ringkasan jumlah dan persentase hadir dihitung dari record valid.           | P0       |
| FR-RPT-03 | Laporan absensi guru, jurnal mengajar, guru tidak hadir, dan jam kosong tersedia.            | Filter utama dan total jam ditampilkan secara konsisten.                    | P0       |
| FR-RPT-04 | Laporan dapat diunduh ke XLSX/CSV dan dicetak atau diekspor ke PDF.                          | File mengikuti filter aktif dan menyertakan periode serta waktu pembuatan.  | P0       |
| FR-AUD-01 | Perubahan data final menyimpan siapa, kapan, data apa, dan alasan bila diperlukan.           | Audit dapat dilihat oleh admin/pimpinan sesuai hak akses.                   | P0       |
| FR-AUD-02 | Penghapusan data operasional dilakukan secara terbatas/soft delete.                          | Data terkait laporan tidak hilang diam-diam; operasi tercatat di audit log. | P0       |

# 7. Alur Proses Utama

## 7.1 Alur absensi siswa harian

1. Guru/piket login lalu memilih tanggal, shift, dan kelas (atau membuka sesi dari jadwal).

2. Sistem menampilkan roster siswa aktif pada kelas yang dipilih.

3. Pengguna memilih “Tandai semua hadir”. Status default hanya berlaku untuk sesi tersebut, bukan menjadi status permanen siswa.

4. Pengguna mengubah siswa yang sakit, izin, alpa, terlambat, atau status lain; alasan dan catatan diisi sesuai kebutuhan.

5. Pengguna menyimpan draft lalu mengirim/finalisasi. Sistem mencegah duplikasi dan menampilkan ringkasan jumlah hadir/tidak hadir.

6. Daftar siswa tidak hadir tersedia otomatis dan dapat dipakai untuk mencatat nomor yang dihubungi, pihak yang menerima informasi, dan keterangan.

## 7.2 Alur kepulangan siswa

1. Petugas membuka menu Kepulangan dan memilih tanggal/shift/kelas.

2. Petugas mencari atau memilih siswa; sistem menampilkan ringkasan absensi hari itu.

3. Petugas mencatat waktu keluar, jenis kepulangan (normal/lebih awal/izin keluar), dan pihak penjemput/penerima bila diwajibkan.

4. Petugas menyimpan; sistem menyimpan identitas petugas dan waktu pencatatan.

## 7.3 Alur absensi guru dan piket

1. Guru melakukan check-in/check-out sesuai kebijakan sekolah. Jika tidak dapat check-in, admin/piket dapat mencatat status dan alasan.

2. Piket membuka agenda harian; sistem memuat petugas piket dan daftar guru terjadwal.

3. Piket memastikan status guru yang hadir/tidak hadir dan melengkapi alasan serta jumlah jam mengajar terdampak.

4. Sistem mengidentifikasi slot jadwal yang berpotensi kosong dan menampilkan kebutuhan guru pengganti.

5. Piket mencatat hal penting, menyimpan draft, lalu memfinalisasi agenda harian.

## 7.4 Alur jurnal mengajar

1. Guru memilih pertemuan dari jadwal hari ini atau membuat catatan sesuai izin.

2. Guru memeriksa kelas dan mata pelajaran, lalu mengisi materi serta kegiatan pembelajaran.

3. Sistem mengisi jumlah periode dari jadwal; guru dapat menambahkan catatan dan menandai status jika pertemuan tidak terlaksana.

4. Guru menyimpan jurnal; pimpinan/admin dapat meninjau sesuai hak akses.

## 7.5 Alur penanggulangan jam kosong

1. Piket membuka daftar slot kosong yang bersumber dari jadwal dan ketidakhadiran guru.

2. Piket memilih slot/kelas/mata pelajaran dan menunjuk guru pengganti.

3. Sistem memeriksa benturan jadwal. Jika ada konflik, pengguna harus memilih guru lain atau meminta override berizin.

4. Piket/guru pengganti mencatat materi atau aktivitas yang dilakukan serta jumlah periode yang ditangani.

5. Ringkasan harian memisahkan slot kosong yang belum tertangani dan yang sudah digantikan.

# 8. Struktur Navigasi dan Daftar Layar

Navigasi disarankan berbasis role. Pada desktop menu samping dapat selalu terlihat; pada ponsel gunakan navigasi ringkas dan tombol aksi utama yang mudah dijangkau. Hindari menampilkan seluruh menu kepada semua role.

| **LAYAR / MENU**             | **KONTEN DAN TINDAKAN UTAMA**                                                                                    | **PENGGUNA**                       |
|------------------------------|------------------------------------------------------------------------------------------------------------------|------------------------------------|
| Login                        | Form username/email dan password; status sesi; pesan error.                                                      | Semua                              |
| Dashboard                    | Ringkasan absensi hari ini, siswa/guru tidak hadir, jam kosong belum tertangani, agenda yang perlu diselesaikan. | Semua sesuai role                  |
| Data Master                  | Tahun ajaran, semester, kelas, siswa, guru, mata pelajaran, shift, periode, jadwal.                              | Admin/TU                           |
| Jadwal Saya / Jadwal Sekolah | Kalender atau daftar jadwal per hari, guru, kelas, shift.                                                        | Guru, piket, admin, pimpinan       |
| Absensi Siswa                | Filter tanggal/shift/kelas; roster; tandai semua hadir; ubah status; simpan/finalisasi.                          | Guru/piket/wali kelas sesuai tugas |
| Siswa Tidak Hadir            | Tabel daftar otomatis; status; alasan; kontak; pihak yang menerima; catatan; ekspor.                             | Piket, wali kelas, admin           |
| Kepulangan Siswa             | Pencarian nama/kelas; waktu keluar; penjemput/penerima; jenis pulang; histori.                                   | Piket/TU                           |
| Absensi Guru                 | Daftar guru terjadwal; check-in/out; status; alasan; jam terdampak.                                              | Guru, piket, admin                 |
| Agenda Guru Piket            | Tanggal/shift, petugas, daftar guru, catatan penting, finalisasi.                                                | Guru piket, pimpinan, admin        |
| Jurnal Mengajar              | Daftar pertemuan; form materi/kegiatan; jumlah periode; pengesahan.                                              | Guru, pimpinan                     |
| Jam Kosong / Guru Pengganti  | Slot kosong, konflik jadwal, pemilihan pengganti, catatan kegiatan.                                              | Piket, admin, pimpinan             |
| Kursus/Jam Tambahan          | Daftar kegiatan, pengampu, kelas, materi, catatan, peserta.                                                      | Koordinator, admin                 |
| Laporan                      | Ringkasan, filter, drill-down, ekspor Excel/CSV/PDF, tampilan cetak.                                             | Sesuai role                        |
| Audit & Persetujuan          | Riwayat koreksi, alasan, pelaku, waktu, status persetujuan.                                                      | Admin/pimpinan                     |
| Pengaturan                   | Status absensi, shift, aturan keterlambatan, jam, template cetak, role.                                          | Admin                              |

## 8.1 Rekomendasi komponen UI berulang

- Header konteks: tanggal, shift, tahun ajaran, dan kelas/role aktif.

- Filter bar yang dapat disimpan atau dipertahankan saat pengguna berpindah tab.

- Status badge dengan label teks dan warna; jangan mengandalkan warna saja.

- Tabel dengan pencarian, pengurutan, paginasi, dan aksi per baris yang jelas.

- Quick action: Tandai Semua Hadir, Simpan Draft, Kirim/Finalisasi, Cetak, Ekspor.

- Empty state yang menjelaskan penyebab data kosong dan tindakan berikutnya.

- Confirmation dialog untuk finalisasi, koreksi, dan penghapusan.

# 9. Data dan Aturan Bisnis

## 9.1 Entitas konseptual

| **ENTITAS**                  | **ATRIBUT PENTING / RELASI**                                                                                                                      |
|------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| User dan Role                | id, nama, username/email, status akun, role, relasi ke profil guru/admin. Satu user dapat memiliki lebih dari satu role jika sekolah mengizinkan. |
| AcademicYear / Semester      | nama tahun ajaran, tanggal mulai/selesai, semester, status aktif.                                                                                 |
| Class / Program              | nama kelas, tingkat, program/kompetensi, shift, wali kelas, status.                                                                               |
| Student                      | id, nomor induk internal, nama, kelas efektif, status aktif, kontak wali sesuai kebijakan.                                                        |
| Teacher                      | id, nomor pegawai/internal, nama, status aktif, mata pelajaran dan penugasan.                                                                     |
| Subject / Period / Timetable | mata pelajaran, nomor jam, waktu mulai/selesai, durasi, relasi guru-kelas-hari-shift.                                                             |
| StudentAttendanceSession     | tanggal, shift, kelas, sesi, pembuat, status draft/final.                                                                                         |
| StudentAttendanceRecord      | sesi, siswa, status, waktu datang, alasan, catatan, metadata komunikasi.                                                                          |
| StudentDismissal             | siswa, tanggal, waktu keluar, jenis kepulangan, pihak penjemput/penerima, petugas pencatat.                                                       |
| TeacherAttendance            | guru, tanggal/shift, check-in/out, status, alasan, jam terdampak.                                                                                 |
| DutyAssignment / DutyAgenda  | petugas piket, tanggal/shift, guru tidak hadir yang dirangkum, catatan penting, status finalisasi.                                                |
| TeachingLog                  | guru, kelas, mata pelajaran, tanggal/shift/pertemuan, materi, aktivitas, periode, status/pengesahan.                                              |
| SubstitutionRecord           | slot jadwal kosong, guru berhalangan, guru pengganti, kelas, mata pelajaran, periode, jumlah jam, catatan.                                        |
| ExtraActivity / ExtraSession | jenis kegiatan, pengampu, kelas peserta, tanggal/shift, materi, catatan, presensi peserta opsional.                                               |
| AuditLog                     | aktor, aksi, entitas, id record, nilai sebelum/sesudah, alasan, timestamp, request id.                                                            |

## 9.2 Aturan bisnis yang perlu konsisten

- Satu siswa hanya boleh memiliki satu status absensi utama untuk satu sesi absensi yang sama. Koreksi memperbarui record, bukan membuat record baru.

- Absensi siswa harian dapat terdiri dari satu sesi pagi/siang atau beberapa sesi sesuai kebijakan sekolah. Struktur data harus mendukung keduanya.

- Status S/I/A pada formulir lama dipetakan ke Sakit/Izin/Alpa. Status Hadir, Terlambat, Pulang Lebih Awal, dan Izin Keluar adalah keadaan terpisah, bukan sinonim.

- Absensi pulang tidak boleh mengubah status kedatangan siswa. Keduanya merupakan peristiwa berbeda dan dapat muncul bersama dalam histori siswa.

- Absensi harian guru dan status kehadiran guru pada satu pertemuan mengajar merupakan dua konteks yang saling terkait tetapi tidak selalu identik.

- Jumlah jam terdampak dihitung dari jadwal aktif pada rentang waktu guru tidak hadir. Piket dapat mengoreksi hitungan dengan menyimpan alasan.

- Jam kosong dianggap tertangani jika record guru pengganti telah tersimpan dan tidak berstatus batal. Slot yang belum memiliki pengganti tetap terlihat dalam laporan.

- Jurnal mengajar tidak boleh mengklaim pertemuan terlaksana apabila statusnya dibatalkan/tidak berlangsung tanpa catatan penjelas.

- Perubahan pada data yang sudah final memerlukan izin dan alasan. Data lama tetap dapat ditelusuri melalui audit log.

- Tanggal operasional menggunakan zona waktu sekolah (default Asia/Jakarta). Waktu disimpan/dikirim dengan offset/timezone yang eksplisit.

## 9.3 Validasi form inti

| **FORM**        | **VALIDASI MINIMUM**                                                                                                                                                   |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Absensi siswa   | Tanggal, shift, kelas, sesi wajib; setiap siswa maksimal satu record per sesi; status wajib; alasan wajib untuk status yang ditetapkan sekolah (mis. sakit/izin/alpa). |
| Kepulangan      | Siswa, tanggal, waktu keluar, jenis kepulangan wajib; pihak penjemput/penerima diwajibkan hanya bila kebijakan sekolah meminta.                                        |
| Absensi guru    | Guru, tanggal/shift, status wajib; check-in tidak boleh lebih lambat dari check-out; alasan wajib untuk sakit/izin/alpa/dinas luar.                                    |
| Agenda piket    | Tanggal/shift dan petugas wajib; sebelum finalisasi seluruh bagian wajib harus lengkap atau diberi penanda “tidak ada”.                                                |
| Jurnal mengajar | Tanggal, guru, kelas, mata pelajaran, materi atau alasan tidak mengajar; jumlah periode tidak boleh negatif dan harus konsisten dengan jadwal.                         |
| Guru pengganti  | Slot jadwal, kelas, mata pelajaran, guru pengganti, periode wajib; konflik jadwal harus diperlihatkan sebelum simpan.                                                  |

# 10. Kebutuhan Integrasi React dengan Golang

> **Batas tanggung jawab:** Tim React membangun UI, validasi sisi klien, manajemen state, dan konsumsi API. Tim Golang menyediakan autentikasi, otorisasi, validasi final, business rules, persistence, audit, dan endpoint. PRD ini menetapkan kesepakatan antarmuka agar keduanya dapat dikembangkan paralel.

## 10.1 Prinsip kontrak API

- Gunakan REST API berbasis JSON dengan prefix versi, disarankan `/api/v1`.

- Gunakan nama field JSON konsisten dalam camelCase; backend Go dapat memetakannya melalui JSON tags.

- Gunakan HTTP method dan status code secara konsisten: GET membaca, POST membuat/aksi, PATCH memperbarui sebagian, PUT mengganti keseluruhan resource bila memang diperlukan, DELETE hanya untuk operasi yang diizinkan.

- Tanggal dikirim sebagai `YYYY-MM-DD`; timestamp dikirim sebagai ISO 8601/RFC 3339 beserta offset/timezone.

- Backend menjadi sumber kebenaran untuk validasi hak akses, status final, duplikasi, konflik jadwal, perhitungan, dan audit.

- Frontend tidak mengasumsikan urutan field atau data statis; semua daftar master dan data operasional dimuat dari API.

- Kontrak OpenAPI/Swagger disepakati sebelum integrasi intensif agar mock API dan frontend dapat berjalan paralel.

## 10.2 Konfigurasi lingkungan frontend

| **VARIABEL**          | **TUJUAN**                                     | **CONTOH**                                     |
|-----------------------|------------------------------------------------|------------------------------------------------|
| VITE_API_BASE_URL     | Alamat dasar API pada tiap environment.        | https://api-sekolah.example.id/api/v1          |
| VITE_APP_NAME         | Nama aplikasi yang ditampilkan.                | Administrasi Sekolah                           |
| VITE_DEFAULT_TIMEZONE | Zona waktu tampilan bila tidak dikirim server. | Asia/Jakarta                                   |
| VITE_ENABLE_MOCK_API  | Mengaktifkan mock untuk pengembangan UI lokal. | true pada local; false pada staging/production |

Nilai rahasia seperti client secret, password database, atau private key tidak boleh disimpan pada variabel VITE_\* karena nilai tersebut masuk ke bundle frontend.

## 10.3 Standar autentikasi yang diusulkan

Opsi baseline: endpoint login mengembalikan access token berumur pendek dan refresh token dikelola melalui cookie HttpOnly, Secure, SameSite sesuai topologi deployment. Request API menggunakan `Authorization: Bearer <accessToken>`. Jika backend memilih session cookie, frontend menyediakan lapisan API client yang dapat disesuaikan tanpa mengubah komponen halaman.

Kesepakatan yang wajib dikonfirmasi tim backend: mekanisme refresh, masa berlaku access token, endpoint logout, perilaku 401/403, CSRF jika cookie digunakan, dan apakah satu akun dapat login di beberapa perangkat.

## 10.4 Format response konsisten

Contoh response sukses untuk data tunggal:

```json
{
  "data": {
    "id": "att_123",
    "studentId": "std_456",
    "studentName": "Nama Siswa",
    "classId": "cls_01",
    "attendanceDate": "2026-11-06",
    "shiftCode": "MORNING",
    "status": "SICK",
    "note": "Demam"
  }
}
```

Contoh response list dengan paginasi:

```json
{
  "data": [{ "id": "std_456", "name": "Nama Siswa" }],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 120, "totalPages": 6 }
}
```

Contoh response error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Status absensi wajib dipilih.",
    "details": { "status": "required" },
    "requestId": "req_abc123"
  }
}
```

## 10.5 Konvensi status dan enum

| **DOMAIN**       | **NILAI API YANG DISARANKAN**                                           | **LABEL UI**                                                       |
|------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------|
| Shift            | MORNING, AFTERNOON, atau kode konfigurasi                               | Pagi, Siang, atau nama shift sekolah                               |
| Absensi          | PRESENT, SICK, PERMISSION, ABSENT, LATE, LEFT_EARLY, EXCUSED            | Hadir, Sakit, Izin, Alpa, Terlambat, Pulang Lebih Awal, Dispensasi |
| Status record    | DRAFT, SUBMITTED, FINAL, REJECTED, CANCELLED                            | Draft, Dikirim, Final, Ditolak, Dibatalkan                         |
| Jenis kepulangan | NORMAL, EARLY_LEAVE, TEMPORARY_EXIT                                     | Pulang Normal, Pulang Lebih Awal, Izin Keluar                      |
| Role             | ADMIN, PRINCIPAL, TEACHER, DUTY_TEACHER, HOMEROOM, ACTIVITY_COORDINATOR | Admin/TU, Pimpinan, Guru, Guru Piket, Wali Kelas, Koordinator      |

Enum di atas adalah kontrak usulan. Jika sekolah membutuhkan kategori tambahan seperti DINAS_LUAR atau DISPENSATION, backend perlu mengembalikan label dan metadata konfigurasi atau tim menyepakati enum baru sebelum rilis.

## 10.6 Daftar endpoint usulan

| **METHOD & PATH**                                  | **KEGUNAAN / PARAMETER UTAMA**                                      |
|----------------------------------------------------|---------------------------------------------------------------------|
| POST /auth/login                                   | Login pengguna.                                                     |
| POST /auth/refresh                                 | Memperbarui access token/sesi.                                      |
| POST /auth/logout                                  | Mengakhiri sesi.                                                    |
| GET /auth/me                                       | Profil, role, dan permissions.                                      |
| GET /academic-years                                | Daftar tahun ajaran; filter active.                                 |
| GET /classes                                       | Daftar kelas; filter academicYearId, shiftCode, status.             |
| GET /students                                      | Daftar siswa; filter classId, search, active, page, pageSize.       |
| GET /teachers                                      | Daftar guru; filter search, subjectId, active.                      |
| GET /subjects                                      | Daftar mata pelajaran.                                              |
| GET /timetables                                    | Jadwal; filter date, classId, teacherId, shiftCode.                 |
| GET /student-attendance/sessions                   | Sesi absensi; filter date, classId, shiftCode.                      |
| GET /student-attendance/sessions/{id}/records      | Roster dan status absensi satu sesi.                                |
| PUT /student-attendance/sessions/{id}/records:bulk | Simpan/update absensi banyak siswa dalam satu permintaan.           |
| PATCH /student-attendance/records/{id}             | Koreksi satu record absensi.                                        |
| GET /student-attendance/absentees                  | Daftar siswa tidak hadir; filter dateFrom, dateTo, classId, status. |
| POST /student-dismissals                           | Catat kepulangan siswa.                                             |
| GET /student-dismissals                            | Histori kepulangan; filter date, classId, studentId.                |
| GET /teacher-attendance                            | Rekap/status kehadiran guru.                                        |
| POST /teacher-attendance/check-in                  | Check-in guru yang sedang login.                                    |
| POST /teacher-attendance/check-out                 | Check-out guru yang sedang login.                                   |
| PATCH /teacher-attendance/{id}                     | Koreksi status/waktu guru oleh role berwenang.                      |
| GET /duty-agendas                                  | Daftar agenda piket; filter date, shiftCode.                        |
| POST /duty-agendas                                 | Buat agenda piket harian.                                           |
| PATCH /duty-agendas/{id}                           | Simpan draft/perbarui agenda.                                       |
| POST /duty-agendas/{id}/submit                     | Kirim/finalisasi agenda sesuai workflow.                            |
| GET /teaching-logs                                 | Daftar jurnal mengajar; filter date, teacherId, classId.            |
| POST /teaching-logs                                | Buat jurnal mengajar.                                               |
| PATCH /teaching-logs/{id}                          | Ubah jurnal sesuai hak akses/status.                                |
| GET /substitution-slots                            | Daftar slot jam kosong yang perlu ditangani.                        |
| POST /substitution-records                         | Tetapkan guru pengganti dan periode.                                |
| GET /extra-activities                              | Daftar kegiatan kursus/jam tambahan.                                |
| POST /extra-activities                             | Buat kegiatan tambahan.                                             |
| GET /reports/attendance-summary                    | Ringkasan absensi; filter periode, kelas, shift, status.            |
| GET /reports/teacher-attendance                    | Laporan absensi guru.                                               |
| GET /reports/teaching-logs                         | Laporan agenda mengajar.                                            |
| GET /reports/substitutions                         | Laporan jam kosong dan pengganti.                                   |
| GET /reports/export                                | Ekspor mengikuti filter; parameter format=xlsx\|csv\|pdf.           |
| GET /audit-logs                                    | Riwayat perubahan; filter entity, actorId, dateFrom, dateTo.        |

Path endpoint adalah rancangan awal, bukan ketentuan implementasi. Nama resource dan nested route dapat disesuaikan backend, selama kontrak dan contoh payload disepakati serta didokumentasikan.

## 10.7 Contoh payload absensi massal

```http
PUT /student-attendance/sessions/{sessionId}/records:bulk
Content-Type: application/json

{
  "records": [
    { "studentId": "std_001", "status": "PRESENT" },
    { "studentId": "std_002", "status": "SICK", "reason": "Demam" },
    { "studentId": "std_003", "status": "PERMISSION", "reason": "Keperluan keluarga" }
  ],
  "submit": true
}
```

Backend perlu menjelaskan apakah operasi bulk bersifat atomik (semua berhasil atau semua gagal), bagaimana error per baris dikembalikan, dan apakah `submit` berarti finalisasi atau hanya menyimpan. Alternatif yang lebih aman adalah endpoint save dan submit yang terpisah.

## 10.8 Kebutuhan dokumentasi dan sandbox backend

- OpenAPI 3.x yang memuat skema request/response, enum, status code, autentikasi, serta contoh error.
- Backend Golang harus mengatur CORS untuk origin frontend local/staging/production yang disetujui, termasuk preflight `OPTIONS`, method/header yang diizinkan, dan `Access-Control-Allow-Credentials` hanya bila mekanisme cookie lintas origin digunakan. Jangan menggunakan wildcard origin bersama credentials.
- Untuk development lokal, frontend Vite dapat memakai `server.proxy` pada prefix `/api` menuju alamat server Go agar URL API konsisten dan mengurangi masalah CORS selama pengembangan. Pada production, utamakan reverse proxy satu origin bila infrastruktur memungkinkan; bila frontend dan API tetap berbeda origin, konfigurasi CORS backend tetap wajib.

- Environment development/staging dengan akun uji untuk setiap role.

- Seed data representatif: kelas pagi/siang, siswa aktif/nonaktif, guru dengan jadwal, guru yang absen, dan slot jam kosong.

- Kontrak paginasi, sorting, filtering, dan format ekspor.

- Kebijakan idempotency atau client request ID untuk mencegah duplikasi saat jaringan terputus dan pengguna mengirim ulang.

- Kebijakan concurrency/version untuk mencegah dua petugas menimpa perubahan yang sama.

# 11. Arsitektur dan Standar Frontend React

## 11.1 Stack yang direkomendasikan

| **LAPISAN**   | **KEPUTUSAN STACK**                                  | **ALASAN / PENERAPAN**                                                                                               |
|---------------|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|
| Framework UI  | React + Vite + TypeScript                            | Fondasi frontend SPA; Vite menangani dev server dan build, TypeScript digunakan untuk seluruh kode aplikasi.         |
| Font UI       | Plus Jakarta Sans                                    | Font utama seluruh aplikasi; gunakan bobot yang diperlukan dan fallback sans-serif sistem.                          |
| Routing       | React Router                                         | Navigasi halaman, nested layout, route guard berdasarkan sesi/permission.                                            |
| Server state  | TanStack Query                                       | Mengelola fetching, caching, invalidation, mutation, retry, loading/error state, dan sinkronisasi data API.          |
| HTTP transport| Fetch API bawaan browser melalui API client terpusat| Tidak menambah library HTTP; satu wrapper menangani base URL, header, autentikasi, error, dan pembatalan request.    |
| Form          | React Hook Form + Zod                                | Form kompleks dan validasi konsisten; skema klien dapat menyelaraskan aturan API.                                    |
| UI components | MUI atau shadcn/ui + Radix                           | Pilih satu sistem utama agar komponen, aksesibilitas, dan tampilan konsisten. Jangan mencampur banyak design system. |
| Testing       | Vitest + React Testing Library; Playwright untuk E2E | Unit/component test dan pengujian alur penting lintas halaman.                                                       |
| Quality       | ESLint + Prettier + TypeScript strict                | Konsistensi, deteksi error, dan review lebih mudah.                                                                  |

**Keputusan HTTP client:** gunakan Fetch API bawaan browser sebagai transport HTTP pada MVP, bukan Axios. Fetch cukup untuk REST API sekolah dan mendukung `AbortSignal` untuk membatalkan request yang tidak lagi dibutuhkan. Semua pemanggilan API harus melalui satu wrapper/service terpusat; komponen UI tidak boleh memanggil `fetch()` langsung. Axios tidak perlu dipasang kecuali kebutuhan teknis nyata di kemudian hari membuat interceptor atau fitur khusus Axios bernilai lebih besar.

**Pembagian tanggung jawab data:** Fetch API bertugas mengirim/menerima HTTP request dan response. TanStack Query mengelola server state seperti cache, stale data, query lifecycle, mutation, retry, dan invalidasi cache. TanStack Query bukan pengganti HTTP transport.

**Font:** gunakan keluarga font `Plus Jakarta Sans` sebagai font utama. Font sebaiknya disediakan melalui asset lokal/self-hosted atau paket font yang disepakati tim, bukan bergantung pada pemanggilan eksternal saat runtime. Gunakan fallback `ui-sans-serif, system-ui, sans-serif` bila font belum termuat.

Rekomendasi UI library dapat diputuskan tim desain. Untuk aplikasi admin dengan banyak tabel dan form, MUI mempercepat komponen siap pakai; shadcn/ui cocok jika tim ingin kontrol visual lebih besar. Pilih satu dan tetapkan design tokens.

### 11.1.1 Konvensi implementasi API client

- Simpan base URL dari `import.meta.env.VITE_API_BASE_URL`; jangan menuliskan URL backend berulang kali di setiap service.
- Buat satu fungsi HTTP terpusat, misalnya `apiFetch<T>()`, untuk mengatur header `Accept`/`Content-Type`, autentikasi sesuai kesepakatan backend, parsing JSON, penanganan response non-2xx, dan format error terstandardisasi.
- Jangan memasang `Content-Type: application/json` untuk request `FormData`; biarkan browser mengatur multipart boundary.
- Teruskan `AbortSignal` dari TanStack Query ke Fetch agar request dapat dibatalkan saat query tidak lagi diperlukan.
- Tangani response `204 No Content` tanpa memaksa parsing JSON.
- Mapping error API ke bentuk konsisten agar komponen dapat menampilkan pesan umum maupun validasi per field.
- Token, cookie, refresh, dan CSRF mengikuti keputusan autentikasi pada Bagian 10.3; jangan mengunci strategi penyimpanan token di komponen halaman.

Contoh pola wrapper (ilustratif; tipe `ApiError` dan schema response disesuaikan dengan kontrak OpenAPI backend):

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    // Teruskan signal dari TanStack Query jika tersedia.
    signal: init.signal,
  });

  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}
```

Contoh pemakaian dengan TanStack Query:

```ts
const studentsQuery = useQuery({
  queryKey: ["students", classId],
  queryFn: ({ signal }) =>
    apiFetch<StudentListResponse>(`/students?classId=${classId}`, { signal }),
});
```

### 11.1.2 Konfigurasi proyek dan standar kode

- Proyek dibuat menggunakan template Vite React TypeScript; seluruh file komponen dan service baru menggunakan TypeScript (`.ts`/`.tsx`), bukan JavaScript (`.js`/`.jsx`), kecuali konfigurasi tooling yang memang mensyaratkannya.
- Aktifkan `strict: true` pada konfigurasi TypeScript dan hindari penggunaan `any`; gunakan `unknown` serta type guard saat bentuk data belum diketahui.
- Pisahkan DTO API, tipe domain, schema validasi, query, mutation, dan komponen UI berdasarkan fitur.
- Gunakan environment terpisah untuk local, staging, dan production. Variabel yang diawali `VITE_` bersifat publik dan akan masuk ke bundle frontend.
- Tetapkan alias import (misalnya `@/`) dan aturan ESLint/Prettier sejak awal agar struktur kode konsisten.
- Jangan mengikat komponen ke alamat atau bentuk response backend yang belum disepakati; gunakan mock service berbasis kontrak yang sama selama API Golang belum tersedia.

## 11.2 Struktur folder berbasis fitur

```text
src/
├── app/                   # Router, providers, app shell, route guards
├── components/            # Komponen bersama: table, modal, status badge
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── master-data/
│   ├── student-attendance/
│   ├── student-dismissal/
│   ├── teacher-attendance/
│   ├── duty-agenda/
│   ├── teaching-logs/
│   ├── substitutions/
│   ├── extra-activities/
│   └── reports/
├── lib/                   # API client, date, permissions, error mapping
├── hooks/                 # Hooks lintas fitur
├── types/                 # Tipe bersama dari kontrak API
├── config/                # Environment dan konfigurasi aplikasi
├── styles/                # Tokens dan global styles
└── main.tsx
```

## 11.3 Prinsip implementasi UI

- Komponen halaman tidak memanggil endpoint secara langsung; gunakan service/query per fitur.

- Gunakan TypeScript type untuk DTO API dan model tampilan yang dibedakan bila perlu.

- Gunakan server state untuk data API; gunakan local state hanya untuk interaksi UI sementara.

- Form mendukung loading, disabled, validation message, success feedback, dan unsaved changes.

- Tampilkan skeleton/loading pada pemuatan pertama dan state kosong yang informatif.

- Untuk aksi massal, tampilkan jumlah record yang akan disimpan serta error tiap baris bila API menyediakan.

- Jangan menghitung ulang angka laporan secara independen jika backend mengirim angka resmi; frontend boleh melakukan agregasi ringan untuk visualisasi namun harus konsisten.

- Gunakan format tanggal Indonesia dan zona waktu sekolah; jangan memformat timestamp UTC sebagai tanggal lokal tanpa konversi.

- Buat komponen tabel adaptif: desktop tabel penuh, ponsel kartu/daftar ringkas dengan aksi utama.

## 11.4 Strategi state dan sinkronisasi

| **JENIS DATA**             | **STRATEGI**                                                                                                            |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------|
| Data master dan jadwal     | Cache TanStack Query; invalidasi setelah create/update; stale time dapat lebih panjang.                                 |
| Absensi harian             | Fetch berdasarkan sessionId; simpan draft melalui mutation; invalidasi ringkasan dan daftar tidak hadir setelah sukses. |
| Form yang belum dikirim    | State lokal/form; konfirmasi sebelum meninggalkan halaman jika ada perubahan belum tersimpan.                           |
| Dashboard dan laporan      | Query dengan key berdasarkan filter; refresh saat filter berubah atau setelah mutation terkait.                         |
| Autentikasi dan permission | Auth provider/context; muat `me` setelah login/refresh; route guard dan conditional action.                           |

# 12. Kebutuhan Nonfungsional

| **AREA**           | **KEBUTUHAN**                                                                                                                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Responsif          | Mendukung ponsel mulai lebar 360 px, tablet, dan desktop. Alur input absensi harus tetap nyaman di layar sentuh.                                                                                       |
| Performa frontend  | Pemuatan awal dashboard pada jaringan sekolah yang wajar ditargetkan ≤ 3 detik untuk dataset normal; tabel menggunakan paginasi/virtualisasi bila roster besar. Angka perlu diverifikasi pada staging. |
| Performa API       | Target awal API p95 ≤ 2 detik untuk operasi baca/tulis umum di staging pada beban yang disepakati; laporan besar dapat berjalan sebagai proses ekspor terpisah.                                        |
| Keamanan           | HTTPS; token/sesi dikelola aman; backend menegakkan authorization per resource; hindari menyimpan rahasia di bundle; proteksi XSS/CSRF mengikuti mekanisme auth.                                       |
| Privasi            | Batasi data kontak siswa/wali; tampilkan hanya pada role yang membutuhkan; jangan menampilkan nomor telepon lengkap di dashboard umum.                                                                 |
| Auditabilitas      | Catat aktor, timestamp, aksi, objek, perubahan, dan alasan untuk koreksi data operasional.                                                                                                             |
| Keandalan          | Pesan error mudah dipahami; retry untuk kegagalan jaringan yang aman; cegah pengiriman ganda; tampilkan status koneksi dan status simpan.                                                              |
| Aksesibilitas      | Kontras memadai, label input, navigasi keyboard, fokus terlihat, pembaca layar untuk status, dan jangan memakai warna sebagai satu-satunya indikator.                                                  |
| Bahasa dan lokal   | Bahasa Indonesia; format tanggal lokal; timezone default Asia/Jakarta; dukung konfigurasi zona waktu bila sekolah berbeda.                                                                             |
| Browser            | Target browser modern: Chrome, Edge, Firefox, Safari versi yang masih didukung vendor.                                                                                                                 |
| Pemeliharaan       | Komponen modular, logging frontend bebas data sensitif, error monitoring, dokumentasi setup dan environment.                                                                                           |
| Backup dan retensi | Backend/sekolah menetapkan kebijakan backup, retensi, arsip, dan penghapusan sesuai peraturan serta kebutuhan operasional.                                                                             |

## 12.1 Ketahanan koneksi

MVP diasumsikan menggunakan koneksi internet/intranet aktif. Frontend wajib mempertahankan input yang belum tersimpan selama halaman masih terbuka, memberikan peringatan saat koneksi gagal, dan mencegah submit berulang yang tidak disengaja. Mode offline penuh dengan antrean sinkronisasi, resolusi konflik, dan enkripsi penyimpanan lokal direkomendasikan sebagai P1 setelah infrastruktur jaringan sekolah diuji.

## 12.2 Privasi dan pengelolaan data siswa

- Kumpulkan data siswa/wali sebatas yang dibutuhkan untuk absensi dan kepulangan.

- Kontak wali dan pihak penjemput hanya dapat dilihat oleh role yang berwenang.

- Jangan menaruh data pribadi siswa di URL, log analitik, atau pesan error.

- Lampiran bukti sakit/izin, jika diaktifkan, memerlukan pembatasan akses dan kebijakan retensi yang jelas.

- Perubahan kelas, status aktif, dan identitas siswa perlu histori efektif agar rekap periode lalu tidak berubah akibat pembaruan master.

# 13. Laporan, Rekap, dan Keluaran

| **LAPORAN**                          | **DIMENSI FILTER**                                    | **ISI MINIMUM**                                                                         |
|--------------------------------------|-------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Rekap absensi siswa harian           | Tanggal, shift, kelas, status                         | Jumlah siswa, hadir, sakit, izin, alpa, terlambat; daftar nama dan catatan sesuai izin. |
| Rekap absensi siswa bulanan/semester | Rentang tanggal, tahun ajaran, semester, kelas, siswa | Jumlah/persentase hadir, jumlah tiap status, histori per siswa.                         |
| Daftar siswa tidak hadir             | Tanggal/rentang, kelas, shift, status                 | Nama, kelas, status, alasan, kontak/konfirmasi, pihak yang menerima, catatan.           |
| Rekap kepulangan siswa               | Tanggal/rentang, kelas, jenis kepulangan, siswa       | Waktu keluar, jenis, pihak penjemput/penerima, petugas.                                 |
| Rekap absensi guru                   | Tanggal/rentang, guru, shift, status                  | Hadir, sakit, izin, alpa, terlambat, check-in/out, alasan.                              |
| Agenda guru piket                    | Tanggal, shift, petugas                               | Daftar guru, ketidakhadiran dan alasan, jam terdampak, catatan penting.                 |
| Agenda kegiatan mengajar             | Tanggal/rentang, guru, kelas, mapel, shift            | Materi, aktivitas, pertemuan, jumlah periode, status/pengesahan.                        |
| Jam kosong dan guru pengganti        | Tanggal/rentang, kelas, mapel, guru                   | Guru berhalangan, slot kosong, pengganti, jumlah jam terdampak/tertangani.              |
| Kursus/jam tambahan                  | Tanggal/rentang, kegiatan, kelas, pengampu            | Materi, kelas, pengampu, keterangan, presensi tambahan.                                 |

## 13.1 Kebutuhan tampilan cetak

Aplikasi perlu menyediakan print view yang menyerupai susunan buku agar administrasi sekolah tidak kehilangan bentuk dokumen yang sudah dikenal. Print view minimal memuat kop sekolah yang dapat dikonfigurasi, nama formulir, tanggal/shift, kolom utama, ruang pengesahan, dan ringkasan jumlah. Tampilan cetak tidak harus meniru tulisan tangan atau layout persis setiap buku, tetapi harus mempertahankan informasi dan urutan kerja yang sama.

## 13.2 Ekspor

- XLSX/CSV untuk analisis lanjutan dan pengolahan data sekolah.

- PDF untuk arsip dan dokumen yang memerlukan pengesahan/cetak.

- Ekspor menghormati filter aktif, role, dan permission pengguna.

- Nama file memuat jenis laporan, periode, dan tanggal pembuatan; contoh: `rekap-absensi-siswa-2026-11.xlsx`.

# 14. Kriteria Penerimaan MVP

| **ID UJI** | **SKENARIO**                                                                       | **HASIL YANG DIHARAPKAN**                                                                              |
|------------|------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| AC-01      | Admin membuat tahun ajaran, kelas, siswa, guru, mata pelajaran, shift, dan jadwal. | Master tersimpan dan dapat dipilih pada modul absensi/jurnal.                                          |
| AC-02      | Guru piket membuka absensi kelas dan menandai semua siswa hadir.                   | Roster lengkap terisi Hadir; pengguna dapat mengubah sebagian siswa menjadi Sakit/Izin/Alpa/Terlambat. |
| AC-03      | Guru piket menyimpan absensi yang sama dua kali karena koneksi lambat.             | Tidak ada duplikasi siswa pada sesi yang sama; UI menampilkan status penyimpanan.                      |
| AC-04      | Pengguna membuka daftar siswa tidak hadir setelah absensi dikirim.                 | Daftar otomatis menampilkan siswa berstatus bukan Hadir sesuai filter.                                 |
| AC-05      | Petugas mencatat nomor yang dihubungi dan pihak yang menerima informasi.           | Informasi tersimpan dan hanya terlihat oleh role yang berhak.                                          |
| AC-06      | Petugas mencatat kepulangan siswa lebih awal.                                      | Record waktu keluar dan jenis kepulangan tersimpan terpisah dari absensi masuk.                        |
| AC-07      | Guru melakukan check-in dan check-out.                                             | Waktu tersimpan dan histori kehadiran dapat dilihat.                                                   |
| AC-08      | Guru tidak hadir dan piket mencatat alasannya.                                     | Status, alasan, dan jam terdampak masuk ke rekap guru tidak hadir.                                     |
| AC-09      | Piket menetapkan guru pengganti pada slot kosong.                                  | Aplikasi memeriksa konflik jadwal dan memperbarui status slot menjadi tertangani setelah tersimpan.    |
| AC-10      | Guru mengisi jurnal mengajar.                                                      | Kelas, mapel, materi, aktivitas, periode, dan tanggal muncul pada histori dan laporan.                 |
| AC-11      | Piket memfinalisasi agenda harian.                                                 | Status agenda berubah menjadi Final; koreksi memerlukan hak akses dan meninggalkan audit trail.        |
| AC-12      | Pimpinan mengunduh rekap bulanan.                                                  | File berisi data sesuai filter dan angka sesuai data detail.                                           |
| AC-13      | Guru mencoba membuka data kelas yang bukan wewenangnya.                            | UI dan API menolak akses sesuai permission.                                                            |
| AC-14      | API mengembalikan 401, 403, 422, 500, atau koneksi terputus.                       | UI memberi respons yang sesuai, tidak menampilkan stack trace/rahasia, dan memberi langkah pemulihan.  |

## 14.1 Definition of Done frontend

- Halaman berfungsi pada desktop dan ponsel, termasuk loading, empty, error, dan success state.

- Validasi klien tersedia, tetapi error validasi backend tetap ditampilkan pada field yang tepat.

- Permission diterapkan pada route, navigasi, dan aksi; backend tetap menjadi otoritas akhir.

- Query key dan cache invalidation ditetapkan untuk setiap mutation.

- Test unit/component untuk aturan UI kritis dan E2E untuk alur absensi utama tersedia.

- Tidak ada error console kritis, data pribadi pada log, atau secret pada bundle frontend.

- Kontrak endpoint sesuai OpenAPI/sandbox backend dan telah diverifikasi dengan minimal satu akun per role.

# 15. Tahapan Rilis dan Risiko

## 15.1 Tahapan implementasi yang disarankan

| **TAHAP**                       | **HASIL**                                                                                                    | **KETERGANTUNGAN**                                          |
|---------------------------------|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------|
| Tahap 0 — Validasi kebutuhan    | Konfirmasi kebijakan shift, kode absensi, sesi siswa, prosedur kepulangan, role, jadwal, dan format laporan. | Wawancara kepala sekolah, TU, guru piket, wali kelas, guru. |
| Tahap 1 — Fondasi frontend/API  | Login, role, layout, master data, jadwal, API client, OpenAPI, mock data.                                    | API auth dan master data dari tim Go.                       |
| Tahap 2 — Absensi inti          | Absensi siswa, daftar tidak hadir, absensi guru, check-in/out, kepulangan.                                   | Endpoint attendance dan aturan bisnis.                      |
| Tahap 3 — Agenda operasional    | Agenda piket, jurnal mengajar, penanganan jam kosong.                                                        | Endpoint duty, teaching log, substitutions.                 |
| Tahap 4 — Rekap dan pilot       | Dashboard, laporan, ekspor/cetak, audit, UAT dan pelatihan.                                                  | Endpoint laporan/export, data uji, persetujuan sekolah.     |
| Tahap 5 — Pengembangan lanjutan | Kursus/jam tambahan jika bukan P0, notifikasi, offline queue, persetujuan koreksi.                           | Validasi kebutuhan dan integrasi tambahan.                  |

## 15.2 Risiko dan mitigasi

| **RISIKO**                            | **DAMPAK**                                               | **MITIGASI**                                                                            |
|---------------------------------------|----------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Aturan absensi sekolah belum seragam  | Status atau waktu yang dicatat berbeda antar guru/kelas. | Tetapkan SOP dan konfigurasi status/shift sebelum implementasi.                         |
| Data master siswa/guru tidak bersih   | Salah kelas, duplikasi, atau roster tidak akurat.        | Bersihkan data; impor dengan validasi; tetapkan ID unik.                                |
| Jadwal mengajar sering berubah        | Slot jam kosong dan hitungan jam tidak akurat.           | Sediakan pembaruan jadwal dengan tanggal efektif dan audit.                             |
| Koneksi sekolah tidak stabil          | Data gagal terkirim atau terkirim dua kali.              | Autosave draft lokal, idempotency API, retry aman; offline penuh sebagai tahap lanjut.  |
| Petugas lupa finalisasi agenda        | Laporan harian tidak lengkap.                            | Dashboard tugas tertunda, status Draft, pengingat in-app dan prosedur penutupan.        |
| Perubahan data tanpa jejak            | Sulit menyelesaikan sengketa absensi.                    | Audit log wajib dan alur koreksi yang terkontrol.                                       |
| Scope aplikasi terlalu luas pada awal | MVP terlambat dan sulit diuji.                           | Prioritaskan P0; tunda integrasi pesan, biometrik, portal orang tua, dan offline penuh. |

# 16. Asumsi, Keputusan Terbuka, dan Glosarium

## 16.1 Asumsi yang dipakai dalam PRD

- Aplikasi pada tahap awal digunakan oleh satu sekolah/organisasi sekolah; dukungan multi-sekolah dapat dipersiapkan namun bukan kebutuhan MVP.

- Pengguna utama adalah guru, guru piket, wali kelas, TU/admin, dan pimpinan; portal siswa/orang tua bukan bagian MVP.

- Absensi siswa dicatat per kelas dan tanggal/shift/sesi sesuai kebijakan sekolah.

- “Absen pulang” ditafsirkan sebagai pencatatan kepulangan siswa serta check-out guru. Sekolah perlu memastikan apakah kedua proses memang dibutuhkan.

- Kode S/I/A pada buku berarti Sakit/Izin/Alpa; pemetaan harus disetujui sekolah.

- Tanda tangan pada formulir kertas untuk MVP digantikan jejak akun dan timestamp; tanda tangan digital dapat ditambahkan jika diwajibkan.

- Jumlah jam dihitung berbasis periode jadwal, bukan angka bebas saja; override dapat dilakukan oleh role tertentu dengan alasan.

## 16.2 Keputusan yang harus dikonfirmasi sebelum development

| **NO** | **KEPUTUSAN**             | **PERTANYAAN VALIDASI**                                                                                                            |
|--------|---------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| 1      | Cakupan absensi pulang    | Apakah yang dicatat adalah kepulangan siswa, check-out guru, atau keduanya? Apakah harus mencatat penjemput/penerima?              |
| 2      | Model absensi siswa       | Absensi satu kali per hari/shift atau per jam pelajaran? Apakah siswa hadir di awal hari lalu absen per pertemuan juga diperlukan? |
| 3      | Kode status               | Apakah S/I/A berarti Sakit/Izin/Alpa dan apakah perlu dispensasi, dinas luar, terlambat, atau izin keluar?                         |
| 4      | Waktu dan batas terlambat | Jam masuk tiap shift, toleransi keterlambatan, dan apakah waktu ditentukan per kelas/guru?                                         |
| 5      | Penanggung jawab absensi  | Siapa yang mengisi absensi siswa: guru mapel, wali kelas, guru piket, atau kombinasi?                                              |
| 6      | Finalisasi dan koreksi    | Siapa yang boleh mengunci data harian dan menyetujui koreksi setelah final?                                                        |
| 7      | Tanda tangan              | Apakah identitas akun + waktu cukup, atau harus memakai PIN/tanda tangan digital?                                                  |
| 8      | Kontak wali               | Apakah sistem hanya mencatat panggilan/manual contact atau perlu integrasi WhatsApp/SMS?                                           |
| 9      | Kursus/jam tambahan       | Apakah agenda kursus/jam tambahan masuk MVP atau rilis lanjutan? Apakah peserta harus diabsen?                                     |
| 10     | Dokumen laporan           | Format cetak/Excel/PDF apa yang wajib dipakai untuk laporan harian, bulanan, dan semester?                                         |
| 11     | Data awal                 | Apakah daftar siswa, guru, kelas, jadwal tersedia dalam Excel untuk diimpor?                                                       |
| 12     | Deployment                | Aplikasi akan di-host di internet, intranet sekolah, atau keduanya? Bagaimana kualitas koneksi sekolah?                            |

## 16.3 Glosarium

| **ISTILAH**                 | **DEFINISI DALAM APLIKASI**                                                                         |
|-----------------------------|-----------------------------------------------------------------------------------------------------|
| Absensi harian siswa        | Pencatatan status kehadiran siswa pada suatu tanggal dan sesi/shift.                                |
| Absensi pulang / kepulangan | Pencatatan peristiwa siswa meninggalkan sekolah, termasuk waktu dan pihak penerima bila dibutuhkan. |
| Check-in / check-out guru   | Pencatatan waktu mulai dan selesai tugas/kehadiran guru.                                            |
| Guru piket                  | Guru yang mendapat penugasan mengawasi dan mencatat administrasi harian sekolah.                    |
| Agenda piket                | Rekap kegiatan harian guru piket, termasuk kehadiran guru, kejadian, dan jam kosong.                |
| Jurnal mengajar             | Catatan pertemuan pembelajaran: kelas, mapel, materi, aktivitas, periode, dan status.               |
| Jam kosong                  | Slot jadwal pelajaran yang tidak terlaksana oleh guru terjadwal dan perlu penanganan.               |
| Guru pengganti              | Guru yang ditugaskan mengisi slot jam kosong.                                                       |
| Jam tambahan                | Kursus atau kegiatan pembelajaran di luar jadwal reguler.                                           |
| Finalisasi                  | Penandaan bahwa suatu catatan sudah diserahkan/ditutup dan memerlukan hak khusus untuk dikoreksi.   |
| Audit log                   | Histori aktivitas dan perubahan data yang menyimpan pelaku serta waktu.                             |
