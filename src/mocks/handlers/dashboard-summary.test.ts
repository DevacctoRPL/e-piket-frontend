import { describe, expect, it } from 'vitest'
import { addDays, formatDateTime, formatTime, todayISO } from '@/lib/date'
import { permissionsForRoles } from '@/lib/permissions'
import { db, MOCK_SCHEMA_VERSION, resetDb, setDbForTest, type MockDb } from '../db'
import { seed } from '../seed'
import { computeDashboardSummary } from './dashboard-summary'

function sweep() {
  const failures: string[] = []
  const today = todayISO()
  for (const u of db().users) {
    const user = { ...u, permissions: permissionsForRoles(u.roles) }
    for (const shiftCode of [null, 'MORNING', 'AFTERNOON']) {
      for (const off of [0, -1, -3, -7]) {
        const date = addDays(today, off)
        try {
          computeDashboardSummary(user, { date, shiftCode })
        } catch (e) {
          failures.push(`${user.username} ${shiftCode} ${date}: ${(e as Error).message}`)
        }
      }
    }
  }
  return failures
}

/** Meniru data mock lama di localStorage: field yang belum ada di versi sebelumnya hilang/kosong. */
function staleDb(): MockDb {
  const d = JSON.parse(JSON.stringify(seed())) as MockDb
  const anyRec = (x: object) => x as Record<string, unknown>
  d.teacherAttendance.forEach((a, i) => i % 2 === 0 && delete anyRec(a).updatedAt)
  d.dismissals.forEach((r) => delete anyRec(r).recordedAt)
  d.substitutions.forEach((r) => (anyRec(r).createdAt = ''))
  d.teachingLogs.forEach((l) => {
    anyRec(l).submittedAt = null
    anyRec(l).updatedAt = 'bukan-tanggal'
  })
  d.dutyAgendas.forEach((a) => {
    delete anyRec(a).notes
    delete anyRec(a).presentTeacherCount
    delete anyRec(a).createdAt
    anyRec(a).finalizedAt = null
    anyRec(a).submittedAt = null
  })
  delete d.schemaVersion
  return d
}

describe('dashboard summary — data mock lama di localStorage (regresi 500)', () => {
  it('tidak melempar untuk seed segar di semua role/shift/tanggal', () => {
    setDbForTest(seed())
    expect(sweep()).toEqual([])
  })

  it('tidak melempar meski timestamp & field agenda hilang/tidak valid', () => {
    setDbForTest(staleDb())
    expect(sweep()).toEqual([])
  })

  it('formatter waktu aman terhadap timestamp tidak valid', () => {
    expect(formatTime('bukan-tanggal')).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })

  it('db versi lama di localStorage otomatis di-seed ulang', async () => {
    const stale = staleDb()
    stale.users[0]!.name = 'Nama Lama'
    localStorage.setItem('epiket-mock-db-v1', JSON.stringify(stale))
    // paksa load() membaca localStorage lagi
    setDbForTest(null as unknown as MockDb)
    expect(db().schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    expect(db().users[0]!.name).not.toBe('Nama Lama')
    expect(JSON.parse(localStorage.getItem('epiket-mock-db-v1')!).schemaVersion).toBe(MOCK_SCHEMA_VERSION)
    resetDb()
  })
})
