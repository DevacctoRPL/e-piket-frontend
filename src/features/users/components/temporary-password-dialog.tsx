import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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

export interface TemporaryPasswordInfo {
  name: string
  username: string
  password: string
  /** 'create' = akun baru, 'reset' = reset kata sandi. */
  kind: 'create' | 'reset'
}

/**
 * Menampilkan kata sandi sementara SEKALI. Pemanggil wajib membuang nilai (state + mutation.reset())
 * di `onClose` agar kata sandi tidak tertinggal di memori/cache setelah dialog ditutup.
 */
export function TemporaryPasswordDialog({
  info,
  onClose,
}: {
  info: TemporaryPasswordInfo | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    if (!info) return
    try {
      await navigator.clipboard.writeText(info.password)
      setCopied(true)
    } catch {
      toast.error('Tidak dapat menyalin otomatis. Pilih teks kata sandi lalu salin manual.')
    }
  }

  return (
    <Dialog
      open={!!info}
      onOpenChange={(o) => {
        if (!o) {
          setCopied(false)
          onClose()
        }
      }}
    >
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound aria-hidden className="size-4 text-muted-foreground" />
            {info?.kind === 'reset' ? 'Kata sandi direset' : 'Akun dibuat'}
          </DialogTitle>
          <DialogDescription>
            Berikan kata sandi sementara ini kepada <strong className="text-foreground">{info?.name}</strong> (
            <span className="font-mono">{info?.username}</span>). Pengguna diminta menggantinya saat masuk.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <span id="temp-password-label" className="text-xs text-muted-foreground">
            Kata sandi sementara
          </span>
          <div className="flex items-center gap-2">
            <output
              aria-labelledby="temp-password-label"
              data-testid="temporary-password"
              className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-input bg-muted/40 px-2.5 font-mono text-sm tracking-wide break-all select-all"
            >
              {info?.password}
            </output>
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="text-tone-success" /> : <Copy />}
              {copied ? 'Tersalin' : 'Salin'}
            </Button>
          </div>
        </div>

        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>Kata sandi ini hanya ditampilkan sekali</AlertTitle>
          <AlertDescription>
            Setelah dialog ditutup, kata sandi tidak dapat dilihat lagi. Bila hilang, lakukan reset kata sandi ulang.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              setCopied(false)
              onClose()
            }}
          >
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
