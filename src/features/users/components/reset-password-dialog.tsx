import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getErrorMessage } from '@/lib/error-mapping'
import type { UserAccount } from '@/types/entities'
import type { useUserMutations } from '../queries'
import type { TemporaryPasswordInfo } from './temporary-password-dialog'

/**
 * Konfirmasi reset kata sandi (alasan wajib). Semua sesi akun itu diakhiri oleh backend.
 * Kata sandi baru diserahkan ke `onDone` untuk ditampilkan sekali di TemporaryPasswordDialog.
 */
export function ResetPasswordDialog({
  account,
  mutations,
  onOpenChange,
  onDone,
}: {
  account: UserAccount | null
  mutations: ReturnType<typeof useUserMutations>
  onOpenChange: (open: boolean) => void
  onDone: (info: TemporaryPasswordInfo) => void
}) {
  const m = mutations.resetPassword
  return (
    <ConfirmDialog
      open={!!account}
      onOpenChange={onOpenChange}
      title="Reset kata sandi?"
      description={
        <>
          Kata sandi <strong className="text-foreground">{account?.name}</strong> diganti dengan kata sandi sementara
          baru. Semua sesi yang sedang berjalan pada akun ini akan diakhiri dan pengguna wajib mengganti kata sandi saat
          masuk.
        </>
      }
      confirmLabel="Reset kata sandi"
      requireReason
      reasonLabel="Alasan reset"
      pending={m.isPending}
      onConfirm={async (reason) => {
        if (!account) return
        try {
          const res = await m.mutateAsync({ id: account.id, reason })
          onDone({ name: account.name, username: account.username, password: res.temporaryPassword, kind: 'reset' })
        } catch (e) {
          toast.error(getErrorMessage(e), { duration: 8000 })
        }
      }}
    />
  )
}
