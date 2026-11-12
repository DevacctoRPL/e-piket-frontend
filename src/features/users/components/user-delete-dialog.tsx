import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getErrorMessage } from '@/lib/error-mapping'
import type { UserAccount } from '@/types/entities'
import type { useUserMutations } from '../queries'

export type DeleteTarget =
  | { kind: 'single'; account: UserAccount }
  | { kind: 'bulk'; accounts: UserAccount[] }
  | null

/**
 * Dialog konfirmasi hapus akun pengguna (satuan atau massal).
 * Tautan ke Data Master Guru otomatis dilepas tanpa menghapus data Master Guru.
 */
export function UserDeleteDialog({
  target,
  mutations,
  onOpenChange,
  onCompleted,
}: {
  target: DeleteTarget
  mutations: ReturnType<typeof useUserMutations>
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void
}) {
  const isSingle = target?.kind === 'single'
  const count = target ? (target.kind === 'single' ? 1 : target.accounts.length) : 0
  const pending = mutations.remove.isPending || mutations.bulkDelete.isPending

  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title={isSingle ? 'Hapus akun pengguna?' : `Hapus ${count} akun pengguna?`}
      description={
        isSingle ? (
          <>
            Akun <strong className="text-foreground">{target.account.name}</strong> (
            <span className="font-mono">{target.account.username}</span>) akan dihapus dan seluruh sesi aktifnya
            diakhiri. Bila akun ini tertaut ke Data Master Guru, tautannya akan dilepas tanpa menghapus data gurunya.
          </>
        ) : (
          <>
            Sebanyak <strong className="text-foreground">{count} akun</strong> terpilih akan dihapus sekaligus dan sesi
            aktifnya diakhiri. Data Master Guru yang tertaut tetap aman dan dapat ditautkan ke akun baru.
          </>
        )
      }
      confirmLabel={isSingle ? 'Hapus akun' : `Hapus ${count} akun`}
      destructive
      pending={pending}
      onConfirm={async (reason) => {
        if (!target) return
        try {
          if (target.kind === 'single') {
            await mutations.remove.mutateAsync({ id: target.account.id, reason: reason || undefined })
            toast.success(`Akun ${target.account.name} dihapus.`)
          } else {
            const ids = target.accounts.map((a) => a.id)
            const res = await mutations.bulkDelete.mutateAsync({ ids, reason: reason || undefined })
            toast.success(`${res.affected} akun dihapus.`)
          }
          onCompleted?.()
          onOpenChange(false)
        } catch (e) {
          toast.error(getErrorMessage(e), { duration: 8000 })
        }
      }}
    />
  )
}

