import { ArrowLeft, CheckCircle2, Info, Pencil, Printer, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FramedCard } from '@/components/framed-card'
import { ErrorState, Page, PageHeader } from '@/components/page'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/auth-context'
import { useLookupMaps } from '@/features/master-data/lookups'
import { ApiError } from '@/lib/api-client'
import { formatDateLong, formatDateTime } from '@/lib/date'
import { getErrorMessage } from '@/lib/error-mapping'
import type { ExtraActivity } from '@/types/entities'
import { ActivityFormDialog } from '../components/activity-form-dialog'
import { ActivityPrint } from '../components/activity-print'
import { ActivityStatusBadge, ClassChips, timeRange, TypeBadge } from '../components/activity-bits'
import { ParticipantsPanel } from '../components/participants-panel'
import { canFillParticipants, canManageActivity } from '../permissions'
import { useDeleteExtraActivity, useExtraActivity, useUpdateExtraActivity } from '../queries'

/** Detail kegiatan: info, ubah, presensi peserta, dan tampilan cetak (FR-EXT-01..03). */
export function ExtraActivityDetailPage() {
  const { id = '' } = useParams()
  const query = useExtraActivity(id)
  const [sp, setSp] = useSearchParams()
  const printMode = sp.get('view') === 'print'
  const { shiftName } = useLookupMaps()

  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    return (
      <Page>
        <BackLink />
        <ErrorState
          error={query.error}
          title={query.error instanceof ApiError && query.error.status === 404 ? 'Kegiatan tidak ditemukan' : undefined}
          onRetry={() => void query.refetch()}
        />
      </Page>
    )
  }

  const a = query.data
  if (printMode) {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setSp({}, { replace: true })}>
            <ArrowLeft /> Kembali ke detail
          </Button>
          <Button onClick={() => window.print()}>
            <Printer /> Cetak / Simpan PDF
          </Button>
        </div>
        <ActivityPrint activity={a} shiftName={shiftName(a.shiftCode)} />
      </div>
    )
  }
  return <DetailView activity={a} shiftName={shiftName(a.shiftCode)} onReload={() => void query.refetch()} />
}

function DetailView({ activity: a, shiftName, onReload }: { activity: ExtraActivity; shiftName: string; onReload: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [, setSp] = useSearchParams()
  const [editOpen, setEditOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | 'delete' | 'finalize'>(null)
  const del = useDeleteExtraActivity(a.id)
  const update = useUpdateExtraActivity(a.id)
  const canManage = canManageActivity(user, a)
  const canFill = canFillParticipants(user, a)
  const isFinal = a.status === 'FINAL'

  const onDelete = async (reason: string) => {
    try {
      await del.mutateAsync(reason || undefined)
      toast.success('Kegiatan dihapus.')
      navigate('..', { relative: 'path', replace: true })
    } catch (e) {
      setConfirm(null)
      toast.error(getErrorMessage(e))
    }
  }

  const onFinalize = async () => {
    try {
      await update.mutateAsync({ status: 'FINAL', version: a.version })
      setConfirm(null)
      toast.success('Kegiatan ditandai final.')
    } catch (e) {
      setConfirm(null)
      toast.error(getErrorMessage(e), e instanceof ApiError && e.status === 409 ? { action: { label: 'Muat ulang', onClick: onReload } } : undefined)
    }
  }

  return (
    <Page className="max-w-5xl">
      <BackLink />
      <PageHeader
        title={a.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <TypeBadge type={a.type} />
            <ActivityStatusBadge status={a.status} />
            <span>
              {formatDateLong(a.date)} · {shiftName}
              {timeRange(a) ? ` · ${timeRange(a)}` : ''}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setSp({ view: 'print' })}>
              <Printer /> Cetak
            </Button>
            {canManage && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil /> {isFinal ? 'Koreksi' : 'Ubah'}
                </Button>
                {!isFinal && !a.participantAttendanceEnabled && (
                  <Button variant="outline" onClick={() => setConfirm('finalize')}>
                    <CheckCircle2 /> Tandai terlaksana
                  </Button>
                )}
                <RowActionsMenu
                  label={`Aksi lain untuk ${a.name}`}
                  actions={[{ label: 'Hapus', icon: Trash2, destructive: true, onSelect: () => setConfirm('delete') }]}
                />
              </>
            )}
          </>
        }
      />

      <FramedCard title="Informasi kegiatan" icon={<Info />}>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoItem label="Pengampu">{a.instructorName}</InfoItem>
          <InfoItem label="Kelas peserta">
            <ClassChips names={a.classNames} />
          </InfoItem>
          <InfoItem label="Materi" wide>
            {a.topic ?? <span className="text-muted-foreground">Belum diisi</span>}
          </InfoItem>
          <InfoItem label="Keterangan" wide>
            {a.note ?? <span className="text-muted-foreground">—</span>}
          </InfoItem>
          <InfoItem label="Dibuat">{formatDateTime(a.createdAt)}</InfoItem>
        </dl>
      </FramedCard>

      <ParticipantsPanel activity={a} canFill={canFill} canManage={canManage} onReload={onReload} />

      {canManage && (
        <ActivityFormDialog open={editOpen} onOpenChange={setEditOpen} activity={a} />
      )}

      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Hapus kegiatan?"
        description={`"${a.name}" akan dihapus dari daftar. Riwayat tetap tersimpan di audit log.`}
        confirmLabel="Hapus"
        destructive
        requireReason={isFinal}
        reasonLabel="Alasan penghapusan"
        pending={del.isPending}
        onConfirm={onDelete}
      />
      <ConfirmDialog
        open={confirm === 'finalize'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Tandai kegiatan terlaksana?"
        description="Kegiatan akan dikunci sebagai final. Perubahan berikutnya memerlukan alasan koreksi."
        confirmLabel="Tandai final"
        pending={update.isPending}
        onConfirm={onFinalize}
      />
    </Page>
  )
}

function InfoItem({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-line">{children}</dd>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to=".."
      relative="path"
      className="no-print inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Kursus / Jam Tambahan
    </Link>
  )
}

function DetailSkeleton() {
  return (
    <Page className="max-w-5xl">
      <div aria-busy="true" aria-label="Memuat kegiatan" className="space-y-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </Page>
  )
}
