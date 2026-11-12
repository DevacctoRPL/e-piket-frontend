import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getErrorMessage } from '@/lib/error-mapping'
import type { ActiveStatus, UserAccount } from '@/types/entities'
import type { useUserMutations } from '../queries'

export type BulkStatusTarget = {
  accounts: UserAccount[]
  status: ActiveStatus
} | null

/**
 * Konfirmasi nonaktifkan (alasan wajib; semua sesi diakhiri) atau aktifkan kembali akun.
 */
export function UserStatusDialog({
  account,
  bulkTarget,
  mutations,
  onOpenChange,
  onCompleted,
}: {
  account: UserAccount | null
  bulkTarget?: BulkStatusTarget
  mutations: ReturnType<typeof useUserMutations>
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}) {
  const isBulk = !!bulkTarget
  const deactivate = isBulk ? bulkTarget.status === 'INACTIVE' : account?.status === 'ACTIVE'
  const count = bulkTarget?.accounts.length ?? 0
  const pending = mutations.setStatus.isPending || mutations.bulkStatus.isPending

  return (
    <ConfirmDialog
      open={!!account || isBulk}
      onOpenChange={onOpenChange}
      title={
        isBulk
          ? deactivate
            ? `Nonaktifkan ${count} akun?`
            : `Aktifkan ${count} akun?`
          : deactivate
            ? 'Nonaktifkan akun?'
            : 'Aktifkan kembali akun?'
      }
      description={
        isBulk ? (
          deactivate ? (
            <>
              Sebanyak <strong className="text-foreground">{count} akun</strong> terpilih tidak akan bisa masuk dan
              semua sesi aktifnya diakhiri. Akun dapat diaktifkan kembali kapan saja.
            </>
          ) : (
            <>
              Sebanyak <strong className="text-foreground">{count} akun</strong> terpilih akan diaktifkan kembali dan
              dapat masuk ke E-Piket.
            </>
          )
        ) : deactivate ? (
          <>
            <strong className="text-foreground">{account?.name}</strong> tidak akan bisa masuk dan semua sesi yang sedang
            berjalan diakhiri. Riwayat dan audit tetap tersimpan; akun dapat diaktifkan kembali kapan saja.
          </>
        ) : (
          <>
            <strong className="text-foreground">{account?.name}</strong> dapat masuk kembali dengan kata sandi yang
            terakhir berlaku. Lakukan reset kata sandi bila pengguna lupa.
          </>
        )
      }
      confirmLabel={
        isBulk
          ? deactivate
            ? `Nonaktifkan ${count} akun`
            : `Aktifkan ${count} akun`
          : deactivate
            ? 'Nonaktifkan'
            : 'Aktifkan'
      }
      destructive={deactivate}
      requireReason={deactivate}
      reasonLabel="Alasan menonaktifkan"
      pending={pending}
      onConfirm={async (reason) => {
        try {
          if (isBulk && bulkTarget) {
            const res = await mutations.bulkStatus.mutateAsync({
              ids: bulkTarget.accounts.map((a) => a.id),
              status: bulkTarget.status,
              reason: reason || undefined,
            })
            toast.success(
              deactivate
                ? `${res.affected} akun dinonaktifkan.`
                : `${res.affected} akun diaktifkan kembali.`,
            )
            onCompleted?.()
            onOpenChange(false)
            return
          }
          if (!account) return
          await mutations.setStatus.mutateAsync({
            id: account.id,
            body: {
              status: deactivate ? 'INACTIVE' : 'ACTIVE',
              reason: reason || undefined,
              version: account.version,
            },
          })
          toast.success(deactivate ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.')
          onCompleted?.()
          onOpenChange(false)
        } catch (e) {
          toast.error(getErrorMessage(e), { duration: 8000 })
        }
      }}
    />
  )
}
