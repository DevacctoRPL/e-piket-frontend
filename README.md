# E-Piket — Frontend Sistem Administrasi Harian Sekolah

SPA berbasis peran yang menggantikan buku agenda piket, buku siswa tidak hadir, agenda mengajar, buku kursus/jam tambahan, dan rekap guru/jam kosong. Spesifikasi lengkap ada di `PRD_Sistem_Administrasi_Sekolah_React_Golang (1).md`.

Backend Golang belum tersedia, jadi seluruh aplikasi berjalan di atas **mock API (MSW)**. Mock ini mengikuti kontrak REST di PRD §10.

## Stack

- **Dasar:** React 19, TypeScript strict, Vite 6, React Router 7
- **Data:** TanStack Query 5, TanStack Table 8
- **Form:** React Hook Form, Zod
- **UI:** Tailwind CSS 4, shadcn/ui (Radix), lucide-react, sonner
- **Mock:** MSW 2
- **Test:** Vitest + Testing Library (unit/komponen), Playwright (E2E)

## Persyaratan

- Node.js **≥ 20.19**
- npm 10+

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:5173
```

### Akun demo (mock API)

Semua akun memakai kata sandi `password`. Di halaman login juga ada tombol pintas untuk mengisi akun demo.

| Username | Peran |
|---|---|
| `admin` | Admin / TU |
| `kepsek` | Kepala Sekolah / Wakasek (pimpinan) |
| `piket` | Guru + Guru Piket |
| `guru` | Guru mapel |
| `walikelas` | Guru + Wali Kelas |
| `koordinator` | Koordinator kegiatan tambahan |

Data mock disimpan di `localStorage` (`epiket-mock-db-v1`) dan dibuat relatif terhadap tanggal hari ini. Untuk kembali ke data awal, pilih **Reset data demo** di menu pengguna.

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Dev server dengan mock API |
| `npm run build` | Typecheck + build produksi ke `dist/` |
| `npm run preview` | Menjalankan hasil build |
| `npm run typecheck` | `tsc` tanpa emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest (unit, komponen, dan handler mock) |
| `npm run test:e2e` | Playwright; menyalakan dev server otomatis |

Sebelum test E2E pertama kali, pasang browser Playwright dengan `npx playwright install chromium`.

## Variabel lingkungan

Salin `.env.example` menjadi `.env.local` bila perlu mengubahnya.

| Variabel | Default | Keterangan |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Basis URL API. Gunakan path relatif agar lewat proxy. |
| `VITE_APP_NAME` | `Administrasi Sekolah` | Nama aplikasi di UI dan kop cetak |
| `VITE_DEFAULT_TIMEZONE` | `Asia/Jakarta` | Zona waktu sekolah untuk tanggal "hari ini" dan jam |
| `VITE_ENABLE_MOCK_API` | `true` | `true` = MSW di browser; `false` = backend sungguhan |

## Beralih ke backend Golang

1. Jalankan backend di `http://localhost:8080` dengan prefix `/api/v1`.
2. Set `VITE_ENABLE_MOCK_API=false` di `.env.local`.
3. Jalankan `npm run dev`. `vite.config.ts` sudah mem-proxy `/api` ke `http://localhost:8080`, jadi cookie refresh (HttpOnly) tetap first-party dan tidak perlu konfigurasi CORS.

Kontrak yang diharapkan frontend (PRD §10):

- **Envelope respons:**
  - sukses tunggal: `{ data }`
  - daftar: `{ data, meta: { page, pageSize, totalItems, totalPages } }`
  - error: `{ error: { code, message, details, requestId } }`
- **Format:**
  - field memakai camelCase
  - tanggal `YYYY-MM-DD`
  - timestamp RFC 3339 dengan offset (`+07:00`)
- **Autentikasi:**
  - `POST /auth/login` mengembalikan `accessToken`. Token disimpan di memori saja.
  - `POST /auth/refresh` memakai cookie HttpOnly. Dipanggil saat aplikasi dimuat dan saat menerima 401.
  - `GET /auth/me` mengembalikan `roles[]`, `permissions[]`, `teacherId`, `homeroomClassIds`, `teachingClassIds`.
- **Validasi:** respons `422` berisi `details` per field. Untuk bulk, kuncinya berbentuk `records.<i>.<field>`; frontend memetakannya ke field form.
- **Konflik:**
  - `409 CONFLICT` / `SCHEDULE_CONFLICT` untuk bentrok, misalnya guru pengganti yang sudah mengajar di jam itu
  - `409 VERSION_CONFLICT` untuk optimistic locking
  - `409 ALREADY_FINAL` untuk record yang sudah final
- **Idempotensi:** mutasi penting mengirim header `Idempotency-Key` (AC-03).
- **Hak akses:** backend tetap wajib menegakkan otorisasi. Permission di frontend hanya untuk menyembunyikan menu dan aksi.

Daftar endpoint dan bentuk DTO ada di `src/types/entities.ts` dan `src/mocks/handlers/*`. Handler mock inilah spesifikasi yang bisa dijalankan.

## Struktur

```
src/
  app/           router, AppShell (sidebar / bottom nav), guard auth & permission, error boundary
  components/    ui/ (shadcn) + komponen bersama: DataTable adaptif, StatusBadge, FilterBar,
                 PrintDocument, ExportMenu, ConfirmDialog, UnsavedChangesGuard, dll.
  features/<x>/  api.ts · queries.ts (query key + invalidasi) · schemas.ts (Zod) · pages/ · components/
  lib/           api-client (apiFetch, refresh 401, idempotency), error-mapping, date (Asia/Jakarta),
                 enums (label + tone), permissions (matriks §4.1), export
  mocks/         db (persist localStorage), seed, domain (aturan bisnis bersama), handlers per fitur
  types/         kontrak API dan entitas
e2e/             test Playwright
```

## Catatan

- **Cetak dan PDF:** halaman cetak (agenda piket, siswa tidak hadir, laporan) memakai CSS print A4. Untuk PDF, gunakan "Simpan sebagai PDF" di dialog cetak browser.
- **Privasi:** nomor telepon wali dimask untuk peran tanpa `student_contact:read`, dan data siswa tidak dimasukkan ke URL.
