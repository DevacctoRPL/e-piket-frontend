import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Info, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { FormField } from '@/components/form-field'
import { StatusBadge } from '@/components/status-badge'
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
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/misc'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/lib/date'
import { ATTENDANCE_META } from '@/lib/enums'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'
import type { AbsenteeRow } from '@/types/entities'
import { useSaveGuardianContact } from '../queries'
import { CONTACT_FIELDS, contactSchema, type ContactFormValues } from '../schemas'
import type { GuardianContactPayload } from '../types'

const RECEIVER_SUGGESTIONS = ['Ayah', 'Ibu', 'Wali', 'Kakak', 'Kakek/Nenek']

function defaultsFor(row: AbsenteeRow, canSeePhone: boolean): ContactFormValues {
  const existing = row.contact
  const phone = canSeePhone ? (existing?.contactedPhone ?? row.guardianPhone ?? '') : ''
  return {
    contactedPhone: phone,
    receiverName: existing?.receiverName ?? '',
    contactNote: existing?.contactNote ?? '',
  }
}

/**
 * Dialog "Catat konfirmasi" (FR-STU-06): mencatat nomor yang dihubungi, pihak yang menerima, dan keterangan.
 * Sistem tidak mengirim pesan — hanya menyimpan catatan komunikasi.
 */
export function ContactDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AbsenteeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {row ? <ContactForm key={row.recordId} row={row} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function ContactForm({ row, onDone }: { row: AbsenteeRow; onDone: () => void }) {
  const { can } = useAuth()
  const canSeePhone = can('student_contact:read')
  const qc = useQueryClient()
  const mutation = useSaveGuardianContact()
  const idem = useIdempotencyKey()
  const [failure, setFailure] = useState<{ message: string; conflict: boolean } | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: defaultsFor(row, canSeePhone),
  })

  // Isi form berubah → niat submit baru.
  const watched = watch()
  const watchedKey = JSON.stringify(watched)
  useEffect(() => {
    idem.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedKey])

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null)
    const body: GuardianContactPayload = {
      receiverName: values.receiverName || null,
      contactNote: values.contactNote || null,
    }
    // Pengguna tanpa hak lihat kontak hanya mengirim nomor bila mengetik sendiri (nomor lama dipertahankan).
    if (canSeePhone || values.contactedPhone) body.contactedPhone = values.contactedPhone || null
    try {
      await mutation.mutateAsync({ recordId: row.recordId, body, idempotencyKey: idem.key() })
      idem.reset()
      toast.success('Konfirmasi wali tersimpan.')
      onDone()
    } catch (e) {
      if (applyServerErrors(e, setError, CONTACT_FIELDS)) return
      const conflict = e instanceof ApiError && (e.status === 409 || e.status === 404)
      setFailure({ message: getErrorMessage(e), conflict })
    }
  })

  const pending = mutation.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <UnsavedChangesGuard when={isDirty && !pending} />
      <DialogHeader>
        <DialogTitle>Catat konfirmasi wali</DialogTitle>
        <DialogDescription>
          Catat hasil komunikasi dengan orang tua/wali. Sistem tidak mengirim pesan otomatis.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{row.studentName}</p>
          <StatusBadge meta={ATTENDANCE_META} value={row.status} showShort />
        </div>
        <p className="text-muted-foreground">
          {row.className} · {formatDate(row.date)}
          {row.reason ? ` · ${row.reason}` : ''}
        </p>
        <p className="text-muted-foreground">
          Wali: {row.guardianName ?? '—'}
          {row.guardianPhone ? <span className="tabular-nums"> · {row.guardianPhone}</span> : null}
        </p>
        {row.contact?.contactedAt && (
          <p className="text-xs text-muted-foreground">
            Terakhir dicatat {formatDateTime(row.contact.contactedAt)} oleh {row.contact.contactedByName ?? '—'}
          </p>
        )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>{failure.message}</span>
            {failure.conflict && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => {
                  void qc.invalidateQueries({ queryKey: ['absentees'] })
                  onDone()
                }}
              >
                <RefreshCw /> Muat ulang daftar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <FormField
        label="Nomor yang dihubungi"
        error={errors.contactedPhone?.message}
        hint={
          canSeePhone
            ? 'Terisi otomatis dari nomor wali; ubah bila menghubungi nomor lain.'
            : 'Nomor wali disembunyikan untuk peran Anda. Kosongkan bila tidak menghubungi nomor baru.'
        }
      >
        <Input type="tel" inputMode="tel" autoComplete="off" placeholder="08xxxxxxxxxx" className="tabular-nums" {...register('contactedPhone')} />
      </FormField>

      <div className="grid gap-2">
        <FormField label="Pihak yang menerima informasi" error={errors.receiverName?.message}>
          <Input autoComplete="off" placeholder="mis. Ibu, Ayah, Wali" {...register('receiverName')} />
        </FormField>
        <div className="flex flex-wrap gap-1.5" aria-label="Pilihan cepat penerima">
          {RECEIVER_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setValue('receiverName', s, { shouldDirty: true, shouldValidate: true })}
              className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Keterangan" error={errors.contactNote?.message}>
        <Textarea rows={3} placeholder="mis. Orang tua sudah mengetahui, surat izin menyusul." {...register('contactNote')} />
      </FormField>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Waktu dan nama petugas dicatat otomatis sebagai pengesahan.
      </p>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" disabled={pending || (!isDirty && !!row.contact)}>
          {pending ? 'Menyimpan…' : 'Simpan konfirmasi'}
        </Button>
      </DialogFooter>
    </form>
  )
}
