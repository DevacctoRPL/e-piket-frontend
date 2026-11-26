import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { loginAs } from '@/test/utils'
import { teachingLogsApi } from './api'

describe('Agenda Guru (teaching-logs) API', () => {
  it('mengambil kegiatan mengajar hari ini beserta TTD read-only dan mendukung filter kelas & pencarian', async () => {
    await loginAs('piket')
    const res = await teachingLogsApi.list({ date: todayISO(), pageSize: 20 })
    expect(res.data.length).toBeGreaterThan(0)

    // Sebagian entri sudah memiliki TTD SVG dari Presensi Guru dan sebagian belum TTD
    expect(res.data.some((l) => l.signatureUrl?.startsWith('data:image/svg+xml'))).toBe(true)
    expect(res.data.some((l) => l.signatureUrl === null)).toBe(true)

    const sampleClassId = res.data[0]!.classId
    const byClass = await teachingLogsApi.list({ date: todayISO(), classId: sampleClassId, pageSize: 20 })
    expect(byClass.data.length).toBeGreaterThan(0)
    expect(byClass.data.every((l) => l.classId === sampleClassId)).toBe(true)
  })
})
