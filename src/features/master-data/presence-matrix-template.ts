import type { Teacher } from '@/types/entities'

export const DAYS_MON_SAT = [
  { day: 1, short: 'Sen', label: 'Senin', upper: 'SENIN' },
  { day: 2, short: 'Sel', label: 'Selasa', upper: 'SELASA' },
  { day: 3, short: 'Rab', label: 'Rabu', upper: 'RABU' },
  { day: 4, short: 'Kam', label: 'Kamis', upper: 'KAMIS' },
  { day: 5, short: 'Jum', label: 'Jumat', upper: 'JUMAT' },
  { day: 6, short: 'Sab', label: 'Sabtu', upper: 'SABTU' },
] as const

export interface PresenceMatrixCell {
  teacherId: string
  name: string
  code: string
  hasAccount: boolean
}

export interface PresenceMatrixGridRow {
  no: number
  /** Key: 1 = Senin .. 6 = Sabtu */
  cells: Record<number, PresenceMatrixCell | null>
}

export interface ParsedPresenceTeacherItem {
  code: string
  name: string
  attendanceDays: number[]
  attendanceOrder: Record<number, number>
  isExisting: boolean
  existingTeacherId: string | null
  hasAccount: boolean
}

export interface ParsedPresenceMatrixResult {
  items: ParsedPresenceTeacherItem[]
  rowCount: number
  updatedCount: number
  newCount: number
  unlinkedCount: number
}

/**
 * Menyusun baris matriks 6 hari (Senin–Sabtu) dari daftar guru aktif.
 * Mempertahankan urutan baris asli (`attendanceOrder[day]`) sesuai dokumen cetak sekolah.
 */
export function buildPresenceMatrixRows(teachers: Teacher[]): PresenceMatrixGridRow[] {
  const activeTeachers = teachers.filter((t) => t.status === 'ACTIVE')
  const byDay: Record<number, PresenceMatrixCell[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  }

  for (const d of DAYS_MON_SAT) {
    const scheduled = activeTeachers
      .filter((t) => (t.attendanceDays ?? []).includes(d.day))
      .sort((a, b) => {
        const ordA = a.attendanceOrder?.[d.day] ?? 9999
        const ordB = b.attendanceOrder?.[d.day] ?? 9999
        if (ordA !== ordB) return ordA - ordB
        return a.name.localeCompare(b.name, 'id')
      })

    byDay[d.day] = scheduled.map((t) => ({
      teacherId: t.id,
      name: t.name,
      code: t.code ?? t.nip.slice(-3),
      hasAccount: Boolean(t.userId),
    }))
  }

  const maxRows = Math.max(
    0,
    ...DAYS_MON_SAT.map((d) => byDay[d.day]?.length ?? 0),
  )

  const rows: PresenceMatrixGridRow[] = []
  for (let i = 0; i < maxRows; i++) {
    const cells: Record<number, PresenceMatrixCell | null> = {}
    for (const d of DAYS_MON_SAT) {
      cells[d.day] = byDay[d.day]?.[i] ?? null
    }
    rows.push({ no: i + 1, cells })
  }

  return rows
}

function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function escapeHtml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Menghasilkan CSV matriks 6 hari dengan header standar NO,SENIN,KODE,...,SABTU,KODE. */
export function buildPresenceMatrixCSV(teachers: Teacher[]): string {
  const rows = buildPresenceMatrixRows(teachers)
  const header = [
    'NO',
    'SENIN',
    'KODE',
    'SELASA',
    'KODE',
    'RABU',
    'KODE',
    'KAMIS',
    'KODE',
    'JUMAT',
    'KODE',
    'SABTU',
    'KODE',
  ].join(',')

  const lines = rows.map((r) => {
    const cols: string[] = [String(r.no)]
    for (const d of DAYS_MON_SAT) {
      const c = r.cells[d.day]
      cols.push(escapeCsvCell(c?.name ?? ''), escapeCsvCell(c?.code ?? ''))
    }
    return cols.join(',')
  })

  return [header, ...lines].join('\r\n')
}

const EXCEL_CODE_PALETTE = [
  '#fef08a',
  '#fed7aa',
  '#bbf7d0',
  '#bae6fd',
  '#e9d5ff',
  '#fbcfe8',
  '#fde68a',
  '#99f6e4',
  '#c7d2fe',
  '#fecdd3',
]

function excelColorForCode(code: string): string {
  if (!code) return '#ffffff'
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) | 0
  }
  return EXCEL_CODE_PALETTE[Math.abs(hash) % EXCEL_CODE_PALETTE.length] ?? '#fef08a'
}

/**
 * Menghasilkan file Excel (.xls) rapi berformat tabel resmi JADWAL KEHADIRAN GURU
 * sesuai tata letak dokumen cetak SMK Plus Pelita Nusantara Bogor.
 */
export function buildPresenceMatrixExcel(
  teachers: Teacher[],
  meta?: { schoolName?: string; academicYear?: string; semester?: string },
): string {
  const rows = buildPresenceMatrixRows(teachers)
  const schoolName = (meta?.schoolName ?? 'SMK PLUS PELITA NUSANTARA BOGOR').toUpperCase()
  const academicYear = meta?.academicYear ?? '2026-2027'
  const semester = (meta?.semester ?? 'GANJIL').toUpperCase()

  const bodyRowsHtml = rows
    .map((r) => {
      const dayCols = DAYS_MON_SAT.map((d) => {
        const cell = r.cells[d.day]
        const bg = cell?.code ? excelColorForCode(cell.code) : '#ffffff'
        return `<td style="border:1px solid #334155;padding:4px 8px;font-size:10pt;color:#0f172a;">${escapeHtml(cell?.name ?? '')}</td><td style="border:1px solid #334155;padding:4px 6px;text-align:center;font-weight:700;font-size:10pt;background:${bg};color:#0f172a;mso-number-format:'\\@';">${escapeHtml(cell?.code ?? '')}</td>`
      }).join('')
      return `<tr><td style="border:1px solid #334155;padding:4px 6px;text-align:center;font-weight:700;font-size:10pt;background:#fef08a;color:#0f172a;">${r.no}</td>${dayCols}</tr>`
    })
    .join('\n')

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  table { border-collapse: collapse; }
</style>
</head>
<body>
<table>
  <tr>
    <td colspan="13" style="text-align:center;font-size:14pt;font-weight:700;padding:4px;">${escapeHtml(schoolName)}</td>
  </tr>
  <tr>
    <td colspan="13" style="text-align:center;font-size:11pt;font-weight:700;padding:2px;">JADWAL KEHADIRAN GURU — TAHUN AJARAN ${escapeHtml(academicYear)} (SEMESTER ${escapeHtml(semester)})</td>
  </tr>
  <tr>
    <th rowspan="2" style="border:1px solid #1e293b;background:#cbd5e1;padding:6px 8px;font-size:10pt;text-align:center;">NO</th>
    <th colspan="12" style="border:1px solid #1e293b;background:#cbd5e1;padding:6px 8px;font-size:10pt;text-align:center;">HARI</th>
  </tr>
  <tr>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">SENIN</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">SELASA</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">RABU</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">KAMIS</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">JUMAT</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 10px;font-size:10pt;">SABTU</th>
    <th style="border:1px solid #1e293b;background:#e2e8f0;padding:6px 6px;font-size:10pt;">KODE</th>
  </tr>
  ${bodyRowsHtml}
</table>
</body>
</html>`
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim()
}

function extractRawTableRows(content: string): string[][] {
  const trimmed = content.trim()
  if (trimmed.includes('<tr') && trimmed.includes('<td')) {
    const trMatches = [...trimmed.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    return trMatches
      .map((m) => {
        const body = m[1] ?? ''
        const cells = [...body.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        return cells.map((c) => decodeHtmlEntities(c[1] ?? ''))
      })
      .filter((r) => r.length > 0)
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headerCandidate = lines.find((l) => /senin/i.test(l) && /selasa/i.test(l)) ?? lines[0]!
  const delimiter = headerCandidate.includes('\t')
    ? '\t'
    : headerCandidate.split(';').length > headerCandidate.split(',').length
      ? ';'
      : ','

  return lines.map((l) => splitDelimitedLine(l, delimiter))
}

function normalizeTeacherBaseName(name: string): string {
  return (name.split(',')[0] ?? name)
    .toLowerCase()
    .replace(/\b(s\.kom|m\.pd|s\.pd|s\.e|s\.ak|s\.sn|s\.tp|s\.kel|s\.psi|s\.mat|s\.sos|s\.t|s\.h|gr)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Mem-parsing file Excel (.xls HTML) maupun CSV matriks 6 hari (NO | SENIN | KODE | ... | SABTU | KODE),
 * menggabungkan jadwal per guru, dan mencocokkan dengan daftar guru yang sudah ada di sistem.
 */
export function parsePresenceMatrixFile(
  content: string,
  existingTeachers: Teacher[],
): ParsedPresenceMatrixResult {
  const rawRows = extractRawTableRows(content)
  if (rawRows.length === 0) {
    return { items: [], rowCount: 0, updatedCount: 0, newCount: 0, unlinkedCount: 0 }
  }

  // Cari indeks baris header yang memuat SENIN & SELASA
  let headerRowIdx = -1
  let hasLeadingNoCol = true
  for (let i = 0; i < rawRows.length; i++) {
    const upper = rawRows[i]!.map((c) => c.toUpperCase())
    if (upper.includes('SENIN') && upper.includes('SELASA')) {
      headerRowIdx = i
      const seninIdx = upper.indexOf('SENIN')
      hasLeadingNoCol = seninIdx === 1
      break
    }
  }

  const dataRows = headerRowIdx >= 0 ? rawRows.slice(headerRowIdx + 1) : rawRows
  const byKey = new Map<
    string,
    {
      code: string
      name: string
      attendanceDays: number[]
      attendanceOrder: Record<number, number>
    }
  >()

  let validDataRowCount = 0

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const cols = dataRows[rIdx]!
    if (cols.length < 2) continue

    // Cek apakah kolom pertama adalah nomor baris atau apakah baris ini tidak punya kolom NO di HTML rowspan
    const firstIsNumber = /^\d+$/.test(cols[0] ?? '')
    const offset = firstIsNumber ? 1 : hasLeadingNoCol && cols.length >= 13 ? 1 : 0
    const rowNo = firstIsNumber ? Number(cols[0]) : rIdx + 1

    let hasAnyTeacherInRow = false
    for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
      const nameCol = (cols[offset + dayIdx * 2] ?? '').trim()
      const codeCol = (cols[offset + dayIdx * 2 + 1] ?? '').trim().toUpperCase()
      if (!nameCol || nameCol === '-' || /^senin|selasa|rabu|kamis|jumat|sabtu$/i.test(nameCol)) {
        continue
      }
      hasAnyTeacherInRow = true
      const dayOfWeek = dayIdx + 1
      const key = codeCol || `NAME:${normalizeTeacherBaseName(nameCol)}`
      let entry = byKey.get(key)
      if (!entry) {
        entry = {
          code: codeCol,
          name: nameCol,
          attendanceDays: [],
          attendanceOrder: {},
        }
        byKey.set(key, entry)
      } else if (nameCol.length > entry.name.length && !nameCol.includes('R. ')) {
        entry.name = nameCol
      }
      if (!entry.attendanceDays.includes(dayOfWeek)) {
        entry.attendanceDays.push(dayOfWeek)
        entry.attendanceDays.sort((a, b) => a - b)
      }
      if (entry.attendanceOrder[dayOfWeek] === undefined) {
        entry.attendanceOrder[dayOfWeek] = rowNo
      }
    }

    if (hasAnyTeacherInRow) {
      validDataRowCount += 1
    }
  }

  const items: ParsedPresenceTeacherItem[] = []
  let updatedCount = 0
  let newCount = 0
  let unlinkedCount = 0

  for (const entry of byKey.values()) {
    const normBase = normalizeTeacherBaseName(entry.name)
    const matched = existingTeachers.find(
      (t) =>
        (entry.code && (t.code ?? '').toUpperCase() === entry.code) ||
        (entry.code && t.nip.toUpperCase() === entry.code) ||
        normalizeTeacherBaseName(t.name) === normBase,
    )

    const isExisting = Boolean(matched)
    const hasAccount = Boolean(matched?.userId)
    if (isExisting) updatedCount += 1
    else newCount += 1
    if (!hasAccount) unlinkedCount += 1

    items.push({
      code: entry.code,
      name: entry.name,
      attendanceDays: entry.attendanceDays,
      attendanceOrder: entry.attendanceOrder,
      isExisting,
      existingTeacherId: matched?.id ?? null,
      hasAccount,
    })
  }

  return {
    items,
    rowCount: validDataRowCount,
    updatedCount,
    newCount,
    unlinkedCount,
  }
}

