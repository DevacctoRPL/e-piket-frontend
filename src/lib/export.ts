import { apiFetch, type QueryParams } from '@/lib/api-client'
import { todayISO } from '@/lib/date'

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

/** Nama jenis laporan (Bahasa Indonesia) per slug API untuk nama file ekspor (PRD §13.2). */
export const REPORT_FILE_SLUGS: Readonly<Record<string, string>> = {
  'student-attendance': 'rekap-absensi-siswa',
  absentees: 'daftar-siswa-tidak-hadir',
  dismissals: 'rekap-kepulangan-siswa',
  'teacher-attendance': 'rekap-absensi-guru',
  'duty-agendas': 'rekap-agenda-piket',
  'teaching-logs': 'rekap-jurnal-mengajar',
  substitutions: 'rekap-jam-kosong',
  'extra-activities': 'rekap-kegiatan-tambahan',
}

/**
 * Nama file sesuai PRD §13.2: <jenis>-<periode>_dibuat-<tanggal-dibuat>.<ext>
 * contoh: rekap-absensi-siswa-2026-11_dibuat-2026-11-08.csv. Server biasanya mengirim nama lewat
 * Content-Disposition; ini hanya cadangan bila header tidak ada.
 */
export function exportFileName(reportSlug: string, period: string, format: ExportFormat): string {
  return `${REPORT_FILE_SLUGS[reportSlug] ?? reportSlug}-${period}_dibuat-${todayISO()}.${format}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

/**
 * GET /reports/export?report=...&format=...&<filter aktif>
 * Ekspor mengikuti filter aktif (PRD §13.2). PDF ditangani via print view (window.print).
 */
export async function exportReport(
  report: string,
  format: Exclude<ExportFormat, 'pdf'>,
  filters: QueryParams,
  fallbackName: string,
) {
  const res = await apiFetch<Response>('/reports/export', {
    method: 'GET',
    query: { ...filters, report, format },
    raw: true,
  })
  const blob = await res.blob()
  downloadBlob(blob, filenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackName)
}

/** Konversi baris ke CSV (RFC 4180) dengan BOM agar Excel membaca UTF-8. */
export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}
