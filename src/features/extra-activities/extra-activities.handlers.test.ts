import { describe, expect, it } from 'vitest'
import { todayISO } from '@/lib/date'
import { loginAs } from '@/test/utils'
import { extraActivitiesApi } from './api'

describe('Jam Tambahan (extra-activities) API', () => {
  it('mengambil daftar jam tambahan hari ini dengan multi-kelas & TTD read-only serta filter kelas', async () => {
    await loginAs('piket')
    const res = await extraActivitiesApi.list({ date: todayISO(), pageSize: 10 })
    expect(res.data.length).toBeGreaterThan(0)

    // Mendukung lebih dari 1 kelas & memiliki contoh TTD + Belum TTD
    expect(res.data.some((a) => a.classNames.length >= 2)).toBe(true)
    expect(res.data.some((a) => a.signatureUrl?.startsWith('data:image/svg+xml'))).toBe(true)
    expect(res.data.some((a) => a.signatureUrl === null)).toBe(true)

    const byClass = await extraActivitiesApi.list({ date: todayISO(), classId: 'cls_3', pageSize: 10 })
    expect(byClass.data.length).toBeGreaterThan(0)
    expect(byClass.data.every((a) => a.classIds.includes('cls_3'))).toBe(true)
  })
})
