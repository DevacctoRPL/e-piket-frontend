import { useCallback } from 'react'
import { ADMIN_ROLES } from '@/lib/permissions'
import { useAuth } from '@/features/auth/auth-context'
import { usePeriods } from '@/features/master-data/lookups'
import { formatWallTime } from '@/lib/date'
import type { ShiftCode } from '@/types/entities'

/** Rentang jam dinding untuk jam ke-N..M pada shift tertentu ('07.00–08.20'). */
export function usePeriodTimes() {
  const periods = usePeriods()
  return useCallback(
    (shiftCode: ShiftCode, start: number, end: number) => {
      const ps = (periods.data ?? []).filter((p) => p.shiftCode === shiftCode)
      const s = ps.find((p) => p.number === start)?.startTime
      const e = ps.find((p) => p.number === end)?.endTime
      return s && e ? `${formatWallTime(s)}–${formatWallTime(e)}` : null
    },
    [periods.data],
  )
}

/** Hak aksi pada halaman jam kosong (backend tetap menegakkan). */
export function useSubstitutionAbilities() {
  const { user, can, is } = useAuth()
  const canWrite = can('substitution:write')
  return {
    canWrite,
    /** Override konflik jadwal hanya admin & guru piket (PRD §7.5.3 "override berizin"). */
    canOverride: canWrite && is(...ADMIN_ROLES, 'DUTY_TEACHER'),
    /** Guru pengganti boleh melengkapi kegiatan/catatan pada tugasnya sendiri (FR-SUB-03). */
    canEditRecord: (substituteTeacherId: string) =>
      canWrite || (!!user?.teacherId && user.teacherId === substituteTeacherId),
  }
}
