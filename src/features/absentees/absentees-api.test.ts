import { describe, expect, it } from 'vitest'
import { api } from '@/lib/api-client'
import { todayISO } from '@/lib/date'
import { loginAs } from '@/test/utils'
import type { ListResponse } from '@/types/api'
import type { Student } from '@/types/entities'
import { absenteesApi } from './api'

describe('Siswa Tidak Hadir (absentees) API', () => {
  it('mengembalikan ringkasan 5 status (S/I/A/D/P) dan mendukung Catat, Edit, dan Hapus', async () => {
    await loginAs('piket')
    const date = todayISO()

    const sumBefore = await absenteesApi.summary({ date })
    expect(sumBefore.total).toBeGreaterThanOrEqual(5)
    expect(sumBefore.byStatus.SICK).toBeGreaterThanOrEqual(1)
    expect(sumBefore.byStatus.PERMISSION).toBeGreaterThanOrEqual(1)
    expect(sumBefore.byStatus.ABSENT).toBeGreaterThanOrEqual(1)
    expect(sumBefore.byStatus.EXCUSED).toBeGreaterThanOrEqual(1)
    expect(sumBefore.byStatus.PKL).toBeGreaterThanOrEqual(1)

    // Pilih siswa aktif di cls_5 (belum ada sesi hari ini) lalu catat PKL
    const studentsRes = await api.get<ListResponse<Student>>('/students', {
      classId: 'cls_5',
      active: 'true',
      pageSize: 5,
    })
    const student = studentsRes.data[0]!

    const created = await absenteesApi.create({
      date,
      classId: 'cls_5',
      studentId: student.id,
      status: 'PKL',
      reason: 'PKL di PT Industri Nusantara',
    })
    expect(created.status).toBe('PKL')
    expect(created.reason).toBe('PKL di PT Industri Nusantara')

    // Edit status ke Dispensasi
    const edited = await absenteesApi.update(created.recordId, {
      status: 'EXCUSED',
      reason: 'Dispensasi lomba',
    })
    expect(edited.status).toBe('EXCUSED')
    expect(edited.removed).toBe(false)

    // Hapus -> kembali ke Hadir
    await absenteesApi.remove(created.recordId)
    const after = await absenteesApi.list({ date, classId: 'cls_5' })
    expect(after.data.some((r) => r.recordId === created.recordId)).toBe(false)
  })
})
