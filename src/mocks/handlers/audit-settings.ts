/**
 * Mock API: audit log (FR-AUD-01/02) dan pengaturan sekolah (PATCH /settings).
 * GET /settings ada di master-read.ts.
 */
import { http, type HttpHandler } from 'msw'
import { dateOf } from '@/lib/date'
import {
  ATTENDANCE_STATUSES,
  AUDIT_ACTIONS,
  TEACHER_ATTENDANCE_STATUSES,
  type AttendanceStatus,
  type AuditAction,
  type SchoolSettings,
  type StatusConfig,
  type TeacherAttendanceStatus,
} from '@/types/entities'
import { db, persist } from '../db'
import {
  apiPath,
  audit,
  errors,
  latency,
  matchesSearch,
  ok,
  paginate,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
} from '../utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/* ------------------------------------------------------------------ audit */

function listAuditLogs(request: Request) {
  const sp = searchParams(request)
  const entity = sp.get('entity')
  const actorId = sp.get('actorId')
  const action = sp.get('action')
  const dateFrom = sp.get('dateFrom')
  const dateTo = sp.get('dateTo')
  const search = sp.get('search')

  const details: Record<string, string> = {}
  if (action && !(AUDIT_ACTIONS as readonly string[]).includes(action)) details.action = 'invalid'
  if (dateFrom && !ISO_DATE.test(dateFrom)) details.dateFrom = 'invalid'
  if (dateTo && !ISO_DATE.test(dateTo)) details.dateTo = 'invalid'
  if (dateFrom && dateTo && ISO_DATE.test(dateFrom) && ISO_DATE.test(dateTo) && dateFrom > dateTo) {
    details.dateTo = 'Tanggal akhir tidak boleh sebelum tanggal awal.'
  }
  if (Object.keys(details).length) throw errors.validation(details, 'Filter audit tidak valid.')

  return db()
    .auditLogs.filter((a) => {
      if (entity && a.entity !== entity) return false
      if (actorId && a.actorId !== actorId) return false
      if (action && a.action !== (action as AuditAction)) return false
      const day = dateOf(a.timestamp)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      return matchesSearch(search, a.summary, a.actorName, a.entityId, a.reason, a.requestId)
    })
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0))
}

/* ------------------------------------------------------------------ settings */

const STATUS_FIELDS = ['label', 'shortCode', 'requiresReason', 'active'] as const

/** Ratakan pengaturan menjadi pasangan field → nilai untuk diff audit yang mudah dibaca. */
function flattenSettings(s: SchoolSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {
    schoolName: s.schoolName,
    schoolAddress: s.schoolAddress,
    letterheadLines: s.letterheadLines,
    principalName: s.principalName,
    principalNip: s.principalNip,
    city: s.city,
    teacherReasonRequiredStatuses: s.teacherReasonRequiredStatuses,
    dismissalRequiresPickup: s.dismissalRequiresPickup,
    dutyNoteCategories: s.dutyNoteCategories,
  }
  for (const st of s.attendanceStatuses) {
    for (const k of STATUS_FIELDS) out[`attendanceStatuses.${st.code}.${k}`] = st[k]
  }
  return out
}

function diffSettings(before: SchoolSettings, after: SchoolSettings) {
  const a = flattenSettings(before)
  const b = flattenSettings(after)
  const beforeDiff: Record<string, unknown> = {}
  const afterDiff: Record<string, unknown> = {}
  for (const key of Object.keys(b)) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      beforeDiff[key] = a[key] ?? null
      afterDiff[key] = b[key] ?? null
    }
  }
  return { before: beforeDiff, after: afterDiff, changed: Object.keys(afterDiff) }
}

const SETTINGS_FIELD_LABEL: Record<string, string> = {
  schoolName: 'nama sekolah',
  schoolAddress: 'alamat',
  letterheadLines: 'kop cetak',
  principalName: 'kepala sekolah',
  principalNip: 'NIP kepala sekolah',
  city: 'kota',
  teacherReasonRequiredStatuses: 'aturan alasan guru',
  dismissalRequiresPickup: 'aturan penjemput',
  dutyNoteCategories: 'kategori catatan piket',
  attendanceStatuses: 'status absensi',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function optionalText(
  body: Record<string, unknown>,
  key: string,
  details: Record<string, string>,
  { required = false, max = 200 }: { required?: boolean; max?: number } = {},
): string | undefined {
  if (!(key in body)) return undefined
  const v = body[key]
  if (typeof v !== 'string') {
    details[key] = 'invalid'
    return undefined
  }
  const t = v.trim()
  if (required && !t) details[key] = 'required'
  else if (t.length > max) details[key] = `Maksimal ${max} karakter.`
  return t
}

/** Validasi & terapkan PATCH /settings. Melempar 422 bila ada isian tidak valid. */
function applySettingsPatch(current: SchoolSettings, body: Record<string, unknown>): SchoolSettings {
  const details: Record<string, string> = {}
  const next: SchoolSettings = structuredClone(current)

  const schoolName = optionalText(body, 'schoolName', details, { required: true, max: 120 })
  const schoolAddress = optionalText(body, 'schoolAddress', details, { max: 200 })
  const principalName = optionalText(body, 'principalName', details, { required: true, max: 120 })
  const principalNip = optionalText(body, 'principalNip', details, { max: 30 })
  const city = optionalText(body, 'city', details, { required: true, max: 60 })
  if (principalNip && !/^[0-9 ]+$/.test(principalNip)) details.principalNip = 'NIP hanya boleh berisi angka.'
  if (schoolName !== undefined) next.schoolName = schoolName
  if (schoolAddress !== undefined) next.schoolAddress = schoolAddress
  if (principalName !== undefined) next.principalName = principalName
  if (principalNip !== undefined) next.principalNip = principalNip.replace(/\s+/g, '')
  if (city !== undefined) next.city = city

  if ('letterheadLines' in body) {
    const lines = body.letterheadLines
    if (!Array.isArray(lines) || lines.some((l) => typeof l !== 'string')) {
      details.letterheadLines = 'invalid'
    } else {
      const cleaned = (lines as string[]).map((l) => l.trim()).filter(Boolean)
      if (cleaned.length === 0) details.letterheadLines = 'Kop cetak minimal berisi satu baris.'
      else if (cleaned.length > 6) details.letterheadLines = 'Kop cetak maksimal 6 baris.'
      else if (cleaned.some((l) => l.length > 120)) details.letterheadLines = 'Setiap baris maksimal 120 karakter.'
      else next.letterheadLines = cleaned
    }
  }

  if ('attendanceStatuses' in body) {
    const incoming = body.attendanceStatuses
    if (!Array.isArray(incoming)) {
      details.attendanceStatuses = 'invalid'
    } else {
      const seen = new Set<string>()
      incoming.forEach((raw: unknown, i) => {
        const p = `attendanceStatuses.${i}`
        if (!isRecord(raw) || typeof raw.code !== 'string' || !(ATTENDANCE_STATUSES as readonly string[]).includes(raw.code)) {
          details[`${p}.code`] = 'invalid'
          return
        }
        const code = raw.code as AttendanceStatus
        if (seen.has(code)) {
          details[`${p}.code`] = 'duplicate'
          return
        }
        seen.add(code)
        const target = next.attendanceStatuses.find((s) => s.code === code)
        if (!target) {
          details[`${p}.code`] = 'invalid'
          return
        }
        if ('label' in raw) {
          const label = typeof raw.label === 'string' ? raw.label.trim() : ''
          if (!label) details[`${p}.label`] = 'required'
          else if (label.length > 40) details[`${p}.label`] = 'Maksimal 40 karakter.'
          else target.label = label
        }
        if ('shortCode' in raw) {
          const sc = typeof raw.shortCode === 'string' ? raw.shortCode.trim().toUpperCase() : ''
          if (!sc) details[`${p}.shortCode`] = 'required'
          else if (sc.length > 3) details[`${p}.shortCode`] = 'Maksimal 3 karakter.'
          else target.shortCode = sc
        }
        if ('requiresReason' in raw) {
          if (typeof raw.requiresReason !== 'boolean') details[`${p}.requiresReason`] = 'invalid'
          else target.requiresReason = raw.requiresReason
        }
        if ('active' in raw) {
          if (typeof raw.active !== 'boolean') details[`${p}.active`] = 'invalid'
          else if (code === 'PRESENT' && !raw.active)
            details[`${p}.active`] = 'Status Hadir tidak dapat dinonaktifkan.'
          else target.active = raw.active
        }
      })
      // Kode singkat harus unik agar rekap cetak/ekspor tidak ambigu.
      const byShort = new Map<string, number>()
      next.attendanceStatuses.forEach((s: StatusConfig) => {
        const key = s.shortCode.toUpperCase()
        byShort.set(key, (byShort.get(key) ?? 0) + 1)
      })
      incoming.forEach((raw: unknown, i) => {
        if (!isRecord(raw)) return
        const target = next.attendanceStatuses.find((s) => s.code === raw.code)
        if (target && (byShort.get(target.shortCode.toUpperCase()) ?? 0) > 1 && !details[`attendanceStatuses.${i}.shortCode`]) {
          details[`attendanceStatuses.${i}.shortCode`] = 'Kode singkat sudah dipakai status lain.'
        }
      })
    }
  }

  if ('teacherReasonRequiredStatuses' in body) {
    const v = body.teacherReasonRequiredStatuses
    if (
      !Array.isArray(v) ||
      v.some((x) => typeof x !== 'string' || !(TEACHER_ATTENDANCE_STATUSES as readonly string[]).includes(x))
    ) {
      details.teacherReasonRequiredStatuses = 'invalid'
    } else if ((v as string[]).includes('PRESENT')) {
      details.teacherReasonRequiredStatuses = 'Status Hadir tidak memerlukan alasan.'
    } else {
      // Simpan sesuai urutan enum agar diff stabil.
      next.teacherReasonRequiredStatuses = TEACHER_ATTENDANCE_STATUSES.filter((s) =>
        (v as string[]).includes(s),
      ) as TeacherAttendanceStatus[]
    }
  }

  if ('dismissalRequiresPickup' in body) {
    if (typeof body.dismissalRequiresPickup !== 'boolean') details.dismissalRequiresPickup = 'invalid'
    else next.dismissalRequiresPickup = body.dismissalRequiresPickup
  }

  if ('dutyNoteCategories' in body) {
    const v = body.dutyNoteCategories
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      details.dutyNoteCategories = 'invalid'
    } else {
      const cleaned = (v as string[]).map((c) => c.trim()).filter(Boolean)
      const lower = cleaned.map((c) => c.toLowerCase())
      if (cleaned.length === 0) details.dutyNoteCategories = 'Minimal satu kategori.'
      else if (cleaned.length > 20) details.dutyNoteCategories = 'Maksimal 20 kategori.'
      else if (cleaned.some((c) => c.length > 30)) details.dutyNoteCategories = 'Nama kategori maksimal 30 karakter.'
      else if (new Set(lower).size !== lower.length) details.dutyNoteCategories = 'Kategori tidak boleh ganda.'
      else next.dutyNoteCategories = cleaned
    }
  }

  if (Object.keys(details).length) throw errors.validation(details)
  return next
}

/* ------------------------------------------------------------------ handlers */

export const auditSettingsHandlers: HttpHandler[] = [
  // /facets harus didaftarkan sebelum /:id.
  http.get(apiPath('/audit-logs/facets'), async ({ request }) => {
    await latency(100)
    const user = requireAuth(request)
    requirePermission(user, 'audit:read')
    const logs = db().auditLogs
    const entities = [...new Set(logs.map((a) => a.entity))].sort()
    const actorMap = new Map<string, string>()
    for (const a of logs) if (!actorMap.has(a.actorId)) actorMap.set(a.actorId, a.actorName)
    const actors = [...actorMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    return ok({ entities, actors })
  }),

  http.get(apiPath('/audit-logs/:id'), async ({ request, params }) => {
    await latency(120)
    const user = requireAuth(request)
    requirePermission(user, 'audit:read')
    const log = db().auditLogs.find((a) => a.id === params.id)
    if (!log) return errors.notFound('Riwayat audit tidak ditemukan.')
    return ok(log)
  }),

  http.get(apiPath('/audit-logs'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'audit:read')
    return paginate(listAuditLogs(request), request)
  }),

  http.patch(apiPath('/settings'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'settings:write')
    const raw = await readJson<unknown>(request)
    if (!isRecord(raw)) return errors.validation({ body: 'invalid' }, 'Format permintaan tidak valid.')
    if (typeof raw.version !== 'number') return errors.validation({ version: 'required' })

    const d = db()
    const current = d.settings
    if (raw.version !== current.version) return errors.versionConflict()

    const next = applySettingsPatch(current, raw)
    const diff = diffSettings(current, next)
    if (diff.changed.length === 0) return ok(current)

    next.version = current.version + 1
    d.settings = next
    const groups = [...new Set(diff.changed.map((k) => k.split('.')[0] ?? k))]
    audit({
      user,
      action: 'UPDATE',
      entity: 'SchoolSettings',
      entityId: 'settings',
      summary: `Ubah pengaturan: ${groups.map((g) => SETTINGS_FIELD_LABEL[g] ?? g).join(', ')}`,
      before: diff.before,
      after: diff.after,
    })
    persist()
    return ok(next)
  }),
]
