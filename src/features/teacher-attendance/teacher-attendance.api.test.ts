import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { loginAs } from '@/test/utils'
import { teacherAttendanceApi } from './api'

describe('teacher-attendance & jam kosong API', () => {
  it('membaca daftar kehadiran guru (read-only) dan slot jam kosong hari ini', async () => {
    await loginAs('piket')
    const date = todayISO()
    const teachers = await teacherAttendanceApi.scheduled({ date })
    expect(teachers.length).toBeGreaterThan(0)

    const slots = await teacherAttendanceApi.emptySlots({ date })
    expect(slots.length).toBeGreaterThan(0)
  })

  it('menolak penambahan jam kosong manual tanpa nama guru pengganti (422)', async () => {
    await loginAs('piket')
    const date = todayISO()
    await expect(
      teacherAttendanceApi.createManualSlot({
        date,
        classId: 'cls_1',
        subjectId: 'sub_1',
        periodStart: 5,
        periodEnd: 6,
        absentTeacherName: 'Pak Hendra',
        substituteTeacherName: '',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('menambah, mengedit, dan menghapus jam kosong manual beserta guru piket nama bebas', async () => {
    await loginAs('piket')
    const date = todayISO()
    const created = await teacherAttendanceApi.createManualSlot({
      date,
      classId: 'cls_1',
      subjectId: 'sub_1',
      periodStart: 5,
      periodEnd: 6,
      absentTeacherName: 'Pak Hendra',
      substituteTeacherName: 'Guru Piket Eksternal',
      activity: 'Latihan mandiri',
    })
    expect(created.isManual).toBe(true)
    expect(created.substitution?.substituteTeacherName).toBe('Guru Piket Eksternal')
    expect(created.substitution?.substituteTeacherId).toBeNull()

    const updated = await teacherAttendanceApi.updateManualSlot(created.manualSlotId!, {
      substituteTeacherName: 'Bu Rina Piket',
    })
    expect(updated.substitution?.substituteTeacherName).toBe('Bu Rina Piket')

    await teacherAttendanceApi.deleteManualSlot(created.manualSlotId!)
    const after = await teacherAttendanceApi.emptySlots({ date })
    expect(after.some((s) => s.id === created.id)).toBe(false)
  })

  it('menugaskan, mengedit, lalu menghapus penugasan pada slot otomatis', async () => {
    await loginAs('piket')
    const date = todayISO()
    const slots = await teacherAttendanceApi.emptySlots({ date })
    const unhandled = slots.find((s) => !s.isManual && !s.substitution)
    expect(unhandled).toBeDefined()

    const rec = await teacherAttendanceApi.assignSubstitute({
      date,
      timetableSlotId: unhandled!.timetableSlotId,
      substituteTeacherName: 'Agus Septiano, S.Pd.',
      activity: 'Pengawasan tugas',
    })
    expect(rec.substituteTeacherName).toBe('Agus Septiano, S.Pd.')

    const edited = await teacherAttendanceApi.updateSubstitute(rec.id, {
      substituteTeacherName: 'Budi Santoso, M.Pd.',
    })
    expect(edited.substituteTeacherName).toBe('Budi Santoso, M.Pd.')

    await teacherAttendanceApi.deleteSubstitute(rec.id)
    const refreshed = await teacherAttendanceApi.emptySlots({ date })
    const back = refreshed.find((s) => s.id === unhandled!.id)
    expect(back?.substitution).toBeNull()
  })
})
