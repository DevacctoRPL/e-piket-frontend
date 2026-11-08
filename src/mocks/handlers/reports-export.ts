/**
 * Ekspor laporan (PRD §13.2, FR-RPT-04): file mengikuti filter aktif & scope role,
 * baris awal memuat judul laporan, periode, dan waktu pembuatan.
 *
 * - CSV: UTF-8 dengan BOM (toCSV dari lib/export).
 * - "xlsx": mock belum memiliki pustaka XLSX → dikirim sebagai tabel HTML yang dibuka Excel
 *   (application/vnd.ms-excel, .xls). Backend Go akan menghasilkan XLSX asli.
 */
import { wallTimeOf } from '@/lib/date'
import {
  ATTENDANCE_META,
  DISMISSAL_META,
  EXTRA_ACTIVITY_TYPE_META,
  RECORD_STATUS_META,
  SUBSTITUTION_SLOT_META,
  TEACHER_ATTENDANCE_META,
  TEACHING_EXECUTION_META,
  TEACHING_PRESENCE_META,
} from '@/lib/enums'
import { REPORT_FILE_SLUGS, toCSV } from '@/lib/export'
import type { ReportSlug } from '@/features/reports/types'
import { ATTENDANCE_STATUSES, TEACHER_ATTENDANCE_STATUSES } from '@/types/entities'
import { db } from '../db'
import { className, subjectName, teacherName } from '../domain'
import { nowTs, type AuthedUser } from '../utils'
import {
  buildAbsenteesReport,
  buildAttendanceReport,
  buildDismissalsReport,
  buildDutyAgendaReport,
  buildExtraActivityReport,
  buildSubstitutionReport,
  buildTeacherAttendanceReport,
  buildTeachingLogReport,
  type ReportParams,
} from './reports-data'

type Cell = string | number | null | undefined

export interface ExportTable {
  title: string
  headers: string[]
  rows: Cell[][]
  /** Baris ringkasan/total di akhir tabel. */
  footer: Cell[][]
}

/** Nama jenis laporan untuk nama file (sumber tunggal: lib/export). */
export const REPORT_FILE_SLUG = REPORT_FILE_SLUGS as Readonly<Record<ReportSlug, string>>

const shiftName = (code: string) => db().shifts.find((s) => s.code === code)?.name ?? code
const time = (ts: string | null | undefined) => (ts ? wallTimeOf(ts) : '')
const pctCell = (v: number | null) => (v === null ? '' : `${String(v).replace('.', ',')}%`)

/** Periode untuk nama file: tanggal tunggal, YYYY-MM (bulan penuh), atau rentang. */
export function periodSlug(p: Pick<ReportParams, 'dateFrom' | 'dateTo'>): string {
  if (p.dateFrom === p.dateTo) return p.dateFrom
  const month = p.dateFrom.slice(0, 7)
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10)
  if (p.dateFrom === `${month}-01` && p.dateTo === last) return month
  return `${p.dateFrom}_${p.dateTo}`
}

function filterSummary(p: ReportParams): string {
  const parts: string[] = []
  if (p.classId) parts.push(`Kelas: ${className(p.classId)}`)
  if (p.shiftCode) parts.push(`Shift: ${shiftName(p.shiftCode)}`)
  if (p.teacherId) parts.push(`Guru: ${teacherName(p.teacherId)}`)
  if (p.subjectId) parts.push(`Mapel: ${subjectName(p.subjectId)}`)
  if (p.studentId) parts.push('Siswa: (dipilih)')
  if (p.statuses.length > 0) parts.push(`Status: ${p.statuses.join(', ')}`)
  if (p.type) parts.push(`Jenis: ${p.type}`)
  if (p.instructorTeacherId) parts.push(`Pengampu: ${teacherName(p.instructorTeacherId)}`)
  if (p.contacted) parts.push(p.contacted === 'true' ? 'Sudah dihubungi' : 'Belum dihubungi')
  if (p.includeDraft) parts.push('Termasuk sesi Draft')
  return parts.join('; ') || 'Semua'
}

const ATT_HEAD = ATTENDANCE_STATUSES.map((s) => ATTENDANCE_META[s].short ?? s)
const TCH_HEAD = TEACHER_ATTENDANCE_STATUSES.map((s) => TEACHER_ATTENDANCE_META[s].short ?? s)

export function buildExportTable(report: ReportSlug, user: AuthedUser, p: ReportParams): ExportTable {
  switch (report) {
    case 'student-attendance': {
      const r = buildAttendanceReport(user, p)
      const first = { class: 'Kelas', student: 'Nama Siswa', date: 'Tanggal' }[r.groupBy]
      const second = { class: 'Keterangan', student: 'NIS · Kelas', date: 'Keterangan' }[r.groupBy]
      return {
        title: 'Rekap Absensi Siswa',
        headers: ['No', first, second, 'Sesi', ...ATT_HEAD, 'Total Record', 'Hadir (H+T)', '% Hadir'],
        rows: r.rows.map((row, i) => [
          i + 1,
          row.label,
          row.sublabel ?? '',
          row.sessions,
          ...ATTENDANCE_STATUSES.map((s) => row.counts[s]),
          row.total,
          row.present,
          pctCell(row.percentPresent),
        ]),
        footer: [
          [
            '',
            'TOTAL',
            '',
            r.totals.sessions,
            ...ATTENDANCE_STATUSES.map((s) => r.totals.counts[s]),
            r.totals.total,
            r.totals.present,
            pctCell(r.totals.percentPresent),
          ],
        ],
      }
    }
    case 'absentees': {
      const r = buildAbsenteesReport(user, p)
      return {
        title: 'Daftar Siswa Tidak Hadir',
        headers: ['No', 'Tanggal', 'Shift', 'Kelas', 'NIS', 'Nama Siswa', 'Status', 'Alasan', 'Catatan', 'Nama Wali', 'Telepon Wali', 'Nomor Dihubungi', 'Penerima Informasi', 'Catatan Konfirmasi', 'Dihubungi Oleh'],
        rows: r.rows.map((x, i) => [
          i + 1,
          x.date,
          shiftName(x.shiftCode),
          x.className,
          x.studentNis,
          x.studentName,
          ATTENDANCE_META[x.status].label,
          x.reason,
          x.note,
          x.guardianName,
          x.guardianPhone,
          x.contact?.contactedPhone,
          x.contact?.receiverName,
          x.contact?.contactNote,
          x.contact?.contactedByName,
        ]),
        footer: [
          ['', 'TOTAL', r.total, '', '', '', ATTENDANCE_STATUSES.filter((s) => r.counts[s] > 0).map((s) => `${ATTENDANCE_META[s].label}: ${r.counts[s]}`).join('; ')],
          ['', 'Sudah dihubungi', r.contacted, '', '', '', `Belum dihubungi: ${r.notContacted}`],
        ],
      }
    }
    case 'dismissals': {
      const r = buildDismissalsReport(user, p)
      return {
        title: 'Rekap Kepulangan Siswa',
        headers: ['No', 'Tanggal', 'Shift', 'Kelas', 'NIS', 'Nama Siswa', 'Jenis', 'Jam Keluar', 'Jam Kembali', 'Penjemput', 'Hubungan', 'Catatan', 'Petugas'],
        rows: r.rows.map((x, i) => [
          i + 1,
          x.date,
          shiftName(x.shiftCode),
          x.className,
          x.studentNis,
          x.studentName,
          DISMISSAL_META[x.type].label,
          time(x.exitTime),
          time(x.returnTime),
          x.pickupName,
          x.pickupRelation,
          x.note,
          x.recordedByName,
        ]),
        footer: [
          ['', 'TOTAL', r.total],
          ...(['NORMAL', 'EARLY_LEAVE', 'TEMPORARY_EXIT'] as const).map((t) => ['', DISMISSAL_META[t].label, r.counts[t]]),
        ],
      }
    }
    case 'teacher-attendance': {
      const r = buildTeacherAttendanceReport(user, p)
      return {
        title: 'Rekap Absensi Guru',
        headers: ['No', 'Nama Guru', 'NIP', ...TCH_HEAD, 'Jumlah Hari', 'Total Menit Terlambat', 'Jam Terdampak'],
        rows: r.teachers.map((t, i) => [
          i + 1,
          t.teacherName,
          t.nip,
          ...TEACHER_ATTENDANCE_STATUSES.map((s) => t.counts[s]),
          t.records,
          t.lateMinutes,
          t.affectedPeriods,
        ]),
        footer: [
          ['', 'TOTAL', '', ...TEACHER_ATTENDANCE_STATUSES.map((s) => r.totals.counts[s]), r.totals.records, r.totals.lateMinutes, r.totals.affectedPeriods],
          [],
          ['RINCIAN HARIAN'],
          ['No', 'Tanggal', 'Nama Guru', 'Shift', 'Status', 'Check-in', 'Check-out', 'Terlambat (menit)', 'Jam Terdampak', 'Alasan'],
          ...r.records.map((a, i) => [
            i + 1,
            a.date,
            a.teacherName,
            shiftName(a.shiftCode),
            TEACHER_ATTENDANCE_META[a.status].label,
            time(a.checkInAt),
            time(a.checkOutAt),
            a.lateMinutes ?? '',
            a.affectedPeriods,
            a.reason,
          ]),
        ],
      }
    }
    case 'duty-agendas': {
      const r = buildDutyAgendaReport(user, p)
      return {
        title: 'Rekap Agenda Guru Piket',
        headers: ['No', 'Tanggal', 'Shift', 'Petugas Piket', 'Status', 'Guru Terjadwal', 'Guru Hadir', 'Guru Tidak Hadir', 'Nama Guru Tidak Hadir', 'Jam Terdampak', 'Jam Tertangani', 'Jumlah Catatan'],
        rows: r.rows.map((x, i) => [
          i + 1,
          x.date,
          x.shiftName,
          x.dutyTeacherNames.join('; '),
          x.status ? RECORD_STATUS_META[x.status].label : 'Belum dibuat',
          x.scheduledTeacherCount,
          x.presentTeacherCount,
          x.absentTeacherCount,
          x.absentTeacherNames.join('; '),
          x.affectedPeriods,
          x.handledPeriods,
          x.notesCount,
        ]),
        footer: [
          ['', 'TOTAL', '', `Final: ${r.totals.final}; Belum final: ${r.totals.notFinal}; Belum dibuat: ${r.totals.notCreated}`, '', '', '', r.totals.absentTeacherCount, '', r.totals.affectedPeriods, r.totals.handledPeriods, r.totals.notesCount],
        ],
      }
    }
    case 'teaching-logs': {
      const r = buildTeachingLogReport(user, p)
      return {
        title: 'Rekap Agenda Kegiatan Mengajar',
        headers: ['No', 'Tanggal', 'Shift', 'Jam ke-', 'JML', 'Kelas', 'Mata Pelajaran', 'Guru', 'Pertemuan ke-', 'Materi', 'Kegiatan', 'Kehadiran Guru', 'Pelaksanaan', 'Alasan Tidak Terlaksana', 'S', 'I', 'A', 'Status'],
        rows: r.rows.map((l, i) => [
          i + 1,
          l.date,
          shiftName(l.shiftCode),
          l.periodStart === l.periodEnd ? l.periodStart : `${l.periodStart}-${l.periodEnd}`,
          l.periodCount,
          l.className,
          l.subjectName,
          l.teacherName,
          l.meetingNumber,
          l.topic,
          l.activity,
          TEACHING_PRESENCE_META[l.teacherPresence].label,
          TEACHING_EXECUTION_META[l.execution].label,
          l.notHeldReason,
          l.studentSick,
          l.studentPermission,
          l.studentAbsent,
          RECORD_STATUS_META[l.status].label,
        ]),
        footer: [
          ['', 'TOTAL JURNAL', r.totals.logs, 'JML terlaksana', r.totals.periods],
          ['', 'Terlaksana', r.totals.held, 'Tidak terlaksana', r.totals.notHeld],
          ['', 'Kelengkapan jurnal', pctCell(r.totals.fillRate), 'Slot terisi / terjadwal', `${r.totals.filledSlots} / ${r.totals.expectedSlots}`],
        ],
      }
    }
    case 'substitutions': {
      const r = buildSubstitutionReport(user, p)
      return {
        title: 'Rekap Jam Kosong dan Guru Pengganti',
        headers: ['No', 'Tanggal', 'Shift', 'Kelas', 'Mata Pelajaran', 'Jam ke-', 'JML', 'Guru Berhalangan', 'Status Guru', 'Guru Pengganti', 'Jam Ditangani', 'Kegiatan', 'Status Slot'],
        rows: r.slots.map((s, i) => [
          i + 1,
          s.date,
          shiftName(s.shiftCode),
          s.className,
          s.subjectName,
          s.periodStart === s.periodEnd ? s.periodStart : `${s.periodStart}-${s.periodEnd}`,
          s.periodCount,
          s.absentTeacherName,
          TEACHER_ATTENDANCE_META[s.absentTeacherStatus].label,
          s.substitution?.substituteTeacherName,
          s.substitution?.periodCount ?? 0,
          s.substitution?.activity,
          SUBSTITUTION_SLOT_META[s.status].label,
        ]),
        footer: [
          ['', 'TOTAL', '', `Slot: ${r.totals.affectedSlots}`, `Tertangani: ${r.totals.handledSlots}`, `Belum: ${r.totals.unhandledSlots}`, r.totals.affectedPeriods, '', '', '', r.totals.handledPeriods],
          ['', 'Jam terdampak', r.totals.affectedPeriods, 'Jam tertangani', r.totals.handledPeriods, 'Jam belum tertangani', r.totals.unhandledPeriods],
        ],
      }
    }
    case 'extra-activities': {
      const r = buildExtraActivityReport(user, p)
      return {
        title: 'Rekap Kursus dan Jam Tambahan',
        headers: ['No', 'Tanggal', 'Shift', 'Waktu', 'Kegiatan', 'Jenis', 'Kelas', 'Pengampu', 'Materi', 'Keterangan', 'Peserta', 'Hadir', 'Status'],
        rows: r.rows.map((a, i) => [
          i + 1,
          a.date,
          shiftName(a.shiftCode),
          a.startTime && a.endTime ? `${a.startTime}-${a.endTime}` : '',
          a.name,
          EXTRA_ACTIVITY_TYPE_META[a.type].label,
          a.classNames.join('; '),
          a.instructorName,
          a.topic,
          a.note,
          a.participantAttendanceEnabled ? a.participantCount : '',
          a.participantAttendanceEnabled ? a.presentCount : '',
          RECORD_STATUS_META[a.status].label,
        ]),
        footer: [['', 'TOTAL', r.totals.activities, '', '', '', '', '', '', '', r.totals.participants, r.totals.present]],
      }
    }
  }
}

function preamble(p: ReportParams): Cell[][] {
  const d = db().settings
  return [
    [d.schoolName],
    ['Periode', p.dateFrom === p.dateTo ? p.dateFrom : `${p.dateFrom} s.d. ${p.dateTo}`],
    ['Filter', filterSummary(p)],
    ['Dibuat pada', nowTs()],
    [],
  ]
}

export function renderCSV(t: ExportTable, p: ReportParams): string {
  return toCSV([t.title], [...preamble(p), t.headers, ...t.rows, ...(t.footer.length ? [[], ...t.footer] : [])])
}

const escHtml = (v: Cell) =>
  (v === null || v === undefined ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Tabel HTML yang dibuka Excel (sel teks dipaksa teks agar NIS/NIP tidak jadi angka ilmiah). */
export function renderExcelHtml(t: ExportTable, p: ReportParams): string {
  const row = (cells: Cell[], tag: 'td' | 'th' = 'td') =>
    `<tr>${cells
      .map((c) =>
        typeof c === 'number' ? `<${tag}>${c}</${tag}>` : `<${tag} style="mso-number-format:'\\@'">${escHtml(c)}</${tag}>`,
      )
      .join('')}</tr>`
  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8"></head><body>',
    `<table><tr><th colspan="${t.headers.length}">${escHtml(t.title)}</th></tr>`,
    ...preamble(p).map((r) => row(r)),
    row(t.headers, 'th'),
    ...t.rows.map((r) => row(r)),
    ...t.footer.map((r) => row(r)),
    '</table></body></html>',
  ].join('')
}
