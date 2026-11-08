import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/page'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/date'
import { AUDIT_ACTION_META } from '@/lib/enums'
import { cn } from '@/lib/utils'
import type { AuditLog, ID } from '@/types/entities'
import { buildDiffRows, entityLabel } from '../audit-format'
import { useAuditLog } from '../queries'

export function AuditDetailSheet({
  id,
  initial,
  onClose,
}: {
  id: ID | null
  initial?: AuditLog
  onClose: () => void
}) {
  const query = useAuditLog(id, initial)
  const log = query.data

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>Detail Riwayat Audit</SheetTitle>
          <SheetDescription>
            {log ? `${entityLabel(log.entity)} · ${formatDateTime(log.timestamp)}` : 'Memuat detail…'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 p-4">
          {query.isPending && !log ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : query.isError && !log ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : log ? (
            <AuditDetailBody log={log} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AuditDetailBody({ log }: { log: AuditLog }) {
  const rows = buildDiffRows(log)
  const changedCount = rows.filter((r) => r.changed).length

  const copyRequestId = async () => {
    try {
      await navigator.clipboard.writeText(log.requestId)
      toast.success('ID permintaan disalin.')
    } catch {
      toast.error('Gagal menyalin ID permintaan.')
    }
  }

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border bg-card p-4 text-sm shadow-xs">
        <dt className="text-muted-foreground">Aksi</dt>
        <dd>
          <StatusBadge meta={AUDIT_ACTION_META} value={log.action} />
        </dd>
        <dt className="text-muted-foreground">Pelaku</dt>
        <dd className="font-medium break-words">{log.actorName}</dd>
        <dt className="text-muted-foreground">Waktu</dt>
        <dd className="tabular-nums">{formatDateTime(log.timestamp)}</dd>
        <dt className="text-muted-foreground">Entitas</dt>
        <dd className="min-w-0">
          {entityLabel(log.entity)}
          <span className="block font-mono text-xs break-all text-muted-foreground">{log.entityId}</span>
        </dd>
        <dt className="text-muted-foreground">Ringkasan</dt>
        <dd className="break-words">{log.summary}</dd>
        <dt className="text-muted-foreground">Alasan</dt>
        <dd className="break-words">{log.reason || <span className="text-muted-foreground">Tidak ada alasan dicatat</span>}</dd>
        <dt className="text-muted-foreground">ID permintaan</dt>
        <dd className="flex items-center gap-1">
          <code className="font-mono text-xs break-all">{log.requestId}</code>
          <Button variant="ghost" size="icon-sm" onClick={() => void copyRequestId()} aria-label="Salin ID permintaan">
            <Copy />
          </Button>
        </dd>
      </dl>

      <section className="space-y-2" aria-labelledby="audit-diff-title">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="audit-diff-title" className="text-sm font-semibold">
            Perubahan data
          </h3>
          {rows.length > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">{changedCount} field berubah</p>
          )}
        </div>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Aksi ini tidak menyimpan rincian perubahan data.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <caption className="sr-only">Perbandingan nilai sebelum dan sesudah</caption>
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Field</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Sebelum</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Sesudah</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.field}
                    className={cn('border-t align-top', r.changed && 'bg-tone-warning-bg/50')}
                    data-changed={r.changed || undefined}
                  >
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {r.label}
                      {r.changed && <span className="sr-only"> (berubah)</span>}
                    </th>
                    <td className={cn('px-3 py-2 break-words', r.changed && 'text-tone-danger')}>
                      {r.before}
                    </td>
                    <td className={cn('px-3 py-2 break-words', r.changed && 'font-semibold text-tone-success')}>
                      {r.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.some((r) => r.changed) && (
          <p className="text-xs text-muted-foreground">
            Baris yang disorot menandakan nilai yang berubah.
          </p>
        )}
      </section>
    </>
  )
}
