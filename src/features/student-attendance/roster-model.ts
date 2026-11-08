/**
 * Logika murni editor roster absensi (tanpa React) — mudah diuji.
 * Edit lokal disimpan per studentId dan ditimpa di atas data server (baseline).
 */
import { DEFAULT_REASON_REQUIRED } from '@/lib/enums'
import type {
  AttendanceStatus,
  AttendanceSummaryCounts,
  ID,
  RosterRow,
  SchoolSettings,
  StudentAttendanceRecord,
} from '@/types/entities'
import { ATTENDANCE_STATUSES } from '@/types/entities'
import { rowDraftSchema } from './schemas'
import type { BulkSaveRequest, RowDraft } from './types'

export type Edits = Record<ID, RowDraft>

/** Status cepat yang tampil sebagai tombol (H S I A T); sisanya di menu "lainnya". */
export const QUICK_STATUSES: AttendanceStatus[] = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE']
export const MORE_STATUSES: AttendanceStatus[] = ['EXCUSED', 'LEFT_EARLY']

export function reasonRequiredFrom(settings: SchoolSettings | undefined): AttendanceStatus[] {
  const cfg = settings?.attendanceStatuses
  if (!cfg?.length) return DEFAULT_REASON_REQUIRED
  return cfg.filter((s) => s.requiresReason).map((s) => s.code)
}

export function activeStatusesFrom(settings: SchoolSettings | undefined): AttendanceStatus[] {
  const cfg = settings?.attendanceStatuses
  if (!cfg?.length) return [...ATTENDANCE_STATUSES]
  return cfg.filter((s) => s.active).map((s) => s.code)
}

export function draftFromRecord(r: StudentAttendanceRecord): RowDraft {
  return { status: r.status, reason: r.reason ?? '', note: r.note ?? '', arrivalTime: r.arrivalTime ?? '' }
}

/** Nilai efektif baris = edit lokal ?? record server ?? null (belum diisi). */
export function effectiveDraft(row: RosterRow, edits: Edits): RowDraft | null {
  return edits[row.student.id] ?? (row.record ? draftFromRecord(row.record) : null)
}

function normalize(d: RowDraft) {
  return {
    status: d.status,
    reason: d.reason.trim(),
    note: d.note.trim(),
    arrivalTime: d.status === 'LATE' ? d.arrivalTime.trim() : '',
  }
}

export function sameDraft(a: RowDraft | null, b: RowDraft | null) {
  if (!a || !b) return a === b
  const x = normalize(a)
  const y = normalize(b)
  return x.status === y.status && x.reason === y.reason && x.note === y.note && x.arrivalTime === y.arrivalTime
}

/** Baris yang berubah dibanding data server (FR-STU-02: perubahan terlihat sebelum dikirim). */
export function isRowDirty(row: RosterRow, edits: Edits) {
  const e = edits[row.student.id]
  if (!e) return false
  return !sameDraft(e, row.record ? draftFromRecord(row.record) : null)
}

export function dirtyRows(rows: RosterRow[], edits: Edits) {
  return rows.filter((r) => isRowDirty(r, edits))
}

/** Buang edit yang ternyata sama dengan server (mis. setelah simpan / muat ulang). */
export function pruneEdits(rows: RosterRow[], edits: Edits): Edits {
  const out: Edits = {}
  for (const r of rows) {
    const e = edits[r.student.id]
    if (e && isRowDirty(r, edits)) out[r.student.id] = e
  }
  return out
}

/** Ringkasan live dari edit lokal + server. */
export function liveSummary(rows: RosterRow[], edits: Edits): AttendanceSummaryCounts {
  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as Record<AttendanceStatus, number>
  let unmarked = 0
  for (const r of rows) {
    const d = effectiveDraft(r, edits)
    if (d) counts[d.status] += 1
    else unmarked += 1
  }
  return { ...counts, total: rows.length, unmarked }
}

/** Tandai Hadir: hanya baris belum diisi (default), atau semua baris bila overwrite. */
export function markAllPresent(rows: RosterRow[], edits: Edits, overwrite = false): { edits: Edits; changed: number } {
  const next: Edits = { ...edits }
  let changed = 0
  for (const r of rows) {
    const current = effectiveDraft(r, next)
    if (!overwrite && current) continue
    if (current?.status === 'PRESENT' && !current.reason && !current.arrivalTime) continue
    next[r.student.id] = { status: 'PRESENT', reason: '', note: current?.note ?? '', arrivalTime: '' }
    changed += 1
  }
  return { edits: next, changed }
}

/** Validasi klien per baris (server tetap otoritas). */
export function validateDraft(d: RowDraft, requiresReason: AttendanceStatus[]): Record<string, string> {
  const out: Record<string, string> = {}
  const parsed = rowDraftSchema.safeParse(d)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'status')
      out[key] ??= issue.message
    }
  }
  if (requiresReason.includes(d.status) && !d.reason.trim()) {
    out.reason = 'Alasan wajib diisi untuk status ini.'
  }
  return out
}

export function clientRowErrors(rows: RosterRow[], edits: Edits, requiresReason: AttendanceStatus[]) {
  const out: Record<ID, Record<string, string>> = {}
  for (const r of rows) {
    if (!isRowDirty(r, edits)) continue
    const e = edits[r.student.id]
    if (!e) continue
    const errs = validateDraft(e, requiresReason)
    if (Object.keys(errs).length) out[r.student.id] = errs
  }
  return out
}

/** Payload bulk: hanya baris yang berubah (upsert di server). Urutan dipakai untuk memetakan error per baris. */
export function buildBulkRecords(rows: RosterRow[], edits: Edits): { records: BulkSaveRequest['records']; ids: ID[] } {
  const records: BulkSaveRequest['records'] = []
  const ids: ID[] = []
  for (const r of dirtyRows(rows, edits)) {
    const e = edits[r.student.id]
    if (!e) continue
    const n = normalize(e)
    records.push({
      studentId: r.student.id,
      status: n.status,
      reason: n.reason || null,
      note: n.note || null,
      arrivalTime: n.arrivalTime || null,
    })
    ids.push(r.student.id)
  }
  return { records, ids }
}

/* ------------------------------------------------------------------ draft lokal (sessionStorage) */

const DRAFT_PREFIX = 'epiket:sa-draft:'

export interface StoredDraft {
  version: number
  savedAt: string
  edits: Edits
}

/** Kunci hanya memakai ID sesi — tanpa nama siswa (PRD §12.2). */
export const draftStorageKey = (sessionId: ID) => `${DRAFT_PREFIX}${sessionId}`

function isRowDraft(v: unknown): v is RowDraft {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.status === 'string' &&
    (ATTENDANCE_STATUSES as readonly string[]).includes(o.status) &&
    typeof o.reason === 'string' &&
    typeof o.note === 'string' &&
    typeof o.arrivalTime === 'string'
  )
}

export function loadDraft(sessionId: ID): StoredDraft | null {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(sessionId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const o = parsed as Record<string, unknown>
    if (typeof o.version !== 'number' || typeof o.savedAt !== 'string' || typeof o.edits !== 'object' || o.edits === null) {
      return null
    }
    const edits: Edits = {}
    for (const [k, v] of Object.entries(o.edits as Record<string, unknown>)) if (isRowDraft(v)) edits[k] = v
    if (!Object.keys(edits).length) return null
    return { version: o.version, savedAt: o.savedAt, edits }
  } catch {
    return null
  }
}

export function saveDraft(sessionId: ID, draft: StoredDraft) {
  try {
    if (!Object.keys(draft.edits).length) sessionStorage.removeItem(draftStorageKey(sessionId))
    else sessionStorage.setItem(draftStorageKey(sessionId), JSON.stringify(draft))
  } catch {
    /* kuota penuh / mode privat — abaikan */
  }
}

export function clearDraft(sessionId: ID) {
  try {
    sessionStorage.removeItem(draftStorageKey(sessionId))
  } catch {
    /* abaikan */
  }
}
