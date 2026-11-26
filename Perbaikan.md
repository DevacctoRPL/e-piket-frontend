# Daftar Perbaikan (Bug & UI Audit Log)

## [HIGH] Penambahan Fitur CRUD Lengkap & Tambah Akun Massal Berbasis Template pada Kelola Pengguna
- **Location:** `src/features/users/pages/users-page.tsx`, `src/features/users/components/user-bulk-dialog.tsx`, `src/features/users/components/user-delete-dialog.tsx`, `src/features/users/bulk-template.ts`, `src/mocks/handlers/users.ts`, `src/mocks/handlers/users-rules.ts`
- **Severity:** High (Operational Efficiency & Feature Completeness)
- **Status:** Resolved
- **Root Cause:** Sebelumnya operator harus menginput akun guru satu per satu dan menautkan guru secara manual, serta belum tersedia aksi hapus akun maupun aksi massal pada tabel Kelola Pengguna.
- **Solution:** Menambahkan fitur **Tambah Massal (Upload Template CSV)** dengan unduhan template siap pakai (kosong maupun otomatis terisi guru belum berakun), validasi pratinjau per baris, *auto-link* / *auto-create* Data Master Guru berdasarkan NIP, unduhan CSV kredensial kata sandi sementara sekali pakai, aksi **Hapus Akun** satuan, dan *checkbox* pemilihan baris untuk **Aktifkan / Nonaktifkan / Hapus Massal**, sembari mempertahankan tombol **Tambah Akun** satuan untuk guru baru.
- **Target Deadline:** 2026-11-11 (Selesai)

## [HIGH] Duplikasi Indikator Visual & Penyalahgunaan Komponen StatusBadge untuk Metadata/Navigasi (UI AI Slop)
- **Location:** `src/components/status-badge.tsx`, `src/components/kpi-card.tsx`, `src/features/dashboard/pages/dashboard-page.tsx`, `src/features/dashboard/components/today-card.tsx`, `src/features/master-data/components/duty-tab.tsx`, `src/features/teaching-logs/components/teaching-log-form.tsx`
- **Severity:** High (UX / Visual Hierarchy & Semantic Clarity)
- **Status:** Resolved
- **Root Cause:** Komponen `ToneBadge` sebelumnya memaksakan bentuk pil pastel `rounded-full` dengan titik indikator (`dot`) pada seluruh pemanggil, dan digunakan sekaligus untuk status operasional, identitas peran statis (`Guru`, `Guru Piket`), badge ber-ikon (`Bertugas piket`), kalimat panjang pada form jurnal, hingga tautan navigasi (`Detail ->`).
- **Solution:** Memisahkan desain `StatusBadge`/`ToneBadge` (`rounded-md` tanpa titik otomatis, satu indikator ikon/teks) dari `MetaTag` monokrom netral, menampilkan peran di subjudul Dashboard sebagai teks terstruktur, merender `"Bertugas piket"` di header `TodayCard` sebagai teks *inline* ber-ikon tunggal, dan mengganti pil `Detail ->` pada kartu metrik sekunder menjadi penunjuk netral `Detail` dengan warna urgensi pada angka utama (`valueClassName`).
- **Target Deadline:** 2026-11-11 (Selesai)

## [HIGH] Tumpukan Toast Error HTTP 500 ("Terjadi kesalahan pada server") Saat Tab Browser Kembali Aktif dari Idle
- **Location:** `vite.config.ts`, `public/mockServiceWorker.js`, `src/mocks/browser.ts`, `src/lib/query-client.ts`
- **Severity:** High (Runtime Reliability / Developer & Demo Experience)
- **Status:** Resolved
- **Root Cause:** Saat tab browser *idle* atau perangkat bangun dari *sleep*, browser menghentikan sementara *thread* Service Worker MSW sehingga himpunan `activeClientIds` di memori menjadi kosong. Ketika jendela kembali fokus, `refetchOnWindowFocus` pada TanStack Query mengirim beberapa *request* `/api/v1/...` yang di-bypass oleh MSW ke server Vite, lalu diteruskan oleh proxy `/api` ke `http://localhost:8080` (backend Go yang tidak aktif) sehingga menghasilkan respons HTTP 500 dan memicu `toast.error` berulang tanpa deduplikasi `id`.
- **Solution:** Menonaktifkan proxy `/api` di `vite.config.ts` kecuali saat `VITE_ENABLE_MOCK_API=false`, memulihkan `clientId` aktif pada `KEEPALIVE_REQUEST` dan *interception* `/api/` di `public/mockServiceWorker.js`, mengirim ulang sinyal `MOCK_ACTIVATE` saat `focus`/`visibilitychange` di `src/mocks/browser.ts`, serta menambahkan `id` deterministik pada `toast.error` di `QueryCache.onError` (`src/lib/query-client.ts`).
- **Target Deadline:** 2026-11-11 (Selesai)

## [HIGH] RedirectIfAuthenticated Mengabaikan Parameter ?next= Saat Login & Terautentikasi
- **Location:** `src/app/guards.tsx`, `src/lib/utils.ts`, `src/features/auth/login-page.tsx`, `src/app/guards.test.tsx`, `src/lib/foundation.test.ts`
- **Severity:** High (Authentication UX & Deep-Link Routing)
- **Status:** Resolved
- **Root Cause:** `RedirectIfAuthenticated` pada `src/app/guards.tsx` merender `<Navigate to="/" replace />` secara permanen setiap kali `status === 'authenticated'`. Ketika pengguna mengakses URL terproteksi (mis. `/absensi-siswa` atau `/jam-kosong`), `RequireAuth` mengarahkan ke `/login?next=...`, namun sesaat setelah `login()` memperbarui status autentikasi, `RedirectIfAuthenticated` membatalkan atau menimpa navigasi `?next=` dari `LoginPage` sehingga pengguna kembali terdorong ke dashboard `/`.
- **Solution:** Mengekstrak helper bersama `safeNextPath` di `src/lib/utils.ts` (menerima path internal diawali `/` sambil menolak protokol eksternal `//`, `/\`, dan loop `/login`) lalu memakainya baik di `RedirectIfAuthenticated` (`useSearchParams`) maupun `LoginPage`, disertai unit test regresi di `src/app/guards.test.tsx` dan `src/lib/foundation.test.ts`.
- **Target Deadline:** 2026-11-13 (Selesai)

## [MEDIUM] Default Filter Halaman Jadwal Mengunci ke "Jadwal Saya" & Ketidakselarasan Selector E2E
- **Location:** `src/features/master-data/pages/schedule-page.tsx`, `e2e/smoke.spec.ts`, `e2e/flows.spec.ts`
- **Severity:** Medium (Usability Guru Piket & E2E Coverage Accuracy)
- **Status:** Resolved
- **Root Cause:** Setelah konsolidasi peran tunggal Guru Piket (`DUTY_TEACHER`), akun piket yang tertaut ke `teacherId` otomatis masuk ke mode filter `'mine'` di `/jadwal` (`SchedulePage`), bukan melihat jadwal sekolah secara keseluruhan sejak awal. Selain itu, beberapa skrip Playwright E2E masih mengacu pada URL lama `/master-data`, heading dashboard generik, tanda `&` alih-alih `/`, serta label dialog lama (`Kegiatan di kelas` dan `Tetapkan pengganti`).
- **Solution:** Mengubah nilai awal `mode` di `SchedulePage` menjadi `'school'` (dengan tetap mempertahankan opsi `'mine'` untuk guru terkait) dan menyelaraskan `e2e/smoke.spec.ts` serta `e2e/flows.spec.ts` terhadap UI aktual (`Jam Kosong / Guru Pengganti`, `/master`, heading dashboard `Selamat ...`, `Kegiatan / materi`, `Simpan pengganti`, dan verifikasi validasi konflik `Bentrok jadwal`).
- **Target Deadline:** 2026-11-13 (Selesai)

## [CRITICAL] Layar "Terjadi kesalahan" Akibat Sesi localStorage Lama (Schema v7) & Akses Tak Aman ROLE_META[r].label
- **Location:** `src/mocks/db.ts`, `src/mocks/handlers/auth.ts`, `src/lib/enums.ts`, `src/app/app-shell.tsx`, `src/features/dashboard/pages/dashboard-page.tsx`, `src/features/super-admin/pages/super-admin-dashboard.tsx`, `src/features/auth/profile-page.tsx`, `src/features/users/pages/users-page.tsx`, `src/features/users/components/user-detail-sheet.tsx`, `src/features/users/components/user-bulk-dialog.tsx`, `src/features/users/bulk-template.ts`
- **Severity:** Critical (Full-Page Runtime Crash pada Render Awal AppShell)
- **Status:** Resolved
- **Root Cause:** Setelah konsolidasi ke peran tunggal `DUTY_TEACHER` dan penghapusan 6 peran lain dari `ROLE_META`, `MOCK_SCHEMA_VERSION` masih tetap `7`. Browser pengguna yang sudah menyimpan `epiket-mock-db-v1` versi `7` dari sesi sebelumnya memuat akun dengan peran lama seperti `SUPER_ADMIN`. Saat `AppShell` dan komponen profil/dashboard mengeksekusi `ROLE_META[r].label`, nilai `undefined.label` melempar `TypeError` sehingga `RouteErrorBoundary` tingkat akar langsung mengambil alih layar dengan pesan *"Terjadi kesalahan"*.
- **Solution:** Menaikkan `MOCK_SCHEMA_VERSION` ke `8` di `src/mocks/db.ts` agar data `localStorage` versi `7` otomatis di-seed ulang ke akun `DUTY_TEACHER`, membersihkan `REFRESH_KEY` yang sudah tidak ditemukan saat `/auth/refresh` di `src/mocks/handlers/auth.ts`, serta mengekstrak helper `roleLabel` dan `formatRoleLabels` di `src/lib/enums.ts` dengan fallback aman untuk menggantikan seluruh pembacaan langsung `ROLE_META[r].label` pada antarmuka pengguna dan generator ekspor.
- **Target Deadline:** 2026-11-13 (Selesai)

## [HIGH] Race Condition Debounce 150ms Pada persist() Mock DB Menghilangkan Mutasi Saat Navigasi Cepat
- **Location:** `src/mocks/db.ts`
- **Severity:** High (Data Persistence Reliability di Mode Mock)
- **Status:** Resolved
- **Root Cause:** `persist()` di `src/mocks/db.ts` menggunakan `setTimeout(..., 150)`. Bila sebuah mutasi (mis. finalisasi absensi siswa) diikuti navigasi penuh atau reload halaman sebelum 150ms berlalu, timer dibatalkan oleh pergantian dokumen sebelum `localStorage.setItem` sempat dieksekusi sehingga data yang baru difinalisasi hilang pada halaman berikutnya.
- **Solution:** Mengganti `setTimeout(..., 150)` dengan koalesensi microtask melalui `queueMicrotask` serta mengekspor `flushPersist()` yang juga dikaitkan ke event `pagehide`, sambil mereset flag `persistDirty` di `resetDb()` dan `setDbForTest()`.
- **Target Deadline:** 2026-11-13 (Selesai)


## [LOW] Ikon Panah Ganda (Double Chevron) Pada Elemen `<select>` Filter & Dialog
- **Location:** `src/features/teacher-attendance/components/teacher-presence-card.tsx`, `src/features/teacher-attendance/components/empty-slot-dialogs.tsx`, `src/features/teaching-logs/pages/teaching-logs-page.tsx`, `src/features/absentees/pages/absentees-page.tsx`, `src/features/absentees/components/absentee-form-dialog.tsx`, `src/features/extra-activities/pages/extra-activities-page.tsx`
- **Severity:** Low (UI Polish / Visual Regression)
- **Status:** Resolved
- **Root Cause:** Elemen `<select>` baru memakai class utilitas `.native-select` (yang menyisipkan chevron SVG kustom lewat `background-image`) tanpa menyertakan class Tailwind `appearance-none`, sehingga panah dropdown bawaan browser ikut dirender berdampingan dengan ikon kustom.
- **Solution:** Menambahkan `appearance-none cursor-pointer` pada seluruh 6 definisi `<select>` ber-class `native-select` agar hanya menampilkan satu ikon panah kustom yang rapi di seluruh browser.
- **Target Deadline:** 2026-11-26 (Selesai)
