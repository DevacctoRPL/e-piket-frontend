import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  FilePenLine,
  Printer,
  RefreshCw,
  Save,
  Send,
  UserCheck,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { StatCard } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/ui/misc'
import { Textarea } from '@/components/ui/textarea'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupMaps } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { formatDateLong, formatDateTime } from '@/lib/date'
import { getErrorMessage } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { DutyAgenda } from '@/types/entities'
import { AbsentTeachersTable } from '../components/absent-teachers-table'
import {
  AgendaSection,
  AgendaStatusBadge,
  CompletenessChecklist,
  summarizeAbsent,
} from '../components/agenda-bits'
import { NotesList } from '../components/notes-section'
import { agendaChecklist, isAgendaComplete } from '../completeness'
import { useDutyAgenda, useSubmitDutyAgenda, useUpdateDutyAgenda } from '../queries'
import { SUBSTITUTION_SUMMARY_MAX } from '../schemas'

interface Edits {
  noAbsentTeachers?: boolean
  noImportantNotes?: boolean
  substitutionSummary?: string
}

/** Editor Agenda Guru Piket menyerupai bagian buku agenda (FR-DUTY-02..05, AC-11). */
export function DutyAgendaDetailPage() {
  const { id = '' } = useParams()
  const query = useDutyAgenda(id)

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404
    return (
      <Page>
        <BackLink />
        {notFound ? (
          <EmptyState
            title="Agenda tidak ditemukan"
            description="Agenda mungkin sudah dihapus atau tautan tidak valid. Kembali ke daftar agenda piket."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/agenda-piket">Ke daftar agenda</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </Page>
    )
  }
  // key = id agar state lokal tidak terbawa antar agenda
  return <AgendaEditor key={query.data.id} agenda={query.data} onReload={() => void query.refetch()} />
}

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="no-print -ml-2 self-start">
      <Link to="/agenda-piket">
        <ArrowLeft /> Agenda piket
      </Link>
    </Button>
  )
}

function DetailSkeleton() {
  return (
    <Page>
      <BackLink />
      <div className="space-y-2" aria-busy="true" aria-label="Memuat agenda">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <TableSkeleton rows={4} cols={5} />
      <Skeleton className="h-40 rounded-xl" />
    </Page>
  )
}

function AgendaEditor({ agenda, onReload }: { agenda: DutyAgenda; onReload: () => void }) {
  const { user, can, is } = useAuth()
  const { shiftName } = useLookupMaps()
  const update = useUpdateDutyAgenda(agenda.id)
  const submit = useSubmitDutyAgenda(agenda.id)
  const submitKey = useIdempotencyKey()

  const [edits, setEdits] = useState<Edits>({})
  const [correcting, setCorrecting] = useState(false)
  const [refreshSnapshot, setRefreshSnapshot] = useState(false)
  const [dialog, setDialog] = useState<null | 'finalize' | 'correct'>(null)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [conflict, setConflict] = useState<ApiError | null>(null)

  const isFinal = agenda.status === 'FINAL'
  const isOfficer = !!user?.teacherId && agenda.dutyTeacherIds.includes(user.teacherId)
  const canFill = !isFinal && (is('ADMIN') || (can('duty_agenda:write') && isOfficer))
  const canCorrect = isFinal && can('duty_agenda:correct')
  const editable = canFill || (canCorrect && correcting)

  // nilai efektif = edit lokal ?? data server
  const noAbsentTeachers =
    agenda.absentTeachers.length > 0 ? false : (edits.noAbsentTeachers ?? agenda.noAbsentTeachers)
  const noImportantNotes = agenda.notes.length > 0 ? false : (edits.noImportantNotes ?? agenda.noImportantNotes)
  const substitutionSummary = edits.substitutionSummary ?? agenda.substitutionSummary ?? ''
  const isDirty =
    noAbsentTeachers !== agenda.noAbsentTeachers ||
    noImportantNotes !== agenda.noImportantNotes ||
    substitutionSummary.trim() !== (agenda.substitutionSummary ?? '').trim()

  const effective = { ...agenda, noAbsentTeachers, noImportantNotes }
  const checklist = agendaChecklist(effective)
  const complete = isAgendaComplete(checklist)
  const absentTotals = summarizeAbsent(agenda.absentTeachers)
  const reasonRowErrors: Record<number, string> = {}
  for (const [k, v] of Object.entries(serverErrors)) {
    const m = /^absentTeachers\.(\d+)\.reason$/.exec(k)
    if (m) reasonRowErrors[Number(m[1])] = v
  }
  const pending = update.isPending || submit.isPending
  const summaryTooLong = substitutionSummary.length > SUBSTITUTION_SUMMARY_MAX

  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.status === 422) {
      setServerErrors(err.details)
      toast.error(err.message)
      return
    }
    if (err instanceof ApiError && err.status === 409) {
      setConflict(err)
      return
    }
    toast.error(getErrorMessage(err))
  }

  const reload = () => {
    setConflict(null)
    setEdits({})
    setServerErrors({})
    setCorrecting(false)
    onReload()
  }

  /** Simpan perubahan lokal; mengembalikan versi terbaru (atau null bila gagal). */
  const saveDraft = async (opts: { silent?: boolean; correctionReason?: string } = {}) => {
    if (summaryTooLong) {
      toast.error(`Penanggulangan jam kosong maksimal ${SUBSTITUTION_SUMMARY_MAX} karakter.`)
      return null
    }
    try {
      const saved = await update.mutateAsync({
        version: agenda.version,
        noAbsentTeachers,
        noImportantNotes,
        substitutionSummary: substitutionSummary.trim() || null,
        ...(opts.correctionReason ? { correctionReason: opts.correctionReason, refreshSnapshot } : {}),
      })
      setEdits({})
      setServerErrors({})
      if (!opts.silent) toast.success(opts.correctionReason ? 'Koreksi agenda disimpan.' : 'Draft agenda disimpan.')
      return saved
    } catch (err) {
      handleError(err)
      return null
    }
  }

  const doSubmit = async (final: boolean) => {
    let version = agenda.version
    if (isDirty) {
      const saved = await saveDraft({ silent: true })
      if (!saved) return false
      version = saved.version
    }
    try {
      await submit.mutateAsync({ final, version, idempotencyKey: submitKey.key() })
      submitKey.reset()
      setServerErrors({})
      toast.success(final ? 'Agenda piket difinalisasi.' : 'Agenda piket dikirim.')
      return true
    } catch (err) {
      submitKey.reset()
      handleError(err)
      return false
    }
  }

  const sectionInvalid = (key: string) => key in serverErrors

  return (
    <Page className="pb-4">
      <UnsavedChangesGuard when={isDirty && !pending} />
      <BackLink />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Agenda Piket · Shift {shiftName(agenda.shiftCode)}
            <AgendaStatusBadge status={agenda.status} />
          </span>
        }
        description={formatDateLong(agenda.date)}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="cetak">
              <Printer /> Cetak
            </Link>
          </Button>
        }
      />

      {conflict && (
        <Alert variant="warning">
          <RefreshCw className="size-4" />
          <AlertTitle>
            {conflict.code === 'ALREADY_FINAL' ? 'Agenda sudah final' : 'Data telah berubah'}
          </AlertTitle>
          <AlertDescription>
            <p>{conflict.message}</p>
            <Button size="sm" variant="outline" onClick={reload} className="mt-1">
              <RefreshCw /> Muat ulang agenda
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isFinal && (
        <Alert variant="info">
          <CheckCheck className="size-4" />
          <AlertTitle>Agenda sudah final</AlertTitle>
          <AlertDescription>
            <p>
              Difinalisasi oleh {agenda.finalizedByName ?? '—'} pada {formatDateTime(agenda.finalizedAt)}. Data guru
              tidak hadir adalah snapshot saat finalisasi.
              {canCorrect
                ? ' Perubahan hanya melalui koreksi dengan alasan dan tercatat di audit log.'
                : ' Hubungi admin atau pimpinan bila perlu koreksi.'}
            </p>
            {canCorrect && !correcting && (
              <Button size="sm" variant="outline" className="mt-1" onClick={() => setCorrecting(true)}>
                <FilePenLine /> Koreksi
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!isFinal && !canFill && (
        <Alert variant="info">
          <AlertTitle>Mode lihat</AlertTitle>
          <AlertDescription>
            Agenda ini diisi oleh petugas piket yang bertugas: {agenda.dutyTeacherNames.join(', ') || '—'}.
          </AlertDescription>
        </Alert>
      )}

      {Object.keys(serverErrors).length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Agenda belum lengkap</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(serverErrors).map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* (1) Identitas */}
          <AgendaSection number={1} id="identitas" title="Identitas" invalid={sectionInvalid('dutyTeacherIds')}>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Hari/Tanggal</dt>
                <dd className="font-medium">{formatDateLong(agenda.date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Shift</dt>
                <dd className="font-medium">{shiftName(agenda.shiftCode)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Petugas Piket</dt>
                <dd className="font-medium">
                  {agenda.dutyTeacherNames.length > 0 ? (
                    <ul>
                      {agenda.dutyTeacherNames.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-tone-danger">Belum ditetapkan</span>
                  )}
                </dd>
              </div>
            </dl>
          </AgendaSection>

          {/* (2) Guru yang harus hadir */}
          <AgendaSection
            number={2}
            id="guru-hadir"
            title="Daftar guru yang harus hadir"
            description="Dihitung dari jadwal mengajar aktif dan absensi guru."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link to={`/absensi-guru?date=${agenda.date}&shiftCode=${agenda.shiftCode}`}>
                  <UserCheck /> Absensi Guru
                </Link>
              </Button>
            }
          >
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Terjadwal" value={agenda.scheduledTeacherCount} />
              <StatCard label="Hadir" value={agenda.presentTeacherCount} tone="success" />
              <StatCard
                label="Tidak hadir"
                value={agenda.absentTeachers.length}
                tone={agenda.absentTeachers.length > 0 ? 'danger' : 'neutral'}
              />
            </div>
            {agenda.scheduledTeacherCount - agenda.presentTeacherCount - agenda.absentTeachers.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground tabular-nums">
                {agenda.scheduledTeacherCount - agenda.presentTeacherCount - agenda.absentTeachers.length} guru belum
                tercatat kehadirannya.
              </p>
            )}
          </AgendaSection>

          {/* (3) Guru tidak hadir */}
          <AgendaSection
            number={3}
            id="guru-tidak-hadir"
            title="Guru tidak hadir"
            description="Status dan alasan diambil dari Absensi Guru; jam yang digantikan dari Jam Kosong."
            invalid={sectionInvalid('absentTeachers') || Object.keys(reasonRowErrors).length > 0}
            actions={
              !isFinal && (
                <>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/absensi-guru?date=${agenda.date}&shiftCode=${agenda.shiftCode}`}>
                      Catat status guru
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/jam-kosong?date=${agenda.date}&shiftCode=${agenda.shiftCode}`}>
                      Tangani jam kosong
                    </Link>
                  </Button>
                </>
              )
            }
          >
            {agenda.absentTeachers.length > 0 ? (
              <AbsentTeachersTable rows={agenda.absentTeachers} rowErrors={reasonRowErrors} />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada guru terjadwal yang tercatat tidak hadir.
                </p>
                <CheckRow
                  id="no-absent"
                  label="Tidak ada guru yang tidak hadir"
                  checked={noAbsentTeachers}
                  disabled={!editable || pending}
                  onChange={(v) => setEdits((e) => ({ ...e, noAbsentTeachers: v }))}
                />
              </div>
            )}
          </AgendaSection>

          {/* (4) Hal penting */}
          <AgendaSection
            number={4}
            id="hal-penting"
            title="Hal penting / kejadian"
            invalid={sectionInvalid('notes')}
          >
            <div className="flex flex-col gap-3">
              <NotesList agenda={agenda} editable={editable} onConflict={setConflict} />
              {agenda.notes.length === 0 && (
                <CheckRow
                  id="no-notes"
                  label="Tidak ada catatan hal penting"
                  checked={noImportantNotes}
                  disabled={!editable || pending}
                  onChange={(v) => setEdits((e) => ({ ...e, noImportantNotes: v }))}
                />
              )}
            </div>
          </AgendaSection>

          {/* (5) Penanggulangan jam kosong */}
          <AgendaSection
            number={5}
            id="jam-kosong"
            title="Penanggulangan jam kosong"
            actions={
              !isFinal && (
                <Button asChild variant="outline" size="sm">
                  <Link to={`/jam-kosong?date=${agenda.date}&shiftCode=${agenda.shiftCode}`}>
                    <CalendarClock /> Jam Kosong
                  </Link>
                </Button>
              )
            }
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Jam terdampak" value={absentTotals.affected} />
                <StatCard label="Digantikan" value={absentTotals.handled} tone="success" />
                <StatCard
                  label="Belum"
                  value={absentTotals.unhandled}
                  tone={absentTotals.unhandled > 0 ? 'warning' : 'neutral'}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="substitution-summary">Catatan penanggulangan</Label>
                {editable ? (
                  <>
                    <Textarea
                      id="substitution-summary"
                      rows={3}
                      value={substitutionSummary}
                      disabled={pending}
                      aria-invalid={summaryTooLong || undefined}
                      aria-describedby="substitution-summary-hint"
                      placeholder="Mis. Jam ke-3–4 X TKJ 1 diisi tugas mandiri dari guru mapel, diawasi guru piket."
                      onChange={(e) => setEdits((x) => ({ ...x, substitutionSummary: e.target.value }))}
                    />
                    <p
                      id="substitution-summary-hint"
                      className={cn('text-xs tabular-nums', summaryTooLong ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      Opsional · {substitutionSummary.length}/{SUBSTITUTION_SUMMARY_MAX}
                    </p>
                  </>
                ) : (
                  <p id="substitution-summary" className="text-sm whitespace-pre-line">
                    {agenda.substitutionSummary || <span className="text-muted-foreground">—</span>}
                  </p>
                )}
              </div>
            </div>
          </AgendaSection>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
          {!isFinal && <CompletenessChecklist items={checklist} />}
          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground shadow-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt>Dikirim</dt>
              <dd className="text-foreground">
                {agenda.submittedAt ? `${formatDateTime(agenda.submittedAt)} · ${agenda.submittedByName ?? ''}` : '—'}
              </dd>
              <dt>Final</dt>
              <dd className="text-foreground">
                {agenda.finalizedAt ? `${formatDateTime(agenda.finalizedAt)} · ${agenda.finalizedByName ?? ''}` : '—'}
              </dd>
              <dt>Versi</dt>
              <dd className="text-foreground tabular-nums">{agenda.version}</dd>
            </dl>
          </div>
        </aside>
      </div>

      {/* Bilah aksi: menempel di bawah (di atas navigasi bawah ponsel). */}
      {(canFill || (canCorrect && correcting)) && (
        <div className="no-print sticky bottom-16 z-10 -mx-3 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:bottom-0">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
            {isDirty && <span className="mr-auto text-xs text-muted-foreground">Ada perubahan belum disimpan</span>}
            {canFill ? (
              <>
                <Button
                  variant="outline"
                  disabled={!isDirty || pending}
                  onClick={() => void saveDraft()}
                >
                  <Save /> {update.isPending ? 'Menyimpan…' : 'Simpan Draft'}
                </Button>
                {agenda.status === 'DRAFT' && (
                  <Button variant="secondary" disabled={pending} onClick={() => void doSubmit(false)}>
                    <Send /> {submit.isPending && !dialog ? 'Mengirim…' : 'Kirim'}
                  </Button>
                )}
                <Button disabled={pending} onClick={() => setDialog('finalize')}>
                  <CheckCheck /> Finalisasi
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setEdits({})
                    setCorrecting(false)
                  }}
                >
                  <X /> Batal koreksi
                </Button>
                <Button disabled={pending || (!isDirty && !refreshSnapshot)} onClick={() => setDialog('correct')}>
                  <Save /> Simpan koreksi
                </Button>
              </>
            )}
          </div>
          {canCorrect && correcting && (
            <div className="mx-auto mt-2 flex max-w-7xl items-center justify-end gap-2">
              <Checkbox
                id="refresh-snapshot"
                checked={refreshSnapshot}
                onCheckedChange={(v) => setRefreshSnapshot(v === true)}
                disabled={pending}
              />
              <Label htmlFor="refresh-snapshot" className="text-xs font-normal">
                Perbarui data guru tidak hadir dari absensi terbaru
              </Label>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={dialog === 'finalize'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Finalisasi agenda piket?"
        description={
          complete ? (
            <p>
              Setelah final, agenda tidak dapat diubah oleh petugas. Perubahan berikutnya memerlukan koreksi oleh
              admin/pimpinan dengan alasan.
            </p>
          ) : (
            <p>
              Masih ada bagian yang belum lengkap. Sistem akan menolak finalisasi sampai semua bagian lengkap atau
              diberi penanda &ldquo;tidak ada&rdquo;.
            </p>
          )
        }
        confirmLabel="Finalisasi"
        pending={pending}
        onConfirm={async () => {
          await doSubmit(true)
          setDialog(null)
        }}
      >
        <CompletenessChecklist items={checklist} className="shadow-none" />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'correct'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Simpan koreksi agenda final?"
        description="Koreksi tercatat di audit log beserta nilai lama, nilai baru, dan alasan."
        confirmLabel="Simpan koreksi"
        requireReason
        reasonLabel="Alasan koreksi"
        pending={pending}
        onConfirm={async (reason) => {
          const saved = await saveDraft({ correctionReason: reason })
          setDialog(null)
          if (saved) {
            setCorrecting(false)
            setRefreshSnapshot(false)
          }
        }}
      />
    </Page>
  )
}

function CheckRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  )
}
