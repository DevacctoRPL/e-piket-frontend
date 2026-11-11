import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getErrorMessage } from '@/lib/error-mapping'
import type { UserAccount } from '@/types/entities'
import type { useUserMutations } from '../queries'

/**
 * Konfirmasi nonaktifkan (alasan wajib; semua sesi diakhiri) atau aktifkan kembali akun.
 * Tidak ada hapus permanen — nama pelaku di audit log tetap terbaca.
 */
export function UserStatusDialog({
  account,
  mutations,
  onOpenChange,
}: {
  account: UserAccount | null
  mutations: ReturnType<typeof useUserMutations>
  onOpenChange: (open: boolean) => void
}) {
  const m = mutations.setStatus
  const deactivate = account?.status === 'ACTIVE'
  return (
    <ConfirmDialog
      open={!!account}
      onOpenChange={onOpenChange}
      title={deactivate ? 'Nonaktifkan akun?' : 'Aktifkan kembali akun?'}
      description={
        deactivate ? (
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
      confirmLabel={deactivate ? 'Nonaktifkan' : 'Aktifkan'}
      destructive={deactivate}
      requireReason={deactivate}
      reasonLabel="Alasan menonaktifkan"
      pending={m.isPending}
      onConfirm={async (reason) => {
        if (!account) return
        try {
          await m.mutateAsync({
            id: account.id,
            body: {
              status: deactivate ? 'INACTIVE' : 'ACTIVE',
              reason: reason || undefined,
              version: account.version,
            },
          })
          toast.success(deactivate ? 'Akun dinonaktifkan.' : 'Akun diaktifkan kembali.')
          onOpenChange(false)
        } catch (e) {
          toast.error(getErrorMessage(e), { duration: 8000 })
        }
      }}
    />
  )
}
