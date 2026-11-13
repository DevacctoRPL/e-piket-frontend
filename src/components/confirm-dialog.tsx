import { useId, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Dialog konfirmasi untuk finalisasi, koreksi, penghapusan (PRD §8.1).
 * `requireReason` memunculkan kolom alasan wajib (koreksi data final — PRD §9.2).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Lanjutkan',
  cancelLabel = 'Batal',
  destructive = false,
  requireReason = false,
  reasonLabel = 'Alasan',
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  requireReason?: boolean
  reasonLabel?: string
  pending?: boolean
  onConfirm: (reason: string) => void | Promise<void>
  children?: ReactNode
}) {
  const reasonId = useId()
  const reasonFieldId = `${reasonId}-reason`
  const reasonErrorId = `${reasonId}-error`
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const reasonMissing = requireReason && reason.trim().length < 3

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return
        if (!o) {
          setReason('')
          setTouched(false)
        }
        onOpenChange(o)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        {requireReason && (
          <div className="grid gap-1.5">
            <Label htmlFor={reasonFieldId}>
              {reasonLabel} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id={reasonFieldId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && reasonMissing}
              aria-describedby={touched && reasonMissing ? reasonErrorId : undefined}
              placeholder="Jelaskan alasan perubahan…"
            />
            {touched && reasonMissing && (
              <p id={reasonErrorId} className="text-xs text-destructive">Alasan wajib diisi (minimal 3 karakter).</p>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={async () => {
              setTouched(true)
              if (reasonMissing) return
              await onConfirm(reason.trim())
            }}
          >
            {pending ? 'Memproses…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
