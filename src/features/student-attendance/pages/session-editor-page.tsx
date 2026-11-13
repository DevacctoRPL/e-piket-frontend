import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  CircleDot,
  CloudOff,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CountChip, FramedCard } from '@/components/framed-card'
import { EmptyState, ErrorState, Page, PageHeader, TableSkeleton } from '@/components/page'
import { SearchField } from '@/components/search-field'
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle, Skeleton } from '@/components/ui/misc'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useSettings, useShifts } from '@/features/master-data/lookups'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { useOnline } from '@/hooks/use-online'
import { ApiError } from '@/lib/api-client'
import { formatDateLong, formatDateTime, formatTime, toISODateTime } from '@/lib/date'
import { ATTENDANCE_META, NON_PRESENT_STATUSES, RECORD_STATUS_META } from '@/lib/enums'
import { getErrorMessage, rowErrors } from '@/lib/error-mapping'
import { cn } from '@/lib/utils'
import type { ID, RosterRow, StudentAttendanceSession } from '@/types/entities'
import { CorrectionDialog } from '../components/correction-dialog'
import { RosterRowItem, type RowPatch } from '../components/roster-row'
import { SummaryCounts } from '../components/summary-counts'
import { useBulkSave, useRoster, useSession } from '../queries'
import {
  activeStatusesFrom,
  buildBulkRecords,
  clearDraft,
  clientRowErrors,
  dirtyRows,
  draftFromRecord,
  effectiveDraft,
  isRowDirty,
  liveSummary,
  loadDraft,
  markAllPresent,
  HOMEROOM_NON_PRESENT_STATUSES,
  pruneEdits,
  reasonRequiredFrom,
  saveDraft,
  type Edits,
  type StoredDraft,
} from '../roster-model'

type RowFilter = 'all' | 'unmarked' | 'absent' | 'dirty'
type Banner = { kind: 'conflict' | 'final'; message: string } | null

export function SessionEditorPage() {
  const { id = '' } = useParams()
  const sessionQ = useSession(id)
  const rosterQ = useRoster(id)

  if (sessionQ.isPending || rosterQ.isPending) {
    return (
      <Page>
        <Skeleton className="h-16 rounded-lg" />
        <TableSkeleton rows={8} cols={3} />
      </Page>
    )
  }
  const error = sessionQ.error ?? rosterQ.error
  if (error || !sessionQ.data || !rosterQ.data) {
    return (
      <Page>
        <BackLink />
        <ErrorState
          error={error}
          title={error instanceof ApiError && error.status === 404 ? 'Sesi absensi tidak ditemukan' : undefined}
          onRetry={() => {
            void sessionQ.refetch()
            void rosterQ.refetch()
          }}
        />
      </Page>
    )
  }
  return (
    <SessionEditor
      key={id}
      session={sessionQ.data}
      rows={rosterQ.data}
      reload={() => Promise.all([sessionQ.refetch(), rosterQ.refetch()])}
    />
  )
}

function BackLink({ session }: { session?: StudentAttendanceSession }) {
  const qs = session ? `?date=${session.date}&shift=${encodeURIComponent(session.shiftCode)}` : ''
  return (
    <Button asChild variant="ghost" size="sm" className="no-print -ml-2 w-fit text-muted-foreground">
      <Link to={`/absensi-siswa${qs}`}>
        <ArrowLeft /> Kembali ke daftar kelas
      </Link>
    </Button>
  )
}

function SessionEditor({
  session,
  rows,
  reload,
}: {
  session: StudentAttendanceSession
  rows: RosterRow[]
  reload: () => Promise<unknown>
}) {
  const { can, user: me } = useAuth()
  const online = useOnline()
  const classesQ = useClasses({ scope: 'mine' })
  const shiftsQ = useShifts()
  const settingsQ = useSettings()
  const requiresReason = useMemo(() => reasonRequiredFrom(settingsQ.data), [settingsQ.data])
  const allowed = useMemo(() => activeStatusesFrom(settingsQ.data), [settingsQ.data])

  const cls = classesQ.data?.find((c) => c.id === session.classId)
  const shiftName = shiftsQ.data?.find((s) => s.code === session.shiftCode)?.name ?? session.shiftCode
  const isFinal = session.status === 'FINAL'
  const isHomeroom = !!me?.roles.includes('HOMEROOM')
  const canWrite = can('student_attendance:write')
  const canCorrect = can('student_attendance:correct')
  const editable = canWrite && !isFinal
  const editorAllowed = isHomeroom ? HOMEROOM_NON_PRESENT_STATUSES.filter((s) => allowed.includes(s)) : allowed

  const [edits, setEdits] = useState<Edits>({})
  const [serverErrors, setServerErrors] = useState<Record<ID, Record<string, string>>>({})
  const [showClientErrors, setShowClientErrors] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingRestore, setPendingRestore] = useState<StoredDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [correcting, setCorrecting] = useState<RosterRow | null>(null)
  const [filter, setFilter] = useState<RowFilter>('all')
  const [search, setSearch] = useState('')

  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const editsRef = useRef(edits)
  editsRef.current = edits

  const bulk = useBulkSave(session.id)
  const draftKey = useIdempotencyKey()
  const submitKey = useIdempotencyKey()

  /* ---- draft lokal: tawarkan pemulihan sekali saat halaman dibuka */
  useEffect(() => {
    if (!editable) {
      setDraftReady(true)
      return
    }
    const stored = loadDraft(session.id)
    const pruned = stored ? pruneEdits(rowsRef.current, stored.edits) : {}
    if (stored && Object.keys(pruned).length) setPendingRestore({ ...stored, edits: pruned })
    else {
      clearDraft(session.id)
      setDraftReady(true)
    }
    // hanya saat mount untuk sesi ini
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  useEffect(() => {
    if (!draftReady || !editable) return
    saveDraft(session.id, { version: session.version, savedAt: toISODateTime(), edits: pruneEdits(rows, edits) })
  }, [draftReady, editable, edits, rows, session.id, session.version])

  /* ---- turunan */
  const summary = useMemo(() => liveSummary(rows, edits), [rows, edits])
  const dirty = useMemo(() => dirtyRows(rows, edits), [rows, edits])
  const dirtyCount = dirty.length
  const clientErrors = useMemo(() => clientRowErrors(rows, edits, requiresReason), [rows, edits, requiresReason])
  const lastServerUpdate = useMemo(() => {
    let max: string | null = null
    for (const r of rows) if (r.record && (!max || r.record.updatedAt > max)) max = r.record.updatedAt
    return max
  }, [rows])

  const absentCount = summary.total - summary.PRESENT - summary.unmarked
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        if (q && !row.student.name.toLowerCase().includes(q) && !row.student.nis.includes(q)) return false
        const d = effectiveDraft(row, edits)
        if (filter === 'unmarked') return !d
        if (filter === 'absent') return !!d && NON_PRESENT_STATUSES.includes(d.status)
        if (filter === 'dirty') return isRowDirty(row, edits)
        return true
      })
  }, [rows, edits, filter, search])

  /* ---- aksi edit */
  const touchEdits = useCallback(() => {
    draftKey.reset()
    submitKey.reset()
    setDraftReady(true)
    setPendingRestore(null)
  }, [draftKey, submitKey])

  const onChange = useCallback(
    (studentId: ID, patch: RowPatch) => {
      touchEdits()
      setEdits((prev) => {
        const row = rowsRef.current.find((r) => r.student.id === studentId)
        if (!row) return prev
        const base = prev[studentId] ?? (row.record ? draftFromRecord(row.record) : null)
        if (!base && !patch.status) return prev
        const next = { ...(base ?? { status: patch.status ?? 'PRESENT', reason: '', note: '', arrivalTime: '' }), ...patch }
        return { ...prev, [studentId]: next }
      })
      setServerErrors((prev) => {
        if (!prev[studentId]) return prev
        const { [studentId]: _removed, ...rest } = prev
        return rest
      })
    },
    [touchEdits],
  )

  const applyMarkAll = (overwrite: boolean) => {
    const res = markAllPresent(rows, edits, overwrite)
    if (res.changed === 0) {
      toast.info('Semua siswa sudah berstatus Hadir.')
      return
    }
    touchEdits()
    setEdits(res.edits)
    toast.success(`${res.changed} siswa ditandai Hadir. Ubah siswa yang tidak hadir, lalu simpan.`)
  }

  const onMarkAll = () => {
    if (summary.unmarked > 0) applyMarkAll(false)
    else setConfirmOverwrite(true)
  }

  /* ---- simpan */
  const scrollToRow = (studentId: ID | undefined) => {
    if (!studentId) return
    document.getElementById(`row-${studentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const save = (submit: boolean) => {
    if (bulk.isPending) return
    setFormError(null)
    const errIds = Object.keys(clientErrors)
    if (errIds.length) {
      setShowClientErrors(true)
      setFilter('all')
      toast.error(`${errIds.length} siswa perlu dilengkapi sebelum disimpan.`)
      scrollToRow(rows.find((r) => clientErrors[r.student.id])?.student.id)
      return
    }
    if (submit && summary.unmarked > 0) {
      setFormError(`${summary.unmarked} siswa belum diberi status. Lengkapi atau gunakan "Tandai semua hadir" sebelum finalisasi.`)
      setFilter('unmarked')
      return
    }
    const { records, ids } = buildBulkRecords(rows, edits)
    if (!submit && records.length === 0) {
      toast.info('Tidak ada perubahan untuk disimpan.')
      return
    }
    const sentEdits = edits
    const key = submit ? submitKey.key() : draftKey.key()
    bulk.mutate(
      { body: { records, version: session.version, submit }, idempotencyKey: key },
      {
        onSuccess: (res) => {
          draftKey.reset()
          submitKey.reset()
          setServerErrors({})
          setShowClientErrors(false)
          setBanner(null)
          setLastSavedAt(toISODateTime())
          // Pertahankan edit yang dibuat selama penyimpanan berlangsung.
          setEdits((current) => {
            const kept: Edits = {}
            for (const [sid, d] of Object.entries(current)) if (sentEdits[sid] !== d) kept[sid] = d
            return pruneEdits(res.records, kept)
          })
          if (submit) {
            clearDraft(session.id)
            toast.success(`Absensi ${cls?.name ?? 'kelas'} telah difinalisasi.`)
            setConfirmFinalize(false)
          } else {
            toast.success(`${records.length} perubahan tersimpan sebagai draft.`)
          }
        },
        onError: (err) => {
          setConfirmFinalize(false)
          if (err instanceof ApiError && err.status === 422) {
            const byIndex = rowErrors(err)
            const mapped: Record<ID, Record<string, string>> = {}
            for (const [idx, fields] of Object.entries(byIndex)) {
              const sid = ids[Number(idx)]
              if (sid) mapped[sid] = fields
            }
            setServerErrors(mapped)
            const general = err.details.records
            if (general) setFormError(general)
            const n = Object.keys(mapped).length
            if (n) {
              setFilter('all')
              toast.error(`${n} baris ditolak server. Periksa baris yang ditandai merah.`)
              scrollToRow(ids.find((sid) => mapped[sid]))
            } else if (!general) toast.error(getErrorMessage(err))
            return
          }
          if (err instanceof ApiError && (err.code === 'VERSION_CONFLICT' || err.code === 'ALREADY_FINAL')) {
            setBanner({ kind: err.code === 'ALREADY_FINAL' ? 'final' : 'conflict', message: err.message })
            return
          }
          // Jaringan/5xx: isian tetap di layar & perangkat; kunci idempotensi dipakai ulang saat mencoba lagi.
          toast.error(
            err instanceof ApiError && err.isNetworkError
              ? 'Gagal terhubung ke server. Isian Anda tetap aman di perangkat ini — coba simpan lagi.'
              : getErrorMessage(err),
          )
        },
      },
    )
  }

  const reloadLatest = async () => {
    await reload()
    setBanner(null)
    draftKey.reset()
    submitKey.reset()
    toast.info('Data terbaru dimuat. Perubahan Anda yang belum tersimpan tetap ditampilkan.')
  }

  const saveStatus = bulk.isPending
    ? 'Menyimpan…'
    : dirtyCount > 0
      ? `Belum disimpan · ${dirtyCount} perubahan`
      : lastSavedAt
        ? `Tersimpan ${formatTime(lastSavedAt)}`
        : lastServerUpdate
          ? `Tersimpan ${formatTime(lastServerUpdate)}`
          : 'Belum ada isian'

  const title = cls?.name ?? 'Absensi kelas'

  const filterOptions = (
    [
      { value: 'all', label: 'Semua', count: rows.length },
      { value: 'unmarked', label: 'Belum diisi', count: summary.unmarked },
      { value: 'absent', label: 'Tidak hadir', count: absentCount },
      { value: 'dirty', label: 'Diubah', count: dirtyCount },
    ] satisfies SegmentOption<RowFilter>[]
  ).filter((o) => editable || o.value !== 'dirty')

  return (
    <Page className="gap-4">
      <UnsavedChangesGuard
        when={dirtyCount > 0 && !bulk.isPending}
        message="Ada perubahan absensi yang belum disimpan. Isian tetap tersimpan sementara di perangkat ini, namun belum terkirim ke server."
      />
      <BackLink session={session} />

      {/* Header konteks sesi */}
      <PageHeader
        title={title}
        description={
          <>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge meta={RECORD_STATUS_META} value={session.status} />
              <span aria-hidden>·</span>
              <span>
                {formatDateLong(session.date)} · Shift {shiftName} · {session.sessionLabel}
              </span>
            </span>
            {session.submittedAt && (
              <span className="mt-0.5 block text-xs">
                Difinalisasi {formatDateTime(session.submittedAt)} oleh {session.submittedByName ?? '—'}
              </span>
            )}
          </>
        }
        actions={
          <>
            {cls && (
              <Button asChild variant="outline">
                <Link to={`/absensi-siswa/riwayat?classId=${cls.id}`}>
                  <History /> Riwayat
                </Link>
              </Button>
            )}
            {editable && dirtyCount > 0 && (
              <Button variant="ghost" onClick={() => setConfirmDiscard(true)} disabled={bulk.isPending}>
                <RotateCcw /> Batalkan perubahan
              </Button>
            )}
          </>
        }
      />
      <div aria-live="polite">
        <SummaryCounts counts={summary} />
      </div>

      {pendingRestore && (
        <Alert variant="info">
          <History className="size-4" />
          <AlertTitle>Ada isian yang belum tersimpan</AlertTitle>
          <AlertDescription>
            <p>
              {Object.keys(pendingRestore.edits).length} perubahan dari {formatDateTime(pendingRestore.savedAt)} masih
              tersimpan di perangkat ini.
              {pendingRestore.version !== session.version && ' Data di server sudah berubah sejak saat itu — periksa kembali sebelum menyimpan.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  setEdits(pendingRestore.edits)
                  setPendingRestore(null)
                  setDraftReady(true)
                  toast.success('Isian sebelumnya dipulihkan.')
                }}
              >
                Pulihkan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearDraft(session.id)
                  setPendingRestore(null)
                  setDraftReady(true)
                }}
              >
                Buang
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {banner && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>{banner.kind === 'final' ? 'Absensi sudah difinalisasi' : 'Data telah diubah pengguna lain'}</AlertTitle>
          <AlertDescription>
            <p>{banner.message}</p>
            <Button size="sm" variant="outline" className="mt-1" onClick={() => void reloadLatest()}>
              <RefreshCw /> Muat ulang data terbaru
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isFinal && (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Absensi final</AlertTitle>
          <AlertDescription>
            {canCorrect
              ? 'Data hanya dapat dikoreksi per siswa dengan alasan. Setiap koreksi tercatat di log audit.'
              : 'Data sudah final dan tidak dapat diubah. Hubungi admin/TU bila ada kesalahan.'}
          </AlertDescription>
        </Alert>
      )}
      {!isFinal && !canWrite && (
        <Alert>
          <Lock className="size-4" />
          <AlertTitle>Mode lihat</AlertTitle>
          <AlertDescription>Anda hanya dapat melihat absensi ini.</AlertDescription>
        </Alert>
      )}
      {!isFinal && isHomeroom && editable && (
        <Alert variant="info">
          <CloudOff className="size-4" />
          <AlertTitle>Hadir berasal dari absensi digital sekolah</AlertTitle>
          <AlertDescription>Wali Kelas hanya mengisi status tidak hadir. Data Hadir akan masuk melalui sinkronisasi server sekolah.</AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* Roster: seksi berbingkai — judul + jumlah di kiri, pencarian/saringan/aksi massal di kanan */}
      <FramedCard
        title="Siswa"
        icon={<Users />}
        titleBadge={<CountChip>{rows.length}</CountChip>}
        headerRight={
          rows.length > 0 ? (
            <>
              <SearchField
                value={search}
                onValueChange={setSearch}
                placeholder="Cari nama atau NIS"
                aria-label="Cari siswa"
                className="w-full sm:w-56"
              />
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                options={filterOptions}
                ariaLabel="Saring siswa"
              />
              {editable && !isHomeroom && (
                <Button variant="outline" onClick={onMarkAll} disabled={bulk.isPending}>
                  <CheckCheck /> Tandai semua hadir
                </Button>
              )}
            </>
          ) : undefined
        }
        bodyClassName="overflow-hidden p-0"
      >
        {rows.length === 0 ? (
          <EmptyState
            className="rounded-none border-0 bg-transparent"
            title="Belum ada siswa aktif di kelas ini"
            description="Roster kosong pada tanggal sesi. Hubungi admin/TU untuk memeriksa data siswa kelas ini."
          />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            className="rounded-none border-0 bg-transparent"
            title="Tidak ada siswa yang cocok"
            description="Ubah kata kunci atau saringan untuk melihat siswa lainnya."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilter('all')
                  setSearch('')
                }}
              >
                Tampilkan semua siswa
              </Button>
            }
          />
        ) : (
          <ul aria-label="Daftar siswa">
            {filteredRows.map(({ row, index }) => {
              const sid = row.student.id
              const errs = serverErrors[sid] ?? (showClientErrors ? clientErrors[sid] : undefined)
              return (
                <RosterRowItem
                  key={sid}
                  index={index}
                  row={row}
                  draft={effectiveDraft(row, edits)}
                  dirty={isRowDirty(row, edits)}
                  errors={errs}
                  showErrors={!!errs}
                  readOnly={!editable}
                  requiresReason={requiresReason}
                  allowed={editorAllowed}
                  onChange={onChange}
                  onCorrect={isFinal && canCorrect ? setCorrecting : undefined}
                />
              )
            })}
          </ul>
        )}
      </FramedCard>

      {/* Bar aksi lengket (di atas navigasi bawah ponsel) */}
      {editable && (
        <div className="no-print sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-3 border-t border-border/85 bg-card px-3 py-2.5 shadow-2xs sm:mx-0 sm:rounded-lg sm:border md:bottom-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p
              className={cn(
                'flex items-center gap-1.5 text-[13px] tabular-nums',
                dirtyCount > 0 || !online ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
              role="status"
              aria-live="polite"
            >
              {!online ? (
                <>
                  <CloudOff className="size-4 text-tone-danger" aria-hidden />
                  <span>Offline — isian disimpan sementara di perangkat</span>
                </>
              ) : (
                <>
                  {!bulk.isPending &&
                    (dirtyCount > 0 ? (
                      <CircleDot className="size-4 text-tone-warning" aria-hidden />
                    ) : (
                      <CheckCircle2 className="size-4 text-tone-success" aria-hidden />
                    ))}
                  {saveStatus}
                </>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
              <Button
                variant="outline"
                onClick={() => save(false)}
                disabled={bulk.isPending || dirtyCount === 0}
              >
                <Save /> {bulk.isPending && !bulk.variables?.body.submit ? 'Menyimpan…' : 'Simpan Draft'}
              </Button>
              <Button
                onClick={() => {
                  setFormError(null)
                  if (Object.keys(clientErrors).length) {
                    save(true)
                    return
                  }
                  if (summary.unmarked > 0) {
                    save(true)
                    return
                  }
                  setConfirmFinalize(true)
                }}
                disabled={bulk.isPending}
              >
                <Lock /> {bulk.isPending && bulk.variables?.body.submit ? 'Menyimpan…' : 'Finalisasi'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmFinalize}
        onOpenChange={setConfirmFinalize}
        title={`Finalisasi absensi ${title}?`}
        description={
          <div className="space-y-3">
            <p>
              {formatDateLong(session.date)} · Shift {shiftName}.{' '}
              {dirtyCount > 0 && `${dirtyCount} perubahan akan disimpan sekaligus. `}
              Setelah final, perubahan hanya dapat dilakukan petugas berwenang dengan alasan.
            </p>
            <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              {(['PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE'] as const).map((s) => (
                <div key={s} className="rounded-md border border-border/85 p-2">
                  <dt className="text-xs text-muted-foreground">{ATTENDANCE_META[s].label}</dt>
                  <dd className="text-lg font-semibold text-foreground tabular-nums">{summary[s]}</dd>
                </div>
              ))}
            </dl>
            {summary.EXCUSED + summary.LEFT_EARLY > 0 && (
              <p className="text-xs tabular-nums">
                Dispensasi {summary.EXCUSED} · Pulang Lebih Awal {summary.LEFT_EARLY}
              </p>
            )}
            <p className="text-xs tabular-nums">Total {summary.total} siswa</p>
          </div>
        }
        confirmLabel="Finalisasi"
        pending={bulk.isPending}
        onConfirm={() => save(true)}
      />

      <ConfirmDialog
        open={confirmOverwrite}
        onOpenChange={setConfirmOverwrite}
        title="Ubah semua siswa menjadi Hadir?"
        description="Semua siswa sudah memiliki status. Melanjutkan akan mengganti status setiap siswa menjadi Hadir (alasan dan jam datang dihapus). Perubahan belum tersimpan sampai Anda menekan Simpan."
        confirmLabel="Ubah semua"
        onConfirm={() => {
          applyMarkAll(true)
          setConfirmOverwrite(false)
        }}
      />

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Batalkan semua perubahan?"
        description={`${dirtyCount} perubahan yang belum disimpan akan dihapus dan data kembali seperti di server.`}
        confirmLabel="Batalkan perubahan"
        destructive
        onConfirm={() => {
          touchEdits()
          setEdits({})
          setServerErrors({})
          setShowClientErrors(false)
          setFormError(null)
          clearDraft(session.id)
          setConfirmDiscard(false)
        }}
      />

      {isFinal && canCorrect && (
        <CorrectionDialog
          sessionId={session.id}
          row={correcting}
          open={!!correcting}
          onOpenChange={(o) => !o && setCorrecting(null)}
          requiresReason={requiresReason}
          allowed={allowed}
          onConflict={() => void reload()}
        />
      )}
    </Page>
  )
}
