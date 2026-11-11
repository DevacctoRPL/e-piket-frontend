import { AlertCircle, CheckCheck, RotateCcw, Save, Send, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FramedCard } from '@/components/framed-card'
import { EmptyState } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, Switch } from '@/components/ui/misc'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { ATTENDANCE_META } from '@/lib/enums'
import { getErrorMessage, rowErrors } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { AttendanceStatus, ExtraActivity, ID } from '@/types/entities'
import { useSaveParticipants, useUpdateExtraActivity } from '../queries'

/** Status cepat seperti kolom buku (H/S/I/A). */
const QUICK: AttendanceStatus[] = ['PRESENT', 'SICK', 'PERMISSION', 'ABSENT']

/** Tombol tetap netral; warna tone hanya pada huruf kode saat terpilih. */
const QUICK_ACTIVE_CODE: Record<string, string> = {
  PRESENT: 'text-tone-success',
  SICK: 'text-tone-info',
  PERMISSION: 'text-tone-purple',
  ABSENT: 'text-tone-danger',
}

type Draft = Record<ID, AttendanceStatus>

function toDraft(a: ExtraActivity): Draft {
  return Object.fromEntries(a.participants.map((p) => [p.studentId, p.status]))
}

/**
 * Presensi peserta kegiatan tambahan — terpisah dari absensi reguler (FR-EXT-03).
 * Roster = siswa aktif seluruh kelas kegiatan.
 */
export function ParticipantsPanel({
  activity,
  canFill,
  canManage,
  onReload,
}: {
  activity: ExtraActivity
  canFill: boolean
  canManage: boolean
  onReload: () => void
}) {
  const save = useSaveParticipants(activity.id)
  const toggle = useUpdateExtraActivity(activity.id)
  // Status yang dinonaktifkan di Pengaturan tidak ditawarkan (status tersimpan tetap ditampilkan).
  const settings = useSettings()
  const quick = useMemo(() => {
    const cfg = settings.data?.attendanceStatuses
    if (!cfg?.length) return QUICK
    const active = new Set(cfg.filter((s) => s.active).map((s) => s.code))
    return QUICK.filter((s) => active.has(s))
  }, [settings.data])
  const idem = useIdempotencyKey()
  const [draft, setDraft] = useState<Draft>(() => toDraft(activity))
  const [errorsByStudent, setErrorsByStudent] = useState<Record<ID, string>>({})
  const [formError, setFormError] = useState<{ message: string; conflict: boolean } | null>(null)
  const [confirm, setConfirm] = useState<null | 'submit' | 'correct' | 'disable' | 'enable'>(null)
  const isFinal = activity.status === 'FINAL'

  // Sinkron saat versi server berubah (setelah simpan / muat ulang).
  useEffect(() => {
    setDraft(toDraft(activity))
    setErrorsByStudent({})
    idem.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id, activity.version])

  const dirty = activity.participants.some((p) => draft[p.studentId] !== p.status)

  const counts = useMemo(() => {
    const c: Partial<Record<AttendanceStatus, number>> = {}
    for (const p of activity.participants) {
      const s = draft[p.studentId] ?? p.status
      c[s] = (c[s] ?? 0) + 1
    }
    return c
  }, [activity.participants, draft])

  const groups = useMemo(() => {
    const map = new Map<ID, ExtraActivity['participants']>()
    for (const p of activity.participants) map.set(p.classId, [...(map.get(p.classId) ?? []), p])
    return activity.classIds
      .map((cid, i) => ({ classId: cid, className: activity.classNames[i] ?? '—', items: map.get(cid) ?? [] }))
      .filter((g) => g.items.length > 0)
  }, [activity.participants, activity.classIds, activity.classNames])

  const readOnly = !canFill || save.isPending

  const persist = async (opts: { submit?: boolean; reason?: string }) => {
    setFormError(null)
    setErrorsByStudent({})
    const participants = activity.participants.map((p) => ({ studentId: p.studentId, status: draft[p.studentId] ?? p.status }))
    try {
      await save.mutateAsync({
        body: { participants, submit: opts.submit, version: activity.version, reason: opts.reason },
        idempotencyKey: idem.key(),
      })
      idem.reset()
      setConfirm(null)
      toast.success(opts.submit ? 'Presensi peserta dikirim dan kegiatan ditandai final.' : 'Presensi peserta disimpan.')
    } catch (e) {
      setConfirm(null)
      if (e instanceof ApiError && e.status === 422) {
        idem.reset()
        const rows = rowErrors(e, 'participants')
        const byStudent: Record<ID, string> = {}
        for (const [idx, fields] of Object.entries(rows)) {
          const p = participants[Number(idx)]
          if (p) byStudent[p.studentId] = Object.values(fields).join(' ')
        }
        setErrorsByStudent(byStudent)
      }
      setFormError({ message: getErrorMessage(e), conflict: e instanceof ApiError && e.status === 409 })
    }
  }

  const setEnabled = async (enabled: boolean, reason?: string) => {
    setFormError(null)
    try {
      await toggle.mutateAsync({ participantAttendanceEnabled: enabled, version: activity.version, reason })
      setConfirm(null)
      toast.success(enabled ? 'Presensi peserta diaktifkan.' : 'Presensi peserta dinonaktifkan.')
    } catch (e) {
      setConfirm(null)
      setFormError({ message: getErrorMessage(e), conflict: e instanceof ApiError && e.status === 409 })
    }
  }

  const requestEnable = () => (isFinal ? setConfirm('enable') : void setEnabled(true))

  const onSave = () => (isFinal ? setConfirm('correct') : void persist({}))

  return (
    <FramedCard
      title="Presensi peserta"
      icon={<Users />}
      description="Dicatat terpisah dari absensi harian siswa."
      headerRight={
        canManage ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="toggle-participants" className="text-xs font-normal text-muted-foreground">
              {activity.participantAttendanceEnabled ? 'Aktif' : 'Nonaktif'}
            </Label>
            <Switch
              id="toggle-participants"
              aria-label="Catat presensi peserta"
              checked={activity.participantAttendanceEnabled}
              disabled={toggle.isPending}
              onCheckedChange={(v) => (v ? requestEnable() : setConfirm('disable'))}
            />
          </div>
        ) : undefined
      }
      bodyClassName="space-y-4"
    >
      {formError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            {formError.message}
            {formError.conflict && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setFormError(null)
                  onReload()
                }}
              >
                <RotateCcw /> Muat ulang
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!activity.participantAttendanceEnabled ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Presensi peserta tidak dicatat"
          description={
            canManage
              ? 'Aktifkan bila kegiatan ini memerlukan daftar hadir. Peserta diambil dari siswa aktif kelas terpilih.'
              : 'Koordinator atau pengampu belum mengaktifkan presensi untuk kegiatan ini.'
          }
          action={
            canManage ? (
              <Button onClick={requestEnable} disabled={toggle.isPending}>
                {toggle.isPending ? 'Menyimpan…' : 'Aktifkan presensi'}
              </Button>
            ) : undefined
          }
        />
      ) : activity.participants.length === 0 ? (
        <EmptyState
          title="Belum ada peserta"
          description="Kelas peserta belum memiliki siswa aktif pada tanggal kegiatan. Periksa data siswa di master data."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
              <span className="text-sm font-medium tabular-nums">{activity.participants.length} peserta</span>
              {QUICK.concat(['LATE', 'LEFT_EARLY', 'EXCUSED']).map((s) =>
                counts[s] ? (
                  <span key={s} className="inline-flex items-center gap-1 tabular-nums">
                    <StatusBadge meta={ATTENDANCE_META} value={s} className="tabular-nums" />
                    <span className="sr-only">:</span> <span className="text-xs font-semibold">{counts[s]}</span>
                  </span>
                ) : null,
              )}
            </div>

            {canFill && (
              <Button
                variant="outline"
                disabled={readOnly}
                onClick={() =>
                  setDraft(Object.fromEntries(activity.participants.map((p) => [p.studentId, 'PRESENT' as const])))
                }
              >
                <CheckCheck /> Tandai semua hadir
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.classId} aria-labelledby={`grp-${g.classId}`} className="space-y-1.5">
                <h3 id={`grp-${g.classId}`} className="text-xs font-medium text-muted-foreground">
                  {g.className} · <span className="tabular-nums">{g.items.length}</span> siswa
                </h3>
                <ul className="divide-y divide-border/60 rounded-md border border-border/80">
                  {g.items.map((p, i) => {
                    const current = draft[p.studentId] ?? p.status
                    const err = errorsByStudent[p.studentId]
                    return (
                      <li
                        key={p.studentId}
                        className={cn(
                          'flex flex-wrap items-center gap-2 border-l-2 border-l-transparent px-3 py-1.5',
                          err && 'border-l-tone-danger',
                        )}
                      >
                        <span className="w-6 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="min-w-0 flex-1 text-sm font-medium">{p.studentName}</span>
                        {canFill ? (
                          <div role="radiogroup" aria-label={`Status ${p.studentName}`} className="flex gap-1">
                            {quick.map((s) => {
                              const m = ATTENDANCE_META[s]
                              const active = current === s
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  role="radio"
                                  aria-checked={active}
                                  aria-label={m.label}
                                  title={m.label}
                                  disabled={readOnly}
                                  onClick={() => setDraft((d) => ({ ...d, [p.studentId]: s }))}
                                  className={cn(
                                    'size-8 rounded-md border border-border/90 text-[13px] font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
                                    active
                                      ? 'border-foreground/40 bg-muted text-foreground'
                                      : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                                  )}
                                >
                                  <span className={active ? QUICK_ACTIVE_CODE[s] : undefined}>{m.short}</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <StatusBadge meta={ATTENDANCE_META} value={current} showShort />
                        )}
                        {err && (
                          <p role="alert" className="flex basis-full items-center gap-1 pl-8 text-xs font-medium text-destructive">
                            <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                            {err}
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          {canFill && (
            <div className="sticky bottom-16 z-10 -mx-4 -mb-4 flex flex-col gap-2 rounded-b-lg border-t border-border/70 bg-card/95 px-4 py-2.5 backdrop-blur sm:flex-row sm:justify-end md:bottom-0">
              {dirty && <p className="text-xs text-muted-foreground sm:mr-auto sm:self-center">Ada perubahan belum disimpan.</p>}
              <Button variant="outline" disabled={readOnly || !dirty} onClick={onSave}>
                <Save /> {save.isPending ? 'Menyimpan…' : isFinal ? 'Simpan koreksi' : 'Simpan draft'}
              </Button>
              {!isFinal && (
                <Button disabled={readOnly} onClick={() => setConfirm('submit')}>
                  <Send /> Kirim presensi
                </Button>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm === 'submit'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Kirim presensi peserta?"
        description="Kegiatan akan ditandai final. Perubahan setelah ini memerlukan alasan koreksi dan tercatat di audit log."
        confirmLabel="Kirim"
        pending={save.isPending}
        onConfirm={() => persist({ submit: true })}
      />
      <ConfirmDialog
        open={confirm === 'correct'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Koreksi presensi peserta"
        description="Presensi kegiatan ini sudah final. Koreksi akan dicatat di audit log."
        confirmLabel="Simpan koreksi"
        requireReason
        reasonLabel="Alasan koreksi"
        pending={save.isPending}
        onConfirm={(reason) => persist({ reason })}
      />
      <ConfirmDialog
        open={confirm === 'disable'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Nonaktifkan presensi peserta?"
        description="Daftar hadir peserta yang sudah diisi akan dihapus dari kegiatan ini."
        confirmLabel="Nonaktifkan"
        destructive
        requireReason={isFinal}
        reasonLabel="Alasan koreksi"
        pending={toggle.isPending}
        onConfirm={(reason) => setEnabled(false, reason || undefined)}
      />
      <ConfirmDialog
        open={confirm === 'enable'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Aktifkan presensi peserta?"
        description="Kegiatan ini sudah final. Mengaktifkan presensi merupakan koreksi dan akan dicatat di audit log."
        confirmLabel="Aktifkan"
        requireReason
        reasonLabel="Alasan koreksi"
        pending={toggle.isPending}
        onConfirm={(reason) => setEnabled(true, reason)}
      />
      <UnsavedChangesGuard when={dirty} />
    </FramedCard>
  )
}
