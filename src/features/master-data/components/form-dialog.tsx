import { AlertTriangle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { UnsavedChangesGuard } from '@/components/unsaved-changes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

/**
 * Dialog form create/edit data master: tombol simpan nonaktif saat pending ("Menyimpan…"),
 * konfirmasi buang perubahan bila form kotor, dan area error tingkat form (mis. 409).
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  pending,
  isDirty,
  submitLabel = 'Simpan',
  formError,
  children,
  wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  pending: boolean
  isDirty: boolean
  submitLabel?: string
  formError?: { title?: string; message: ReactNode } | null
  children: ReactNode
  wide?: boolean
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true)
    if (pending) return
    if (isDirty) return setConfirmDiscard(true)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className={cn(wide && 'sm:max-w-2xl')}>
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? (
                <DialogDescription>{description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Isi formulir lalu simpan.</DialogDescription>
              )}
            </DialogHeader>
            {formError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>{formError.title ?? 'Gagal menyimpan'}</AlertTitle>
                <AlertDescription>{formError.message}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4">{children}</div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => requestClose(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Menyimpan…' : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Buang perubahan?"
        description="Perubahan pada formulir ini belum disimpan dan akan hilang."
        confirmLabel="Buang perubahan"
        cancelLabel="Lanjut mengisi"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onOpenChange(false)
        }}
      />
      {/* Satu router hanya mendukung satu blocker aktif: render guard hanya saat dibutuhkan. */}
      {open && isDirty && <UnsavedChangesGuard when />}
    </>
  )
}
