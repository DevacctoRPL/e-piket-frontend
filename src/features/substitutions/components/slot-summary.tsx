import { StatusBadge } from '@/components/status-badge'
import { TEACHER_ATTENDANCE_META } from '@/lib/enums'
import type { SubstitutionSlot } from '@/types/entities'
import { usePeriodTimes } from '../hooks'
import { periodLabel } from '../utils'

/** Ringkasan identitas slot jam kosong (dipakai di sheet & dialog). */
export function SlotSummary({ slot }: { slot: SubstitutionSlot }) {
  const timesOf = usePeriodTimes()
  const times = timesOf(slot.shiftCode, slot.periodStart, slot.periodEnd)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/85 bg-muted/30 p-3 text-[13px]">
      <dt className="text-muted-foreground">Kelas</dt>
      <dd className="font-medium">{slot.className}</dd>
      <dt className="text-muted-foreground">Waktu</dt>
      <dd className="tabular-nums">
        {periodLabel(slot.periodStart, slot.periodEnd)}
        {times && <span className="text-muted-foreground"> · {times}</span>}
      </dd>
      <dt className="text-muted-foreground">Mapel</dt>
      <dd>{slot.subjectName}</dd>
      <dt className="text-muted-foreground">Guru berhalangan</dt>
      <dd className="flex flex-wrap items-center gap-2">
        <span className="break-words">{slot.absentTeacherName}</span>
        <StatusBadge meta={TEACHER_ATTENDANCE_META} value={slot.absentTeacherStatus} />
      </dd>
    </dl>
  )
}
