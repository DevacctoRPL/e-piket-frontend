import { MessageSquarePlus, PencilLine } from 'lucide-react'
import { memo, useId, useState } from 'react'
import { StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ATTENDANCE_META } from '@/lib/enums'
import { formatWallTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, ID, RosterRow } from '@/types/entities'
import type { RowDraft } from '../types'
import { StatusPicker } from './status-picker'

export type RowPatch = Partial<RowDraft>

/** Baris siswa pada editor roster — kartu di ponsel, baris lebar di desktop. */
export const RosterRowItem = memo(function RosterRowItem({
  index,
  row,
  draft,
  dirty,
  errors,
  showErrors,
  readOnly,
  requiresReason,
  allowed,
  onChange,
  onCorrect,
}: {
  index: number
  row: RosterRow
  draft: RowDraft | null
  dirty: boolean
  errors: Record<string, string> | undefined
  /** Tampilkan error validasi klien (setelah percobaan simpan). Error server selalu tampil. */
  showErrors: boolean
  readOnly: boolean
  requiresReason: AttendanceStatus[]
  allowed: AttendanceStatus[]
  onChange: (studentId: ID, patch: RowPatch) => void
  /** Bila ada: tombol koreksi (sesi final + hak koreksi). */
  onCorrect?: (row: RosterRow) => void
}) {
  const uid = useId()
  const { student } = row
  const [noteOpen, setNoteOpen] = useState(false)
  const status = draft?.status ?? null
  const needsReason = !!status && requiresReason.includes(status)
  const isLate = status === 'LATE'
  const showNote = noteOpen || !!draft?.note
  const reasonError = errors?.reason
  const arrivalError = errors?.arrivalTime
  const statusError = errors?.status ?? errors?.studentId
  const hasError = !!(reasonError || arrivalError || statusError) && showErrors

  return (
    <li
      id={`row-${student.id}`}
      className={cn(
        'scroll-mt-24 border-b bg-card px-3 py-3 transition-colors last:border-b-0 sm:px-4',
        dirty && 'bg-tone-warning-bg/40 shadow-[inset_3px_0_0_var(--color-tone-warning)]',
        hasError && 'bg-tone-danger-bg/40 shadow-[inset_3px_0_0_var(--color-tone-danger)]',
      )}
      aria-invalid={hasError || undefined}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        {/* identitas */}
        <div className="flex min-w-0 items-start gap-3 lg:w-64 lg:shrink-0 lg:pt-1.5">
          <span className="w-6 shrink-0 pt-0.5 text-right text-xs text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium" id={`${uid}-name`}>
              {student.name}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">NIS {student.nis}</span>
              <span aria-hidden>·</span>
              <span>{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
              {dirty && (
                <ToneBadge tone="warning" className="py-0 text-[10px]">
                  diubah
                </ToneBadge>
              )}
              {!draft && !readOnly && (
                <ToneBadge tone="neutral" className="py-0 text-[10px]">
                  belum diisi
                </ToneBadge>
              )}
            </p>
          </div>
        </div>

        {/* status + detail */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pl-9 lg:pl-0">
          {readOnly ? (
            <div className="flex flex-wrap items-center gap-2 lg:pt-1">
              {status ? (
                <StatusBadge meta={ATTENDANCE_META} value={status} showShort />
              ) : (
                <ToneBadge tone="neutral">Belum diisi</ToneBadge>
              )}
              {isLate && draft?.arrivalTime && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Datang {formatWallTime(draft.arrivalTime)}
                </span>
              )}
              {draft?.reason && <span className="text-sm">— {draft.reason}</span>}
              {draft?.note && <span className="text-xs text-muted-foreground">({draft.note})</span>}
              {onCorrect && row.record && (
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto min-h-9"
                  onClick={() => onCorrect(row)}
                  aria-label={`Koreksi absensi ${student.name}`}
                >
                  <PencilLine /> Koreksi
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPicker
                  value={status}
                  onChange={(s) => onChange(student.id, { status: s })}
                  label={`Status ${student.name}`}
                  allowed={allowed}
                />
                {!showNote && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 text-muted-foreground"
                    onClick={() => setNoteOpen(true)}
                    aria-label={`Tambah catatan untuk ${student.name}`}
                  >
                    <MessageSquarePlus /> Catatan
                  </Button>
                )}
              </div>
              {statusError && (showErrors || errors?.studentId) && (
                <p className="text-xs font-medium text-destructive" role="alert">
                  {statusError}
                </p>
              )}
              {(needsReason || isLate || showNote) && (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  {needsReason || isLate ? (
                    <div className="grid gap-1">
                      <Label htmlFor={`${uid}-reason`} className="text-xs">
                        Alasan{needsReason && <span className="text-destructive" aria-hidden>*</span>}
                        {status && (
                          <span className="font-normal text-muted-foreground">
                            {' '}
                            ({ATTENDANCE_META[status].label.toLowerCase()}
                            {needsReason ? ', wajib' : ', opsional'})
                          </span>
                        )}
                      </Label>
                      <Input
                        id={`${uid}-reason`}
                        value={draft?.reason ?? ''}
                        onChange={(e) => onChange(student.id, { reason: e.target.value })}
                        placeholder={isLate ? 'Mis. ban bocor, hujan deras' : 'Mis. demam, keperluan keluarga'}
                        aria-required={needsReason || undefined}
                        aria-invalid={(showErrors || !!reasonError) && !!reasonError ? true : undefined}
                        aria-describedby={reasonError ? `${uid}-reason-err` : undefined}
                        maxLength={500}
                        className="h-11 sm:h-9"
                      />
                      {reasonError && showErrors ? (
                        <p id={`${uid}-reason-err`} className="text-xs font-medium text-destructive" role="alert">
                          {reasonError}
                        </p>
                      ) : needsReason && !draft?.reason.trim() ? (
                        <p className="text-xs text-tone-warning">Alasan wajib diisi untuk status ini.</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="hidden sm:block" />
                  )}
                  {isLate && (
                    <div className="grid gap-1">
                      <Label htmlFor={`${uid}-arrival`} className="text-xs">
                        Jam datang
                      </Label>
                      <Input
                        id={`${uid}-arrival`}
                        type="time"
                        value={draft?.arrivalTime ?? ''}
                        onChange={(e) => onChange(student.id, { arrivalTime: e.target.value })}
                        aria-invalid={arrivalError && showErrors ? true : undefined}
                        className="h-11 w-full sm:h-9 sm:w-32"
                      />
                      {arrivalError && showErrors && (
                        <p className="text-xs font-medium text-destructive" role="alert">
                          {arrivalError}
                        </p>
                      )}
                    </div>
                  )}
                  {showNote && (
                    <div className="grid gap-1 sm:col-span-2">
                      <Label htmlFor={`${uid}-note`} className="text-xs">
                        Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
                      </Label>
                      <Input
                        id={`${uid}-note`}
                        value={draft?.note ?? ''}
                        onChange={(e) => onChange(student.id, { note: e.target.value })}
                        placeholder="Catatan tambahan"
                        maxLength={500}
                        disabled={!draft}
                        className="h-11 sm:h-9"
                      />
                      {errors?.note && showErrors && (
                        <p className="text-xs font-medium text-destructive" role="alert">
                          {errors.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  )
})
