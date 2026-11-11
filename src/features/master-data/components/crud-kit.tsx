/**
 * Perangkat kecil yang dipakai semua tab Data Master: state dialog, aksi baris, penanganan error mutasi.
 */
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import type { FieldValues, UseFormSetError } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RowActionsMenu } from '@/components/row-actions-menu'
import { Button } from '@/components/ui/button'
import { useIdempotencyKey } from '@/hooks/use-idempotent-mutation'
import { ApiError } from '@/lib/api-client'
import { applyServerErrors, getErrorMessage } from '@/lib/error-mapping'

export type DialogState<T> = { mode: 'create' } | { mode: 'edit'; item: T } | null

export function useCrudState<T>() {
  const [dialog, setDialog] = useState<DialogState<T>>(null)
  const [toDelete, setToDelete] = useState<T | null>(null)
  const openCreate = useCallback(() => setDialog({ mode: 'create' }), [])
  const openEdit = useCallback((item: T) => setDialog({ mode: 'edit', item }), [])
  const close = useCallback(() => setDialog(null), [])
  const cancelDelete = useCallback(() => setToDelete(null), [])
  return { dialog, openCreate, openEdit, close, toDelete, askDelete: setToDelete, cancelDelete }
}

/**
 * Kunci idempotensi per isi payload (AC-03): klik ganda / retry dengan isi yang sama memakai kunci
 * yang sama; bila isi form berubah, kunci baru dibuat.
 */
export function useSubmitKey() {
  const idem = useIdempotencyKey()
  const last = useRef<string | null>(null)
  return useCallback(
    (payload: unknown) => {
      const sig = JSON.stringify(payload)
      if (sig !== last.current) {
        idem.reset()
        last.current = sig
      }
      return idem.key()
    },
    // idem.reset/key hanya membaca ref → aman walau objeknya baru tiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

export type FormError = { title?: string; message: ReactNode } | null

/**
 * Petakan error mutasi: 422 → field (atau pesan form bila field tak dikenal), 409 → pesan form,
 * lainnya → pesan aman. Mengembalikan FormError untuk ditampilkan di dialog.
 */
export function mapMutationError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): FormError {
  if (applyServerErrors(error, setError, fields)) {
    const unmapped =
      error instanceof ApiError ? Object.keys(error.details).filter((k) => !fields.includes(k)) : []
    return unmapped.length
      ? { message: unmapped.map((k) => (error as ApiError).details[k]).join(' ') }
      : null
  }
  if (error instanceof ApiError && error.status === 409) {
    return { title: 'Tidak dapat disimpan', message: error.message }
  }
  return { message: getErrorMessage(error) }
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button onClick={onClick}>
      <Plus /> {children}
    </Button>
  )
}

/**
 * Aksi baris standar Data Master: kebab (⋯) berisi "Ubah" dan "Hapus" (destruktif, dengan dialog konfirmasi
 * dari pemanggil). Aksi yang tidak diberikan (mis. tahun ajaran aktif tidak bisa dihapus) tidak ditampilkan.
 */
export function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  /** Nama item untuk label aksesibel, mis. "Matematika" → "Aksi untuk Matematika". */
  label: string
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex justify-end">
      <RowActionsMenu
        label={`Aksi untuk ${label}`}
        actions={[
          { label: 'Ubah', icon: Pencil, onSelect: onEdit, hidden: !onEdit },
          { label: 'Hapus', icon: Trash2, onSelect: onDelete, hidden: !onDelete, destructive: true, separated: true },
        ]}
      />
    </div>
  )
}

/** Dialog hapus standar (soft delete di backend). Pesan 409 ditampilkan sebagai toast. */
export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  pending: boolean
  onConfirm: () => Promise<unknown>
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel="Hapus"
      destructive
      pending={pending}
      onConfirm={async () => {
        try {
          await onConfirm()
          onOpenChange(false)
        } catch (e) {
          toast.error(getErrorMessage(e), { duration: 8000 })
        }
      }}
    />
  )
}

/** Kartu ponsel ringkas: judul, baris info, aksi (kebab). */
export function MobileCard({
  title,
  badge,
  lines,
  actions,
}: {
  title: ReactNode
  badge?: ReactNode
  lines: ReactNode[]
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium break-words text-foreground">{title}</p>
          {badge}
        </div>
        {lines.filter(Boolean).map((l, i) => (
          <p key={i} className="text-xs break-words text-muted-foreground">
            {l}
          </p>
        ))}
      </div>
      {actions && <div className="-mt-1 -mr-1 shrink-0">{actions}</div>}
    </div>
  )
}

/** Toolbar ringkas di atas tabel tab: deskripsi singkat kiri, tombol aksi (h-8) kanan — tanpa kartu pembungkus. */
export function TabToolbar({ description, actions }: { description: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p className="max-w-3xl text-[13px] text-pretty text-muted-foreground">{description}</p>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export const ACTIVE_STATUS_META = {
  ACTIVE: { label: 'Aktif', tone: 'success' },
  INACTIVE: { label: 'Nonaktif', tone: 'neutral' },
} as const
