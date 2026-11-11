import { Ban, Clock, Pencil, ShieldAlert, UserPlus } from 'lucide-react'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { useLookupMaps } from '@/features/master-data/lookups'
import { SUBSTITUTION_SLOT_META, TEACHER_ATTENDANCE_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { SubstitutionSlot } from '@/types/entities'
import { usePeriodTimes, useSubstitutionAbilities } from '../hooks'
import { periodLabel } from '../utils'

/** Kartu satu slot jam kosong. Slot belum tertangani ditandai garis kiri merah (PRD §7.5.5). */
export function SlotCard({
  slot,
  showShift,
  onAssign,
  onEdit,
  onCancel,
}: {
  slot: SubstitutionSlot
  showShift: boolean
  onAssign: (slot: SubstitutionSlot) => void
  onEdit: (slot: SubstitutionSlot) => void
  onCancel: (slot: SubstitutionSlot) => void
}) {
  const { canWrite, canEditRecord } = useSubstitutionAbilities()
  const { shiftName } = useLookupMaps()
  const timesOf = usePeriodTimes()
  const times = timesOf(slot.shiftCode, slot.periodStart, slot.periodEnd)
  const sub = slot.substitution
  const unhandled = slot.status === 'UNHANDLED'
  const headingId = `slot-${slot.id}`

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border/85 bg-card p-4 shadow-2xs',
        unhandled && 'border-l-2 border-l-tone-danger',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3 id={headingId} className="text-sm font-semibold break-words">
            {slot.className}
            <span className="font-normal text-muted-foreground"> · {slot.subjectName}</span>
          </h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
            <Clock className="size-3.5" aria-hidden />
            <span>{periodLabel(slot.periodStart, slot.periodEnd)}</span>
            {times && <span>({times})</span>}
            <span>· {slot.periodCount} jam</span>
            {showShift && <span>· Shift {shiftName(slot.shiftCode)}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge meta={SUBSTITUTION_SLOT_META} value={slot.status} />
          {sub && (
            <RowActionsMenu
              label={`Aksi untuk ${slot.className} ${periodLabel(slot.periodStart, slot.periodEnd).toLowerCase()}`}
              actions={[
                {
                  label: 'Ubah catatan',
                  icon: Pencil,
                  hidden: !canEditRecord(sub.substituteTeacherId),
                  onSelect: () => onEdit(slot),
                },
                {
                  label: 'Batalkan',
                  icon: Ban,
                  destructive: true,
                  separated: true,
                  hidden: !canWrite,
                  onSelect: () => onCancel(slot),
                },
              ]}
            />
          )}
        </div>
      </header>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
        <dt className="text-muted-foreground">Guru berhalangan</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="break-words">{slot.absentTeacherName}</span>
          <StatusBadge meta={TEACHER_ATTENDANCE_META} value={slot.absentTeacherStatus} />
        </dd>
        {sub && (
          <>
            <dt className="text-muted-foreground">Guru pengganti</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="font-medium break-words">{sub.substituteTeacherName}</span>
              {sub.conflictOverridden && (
                <ToneBadge tone="warning" icon={ShieldAlert}>
                  Override konflik
                </ToneBadge>
              )}
            </dd>
            <dt className="text-muted-foreground">Ditangani</dt>
            <dd className="tabular-nums">
              {periodLabel(sub.periodStart, sub.periodEnd)} · {sub.periodCount} jam
            </dd>
            <dt className="text-muted-foreground">Kegiatan</dt>
            <dd className={cn('break-words', !sub.activity && 'text-muted-foreground italic')}>
              {sub.activity ?? 'Belum dicatat'}
            </dd>
            {sub.note && (
              <>
                <dt className="text-muted-foreground">Catatan</dt>
                <dd className="break-words">{sub.note}</dd>
              </>
            )}
            {sub.overrideReason && (
              <>
                <dt className="text-muted-foreground">Alasan override</dt>
                <dd className="break-words">{sub.overrideReason}</dd>
              </>
            )}
          </>
        )}
      </dl>

      {unhandled && canWrite && (
        <Button variant="outline" className="w-full sm:w-fit" onClick={() => onAssign(slot)}>
          <UserPlus /> Tetapkan pengganti
        </Button>
      )}
    </article>
  )
}
