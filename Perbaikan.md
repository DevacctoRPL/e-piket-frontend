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

