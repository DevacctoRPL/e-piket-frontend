/**
 * Endpoint tulis data master + penugasan piket (PRD §6.2 FR-MST-01..05, FR-DUTY-01, AC-01).
 * Meniru perilaku backend Go: otorisasi per permission, validasi 422 per field, 409 untuk
 * bentrok jadwal / data yang masih dipakai, soft delete, audit log, idempotensi POST.
 */
import { http, type HttpHandler } from 'msw'
import { todayISO } from '@/lib/date'
import type {
  AcademicYear,
  ActiveStatus,
  ClassRoom,
  DutyAssignment,
  ID,
  Period,
  Semester,
  Shift,
  Student,
  Subject,
  Teacher,
  TimetableSlot,
} from '@/types/entities'
import { db, isDeleted, newId, persist, softDelete } from '../db'
import { activeAcademicYear, phoneForUser, rosterForClass } from '../domain'
import {
  apiPath,
  audit,
  created,
  errors,
  latency,
  ok,
  pick,
  readJson,
  requireAuth,
  requirePermission,
  searchParams,
  withIdempotency,
  type AuthedUser,
} from '../utils'
import {
  alive,
  asRecord,
  conflictDetails,
  currentSemesterIds,
  DATE_RE,
  FieldErrors,
  findScheduleConflicts,
  isInt,
  isStr,
  merged,
  minutesBetween,
  normalizePhone,
  optionalText,
  PHONE_RE,
  requireDate,
  requireText,
  requireTime,
  trimmed,
} from './master-write-rules'

const ACTIVE_STATUSES: ActiveStatus[] = ['ACTIVE', 'INACTIVE']
const asStatus = (v: unknown): ActiveStatus | null =>
  ACTIVE_STATUSES.includes(v as ActiveStatus) ? (v as ActiveStatus) : null

function writer(request: Request): AuthedUser {
  const user = requireAuth(request)
  requirePermission(user, 'master:write')
  return user
}

async function body(request: Request) {
  return asRecord(await readJson<unknown>(request))
}

function idParam(params: Record<string, string | readonly string[] | undefined>): ID {
  const v = params.id
  return typeof v === 'string' ? v : ''
}

/* ================================================================== academic years */

function validateAcademicYear(input: Record<string, unknown>, selfId?: ID) {
  const fe = new FieldErrors()
  const name = requireText(fe, input, 'name', 20)
  if (name && !/^\d{4}\/\d{4}$/.test(name)) fe.add('name', 'Format nama tahun ajaran: 2026/2027.')
  if (
    name &&
    alive('academicYears', db().academicYears).some((y) => y.id !== selfId && y.name === name)
  ) {
    fe.add('name', 'duplicate')
  }
  const startDate = requireDate(fe, input, 'startDate')
  const endDate = requireDate(fe, input, 'endDate')
  if (startDate && endDate && DATE_RE.test(startDate) && DATE_RE.test(endDate) && startDate >= endDate) {
    fe.add('endDate', 'Tanggal selesai harus setelah tanggal mulai.')
  }
  const rawSems = Array.isArray(input.semesters) ? input.semesters : []
  if (rawSems.length !== 2) fe.add('semesters', 'Tahun ajaran harus memiliki 2 semester (Ganjil & Genap).')
  const semesters = rawSems.slice(0, 2).map((raw, i) => {
    const s = asRecord(raw)
    const sStart = trimmed(s.startDate)
    const sEnd = trimmed(s.endDate)
    if (!sStart) fe.add(`semesters.${i}.startDate`, 'required')
    else if (!DATE_RE.test(sStart)) fe.add(`semesters.${i}.startDate`, 'invalid')
    if (!sEnd) fe.add(`semesters.${i}.endDate`, 'required')
    else if (!DATE_RE.test(sEnd)) fe.add(`semesters.${i}.endDate`, 'invalid')
    if (sStart && sEnd && sStart >= sEnd) fe.add(`semesters.${i}.endDate`, 'Tanggal selesai harus setelah tanggal mulai.')
    if (startDate && endDate && sStart && sEnd && (sStart < startDate || sEnd > endDate)) {
      fe.add(`semesters.${i}.startDate`, 'Semester harus berada dalam rentang tahun ajaran.')
    }
    return { id: isStr(s.id) ? s.id : undefined, startDate: sStart, endDate: sEnd }
  })
  const [s1, s2] = semesters
  if (s1 && s2 && s1.endDate && s2.startDate && s2.startDate <= s1.endDate) {
    fe.add('semesters.1.startDate', 'Semester Genap harus dimulai setelah semester Ganjil berakhir.')
  }
  fe.throwIfAny()
  return { name, startDate, endDate, semesters }
}

/** Hanya satu tahun ajaran & satu semester aktif di seluruh sistem (FR-MST-01). */
function activate(yearId: ID, semesterId?: ID) {
  const d = db()
  const year = d.academicYears.find((y) => y.id === yearId)
  if (!year) return
  const today = todayISO()
  const targetSem =
    year.semesters.find((s) => s.id === semesterId) ??
    year.semesters.find((s) => s.startDate <= today && today <= s.endDate) ??
    year.semesters.find((s) => s.isActive) ??
    year.semesters[0]
  for (const y of d.academicYears) {
    y.isActive = y.id === yearId
    for (const s of y.semesters) s.isActive = y.id === yearId && s.id === targetSem?.id
  }
}

const yearAudit = (y: AcademicYear) => ({
  ...pick(y, ['name', 'startDate', 'endDate', 'isActive']),
  activeSemester: y.semesters.find((s) => s.isActive)?.name ?? null,
})

const academicYearHandlers: HttpHandler[] = [
  http.post(apiPath('/academic-years'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const input = await body(request)
      const v = validateAcademicYear(input)
      const id = newId('ay')
      const semesters: Semester[] = v.semesters.map((s, i) => ({
        id: newId('sem'),
        academicYearId: id,
        number: (i + 1) as 1 | 2,
        name: i === 0 ? 'Ganjil' : 'Genap',
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: false,
      }))
      const year: AcademicYear = { id, name: v.name, startDate: v.startDate, endDate: v.endDate, isActive: false, semesters }
      db().academicYears.push(year)
      if (input.isActive === true) activate(id)
      persist()
      audit({ user, action: 'CREATE', entity: 'AcademicYear', entityId: id, summary: `Membuat tahun ajaran ${year.name}`, after: yearAudit(year) })
      return created(year)
    })
  }),

  http.patch(apiPath('/academic-years/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const year = db().academicYears.find((y) => y.id === idParam(params) && !isDeleted('academicYears', y.id))
    if (!year) return errors.notFound('Tahun ajaran tidak ditemukan.')
    const input = await body(request)
    const before = yearAudit(year)
    if (input.isActive === false && year.isActive) {
      return errors.conflict(
        'Tahun ajaran aktif tidak dapat dinonaktifkan langsung. Aktifkan tahun ajaran lain terlebih dahulu.',
        'ACTIVE_YEAR_REQUIRED',
      )
    }
    const semesterId = isStr(input.activeSemesterId) ? input.activeSemesterId : undefined
    if (semesterId && !year.semesters.some((s) => s.id === semesterId)) {
      return errors.validation({ activeSemesterId: 'Semester tidak termasuk tahun ajaran ini.' })
    }
    const hasFields = ['name', 'startDate', 'endDate', 'semesters'].some((k) => k in input)
    if (hasFields) {
      const v = validateAcademicYear({
        ...merged(year, input),
        semesters: Array.isArray(input.semesters) ? input.semesters : year.semesters,
      }, year.id)
      year.name = v.name
      year.startDate = v.startDate
      year.endDate = v.endDate
      year.semesters.forEach((s, i) => {
        const next = v.semesters[i]
        if (next) {
          s.startDate = next.startDate
          s.endDate = next.endDate
        }
      })
    }
    if (input.isActive === true || semesterId) activate(year.id, semesterId)
    persist()
    audit({
      user,
      action: 'UPDATE',
      entity: 'AcademicYear',
      entityId: year.id,
      summary: input.isActive === true || semesterId
        ? `Mengaktifkan ${year.name} semester ${year.semesters.find((s) => s.isActive)?.name ?? ''}`.trim()
        : `Mengubah tahun ajaran ${year.name}`,
      before,
      after: yearAudit(year),
    })
    return ok(year)
  }),

  http.delete(apiPath('/academic-years/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const year = db().academicYears.find((y) => y.id === idParam(params) && !isDeleted('academicYears', y.id))
    if (!year) return errors.notFound('Tahun ajaran tidak ditemukan.')
    if (year.isActive) {
      return errors.conflict('Tahun ajaran yang sedang aktif tidak dapat dihapus.', 'IN_USE')
    }
    const classCount = alive('classes', db().classes).filter((c) => c.academicYearId === year.id).length
    if (classCount > 0) {
      return errors.conflict(
        `Tahun ajaran ${year.name} masih memiliki ${classCount} kelas. Hapus atau pindahkan kelas terlebih dahulu.`,
        'IN_USE',
      )
    }
    softDelete('academicYears', year.id)
    audit({ user, action: 'DELETE', entity: 'AcademicYear', entityId: year.id, summary: `Menghapus tahun ajaran ${year.name}`, before: yearAudit(year) })
    return ok({ id: year.id })
  }),
]

/* ================================================================== classes */

function validateClass(input: Record<string, unknown>, selfId?: ID): Omit<ClassRoom, 'id' | 'studentCount'> {
  const fe = new FieldErrors()
  const d = db()
  const name = requireText(fe, input, 'name', 40)
  const program = requireText(fe, input, 'program', 120)
  const grade = input.grade
  if (grade === undefined || grade === null || grade === '') fe.add('grade', 'required')
  else if (!isInt(grade) || grade < 1 || grade > 13) fe.add('grade', 'Tingkat harus angka 1–13.')
  const shiftCode = trimmed(input.shiftCode)
  if (!shiftCode) fe.add('shiftCode', 'required')
  else if (!alive('shifts', d.shifts).some((s) => s.code === shiftCode)) fe.add('shiftCode', 'Shift tidak ditemukan.')
  const homeroomTeacherId = trimmed(input.homeroomTeacherId) || null
  if (homeroomTeacherId && !alive('teachers', d.teachers).some((t) => t.id === homeroomTeacherId)) {
    fe.add('homeroomTeacherId', 'Guru tidak ditemukan.')
  }
  const academicYearId = trimmed(input.academicYearId) || activeAcademicYear()?.id || ''
  if (!alive('academicYears', d.academicYears).some((y) => y.id === academicYearId)) {
    fe.add('academicYearId', 'Tahun ajaran tidak ditemukan.')
  }
  const status = asStatus(input.status ?? 'ACTIVE')
  if (!status) fe.add('status', 'invalid')
  if (
    name &&
    alive('classes', d.classes).some(
      (c) => c.id !== selfId && c.academicYearId === academicYearId && c.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    fe.add('name', 'duplicate')
  }
  if (homeroomTeacherId) {
    const other = alive('classes', d.classes).find(
      (c) => c.id !== selfId && c.academicYearId === academicYearId && c.homeroomTeacherId === homeroomTeacherId,
    )
    if (other) fe.add('homeroomTeacherId', `Guru ini sudah menjadi wali kelas ${other.name}.`)
  }
  fe.throwIfAny()
  return {
    name,
    program,
    grade: grade as number,
    shiftCode,
    homeroomTeacherId,
    academicYearId,
    status: status ?? 'ACTIVE',
  }
}

const withCount = (c: Omit<ClassRoom, 'studentCount'>): ClassRoom => ({
  ...c,
  studentCount: rosterForClass(c.id, '9999-12-31').length,
})
const CLASS_AUDIT: (keyof Omit<ClassRoom, 'studentCount'>)[] = ['name', 'grade', 'program', 'shiftCode', 'homeroomTeacherId', 'status']

const classHandlers: HttpHandler[] = [
  http.post(apiPath('/classes'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateClass(await body(request))
      const cls = { id: newId('cls'), ...v }
      db().classes.push(cls)
      persist()
      audit({ user, action: 'CREATE', entity: 'ClassRoom', entityId: cls.id, summary: `Membuat kelas ${cls.name}`, after: pick(cls, CLASS_AUDIT) })
      return created(withCount(cls))
    })
  }),

  http.patch(apiPath('/classes/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const cls = db().classes.find((c) => c.id === idParam(params) && !isDeleted('classes', c.id))
    if (!cls) return errors.notFound('Kelas tidak ditemukan.')
    const v = validateClass(merged(cls, await body(request)), cls.id)
    if (v.shiftCode !== cls.shiftCode) {
      const slots = alive('timetable', db().timetable).filter((s) => s.classId === cls.id).length
      if (slots > 0) {
        return errors.validation(
          { shiftCode: `Kelas masih memiliki ${slots} slot jadwal pada shift lama. Pindahkan/hapus jadwalnya dahulu.` },
        )
      }
    }
    const before = pick(cls, CLASS_AUDIT)
    Object.assign(cls, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'ClassRoom', entityId: cls.id, summary: `Mengubah kelas ${cls.name}`, before, after: pick(cls, CLASS_AUDIT) })
    return ok(withCount(cls))
  }),

  http.delete(apiPath('/classes/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const cls = db().classes.find((c) => c.id === idParam(params) && !isDeleted('classes', c.id))
    if (!cls) return errors.notFound('Kelas tidak ditemukan.')
    const activeStudents = alive('students', db().students).filter(
      (s) => s.classId === cls.id && s.status === 'ACTIVE',
    ).length
    if (activeStudents > 0) {
      return errors.conflict(
        `Kelas ${cls.name} masih memiliki ${activeStudents} siswa aktif. Pindahkan atau nonaktifkan siswa terlebih dahulu.`,
        'CLASS_HAS_STUDENTS',
      )
    }
    const slots = alive('timetable', db().timetable).filter((s) => s.classId === cls.id)
    slots.forEach((s) => softDelete('timetable', s.id))
    softDelete('classes', cls.id)
    audit({
      user,
      action: 'DELETE',
      entity: 'ClassRoom',
      entityId: cls.id,
      summary: `Menghapus kelas ${cls.name}${slots.length ? ` beserta ${slots.length} slot jadwal` : ''}`,
      before: pick(cls, CLASS_AUDIT),
    })
    return ok({ id: cls.id })
  }),
]

/* ================================================================== students */

function validateStudent(input: Record<string, unknown>, selfId?: ID): Omit<Student, 'id'> {
  const fe = new FieldErrors()
  const d = db()
  const nis = requireText(fe, input, 'nis', 20)
  if (nis && !/^[A-Za-z0-9.-]+$/.test(nis)) fe.add('nis', 'NIS hanya boleh berisi huruf, angka, titik, atau tanda hubung.')
  if (nis && alive('students', d.students).some((s) => s.id !== selfId && s.nis === nis)) fe.add('nis', 'duplicate')
  const name = requireText(fe, input, 'name', 120)
  const gender = input.gender
  if (gender !== 'L' && gender !== 'P') fe.add('gender', gender ? 'invalid' : 'required')
  const classId = trimmed(input.classId)
  if (!classId) fe.add('classId', 'required')
  else if (!alive('classes', d.classes).some((c) => c.id === classId)) fe.add('classId', 'Kelas tidak ditemukan.')
  const status = asStatus(input.status ?? 'ACTIVE')
  if (!status) fe.add('status', 'invalid')
  let inactiveFrom: string | null = null
  if (status === 'INACTIVE') {
    inactiveFrom = trimmed(input.inactiveFrom)
    if (!inactiveFrom) fe.add('inactiveFrom', 'Tanggal efektif nonaktif wajib diisi.')
    else if (!DATE_RE.test(inactiveFrom)) fe.add('inactiveFrom', 'invalid')
  }
  const guardianName = optionalText(input, 'guardianName')
  if (guardianName && guardianName.length > 120) fe.add('guardianName', 'too_long')
  const guardianPhone = normalizePhone(input.guardianPhone)
  if (guardianPhone && !PHONE_RE.test(guardianPhone)) fe.add('guardianPhone', 'Nomor telepon tidak valid (8–15 digit).')
  fe.throwIfAny()
  return {
    nis,
    name,
    gender: gender as 'L' | 'P',
    classId,
    status: status ?? 'ACTIVE',
    inactiveFrom: inactiveFrom || null,
    guardianName,
    guardianPhone,
  }
}

const STUDENT_AUDIT: (keyof Student)[] = ['nis', 'name', 'classId', 'status', 'inactiveFrom']

const studentHandlers: HttpHandler[] = [
  http.post(apiPath('/students'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateStudent(await body(request))
      const s: Student = { id: newId('std'), ...v }
      db().students.push(s)
      persist()
      audit({ user, action: 'CREATE', entity: 'Student', entityId: s.id, summary: `Menambah siswa NIS ${s.nis}`, after: pick(s, STUDENT_AUDIT) })
      return created({ ...s, guardianPhone: phoneForUser(s.guardianPhone, user) })
    })
  }),

  http.patch(apiPath('/students/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().students.find((x) => x.id === idParam(params) && !isDeleted('students', x.id))
    if (!s) return errors.notFound('Siswa tidak ditemukan.')
    const patch = await body(request)
    // Nomor yang dimask tidak boleh menimpa nomor asli.
    if (isStr(patch.guardianPhone) && patch.guardianPhone.includes('*')) delete patch.guardianPhone
    const v = validateStudent(merged(s, patch), s.id)
    const before = pick(s, STUDENT_AUDIT)
    Object.assign(s, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'Student', entityId: s.id, summary: `Mengubah data siswa NIS ${s.nis}`, before, after: pick(s, STUDENT_AUDIT) })
    return ok({ ...s, guardianPhone: phoneForUser(s.guardianPhone, user) })
  }),

  http.delete(apiPath('/students/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().students.find((x) => x.id === idParam(params) && !isDeleted('students', x.id))
    if (!s) return errors.notFound('Siswa tidak ditemukan.')
    softDelete('students', s.id)
    audit({ user, action: 'DELETE', entity: 'Student', entityId: s.id, summary: `Menghapus siswa NIS ${s.nis}`, before: pick(s, STUDENT_AUDIT) })
    return ok({ id: s.id })
  }),
]

/* ================================================================== teachers */

function validateTeacher(input: Record<string, unknown>, selfId?: ID): Omit<Teacher, 'id' | 'userId'> {
  const fe = new FieldErrors()
  const d = db()
  const nip = requireText(fe, input, 'nip', 30)
  if (nip && !/^[A-Za-z0-9.-]+$/.test(nip)) fe.add('nip', 'invalid')
  if (nip && alive('teachers', d.teachers).some((t) => t.id !== selfId && t.nip === nip)) fe.add('nip', 'duplicate')
  const rawCode = optionalText(input, 'code')
  if (rawCode && rawCode.length > 16) fe.add('code', 'too_long')
  const code = rawCode ? rawCode.toUpperCase() : null
  if (code && !/^[A-Z0-9.-]+$/.test(code)) fe.add('code', 'Kode guru hanya huruf, angka, titik, atau tanda hubung.')
  if (
    code &&
    alive('teachers', d.teachers).some((t) => t.id !== selfId && (t.code ?? '').toUpperCase() === code)
  ) {
    fe.add('code', 'duplicate')
  }
  const name = requireText(fe, input, 'name', 120)
  const phone = normalizePhone(input.phone)
  if (phone && !PHONE_RE.test(phone)) fe.add('phone', 'Nomor telepon tidak valid (8–15 digit).')
  const rawSubjects = Array.isArray(input.subjectIds) ? input.subjectIds : []
  const subjectIds = [...new Set(rawSubjects.filter(isStr))]
  const known = new Set(alive('subjects', d.subjects).map((s) => s.id))
  if (subjectIds.some((id) => !known.has(id))) fe.add('subjectIds', 'Mata pelajaran tidak ditemukan.')
  const rawDays = Array.isArray(input.attendanceDays) ? input.attendanceDays : []
  const attendanceDays = [...new Set(rawDays.filter((x): x is number => isInt(x) && x >= 1 && x <= 6))].sort(
    (a, b) => a - b,
  )
  const rawOrder = asRecord(input.attendanceOrder)
  const attendanceOrder: Partial<Record<number, number>> = {}
  for (let day = 1; day <= 6; day++) {
    const val = rawOrder[String(day)]
    if (isInt(val) && val >= 1 && val <= 500) {
      attendanceOrder[day] = val
    }
  }
  const status = asStatus(input.status ?? 'ACTIVE')
  if (!status) fe.add('status', 'invalid')
  fe.throwIfAny()
  return { nip, code, name, phone, subjectIds, attendanceDays, attendanceOrder, status: status ?? 'ACTIVE' }
}

const TEACHER_AUDIT: (keyof Teacher)[] = ['nip', 'code', 'name', 'subjectIds', 'attendanceDays', 'status']

function buildUniqueUsernameFromTeacherName(name: string, existingUsernames: Set<string>): string {
  const withoutTitle = (name.split(',')[0] ?? name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
  const parts = withoutTitle.split(/\s+/).filter((p) => p.length > 1)
  const base = parts.slice(0, 2).join('.') || 'guru'
  let candidate = base.slice(0, 24)
  let seq = 2
  while (existingUsernames.has(candidate)) {
    candidate = `${base.slice(0, 20)}.${seq}`
    seq += 1
  }
  existingUsernames.add(candidate)
  return candidate
}

const teacherHandlers: HttpHandler[] = [
  http.post(apiPath('/teachers/presence-matrix'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const payload = await body(request)
      const rawItems = Array.isArray(payload.items) ? payload.items : []
      if (rawItems.length === 0) {
        return errors.validation({ items: 'Daftar matriks kehadiran guru tidak boleh kosong.' })
      }
      const replaceSchedule = payload.replaceSchedule !== false
      const createAccounts = payload.createAccounts === true
      const d = db()
      const aliveTeachers = alive('teachers', d.teachers)

      if (replaceSchedule) {
        for (const t of aliveTeachers) {
          t.attendanceDays = []
          t.attendanceOrder = {}
        }
      }

      const existingUsernames = new Set(d.users.map((u) => u.username.toLowerCase()))
      const existingNips = new Set(aliveTeachers.map((t) => t.nip.toUpperCase()))
      let updatedCount = 0
      let createdCount = 0
      let accountsCreatedCount = 0

      for (const rawItem of rawItems) {
        const item = asRecord(rawItem)
        const name = trimmed(item.name)
        const code = trimmed(item.code).toUpperCase()
        if (!name) continue
        const rawDays = Array.isArray(item.attendanceDays) ? item.attendanceDays : []
        const attendanceDays = [...new Set(rawDays.filter((x): x is number => isInt(x) && x >= 1 && x <= 6))].sort(
          (a, b) => a - b,
        )
        const rawOrder = asRecord(item.attendanceOrder)
        const attendanceOrder: Partial<Record<number, number>> = {}
        for (let day = 1; day <= 6; day++) {
          const val = rawOrder[String(day)]
          if (isInt(val) && val >= 1 && val <= 500) {
            attendanceOrder[day] = val
          }
        }

        const normName = (name.split(',')[0] ?? name).trim().toLowerCase()
        let teacher = alive('teachers', d.teachers).find(
          (t) =>
            (code && (t.code ?? '').toUpperCase() === code) ||
            (code && t.nip.toUpperCase() === code) ||
            (t.name.split(',')[0] ?? t.name).trim().toLowerCase() === normName,
        )

        if (teacher) {
          if (code) teacher.code = code
          if (name.length >= teacher.name.length) teacher.name = name
          teacher.attendanceDays = attendanceDays
          teacher.attendanceOrder = attendanceOrder
          updatedCount += 1
        } else {
          let nip = trimmed(item.nip) || (code ? `KODE-${code}` : `GURU-${d.teachers.length + 1}`)
          let suffix = 2
          while (existingNips.has(nip.toUpperCase())) {
            nip = `${code || 'GURU'}-${suffix}`
            suffix += 1
          }
          existingNips.add(nip.toUpperCase())
          teacher = {
            id: newId('tch'),
            nip,
            code: code || null,
            name,
            phone: null,
            subjectIds: [],
            attendanceDays,
            attendanceOrder,
            status: 'ACTIVE',
            userId: null,
          }
          d.teachers.push(teacher)
          createdCount += 1
        }

        if (createAccounts && !teacher.userId && teacher.status === 'ACTIVE') {
          const username = buildUniqueUsernameFromTeacherName(teacher.name, existingUsernames)
          const nowIso = new Date().toISOString()
          const newUser = {
            id: newId('usr'),
            username,
            password: 'Guru12345',
            name: teacher.name,
            email: null,
            roles: ['TEACHER' as const],
            teacherId: teacher.id,
            status: 'ACTIVE' as const,
            createdAt: nowIso,
            updatedAt: nowIso,
            lastLoginAt: null,
            mustChangePassword: true,
            version: 1,
          }
          d.users.push(newUser)
          teacher.userId = newUser.id
          accountsCreatedCount += 1
        }
      }

      persist()
      audit({
        user,
        action: 'UPDATE',
        entity: 'TeacherPresenceMatrix',
        entityId: 'matrix_mon_sat',
        summary: `Impor matriks kehadiran guru (${updatedCount} diperbarui, ${createdCount} guru baru, ${accountsCreatedCount} akun dibuat)`,
        after: { updatedCount, createdCount, accountsCreatedCount, totalItems: rawItems.length },
      })
      return ok({
        updatedCount,
        createdCount,
        accountsCreatedCount,
        totalScheduledTeachers: rawItems.length,
      })
    })
  }),

  http.post(apiPath('/teachers'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateTeacher(await body(request))
      const t: Teacher = { id: newId('tch'), ...v, userId: null }
      db().teachers.push(t)
      persist()
      audit({ user, action: 'CREATE', entity: 'Teacher', entityId: t.id, summary: `Menambah guru ${t.name}`, after: pick(t, TEACHER_AUDIT) })
      return created(t)
    })
  }),

  http.patch(apiPath('/teachers/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const t = db().teachers.find((x) => x.id === idParam(params) && !isDeleted('teachers', x.id))
    if (!t) return errors.notFound('Guru tidak ditemukan.')
    const v = validateTeacher(merged(t, await body(request)), t.id)
    const before = pick(t, TEACHER_AUDIT)
    Object.assign(t, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'Teacher', entityId: t.id, summary: `Mengubah data guru ${t.name}`, before, after: pick(t, TEACHER_AUDIT) })
    return ok(t)
  }),

  http.delete(apiPath('/teachers/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const t = db().teachers.find((x) => x.id === idParam(params) && !isDeleted('teachers', x.id))
    if (!t) return errors.notFound('Guru tidak ditemukan.')
    const slots = alive('timetable', db().timetable).filter((s) => s.teacherId === t.id).length
    if (slots > 0) {
      return errors.conflict(
        `${t.name} masih memiliki ${slots} slot jadwal mengajar. Ganti guru pada jadwal tersebut atau ubah status menjadi Nonaktif.`,
        'IN_USE',
      )
    }
    const homeroom = alive('classes', db().classes).find((c) => c.homeroomTeacherId === t.id)
    if (homeroom) {
      return errors.conflict(`${t.name} masih menjadi wali kelas ${homeroom.name}.`, 'IN_USE')
    }
    softDelete('teachers', t.id)
    audit({ user, action: 'DELETE', entity: 'Teacher', entityId: t.id, summary: `Menghapus guru ${t.name}`, before: pick(t, TEACHER_AUDIT) })
    return ok({ id: t.id })
  }),
]

/* ================================================================== subjects */

function validateSubject(input: Record<string, unknown>, selfId?: ID): Omit<Subject, 'id'> {
  const fe = new FieldErrors()
  const code = requireText(fe, input, 'code', 12).toUpperCase()
  if (code && !/^[A-Z0-9_-]+$/.test(code)) fe.add('code', 'Kode hanya huruf/angka tanpa spasi.')
  if (code && alive('subjects', db().subjects).some((s) => s.id !== selfId && s.code.toUpperCase() === code)) {
    fe.add('code', 'duplicate')
  }
  const name = requireText(fe, input, 'name', 80)
  fe.throwIfAny()
  return { code, name }
}

const subjectHandlers: HttpHandler[] = [
  http.post(apiPath('/subjects'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateSubject(await body(request))
      const s: Subject = { id: newId('sub'), ...v }
      db().subjects.push(s)
      persist()
      audit({ user, action: 'CREATE', entity: 'Subject', entityId: s.id, summary: `Menambah mata pelajaran ${s.name}`, after: { ...s } })
      return created(s)
    })
  }),

  http.patch(apiPath('/subjects/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().subjects.find((x) => x.id === idParam(params) && !isDeleted('subjects', x.id))
    if (!s) return errors.notFound('Mata pelajaran tidak ditemukan.')
    const v = validateSubject(merged(s, await body(request)), s.id)
    const before = { code: s.code, name: s.name }
    Object.assign(s, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'Subject', entityId: s.id, summary: `Mengubah mata pelajaran ${s.name}`, before, after: { code: s.code, name: s.name } })
    return ok(s)
  }),

  http.delete(apiPath('/subjects/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().subjects.find((x) => x.id === idParam(params) && !isDeleted('subjects', x.id))
    if (!s) return errors.notFound('Mata pelajaran tidak ditemukan.')
    const slots = alive('timetable', db().timetable).filter((x) => x.subjectId === s.id).length
    if (slots > 0) {
      return errors.conflict(
        `Mata pelajaran ${s.name} masih dipakai di ${slots} slot jadwal. Ubah jadwal tersebut terlebih dahulu.`,
        'IN_USE',
      )
    }
    softDelete('subjects', s.id)
    for (const t of db().teachers) t.subjectIds = t.subjectIds.filter((id) => id !== s.id)
    persist()
    audit({ user, action: 'DELETE', entity: 'Subject', entityId: s.id, summary: `Menghapus mata pelajaran ${s.name}`, before: { code: s.code, name: s.name } })
    return ok({ id: s.id })
  }),
]

/* ================================================================== shifts */

function shiftInUse(code: string) {
  const d = db()
  return (
    alive('classes', d.classes).some((c) => c.shiftCode === code) ||
    alive('timetable', d.timetable).some((s) => s.shiftCode === code)
  )
}

function validateShift(input: Record<string, unknown>, self?: Shift): Omit<Shift, 'id'> {
  const fe = new FieldErrors()
  const code = requireText(fe, input, 'code', 20).toUpperCase()
  if (code && !/^[A-Z][A-Z0-9_]*$/.test(code)) fe.add('code', 'Kode diawali huruf; hanya huruf kapital, angka, garis bawah.')
  if (code && alive('shifts', db().shifts).some((s) => s.id !== self?.id && s.code === code)) fe.add('code', 'duplicate')
  if (self && code && code !== self.code && shiftInUse(self.code)) {
    fe.add('code', 'Kode shift tidak dapat diubah karena sudah dipakai kelas/jadwal.')
  }
  const name = requireText(fe, input, 'name', 40)
  const startTime = requireTime(fe, input, 'startTime')
  const endTime = requireTime(fe, input, 'endTime')
  if (!fe.details.startTime && !fe.details.endTime && minutesBetween(startTime, endTime) <= 0) {
    fe.add('endTime', 'Jam selesai harus setelah jam mulai.')
  }
  const tol = input.lateToleranceMinutes
  if (tol === undefined || tol === null || tol === '') fe.add('lateToleranceMinutes', 'required')
  else if (!isInt(tol)) fe.add('lateToleranceMinutes', 'invalid')
  else if (tol < 0) fe.add('lateToleranceMinutes', 'negative')
  else if (tol > 120) fe.add('lateToleranceMinutes', 'Maksimal 120 menit.')
  fe.throwIfAny()
  return {
    code,
    name,
    startTime,
    endTime,
    lateToleranceMinutes: tol as number,
    isActive: input.isActive === undefined ? true : input.isActive === true,
  }
}

const SHIFT_AUDIT: (keyof Shift)[] = ['code', 'name', 'startTime', 'endTime', 'lateToleranceMinutes', 'isActive']

const shiftHandlers: HttpHandler[] = [
  http.post(apiPath('/shifts'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateShift(await body(request))
      const s: Shift = { id: newId('sh'), ...v }
      db().shifts.push(s)
      persist()
      audit({ user, action: 'CREATE', entity: 'Shift', entityId: s.id, summary: `Menambah shift ${s.name}`, after: pick(s, SHIFT_AUDIT) })
      return created(s)
    })
  }),

  http.patch(apiPath('/shifts/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().shifts.find((x) => x.id === idParam(params) && !isDeleted('shifts', x.id))
    if (!s) return errors.notFound('Shift tidak ditemukan.')
    const v = validateShift(merged(s, await body(request)), s)
    const before = pick(s, SHIFT_AUDIT)
    const oldCode = s.code
    Object.assign(s, v)
    if (oldCode !== s.code) {
      for (const p of db().periods) if (p.shiftCode === oldCode) p.shiftCode = s.code
      for (const a of db().dutyAssignments) if (a.shiftCode === oldCode) a.shiftCode = s.code
    }
    persist()
    audit({ user, action: 'UPDATE', entity: 'Shift', entityId: s.id, summary: `Mengubah shift ${s.name}`, before, after: pick(s, SHIFT_AUDIT) })
    return ok(s)
  }),

  http.delete(apiPath('/shifts/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const s = db().shifts.find((x) => x.id === idParam(params) && !isDeleted('shifts', x.id))
    if (!s) return errors.notFound('Shift tidak ditemukan.')
    if (shiftInUse(s.code)) {
      return errors.conflict(
        `Shift ${s.name} masih dipakai oleh kelas atau jadwal. Nonaktifkan shift atau pindahkan kelasnya terlebih dahulu.`,
        'IN_USE',
      )
    }
    softDelete('shifts', s.id)
    alive('periods', db().periods).filter((p) => p.shiftCode === s.code).forEach((p) => softDelete('periods', p.id))
    audit({ user, action: 'DELETE', entity: 'Shift', entityId: s.id, summary: `Menghapus shift ${s.name}`, before: pick(s, SHIFT_AUDIT) })
    return ok({ id: s.id })
  }),
]

/* ================================================================== periods */

function validatePeriod(input: Record<string, unknown>, selfId?: ID): Omit<Period, 'id'> {
  const fe = new FieldErrors()
  const d = db()
  const shiftCode = trimmed(input.shiftCode)
  if (!shiftCode) fe.add('shiftCode', 'required')
  else if (!alive('shifts', d.shifts).some((s) => s.code === shiftCode)) fe.add('shiftCode', 'Shift tidak ditemukan.')
  const number = input.number
  if (number === undefined || number === null || number === '') fe.add('number', 'required')
  else if (!isInt(number) || number < 1 || number > 20) fe.add('number', 'Jam ke- harus angka 1–20.')
  const startTime = requireTime(fe, input, 'startTime')
  const endTime = requireTime(fe, input, 'endTime')
  if (!fe.details.startTime && !fe.details.endTime && minutesBetween(startTime, endTime) <= 0) {
    fe.add('endTime', 'Jam selesai harus setelah jam mulai.')
  }
  const siblings = alive('periods', d.periods).filter((p) => p.shiftCode === shiftCode && p.id !== selfId)
  if (isInt(number) && siblings.some((p) => p.number === number)) fe.add('number', 'duplicate')
  if (!fe.details.startTime && !fe.details.endTime) {
    const clash = siblings.find(
      (p) => minutesBetween(p.startTime, endTime) > 0 && minutesBetween(startTime, p.endTime) > 0,
    )
    if (clash) fe.add('startTime', `Waktu bertumpuk dengan jam ke-${clash.number} (${clash.startTime}–${clash.endTime}).`)
  }
  fe.throwIfAny()
  return {
    shiftCode,
    number: number as number,
    startTime,
    endTime,
    durationMinutes: minutesBetween(startTime, endTime),
  }
}

const periodInUse = (p: Period) =>
  alive('timetable', db().timetable).filter(
    (s) => s.shiftCode === p.shiftCode && s.periodStart <= p.number && s.periodEnd >= p.number,
  ).length

const periodHandlers: HttpHandler[] = [
  http.post(apiPath('/periods'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validatePeriod(await body(request))
      const p: Period = { id: newId('per'), ...v }
      db().periods.push(p)
      persist()
      audit({ user, action: 'CREATE', entity: 'Period', entityId: p.id, summary: `Menambah jam ke-${p.number} shift ${p.shiftCode}`, after: { ...p } })
      return created(p)
    })
  }),

  http.patch(apiPath('/periods/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const p = db().periods.find((x) => x.id === idParam(params) && !isDeleted('periods', x.id))
    if (!p) return errors.notFound('Periode jam tidak ditemukan.')
    const v = validatePeriod(merged(p, await body(request)), p.id)
    if ((v.number !== p.number || v.shiftCode !== p.shiftCode) && periodInUse(p) > 0) {
      return errors.validation({ number: 'Nomor jam/shift tidak dapat diubah karena dipakai jadwal. Ubah waktunya saja.' })
    }
    const before = { ...p }
    Object.assign(p, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'Period', entityId: p.id, summary: `Mengubah jam ke-${p.number} shift ${p.shiftCode}`, before, after: { ...p } })
    return ok(p)
  }),

  http.delete(apiPath('/periods/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const p = db().periods.find((x) => x.id === idParam(params) && !isDeleted('periods', x.id))
    if (!p) return errors.notFound('Periode jam tidak ditemukan.')
    const used = periodInUse(p)
    if (used > 0) {
      return errors.conflict(`Jam ke-${p.number} masih dipakai oleh ${used} slot jadwal.`, 'IN_USE')
    }
    softDelete('periods', p.id)
    audit({ user, action: 'DELETE', entity: 'Period', entityId: p.id, summary: `Menghapus jam ke-${p.number} shift ${p.shiftCode}`, before: { ...p } })
    return ok({ id: p.id })
  }),
]

/* ================================================================== timetables */

function validateSlot(input: Record<string, unknown>) {
  const fe = new FieldErrors()
  const d = db()
  const dayOfWeek = input.dayOfWeek
  if (dayOfWeek === undefined || dayOfWeek === null || dayOfWeek === '') fe.add('dayOfWeek', 'required')
  else if (!isInt(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) fe.add('dayOfWeek', 'invalid')
  const shiftCode = trimmed(input.shiftCode)
  if (!shiftCode) fe.add('shiftCode', 'required')
  else if (!alive('shifts', d.shifts).some((s) => s.code === shiftCode)) fe.add('shiftCode', 'Shift tidak ditemukan.')
  const classId = trimmed(input.classId)
  const cls = alive('classes', d.classes).find((c) => c.id === classId)
  if (!classId) fe.add('classId', 'required')
  else if (!cls) fe.add('classId', 'Kelas tidak ditemukan.')
  else if (shiftCode && cls.shiftCode !== shiftCode) fe.add('classId', `Kelas ${cls.name} berada di shift lain.`)
  const teacherId = trimmed(input.teacherId)
  const teacher = alive('teachers', d.teachers).find((t) => t.id === teacherId)
  if (!teacherId) fe.add('teacherId', 'required')
  else if (!teacher) fe.add('teacherId', 'Guru tidak ditemukan.')
  else if (teacher.status !== 'ACTIVE') fe.add('teacherId', 'Guru berstatus nonaktif.')
  const subjectId = trimmed(input.subjectId)
  if (!subjectId) fe.add('subjectId', 'required')
  else if (!alive('subjects', d.subjects).some((s) => s.id === subjectId)) fe.add('subjectId', 'Mata pelajaran tidak ditemukan.')
  const periodStart = input.periodStart
  const periodEnd = input.periodEnd
  if (!isInt(periodStart)) fe.add('periodStart', periodStart === undefined || periodStart === null ? 'required' : 'invalid')
  if (!isInt(periodEnd)) fe.add('periodEnd', periodEnd === undefined || periodEnd === null ? 'required' : 'invalid')
  if (isInt(periodStart) && isInt(periodEnd)) {
    if (periodEnd < periodStart) fe.add('periodEnd', 'Jam akhir tidak boleh sebelum jam awal.')
    const numbers = new Set(alive('periods', d.periods).filter((p) => p.shiftCode === shiftCode).map((p) => p.number))
    for (let n = periodStart; n <= periodEnd; n++) {
      if (!numbers.has(n)) {
        fe.add(n === periodStart ? 'periodStart' : 'periodEnd', `Jam ke-${n} belum terdaftar pada shift ini.`)
        break
      }
    }
  }
  fe.throwIfAny()
  const start = periodStart as number
  const end = periodEnd as number
  return {
    dayOfWeek: dayOfWeek as number,
    shiftCode,
    classId,
    teacherId,
    subjectId,
    periodStart: start,
    periodEnd: end,
    periodCount: end - start + 1,
  }
}

function scheduleConflictResponse(slot: Parameters<typeof findScheduleConflicts>[0], excludeId?: ID) {
  const conflicts = findScheduleConflicts(slot, excludeId)
  if (conflicts.length === 0) return null
  return errors.conflict(
    'Jadwal bentrok dengan slot lain. Ubah hari, jam, guru, atau kelas.',
    'SCHEDULE_CONFLICT',
    conflictDetails(conflicts),
  )
}

const SLOT_AUDIT: (keyof TimetableSlot)[] = ['dayOfWeek', 'shiftCode', 'classId', 'teacherId', 'subjectId', 'periodStart', 'periodEnd']

const timetableHandlers: HttpHandler[] = [
  http.post(apiPath('/timetables'), async ({ request }) => {
    await latency()
    const user = writer(request)
    return withIdempotency(request, async () => {
      const v = validateSlot(await body(request))
      const sem = currentSemesterIds()
      if (!sem.semesterId) return errors.conflict('Belum ada semester aktif. Aktifkan semester terlebih dahulu.', 'NO_ACTIVE_SEMESTER')
      const slot: TimetableSlot = { id: newId('tt'), ...sem, ...v }
      const conflict = scheduleConflictResponse(slot)
      if (conflict) return conflict
      db().timetable.push(slot)
      persist()
      audit({ user, action: 'CREATE', entity: 'TimetableSlot', entityId: slot.id, summary: 'Menambah slot jadwal', after: pick(slot, SLOT_AUDIT) })
      return created(slot)
    })
  }),

  http.patch(apiPath('/timetables/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const slot = db().timetable.find((x) => x.id === idParam(params) && !isDeleted('timetable', x.id))
    if (!slot) return errors.notFound('Slot jadwal tidak ditemukan.')
    const v = validateSlot(merged(slot, await body(request)))
    const next = { ...slot, ...v }
    const conflict = scheduleConflictResponse(next, slot.id)
    if (conflict) return conflict
    const before = pick(slot, SLOT_AUDIT)
    Object.assign(slot, v)
    persist()
    audit({ user, action: 'UPDATE', entity: 'TimetableSlot', entityId: slot.id, summary: 'Mengubah slot jadwal', before, after: pick(slot, SLOT_AUDIT) })
    return ok(slot)
  }),

  http.delete(apiPath('/timetables/:id'), async ({ request, params }) => {
    await latency()
    const user = writer(request)
    const slot = db().timetable.find((x) => x.id === idParam(params) && !isDeleted('timetable', x.id))
    if (!slot) return errors.notFound('Slot jadwal tidak ditemukan.')
    softDelete('timetable', slot.id)
    audit({ user, action: 'DELETE', entity: 'TimetableSlot', entityId: slot.id, summary: 'Menghapus slot jadwal', before: pick(slot, SLOT_AUDIT) })
    return ok({ id: slot.id })
  }),
]

/* ================================================================== duty assignments */

function validateDuty(input: Record<string, unknown>, selfId?: ID): Omit<DutyAssignment, 'id'> {
  const fe = new FieldErrors()
  const d = db()
  const rawDate = trimmed(input.date)
  const rawDow = input.dayOfWeek
  const hasDow = rawDow !== null && rawDow !== undefined && rawDow !== ''
  let date: string | null = null
  let dayOfWeek: number | null = null
  if (rawDate && hasDow) fe.add('date', 'Pilih salah satu: hari rutin atau tanggal khusus.')
  else if (rawDate) {
    if (!DATE_RE.test(rawDate)) fe.add('date', 'invalid')
    else date = rawDate
  } else if (hasDow) {
    if (!isInt(rawDow) || rawDow < 1 || rawDow > 7) fe.add('dayOfWeek', 'invalid')
    else dayOfWeek = rawDow
  } else {
    fe.add('dayOfWeek', 'Pilih hari rutin atau tanggal khusus.')
  }
  const shiftCode = trimmed(input.shiftCode)
  if (!shiftCode) fe.add('shiftCode', 'required')
  else if (!alive('shifts', d.shifts).some((s) => s.code === shiftCode)) fe.add('shiftCode', 'Shift tidak ditemukan.')
  const raw = Array.isArray(input.teacherIds) ? input.teacherIds : []
  const teacherIds = [...new Set(raw.filter(isStr))]
  if (teacherIds.length === 0) fe.add('teacherIds', 'Pilih minimal satu guru piket.')
  else if (teacherIds.length > 10) fe.add('teacherIds', 'Maksimal 10 guru piket per shift.')
  else {
    const known = new Set(alive('teachers', d.teachers).filter((t) => t.status === 'ACTIVE').map((t) => t.id))
    if (teacherIds.some((id) => !known.has(id))) fe.add('teacherIds', 'Ada guru yang tidak ditemukan atau nonaktif.')
  }
  const note = optionalText(input, 'note')
  if (note && note.length > 300) fe.add('note', 'too_long')
  if (shiftCode && (date || dayOfWeek)) {
    const dup = alive('dutyAssignments', d.dutyAssignments).find(
      (a) =>
        a.id !== selfId &&
        a.shiftCode === shiftCode &&
        (date ? a.date === date : a.date === null && a.dayOfWeek === dayOfWeek),
    )
    if (dup) fe.add(date ? 'date' : 'dayOfWeek', 'Penugasan untuk hari/tanggal dan shift ini sudah ada. Ubah penugasan yang ada.')
  }
  fe.throwIfAny()
  return { dayOfWeek, date, shiftCode, teacherIds, note }
}

const dutyLabel = (a: Pick<DutyAssignment, 'dayOfWeek' | 'date' | 'shiftCode'>) =>
  a.date ? `tanggal ${a.date} shift ${a.shiftCode}` : `hari ke-${a.dayOfWeek} shift ${a.shiftCode}`
const DUTY_AUDIT: (keyof DutyAssignment)[] = ['dayOfWeek', 'date', 'shiftCode', 'teacherIds', 'note']

function dutyWriter(request: Request) {
  const user = requireAuth(request)
  requirePermission(user, 'master:write', 'duty_assignment:write')
  return user
}

const dutyHandlers: HttpHandler[] = [
  http.get(apiPath('/duty-assignments'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'master:read', 'master:write', 'duty_agenda:read')
    const sp = searchParams(request)
    const shiftCode = sp.get('shiftCode')
    const type = sp.get('type') // 'routine' | 'override'
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    const date = sp.get('date')
    const dow = sp.get('dayOfWeek')
    const items = alive('dutyAssignments', db().dutyAssignments)
      .filter(
        (a) =>
          (!shiftCode || a.shiftCode === shiftCode) &&
          (type !== 'routine' || a.date === null) &&
          (type !== 'override' || a.date !== null) &&
          (!date || a.date === date) &&
          (!dow || a.dayOfWeek === Number(dow)) &&
          (!dateFrom || (a.date !== null && a.date >= dateFrom)) &&
          (!dateTo || (a.date !== null && a.date <= dateTo)),
      )
      .sort(
        (a, b) =>
          (a.date ?? '').localeCompare(b.date ?? '') ||
          (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) ||
          a.shiftCode.localeCompare(b.shiftCode) * -1,
      )
    return ok(items)
  }),

  http.post(apiPath('/duty-assignments'), async ({ request }) => {
    await latency()
    const user = dutyWriter(request)
    return withIdempotency(request, async () => {
      const v = validateDuty(await body(request))
      const a: DutyAssignment = { id: newId('duty'), ...v }
      db().dutyAssignments.push(a)
      persist()
      audit({ user, action: 'CREATE', entity: 'DutyAssignment', entityId: a.id, summary: `Menetapkan petugas piket ${dutyLabel(a)}`, after: pick(a, DUTY_AUDIT) })
      return created(a)
    })
  }),

  http.patch(apiPath('/duty-assignments/:id'), async ({ request, params }) => {
    await latency()
    const user = dutyWriter(request)
    const a = db().dutyAssignments.find((x) => x.id === idParam(params) && !isDeleted('dutyAssignments', x.id))
    if (!a) return errors.notFound('Penugasan piket tidak ditemukan.')
    const patch = await body(request)
    // Jenis penugasan (rutin vs tanggal) mengikuti field yang dikirim; bila tidak dikirim tetap.
    const base: Record<string, unknown> = { ...a }
    if ('date' in patch && patch.date) base.dayOfWeek = null
    if ('dayOfWeek' in patch && patch.dayOfWeek) base.date = null
    const v = validateDuty({ ...base, ...patch }, a.id)
    const before = pick(a, DUTY_AUDIT)
    Object.assign(a, v)
    persist()
    audit({
      user,
      action: 'UPDATE',
      entity: 'DutyAssignment',
      entityId: a.id,
      summary: `Mengubah petugas piket ${dutyLabel(a)}`,
      before,
      after: pick(a, DUTY_AUDIT),
      reason: optionalText(patch, 'reason'),
    })
    return ok(a)
  }),

  http.delete(apiPath('/duty-assignments/:id'), async ({ request, params }) => {
    await latency()
    const user = dutyWriter(request)
    const a = db().dutyAssignments.find((x) => x.id === idParam(params) && !isDeleted('dutyAssignments', x.id))
    if (!a) return errors.notFound('Penugasan piket tidak ditemukan.')
    softDelete('dutyAssignments', a.id)
    audit({ user, action: 'DELETE', entity: 'DutyAssignment', entityId: a.id, summary: `Menghapus petugas piket ${dutyLabel(a)}`, before: pick(a, DUTY_AUDIT) })
    return ok({ id: a.id })
  }),
]

export const masterWriteHandlers: HttpHandler[] = [
  ...academicYearHandlers,
  ...classHandlers,
  ...studentHandlers,
  ...teacherHandlers,
  ...subjectHandlers,
  ...shiftHandlers,
  ...periodHandlers,
  ...timetableHandlers,
  ...dutyHandlers,
]
