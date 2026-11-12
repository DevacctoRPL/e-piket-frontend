import { describe, expect, it } from 'vitest'
import { extractSmkPelitaNusantaraTeachers } from '@/mocks/smk-pelita-nusantara-schedule'
import type { Teacher } from '@/types/entities'
import {
  buildPresenceMatrixCSV,
  buildPresenceMatrixExcel,
  buildPresenceMatrixRows,
  parsePresenceMatrixFile,
} from './presence-matrix-template'

function makeSampleTeachers(): Teacher[] {
  return extractSmkPelitaNusantaraTeachers().map((t, i) => ({
    id: `tch_${i + 1}`,
    nip: `198001012010011${String(i + 1).padStart(3, '0')}`,
    code: t.code,
    name: t.name,
    phone: null,
    subjectIds: [],
    attendanceDays: t.attendanceDays,
    attendanceOrder: t.attendanceOrder,
    status: 'ACTIVE',
    userId: i < 4 ? `usr_${i + 1}` : null,
  }))
}

describe('presence-matrix-template', () => {
  it('menyusun grid matriks 6 hari (Senin–Sabtu) sesuai urutan baris PDF SMK Plus Pelita Nusantara', () => {
    const teachers = makeSampleTeachers()
    const rows = buildPresenceMatrixRows(teachers)

    expect(rows.length).toBeGreaterThanOrEqual(40)
    // Baris 1 Senin = Septianto Raharso (21), Selasa = Putri Ngawirabaya (16), Rabu = Raihana (8)
    expect(rows[0]?.cells[1]?.code).toBe('21')
    expect(rows[0]?.cells[2]?.code).toBe('16')
    expect(rows[0]?.cells[3]?.code).toBe('8')
    expect(rows[0]?.cells[4]?.code).toBe('41')
    expect(rows[0]?.cells[5]?.code).toBe('21')
    expect(rows[0]?.cells[6]?.code).toBe('21')
  })

  it('menghasilkan CSV matriks 6 hari dan mem-parsing kembali secara round-trip', () => {
    const teachers = makeSampleTeachers()
    const csv = buildPresenceMatrixCSV(teachers)

    expect(csv).toContain('NO,SENIN,KODE,SELASA,KODE,RABU,KODE,KAMIS,KODE,JUMAT,KODE,SABTU,KODE')
    expect(csv).toContain('Septianto Raharso')

    const parsed = parsePresenceMatrixFile(csv, teachers.slice(0, 10))
    expect(parsed.items.length).toBe(teachers.length)
    expect(parsed.updatedCount).toBe(10)
    expect(parsed.newCount).toBe(teachers.length - 10)

    const septianto = parsed.items.find((x) => x.code === '21')
    expect(septianto?.attendanceDays).toEqual([1, 2, 3, 4, 5, 6])
    expect(septianto?.isExisting).toBe(true)
  })

  it('menghasilkan file Excel (.xls) rapi dan dapat diimpor ulang langsung oleh parser', () => {
    const teachers = makeSampleTeachers()
    const xls = buildPresenceMatrixExcel(teachers, {
      schoolName: 'SMK PLUS PELITA NUSANTARA BOGOR',
      academicYear: '2026/2027',
      semester: 'Ganjil',
    })

    expect(xls).toContain('<table')
    expect(xls).toContain('JADWAL KEHADIRAN GURU')
    expect(xls).toContain('SMK PLUS PELITA NUSANTARA BOGOR')

    const parsed = parsePresenceMatrixFile(xls, teachers)
    expect(parsed.items.length).toBe(teachers.length)
    expect(parsed.updatedCount).toBe(teachers.length)
    expect(parsed.newCount).toBe(0)
  })
})

