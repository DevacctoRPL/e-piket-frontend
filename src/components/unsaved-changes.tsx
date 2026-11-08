import { useEffect } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '@/components/confirm-dialog'

/**
 * Konfirmasi sebelum meninggalkan halaman bila ada perubahan belum tersimpan (PRD §11.4, §12.1).
 * Menangani navigasi in-app (useBlocker) dan tutup tab/reload (beforeunload).
 */
export function UnsavedChangesGuard({ when, message }: { when: boolean; message?: string }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(o) => {
        if (!o && blocker.state === 'blocked') blocker.reset()
      }}
      title="Tinggalkan halaman?"
      description={message ?? 'Ada perubahan yang belum disimpan. Perubahan akan hilang jika Anda meninggalkan halaman ini.'}
      confirmLabel="Tinggalkan"
      cancelLabel="Tetap di sini"
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
