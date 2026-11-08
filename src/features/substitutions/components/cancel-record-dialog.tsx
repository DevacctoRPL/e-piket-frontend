import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-mapping'
import type { SubstitutionRecord } from '@/types/entities'
import { useCancelSubstitution } from '../queries'
import { periodLabel } from '../utils'

/** Batalkan penugasan pengganti: slot kembali "Belum Tertangani", alasan wajib & tercatat di audit. */
export function CancelRecordDialog({
  record,
  className,
  onOpenChange,
}: {
  record: SubstitutionRecord | null
  className?: string
  onOpenChange: (open: boolean) => void
}) {
  const cancel = useCancelSubstitution()
  return (
    <ConfirmDialog
      key={record?.id ?? 'none'}
      open={!!record}
      onOpenChange={onOpenChange}
      title="Batalkan guru pengganti?"
      description={
        record ? (
          <p>
            Penugasan <strong>{record.substituteTeacherName}</strong> di {className ?? 'kelas ini'} (
            {periodLabel(record.periodStart, record.periodEnd).toLowerCase()}) akan dibatalkan dan slot kembali
            berstatus <strong>Belum Tertangani</strong>. Riwayat tetap tersimpan di audit log.
          </p>
        ) : null
      }
      confirmLabel="Batalkan penugasan"
      cancelLabel="Kembali"
      destructive
      requireReason
      reasonLabel="Alasan pembatalan"
      pending={cancel.isPending}
      onConfirm={async (reason) => {
        if (!record) return
        try {
          await cancel.mutateAsync({ id: record.id, reason })
          toast.success('Penugasan guru pengganti dibatalkan.')
          onOpenChange(false)
        } catch (e) {
          // 4xx selain 422 sudah ditampilkan oleh toast global (MutationCache).
          if (e instanceof ApiError && e.status === 422) toast.error(getErrorMessage(e))
        }
      }}
    />
  )
}
