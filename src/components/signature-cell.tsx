import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatTime } from '@/lib/date'
import type { ISODateTime } from '@/types/entities'

export interface SignatureCellProps {
  signatureUrl: string | null
  signedAt?: ISODateTime | null
  signerName: string
  contextLabel?: string
}

/**
 * Tampilan sel TTD read-only dari API Presensi Guru.
 * Menampilkan pratinjau gambar tanda tangan yang dapat diperbesar, atau "Belum TTD" bila belum tersedia.
 */
export function SignatureCell({ signatureUrl, signedAt, signerName, contextLabel }: SignatureCellProps) {
  const [open, setOpen] = useState(false)

  if (!signatureUrl) {
    return <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Belum TTD</span>
  }

  const signedLabel = signedAt ? `${formatDate(signedAt.slice(0, 10))} · ${formatTime(signedAt)}` : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-24 items-center justify-center rounded-md border border-border/80 bg-white px-2 py-1 shadow-2xs transition-colors hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={`Lihat tanda tangan ${signerName}`}
        title="Klik untuk memperbesar tanda tangan"
      >
        <img
          src={signatureUrl}
          alt={`Tanda tangan ${signerName}`}
          className="max-h-8 w-full object-contain"
          loading="lazy"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tanda Tangan Guru</DialogTitle>
            <DialogDescription>
              {contextLabel ? `${signerName} · ${contextLabel}` : signerName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex min-h-36 items-center justify-center rounded-lg border border-border/80 bg-white p-5">
              <img
                src={signatureUrl}
                alt={`Pratinjau tanda tangan ${signerName}`}
                className="max-h-28 w-full object-contain"
              />
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border/70 bg-muted/35 px-3.5 py-2.5 text-xs">
              <dt className="text-muted-foreground">Penanda tangan</dt>
              <dd className="font-medium text-foreground">{signerName}</dd>
              {signedLabel && (
                <>
                  <dt className="text-muted-foreground">Waktu TTD</dt>
                  <dd className="font-medium text-foreground tabular-nums">{signedLabel}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Sumber data</dt>
              <dd className="text-foreground">Presensi Guru (hanya baca)</dd>
            </dl>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
