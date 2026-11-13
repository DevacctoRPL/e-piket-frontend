import type { ClassRoom, ID } from '@/types/entities'
import { db, isDeleted, type MockUser } from './db'
import { errors } from './utils'

type AssignmentClass = Omit<ClassRoom, 'studentCount'>
type Account = Pick<MockUser, 'id' | 'teacherId' | 'roles' | 'status'>

export function activeHomeroomClasses(teacherId: ID | null, classes = db().classes) {
  const year = db().academicYears.find((y) => y.isActive && !isDeleted('academicYears', y.id))
  return teacherId && year
    ? classes.filter((c) => !isDeleted('classes', c.id) && c.status === 'ACTIVE' &&
        c.academicYearId === year.id && c.homeroomTeacherId === teacherId)
    : []
}

export function homeroomClassForTeacher(teacherId: ID | null) {
  return activeHomeroomClasses(teacherId)[0] ?? null
}

/** Validate the projected state before mutating any account or class. */
export function requireValidHomerooms(classes: AssignmentClass[], users: Account[] = db().users) {
  const year = db().academicYears.find((y) => y.isActive && !isDeleted('academicYears', y.id))
  const active = classes.filter((c) => !isDeleted('classes', c.id) && c.status === 'ACTIVE' && c.academicYearId === year?.id)
  const assigned = new Set<ID>()
  for (const cls of active) {
    const teacherId = cls.homeroomTeacherId
    if (!teacherId) continue
    if (assigned.has(teacherId)) throw errors.validation({ homeroomClassId: 'Satu wali kelas hanya boleh memimpin satu kelas aktif.' })
    assigned.add(teacherId)
  }
  for (const user of users) {
    if (user.status !== 'ACTIVE' || !user.roles.includes('HOMEROOM')) continue
    const teacher = db().teachers.find((t) => t.id === user.teacherId && t.status === 'ACTIVE' && !isDeleted('teachers', t.id))
    if (!teacher || active.filter((c) => c.homeroomTeacherId === teacher.id).length !== 1) {
      throw errors.validation({ homeroomClassId: `Akun Wali Kelas ${db().users.find((u) => u.id === user.id)?.name ?? ''} wajib memiliki tepat satu kelas aktif pada tahun ajaran berjalan.` })
    }
  }
}

/** Account changes and class reassignment are applied together after all validation succeeds. */
export function planHomeroomChange(next: Account, previous: Account | null, requested: unknown, provided: boolean) {
  const classes = db().classes.map((c) => ({ ...c }))
  const isHomeroom = next.roles.includes('HOMEROOM')
  if (provided && requested !== null && typeof requested !== 'string') {
    throw errors.validation({ homeroomClassId: 'Kelas tidak valid.' })
  }
  const classId = typeof requested === 'string' ? requested.trim() : ''
  if (provided && classId && !isHomeroom) {
    throw errors.validation({ homeroomClassId: 'Penugasan kelas memerlukan peran Wali Kelas.' })
  }
  const year = db().academicYears.find((y) => y.isActive)
  const oldTeacherId = previous?.roles.includes('HOMEROOM') ? previous.teacherId : null
  if (provided || (oldTeacherId && (!isHomeroom || oldTeacherId !== next.teacherId))) {
    for (const cls of classes) {
      if (cls.academicYearId === year?.id && cls.status === 'ACTIVE' &&
          (cls.homeroomTeacherId === oldTeacherId || (isHomeroom && cls.homeroomTeacherId === next.teacherId))) {
        cls.homeroomTeacherId = null
      }
    }
  }
  if (provided && classId) {
    const target = classes.find((c) => c.id === classId && c.status === 'ACTIVE' &&
      c.academicYearId === year?.id && !isDeleted('classes', c.id))
    if (!target) throw errors.validation({ homeroomClassId: 'Pilih kelas aktif pada tahun ajaran berjalan.' })
    if (!next.teacherId) throw errors.validation({ teacherId: 'Wali Kelas wajib ditautkan ke guru aktif.' })
    if (target.homeroomTeacherId && target.homeroomTeacherId !== next.teacherId) {
      throw errors.validation({ homeroomClassId: 'Kelas sudah memiliki wali kelas. Lepaskan atau pindahkan penugasan sebelumnya dahulu.' })
    }
    target.homeroomTeacherId = next.teacherId
  }
  requireValidHomerooms(classes, [...db().users.filter((u) => u.id !== next.id), next])
  return classes
}
