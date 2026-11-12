/**
 * Aturan pengaman akun pengguna (Kelola Pengguna, Super Admin) — fungsi murni agar dapat diuji langsung.
 *
 * 1. Tidak bisa menurunkan / menonaktifkan / reset sandi diri sendiri → 409 SELF_PROTECTED.
 * 2. Minimal satu Super Admin aktif harus tersisa → 409 LAST_SUPER_ADMIN.
 * 3. Hanya Super Admin yang boleh memberi/mencabut peran Super Admin & Admin/TU → 403.
 * 4. Username unik (abaikan huruf besar/kecil), 3–32 karakter a-z0-9._-, disimpan huruf kecil → 422.
 * 5. Peran Guru/Guru Piket/Wali Kelas wajib ditautkan ke data guru aktif yang belum dipakai akun lain → 422.
 * 6. Menonaktifkan / reset sandi mengakhiri semua sesi akun itu (lihat users.ts).
 * 7. Kata sandi sementara hanya tampil sekali; tidak pernah masuk audit / log login.
 * 8. Tidak ada hapus permanen — hanya nonaktifkan.
 */
import { canGrantRole, PRIVILEGED_ROLES, TEACHER_LINK_ROLES } from '@/lib/permissions'
import { ROLES, type ActiveStatus, type ID, type Role, type Teacher } from '@/types/entities'

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/
export const MIN_PASSWORD_LENGTH = 8

/** Huruf/angka yang tidak mudah tertukar (tanpa 0/O, 1/l/I). */
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
export const TEMP_PASSWORD_RE = /^Ep-[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]{8}$/

type AccountLike = { id: ID; username: string; roles: Role[]; status: ActiveStatus; teacherId: ID | null }

export function normalizeUsername(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

/** Kode error field username, atau null bila valid. */
export function usernameError(
  username: string,
  users: readonly Pick<AccountLike, 'id' | 'username'>[],
  selfId?: ID,
): 'required' | 'invalid' | 'duplicate' | null {
  if (!username) return 'required'
  if (!USERNAME_RE.test(username)) return 'invalid'
  const taken = users.some((u) => u.id !== selfId && u.username.toLowerCase() === username)
  return taken ? 'duplicate' : null
}

/** Normalisasi daftar peran; null bila bukan array atau ada peran tak dikenal. */
export function parseRoles(v: unknown): Role[] | null {
  if (!Array.isArray(v)) return null
  if (!v.every((r) => typeof r === 'string' && (ROLES as readonly string[]).includes(r))) return null
  // urut sesuai ROLES agar diff audit stabil
  return ROLES.filter((r) => (v as string[]).includes(r))
}

/** Peran istimewa yang ditambah/dicabut tetapi tidak boleh diberikan oleh pelaku (aturan 3). */
export function forbiddenRoleChanges(actorRoles: readonly Role[], before: readonly Role[], after: readonly Role[]): Role[] {
  const changed = [
    ...after.filter((r) => !before.includes(r)),
    ...before.filter((r) => !after.includes(r)),
  ]
  return changed.filter((r) => !canGrantRole(actorRoles, r))
}

/** Target memegang peran istimewa sehingga hanya Super Admin yang boleh mengelolanya. */
export function isPrivilegedAccount(roles: readonly Role[]) {
  return roles.some((r) => (PRIVILEGED_ROLES as readonly Role[]).includes(r))
}

export function needsTeacherLink(roles: readonly Role[]) {
  return roles.some((r) => (TEACHER_LINK_ROLES as readonly Role[]).includes(r))
}

/**
 * Aturan 1 — pelaku mengubah akunnya sendiri: tidak boleh mencabut peran istimewa miliknya,
 * menonaktifkan diri, menghapus diri, atau me-reset sandi sendiri (pakai ganti sandi di Profil).
 */
export function selfProtectionError(
  actorId: ID,
  target: Pick<AccountLike, 'id' | 'roles'>,
  change: { roles?: readonly Role[]; status?: ActiveStatus; resetPassword?: boolean; delete?: boolean },
): string | null {
  if (actorId !== target.id) return null
  if (change.delete) return 'Tidak dapat menghapus akun sendiri.'
  if (change.resetPassword) return 'Tidak dapat me-reset kata sandi akun sendiri. Gunakan Ganti kata sandi di Profil.'
  if (change.status === 'INACTIVE') return 'Tidak dapat menonaktifkan akun sendiri.'
  if (change.roles) {
    const dropped = target.roles.filter(
      (r) => (PRIVILEGED_ROLES as readonly Role[]).includes(r) && !change.roles!.includes(r),
    )
    if (dropped.length) return 'Tidak dapat menurunkan peran akun sendiri.'
  }
  return null
}

/** Aturan 2 — setelah perubahan, minimal satu Super Admin aktif harus tersisa. */
export function wouldRemoveLastSuperAdmin(
  users: readonly Pick<AccountLike, 'id' | 'roles' | 'status'>[],
  targetId: ID,
  next: { roles?: readonly Role[]; status?: ActiveStatus; delete?: boolean },
): boolean {
  const isActiveSa = (u: Pick<AccountLike, 'roles' | 'status'>) => u.status === 'ACTIVE' && u.roles.includes('SUPER_ADMIN')
  const target = users.find((u) => u.id === targetId)
  if (!target || !isActiveSa(target)) return false
  if (!next.delete) {
    const after = { roles: next.roles ?? target.roles, status: next.status ?? target.status }
    if (isActiveSa(after as Pick<AccountLike, 'roles' | 'status'>)) return false
  }
  return !users.some((u) => u.id !== targetId && isActiveSa(u))
}

/** Cek apakah menonaktifkan/menghapus sekumpulan akun sekaligus akan menghabiskan Super Admin aktif. */
export function wouldRemoveLastSuperAdminBulk(
  users: readonly Pick<AccountLike, 'id' | 'roles' | 'status'>[],
  targetIds: ReadonlySet<ID>,
  change: { status?: ActiveStatus; delete?: boolean },
): boolean {
  if (!change.delete && change.status !== 'INACTIVE') return false
  const isActiveSa = (u: Pick<AccountLike, 'roles' | 'status'>) => u.status === 'ACTIVE' && u.roles.includes('SUPER_ADMIN')
  const affectedSa = users.some((u) => targetIds.has(u.id) && isActiveSa(u))
  if (!affectedSa) return false
  return !users.some((u) => !targetIds.has(u.id) && isActiveSa(u))
}

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

/** Buat username unik otomatis dari nama lengkap dan/atau NIP. */
export function generateUniqueUsername(
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

/**
 * Aturan 5 — kode/pesan error untuk field teacherId, atau null bila valid.
 * Guru yang dipilih harus ada, aktif, dan belum ditautkan ke akun lain.
 */
export function teacherLinkError(
  roles: readonly Role[],
  teacherId: ID | null,
  teachers: readonly Pick<Teacher, 'id' | 'status' | 'userId'>[],
  users: readonly Pick<AccountLike, 'id' | 'teacherId'>[],
  selfId?: ID,
): string | null {
  if (!teacherId) return needsTeacherLink(roles) ? 'required' : null
  const t = teachers.find((x) => x.id === teacherId)
  if (!t) return 'Data guru tidak ditemukan.'
  if (t.status !== 'ACTIVE') return 'Data guru tidak aktif.'
  const usedBy = users.find((u) => u.id !== selfId && u.teacherId === teacherId)
  if (usedBy || (t.userId && t.userId !== selfId)) return 'Guru ini sudah ditautkan ke akun lain.'
  return null
}

/** Aturan ganti sandi sendiri. */
export function newPasswordError(current: string, next: unknown): string | null {
  if (typeof next !== 'string' || !next) return 'required'
  if (next.length < MIN_PASSWORD_LENGTH) return `Minimal ${MIN_PASSWORD_LENGTH} karakter.`
  if (next.length > 128) return 'too_long'
  if (next === current) return 'Kata sandi baru harus berbeda dari kata sandi saat ini.'
  return null
}

function randomIndex(n: number): number {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1)
    c.getRandomValues(buf)
    return (buf[0] ?? 0) % n
  }
  return Math.floor(Math.random() * n)
}

/** 'Ep-' + 8 karakter dari alfabet tanpa huruf/angka yang mirip. */
export function generateTemporaryPassword(): string {
  let out = 'Ep-'
  for (let i = 0; i < 8; i++) out += TEMP_PASSWORD_ALPHABET[randomIndex(TEMP_PASSWORD_ALPHABET.length)]
  return out
}
