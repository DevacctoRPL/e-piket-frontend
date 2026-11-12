import { ROLE_META } from '@/lib/enums'
import { toCSV } from '@/lib/export'
import { canGrantRole, TEACHER_LINK_ROLES } from '@/lib/permissions'
import {
  ROLES,
  type BulkCreatedUserResult,
  type BulkTeacherAction,
  type BulkUserItemInput,
  type ID,
  type Role,
  type Teacher,
  type UserAccount,
} from '@/types/entities'
import { USERNAME_RE } from './schemas'

/** Urutan kolom standar TU Sekolah: identitas wajib di depan, kredensial opsional (auto-generate) di kanan. */
export const TEMPLATE_HEADERS = [
  'No',
  'Nama Lengkap *',
  'NIP',
  'Peran',
  'Email',
  'No. Telepon',
  'Username (Opsional)',
  'Kata Sandi Awal (Opsional)',
] as const

export const TEMPLATE_COLUMNS_META = [
  { label: 'No', badge: 'Urut', required: false },
  { label: 'Nama Lengkap', badge: 'Wajib', required: true },
  { label: 'NIP', badge: 'Wajib utk Guru', required: false },
  { label: 'Peran', badge: 'Default: Guru', required: false },
  { label: 'Email', badge: 'Opsional', required: false },
  { label: 'No. Telepon', badge: 'Opsional', required: false },
  { label: 'Username', badge: 'Otomatis', required: false },
  { label: 'Kata Sandi Awal', badge: 'Otomatis', required: false },
] as const

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const NIP_RE = /^[A-Za-z0-9.-]{1,30}$/
const PHONE_RE = /^\+?\d{8,15}$/

const TITLE_STOPWORDS = new Set([
  'drs',
  'dra',
  'ir',
  'prof',
  'h',
  'hj',
  'spd',
  'mpd',
  'skom',
  'mkom',
  'ssi',
  'msi',
  'st',
  'mt',
  'sag',
  'mag',
  'ssos',
  'shum',
  'ssn',
  'gr',
  'spdi',
  'mpdi',
  'se',
  'mm',
  'sh',
])

const ROLE_ALIASES: Readonly<Record<string, Role>> = {
  super_admin: 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  'super admin': 'SUPER_ADMIN',
  admin: 'ADMIN',
  tu: 'ADMIN',
  'admin/tu': 'ADMIN',
  'admin tu': 'ADMIN',
  'tata usaha': 'ADMIN',
  principal: 'PRINCIPAL',
  pimpinan: 'PRINCIPAL',
  kepsek: 'PRINCIPAL',
  'kepala sekolah': 'PRINCIPAL',
  wakasek: 'PRINCIPAL',
  teacher: 'TEACHER',
  guru: 'TEACHER',
  'guru mapel': 'TEACHER',
  duty_teacher: 'DUTY_TEACHER',
  'guru piket': 'DUTY_TEACHER',
  piket: 'DUTY_TEACHER',
  homeroom: 'HOMEROOM',
  'wali kelas': 'HOMEROOM',
  walikelas: 'HOMEROOM',
  activity_coordinator: 'ACTIVITY_COORDINATOR',
  koordinator: 'ACTIVITY_COORDINATOR',
  'koordinator kegiatan': 'ACTIVITY_COORDINATOR',
}

export interface BulkPreviewRow {
  rowNumber: number
  username: string
  usernameAuto: boolean
  name: string
  nip: string
  roles: Role[]
  email: string
  phone: string
  password: string
  teacherId: ID | null
  teacherAction: BulkTeacherAction
  teacherLabel: string
  errors: string[]
  valid: boolean
}

/** Buat username unik otomatis dari nama lengkap dan/atau NIP. */
export function suggestUniqueUsername(
  name: string,
  nip: string | null | undefined,
  takenUsernames: ReadonlySet<string>,
): string {
  const beforeComma = name.split(',')[0] ?? name
  const words = beforeComma
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !TITLE_STOPWORDS.has(w))

  let base = words.slice(0, 2).join('.')
  const cleanNip = (nip ?? '').replace(/[^0-9a-z]/gi, '').toLowerCase()
  if (base.length < 3) {
    base = cleanNip.length >= 3 ? `guru.${cleanNip.slice(-6)}` : `user.${cleanNip || 'baru'}`
  }
  base = base.slice(0, 26).replace(/^[._-]+|[._-]+$/g, '')
  if (base.length < 3) base = 'pengguna'

  if (!takenUsernames.has(base)) return base
  if (cleanNip.length >= 4) {
    const withNip = `${base.slice(0, 22)}.${cleanNip.slice(-4)}`
    if (!takenUsernames.has(withNip)) return withNip
  }
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, 26)}.${i}`
    if (!takenUsernames.has(candidate)) return candidate
  }
  return `${base.slice(0, 22)}.${Date.now().toString(36).slice(-4)}`
}

/** Ubah string peran (mis. "Guru, Guru Piket" atau "TEACHER;HOMEROOM") menjadi Role[] + daftar token tak dikenal. */
export function parseRoleCell(raw: string): { roles: Role[]; unknownTokens: string[] } {
  const cleaned = raw.trim()
  if (!cleaned) return { roles: ['TEACHER'], unknownTokens: [] }

  // Jaga frasa "Admin/TU" agar tidak terpecah oleh pemisah '/'
  const normalized = cleaned.replace(/admin\s*\/\s*tu/gi, 'admin/tu')
  const parts = normalized
    .split(/[,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const found = new Set<Role>()
  const unknownTokens: string[] = []
  for (const part of parts) {
    const key = part.toLowerCase().replace(/\s+/g, ' ')
    const direct = (ROLES as readonly string[]).find((r) => r.toLowerCase() === key) as Role | undefined
    const mapped = direct ?? ROLE_ALIASES[key]
    if (mapped) found.add(mapped)
    else unknownTokens.push(part)
  }

  return {
    roles: ROLES.filter((r) => found.has(r)),
    unknownTokens,
  }
}

function unescapeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function parseHtmlTableRows(html: string): string[][] {
  const rows: string[][] = []
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1] ?? ''
    // Abaikan baris kop/petunjuk yang memakai colspan penuh
    if (/colspan\s*=\s*["']?[2-9]/i.test(rowHtml)) continue
    const cells: string[] = []
    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      const inner = (cellMatch[1] ?? '').replace(/<[^>]+>/g, ' ')
      cells.push(unescapeHtmlEntities(inner).replace(/\s+/g, ' ').trim())
    }
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells)
    }
  }
  return rows
}

/** Deteksi format tabel HTML (.xls) atau delimiter (`,`, `;`, `\t`) dan parse teks menjadi baris-baris sel. */
export function parseDelimitedText(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (/<table\b/i.test(clean) && /<tr\b/i.test(clean)) {
    return parseHtmlTableRows(clean)
  }

  const lines = clean.split('\n')

  // Cari baris non-kosong pertama yang bukan komentar / direktif sep= untuk mendeteksi delimiter
  const firstContentLine = lines.find((l) => {
    const t = l.trim()
    return t.length > 0 && !t.startsWith('#') && !/^sep\s*=/i.test(t)
  })
  if (!firstContentLine) return []

  const countChar = (s: string, ch: string) => {
    let count = 0
    let inQuotes = false
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c === '"') inQuotes = !inQuotes
      else if (!inQuotes && c === ch) count++
    }
    return count
  }

  const tabs = countChar(firstContentLine, '\t')
  const semicolons = countChar(firstContentLine, ';')
  const commas = countChar(firstContentLine, ',')
  const delimiter = tabs > semicolons && tabs > commas ? '\t' : semicolons > commas ? ';' : ','

  const rows: string[][] = []
  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim()
    if (!trimmedLine || trimmedLine.startsWith('#') || /^sep\s*=/i.test(trimmedLine)) continue
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < rawLine.length; i++) {
      const ch = rawLine[i]!
      if (ch === '"') {
        if (inQuotes && rawLine[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur.trim())
    if (cells.some((c) => c.length > 0)) {
      rows.push(cells)
    }
  }
  return rows
}

type ColumnMap = {
  username: number
  name: number
  nip: number
  roles: number
  email: number
  phone: number
  password: number
}

function matchHeaderCells(headerCells: readonly string[]): ColumnMap | null {
  const norm = headerCells.map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
  )

  const findIdx = (candidates: readonly string[]) => norm.findIndex((h) => candidates.includes(h))

  const nameIdx = findIdx([
    'nama_lengkap',
    'nama',
    'name',
    'nama_guru',
    'full_name',
    'pengguna',
    'nama_lengkap_wajib',
  ])
  const usernameIdx = findIdx([
    'username',
    'username_opsional',
    'nama_pengguna',
    'nama_pengguna_opsional',
    'user',
    'akun',
    'login',
  ])
  const nipIdx = findIdx(['nip', 'nomor_pegawai', 'no_pegawai', 'nip_nik', 'nik'])
  const rolesIdx = findIdx(['peran', 'roles', 'role', 'jabatan', 'akses'])
  const emailIdx = findIdx(['email', 'email_opsional', 'surel', 'e_mail'])
  const phoneIdx = findIdx([
    'no_telepon',
    'no_telepon_opsional',
    'telepon',
    'phone',
    'no_hp',
    'hp',
    'nomor_telepon',
    'wa',
  ])
  const passwordIdx = findIdx([
    'kata_sandi_awal_opsional',
    'kata_sandi_awal',
    'kata_sandi',
    'password',
    'password_opsional',
    'sandi',
    'pass',
    'sandi_awal',
  ])

  const matchedCount = [nameIdx, usernameIdx, nipIdx, rolesIdx].filter((i) => i !== -1).length
  if (matchedCount === 0) return null

  return {
    username: usernameIdx,
    name: nameIdx,
    nip: nipIdx,
    roles: rolesIdx,
    email: emailIdx,
    phone: phoneIdx,
    password: passwordIdx,
  }
}

function resolveHeaderAndDataRows(rawRows: readonly string[][]): {
  map: ColumnMap
  dataRows: readonly string[][]
} {
  const maxScan = Math.min(rawRows.length, 10)
  for (let i = 0; i < maxScan; i++) {
    const matched = matchHeaderCells(rawRows[i]!)
    if (matched) {
      return {
        map: matched,
        dataRows: rawRows.slice(i + 1),
      }
    }
  }

  // Tanpa baris header: cek apakah kolom pertama adalah nomor urut (1, 2, 3...) seperti urutan TU baru
  const firstRow = rawRows[0] ?? []
  const startsWithNumber = /^\d{1,4}$/.test((firstRow[0] ?? '').trim()) && firstRow.length >= 4
  if (startsWithNumber) {
    return {
      map: { name: 1, nip: 2, roles: 3, email: 4, phone: 5, username: 6, password: 7 },
      dataRows: rawRows,
    }
  }

  return {
    map: { username: 0, name: 1, nip: 2, roles: 3, email: 4, phone: 5, password: 6 },
    dataRows: rawRows,
  }
}

/**
 * Parse teks CSV/TSV/Excel(.xls) dan validasi setiap baris terhadap daftar akun & data guru yang ada.
 */
export function prepareBulkPreview(
  text: string,
  existingUsers: readonly Pick<UserAccount, 'id' | 'username' | 'teacherId'>[],
  existingTeachers: readonly Pick<Teacher, 'id' | 'nip' | 'name' | 'status' | 'userId'>[],
  actorRoles: readonly Role[],
): BulkPreviewRow[] {
  const rawRows = parseDelimitedText(text)
  if (rawRows.length === 0) return []

  const { map, dataRows } = resolveHeaderAndDataRows(rawRows)

  const takenUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()))
  const seenUsernamesInFile = new Set<string>()
  const seenNipsInFile = new Set<string>()
  const seenTeacherIdsInFile = new Set<string>()

  const teacherByNip = new Map<string, Pick<Teacher, 'id' | 'nip' | 'name' | 'status' | 'userId'>>()
  for (const t of existingTeachers) {
    teacherByNip.set(t.nip.trim().toLowerCase(), t)
  }
  const linkedTeacherIds = new Set(existingUsers.map((u) => u.teacherId).filter((id): id is ID => !!id))

  return dataRows.map((cells, idx) => {
    const get = (colIdx: number) => (colIdx >= 0 && colIdx < cells.length ? (cells[colIdx] ?? '').trim() : '')
    const rawUsername = get(map.username).toLowerCase()
    const name = get(map.name)
    const nip = get(map.nip)
    const rawRoles = get(map.roles)
    const email = get(map.email).toLowerCase()
    const phone = get(map.phone).replace(/[\s-]/g, '')
    const password = get(map.password)

    const errors: string[] = []

    if (!name) errors.push('Nama lengkap wajib diisi.')
    else if (name.length > 120) errors.push('Nama maksimal 120 karakter.')

    const usernameAuto = !rawUsername
    const username = rawUsername || suggestUniqueUsername(name || `baris.${idx + 1}`, nip, takenUsernames)

    if (!USERNAME_RE.test(username)) {
      errors.push('Username harus 3–32 karakter (huruf kecil, angka, titik, garis bawah, tanda hubung).')
    } else if (seenUsernamesInFile.has(username)) {
      errors.push(`Username "${username}" duplikat di dalam file.`)
    } else if (existingUsers.some((u) => u.username.toLowerCase() === username)) {
      errors.push(`Username "${username}" sudah terdaftar.`)
    }
    seenUsernamesInFile.add(username)
    takenUsernames.add(username)

    const { roles, unknownTokens } = parseRoleCell(rawRoles)
    if (unknownTokens.length > 0) {
      errors.push(`Peran tidak dikenal: ${unknownTokens.join(', ')}.`)
    }
    if (roles.length === 0) {
      errors.push('Pilih minimal satu peran.')
    }
    for (const r of roles) {
      if (!canGrantRole(actorRoles, r)) {
        errors.push(`Anda tidak berhak memberikan peran ${ROLE_META[r].label}.`)
      }
    }

    if (email) {
      if (email.length > 120 || !EMAIL_RE.test(email)) {
        errors.push('Format email tidak valid.')
      }
    }

    if (phone && !PHONE_RE.test(phone)) {
      errors.push('Nomor telepon tidak valid (8–15 digit).')
    }

    if (password && (password.length < 8 || password.length > 128)) {
      errors.push('Password awal minimal 8 karakter (atau kosongkan agar dibuat otomatis).')
    }

    const requiresTeacher = roles.some((r) => (TEACHER_LINK_ROLES as readonly Role[]).includes(r))
    let teacherId: ID | null = null
    let teacherAction: BulkTeacherAction = 'NONE'
    let teacherLabel = 'Tanpa tautan'

    const nipKey = nip.toLowerCase()
    if (nip) {
      if (!NIP_RE.test(nip)) {
        errors.push('Format NIP tidak valid (maks. 30 karakter huruf/angka/titik/strip).')
      } else if (seenNipsInFile.has(nipKey)) {
        errors.push(`NIP "${nip}" duplikat di dalam file.`)
      } else {
        seenNipsInFile.add(nipKey)
        const existingTeacher = teacherByNip.get(nipKey)
        if (existingTeacher) {
          if (existingTeacher.status !== 'ACTIVE') {
            errors.push(`Data guru ${existingTeacher.name} (${existingTeacher.nip}) berstatus nonaktif.`)
          } else if (
            existingTeacher.userId ||
            linkedTeacherIds.has(existingTeacher.id) ||
            seenTeacherIdsInFile.has(existingTeacher.id)
          ) {
            errors.push(`Guru ${existingTeacher.name} (${existingTeacher.nip}) sudah ditautkan ke akun lain.`)
          } else {
            teacherId = existingTeacher.id
            teacherAction = 'LINKED_EXISTING'
            teacherLabel = `Tautkan: ${existingTeacher.name}`
            seenTeacherIdsInFile.add(existingTeacher.id)
          }
        } else {
          teacherAction = 'CREATED_NEW'
          teacherLabel = `Buat Guru Baru (${nip})`
        }
      }
    } else if (requiresTeacher) {
      errors.push('NIP wajib diisi untuk peran Guru / Guru Piket / Wali Kelas.')
    }

    return {
      rowNumber: idx + 1,
      username,
      usernameAuto,
      name,
      nip,
      roles,
      email,
      phone,
      password,
      teacherId,
      teacherAction,
      teacherLabel,
      errors,
      valid: errors.length === 0,
    }
  })
}

/** Ubah baris pratinjau yang valid menjadi payload API POST /users/bulk. */
export function previewRowToInput(row: BulkPreviewRow): BulkUserItemInput {
  return {
    username: row.username,
    name: row.name,
    email: row.email || null,
    roles: row.roles,
    teacherId: row.teacherId,
    nip: row.nip || null,
    phone: row.phone || null,
    password: row.password || null,
  }
}

const SAMPLE_TEMPLATE_ROWS: (string | number)[][] = [
  [
    1,
    'Budi Santoso, S.Pd.',
    '198803152014021001',
    'Guru',
    'budi.santoso@sekolah.sch.id',
    '081234567801',
    'budi.santoso',
    '',
  ],
  [
    2,
    'Siti Rahma, M.Pd.',
    '199107222019032004',
    'Guru; Guru Piket',
    'siti.rahma@sekolah.sch.id',
    '081234567802',
    'siti.rahma',
    '',
  ],
  [
    3,
    'Hendri Wijaya (TU)',
    '',
    'Admin/TU',
    'hendri.tu@sekolah.sch.id',
    '081234567803',
    'staf.tu.baru',
    '',
  ],
]

function escHtml(v: string | number | null | undefined): string {
  return (v === null || v === undefined ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Membangun dokumen tabel HTML-Excel (.xls) yang rapi dengan lebar kolom proporsional,
 * kop petunjuk pengisian, header tabel berwarna, border sel, dan format teks terkunci (`mso-number-format:'\@'`)
 * agar 18 digit NIP dan nomor telepon berawalan 0 tidak rusak saat dibuka di Microsoft Excel.
 */
function renderStyledExcelSheet(options: {
  title: string
  subtitleLines: string[]
  headers: readonly string[]
  colWidthsPx: readonly number[]
  rows: readonly (string | number | null | undefined)[][]
}): string {
  const { title, subtitleLines, headers, colWidthsPx, rows } = options
  const colSpan = headers.length

  const colGroup = `<colgroup>${colWidthsPx.map((w) => `<col width="${w}" style="width:${w}px">`).join('')}</colgroup>`

  const bannerRows = [
    `<tr><td colspan="${colSpan}" style="background:#0f172a;color:#ffffff;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:13pt;font-weight:700;padding:10px 12px;border:1px solid #0f172a;">${escHtml(title)}</td></tr>`,
    ...subtitleLines.map(
      (line) =>
        `<tr><td colspan="${colSpan}" style="background:#f8fafc;color:#334155;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:9.5pt;padding:5px 12px;border-left:1px solid #cbd5e1;border-right:1px solid #cbd5e1;">${escHtml(line)}</td></tr>`,
    ),
    `<tr><td colspan="${colSpan}" style="height:8px;background:#ffffff;border-left:1px solid #cbd5e1;border-right:1px solid #cbd5e1;"></td></tr>`,
  ].join('')

  const headerRow = `<tr>${headers
    .map(
      (h, i) =>
        `<th style="background:#1e293b;color:#ffffff;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;font-weight:600;padding:8px 10px;border:1px solid #334155;text-align:${i === 0 ? 'center' : 'left'};">${escHtml(h)}</th>`,
    )
    .join('')}</tr>`

  const bodyRows = rows
    .map((r, rowIdx) => {
      const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
      return `<tr>${headers
        .map((_, colIdx) => {
          const val = r[colIdx] ?? ''
          const isRowNum = colIdx === 0 && typeof val === 'number'
          const align = isRowNum ? 'center' : 'left'
          const numFormat = isRowNum ? '' : "mso-number-format:'\\@';"
          return `<td style="background:${bg};color:#0f172a;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;padding:6px 10px;border:1px solid #cbd5e1;text-align:${align};${numFormat}">${escHtml(val)}</td>`
        })
        .join('')}</tr>`
    })
    .join('')

  return [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8"></head>',
    '<body>',
    `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;">`,
    colGroup,
    bannerRows,
    headerRow,
    bodyRows,
    '</table>',
    '</body></html>',
  ].join('')
}

/** CSV template kosong dengan contoh baris siap pakai (urutan standar TU). */
export function buildBlankUserTemplateCSV(): string {
  return toCSV([...TEMPLATE_HEADERS], SAMPLE_TEMPLATE_ROWS)
}

/** Excel (.xls) template kosong yang rapi dengan petunjuk pengisian dan kunci teks NIP 18 digit. */
export function buildBlankUserTemplateExcel(): string {
  return renderStyledExcelSheet({
    title: 'TEMPLATE IMPOR AKUN PENGGUNA E-PIKET',
    subtitleLines: [
      'Petunjuk: Isi data guru/staf mulai pada baris di bawah judul kolom. Hapus atau ganti 3 baris contoh sebelum mengunggah.',
      'Peran yang didukung: Guru, Guru Piket, Wali Kelas, Koordinator, Admin/TU, Pimpinan, Super Admin (pisahkan dengan ";" bila lebih dari satu).',
      'Catatan: Jika NIP belum terdaftar di Data Master Guru, sistem otomatis membuatkan Master Guru baru. Username & Kata Sandi Awal boleh dikosongkan.',
    ],
    headers: TEMPLATE_HEADERS,
    colWidthsPx: [48, 230, 175, 170, 210, 145, 165, 175],
    rows: SAMPLE_TEMPLATE_ROWS,
  })
}

function buildUnlinkedTeachersRows(
  teachers: readonly Teacher[],
  existingUsers: readonly Pick<UserAccount, 'username' | 'teacherId'>[],
): (string | number)[][] {
  const linkedIds = new Set(existingUsers.map((u) => u.teacherId).filter((id): id is ID => !!id))
  const takenUsernames = new Set(existingUsers.map((u) => u.username.toLowerCase()))
  const unlinked = teachers
    .filter((t) => t.status === 'ACTIVE' && !t.userId && !linkedIds.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))

  return unlinked.map((t, idx) => {
    const uname = suggestUniqueUsername(t.name, t.nip, takenUsernames)
    takenUsernames.add(uname)
    return [idx + 1, t.name, t.nip, 'Guru', '', t.phone ?? '', uname, '']
  })
}

/** CSV template yang otomatis berisi daftar guru aktif dari Data Master yang belum punya akun. */
export function buildUnlinkedTeachersTemplateCSV(
  teachers: readonly Teacher[],
  existingUsers: readonly Pick<UserAccount, 'username' | 'teacherId'>[],
): string {
  return toCSV([...TEMPLATE_HEADERS], buildUnlinkedTeachersRows(teachers, existingUsers))
}

/** Excel (.xls) template rapi berisi daftar guru aktif dari Data Master yang belum punya akun. */
export function buildUnlinkedTeachersTemplateExcel(
  teachers: readonly Teacher[],
  existingUsers: readonly Pick<UserAccount, 'username' | 'teacherId'>[],
): string {
  const rows = buildUnlinkedTeachersRows(teachers, existingUsers)
  return renderStyledExcelSheet({
    title: 'DAFTAR GURU AKTIF BELUM MEMILIKI AKUN E-PIKET',
    subtitleLines: [
      `Total: ${rows.length} guru aktif dari Data Master yang belum tertaut ke akun pengguna.`,
      'Anda dapat menyesuaikan kolom Peran (mis. "Guru; Wali Kelas" atau "Guru; Guru Piket"), Email, atau Username sebelum mengunggah kembali.',
    ],
    headers: TEMPLATE_HEADERS,
    colWidthsPx: [48, 230, 175, 170, 210, 145, 165, 175],
    rows,
  })
}

const CREDENTIAL_HEADERS = [
  'No',
  'Nama Lengkap',
  'Username',
  'Kata Sandi Sementara',
  'Peran',
  'Guru Tertaut',
  'Status Data Guru',
] as const

const ACTION_LABEL: Record<BulkTeacherAction, string> = {
  LINKED_EXISTING: 'Ditautkan ke Master Guru',
  CREATED_NEW: 'Master Guru baru dibuat otomatis',
  NONE: 'Tanpa tautan guru',
}

/** CSV kredensial akun yang baru dibuat secara massal untuk dibagikan operator ke guru/staf. */
export function buildCredentialsCSV(created: readonly BulkCreatedUserResult[]): string {
  const rows = created.map((item, idx) => [
    idx + 1,
    item.user.name,
    item.user.username,
    item.temporaryPassword,
    item.user.roles.map((r) => ROLE_META[r].label).join('; '),
    item.user.teacherName ?? '—',
    ACTION_LABEL[item.teacherAction],
  ])
  return toCSV([...CREDENTIAL_HEADERS], rows)
}

/** Excel (.xls) kredensial akun yang baru dibuat secara massal, siap dicetak atau dibagikan oleh TU. */
export function buildCredentialsExcel(created: readonly BulkCreatedUserResult[]): string {
  const rows = created.map((item, idx) => [
    idx + 1,
    item.user.name,
    item.user.username,
    item.temporaryPassword,
    item.user.roles.map((r) => ROLE_META[r].label).join('; '),
    item.user.teacherName ?? '—',
    ACTION_LABEL[item.teacherAction],
  ])
  return renderStyledExcelSheet({
    title: 'DAFTAR KREDENSIAL SEMENTARA AKUN PENGGUNA E-PIKET',
    subtitleLines: [
      'PENTING: Bagikan username dan kata sandi sementara ini kepada masing-masing guru/staf.',
      'Setiap pengguna wajib mengganti kata sandi sementara saat pertama kali masuk ke aplikasi E-Piket.',
    ],
    headers: CREDENTIAL_HEADERS,
    colWidthsPx: [48, 220, 160, 170, 180, 200, 210],
    rows,
  })
}
