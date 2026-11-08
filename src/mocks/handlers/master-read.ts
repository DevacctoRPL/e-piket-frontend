/**
 * Endpoint baca data master & jadwal (dipakai lintas fitur). Endpoint tulis ada di master-write.ts.
 */
import { http } from 'msw'
import type { ClassRoom } from '@/types/entities'
import { db, isDeleted } from '../db'
import { activeAcademicYear, rosterForClass, slotsOn } from '../domain'
import {
  accessibleClassIds,
  apiPath,
  errors,
  latency,
  matchesSearch,
  ok,
  paginate,
  requireAuth,
  requirePermission,
  searchParams,
  sortBy,
} from '../utils'
import { phoneForUser } from '../domain'

export const masterReadHandlers = [
  http.get(apiPath('/academic-years'), async ({ request }) => {
    await latency()
    requireAuth(request)
    const sp = searchParams(request)
    let items = db().academicYears.filter((y) => !isDeleted('academicYears', y.id))
    if (sp.get('active') === 'true') items = items.filter((y) => y.isActive)
    return ok(sortBy(items, '-startDate'))
  }),

  http.get(apiPath('/shifts'), async ({ request }) => {
    await latency(80)
    requireAuth(request)
    return ok(db().shifts.filter((s) => !isDeleted('shifts', s.id)))
  }),

  http.get(apiPath('/periods'), async ({ request }) => {
    await latency(80)
    requireAuth(request)
    const shiftCode = searchParams(request).get('shiftCode')
    const items = db()
      .periods.filter((p) => !isDeleted('periods', p.id) && (!shiftCode || p.shiftCode === shiftCode))
      .sort((a, b) => a.shiftCode.localeCompare(b.shiftCode) || a.number - b.number)
    return ok(items)
  }),

  http.get(apiPath('/subjects'), async ({ request }) => {
    await latency(80)
    requireAuth(request)
    const q = searchParams(request).get('search')
    return ok(
      db()
        .subjects.filter((s) => !isDeleted('subjects', s.id) && matchesSearch(q, s.name, s.code))
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    )
  }),

  http.get(apiPath('/classes'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    const sp = searchParams(request)
    const scope = sp.get('scope') === 'mine' ? accessibleClassIds(user) : null
    const yearId = sp.get('academicYearId') ?? activeAcademicYear()?.id
    const items: ClassRoom[] = db()
      .classes.filter(
        (c) =>
          !isDeleted('classes', c.id) &&
          (!yearId || c.academicYearId === yearId) &&
          (!sp.get('shiftCode') || c.shiftCode === sp.get('shiftCode')) &&
          (!sp.get('status') || c.status === sp.get('status')) &&
          (!scope || scope.includes(c.id)) &&
          matchesSearch(sp.get('search'), c.name, c.program),
      )
      .map((c) => ({ ...c, studentCount: rosterForClass(c.id, '9999-12-31').length }))
      .sort((a, b) => a.shiftCode.localeCompare(b.shiftCode) * -1 || a.grade - b.grade || a.name.localeCompare(b.name))
    return ok(items)
  }),

  http.get(apiPath('/classes/:id'), async ({ request, params }) => {
    await latency()
    requireAuth(request)
    const c = db().classes.find((x) => x.id === params.id && !isDeleted('classes', x.id))
    if (!c) return errors.notFound('Kelas tidak ditemukan.')
    return ok({ ...c, studentCount: rosterForClass(c.id, '9999-12-31').length })
  }),

  http.get(apiPath('/students'), async ({ request }) => {
    await latency()
    const user = requireAuth(request)
    requirePermission(user, 'master:read', 'student_attendance:read', 'dismissal:read', 'extra_activity:read')
    const sp = searchParams(request)
    const scope = accessibleClassIds(user)
    const classId = sp.get('classId')
    if (classId && scope && !scope.includes(classId)) {
      return errors.forbidden('Anda tidak memiliki akses ke data kelas ini.')
    }
    const active = sp.get('active')
    const items = db()
      .students.filter(
        (s) =>
          !isDeleted('students', s.id) &&
          (!classId || s.classId === classId) &&
          (!scope || scope.includes(s.classId)) &&
          (active === null || (active === 'true' ? s.status === 'ACTIVE' : s.status === 'INACTIVE')) &&
          matchesSearch(sp.get('search'), s.name, s.nis),
      )
      .map((s) => ({ ...s, guardianPhone: phoneForUser(s.guardianPhone, user) }))
    return paginate(sortBy(items, sp.get('sort'), 'name'), request)
  }),

  http.get(apiPath('/students/:id'), async ({ request, params }) => {
    await latency()
    const user = requireAuth(request)
    const s = db().students.find((x) => x.id === params.id && !isDeleted('students', x.id))
    if (!s) return errors.notFound('Siswa tidak ditemukan.')
    const scope = accessibleClassIds(user)
    if (scope && !scope.includes(s.classId)) return errors.forbidden()
    return ok({ ...s, guardianPhone: phoneForUser(s.guardianPhone, user) })
  }),

  http.get(apiPath('/teachers'), async ({ request }) => {
    await latency()
    requireAuth(request)
    const sp = searchParams(request)
    const subjectId = sp.get('subjectId')
    const active = sp.get('active')
    const items = db().teachers.filter(
      (t) =>
        !isDeleted('teachers', t.id) &&
        (!subjectId || t.subjectIds.includes(subjectId)) &&
        (active === null || (active === 'true' ? t.status === 'ACTIVE' : t.status === 'INACTIVE')) &&
        matchesSearch(sp.get('search'), t.name, t.nip),
    )
    return ok(items.sort((a, b) => a.name.localeCompare(b.name, 'id')))
  }),

  http.get(apiPath('/timetables'), async ({ request }) => {
    await latency()
    requireAuth(request)
    const sp = searchParams(request)
    const date = sp.get('date')
    const dayOfWeek = sp.get('dayOfWeek')
    const filter = {
      shiftCode: sp.get('shiftCode'),
      classId: sp.get('classId'),
      teacherId: sp.get('teacherId'),
    }
    if (date) return ok(slotsOn(date, filter))
    const items = db()
      .timetable.filter(
        (s) =>
          !isDeleted('timetable', s.id) &&
          (!dayOfWeek || s.dayOfWeek === Number(dayOfWeek)) &&
          (!filter.shiftCode || s.shiftCode === filter.shiftCode) &&
          (!filter.classId || s.classId === filter.classId) &&
          (!filter.teacherId || s.teacherId === filter.teacherId),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodStart - b.periodStart)
    return ok(items)
  }),

  http.get(apiPath('/settings'), async ({ request }) => {
    await latency(80)
    requireAuth(request)
    return ok(db().settings)
  }),
]
