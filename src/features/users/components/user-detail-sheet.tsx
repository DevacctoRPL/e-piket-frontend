import { History, LogIn } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar } from '@/components/avatar'
import { ErrorState } from '@/components/page'
import { MetaTag, StatusBadge, ToneBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/misc'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/date'
import { ACCOUNT_STATUS_META, ROLE_META } from '@/lib/enums'
import type { ID, LoginEvent, UserAccount } from '@/types/entities'
import { useUser } from '../queries'

/** URL Audit Log terfilter pada pelaku tertentu (parameter `actorId` dibaca halaman audit). */
export function auditHrefForActor(id: ID) {
  return `/audit?actorId=${encodeURIComponent(id)}`
}

const LOGIN_REASON: Record<LoginEvent['reason'], string> = {
  OK: 'Berhasil masuk',
  BAD_CREDENTIALS: 'Kata sandi salah',
  INACTIVE: 'Akun nonaktif',
}

/** Detail akun: peran, guru tertaut, 10 percobaan masuk terakhir, tautan audit. */
export function UserDetailSheet({
  account,
  onClose,
}: {
  account: UserAccount | null
  onClose: () => void
}) {
  const detail = useUser(account?.id ?? null)
  const data = detail.data ?? account

  return (
    <Sheet open={!!account} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border/60">
          <div className="flex items-center gap-3 pr-6">
            {data && <Avatar name={data.name} size="md" />}
            <div className="min-w-0">
              <SheetTitle className="truncate text-[15px]">{data?.name ?? 'Detail akun'}</SheetTitle>
              <SheetDescription className="truncate font-mono text-xs">{data?.username}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {data && (
          <div className="grid gap-5 p-4 text-[13px]">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge meta={ACCOUNT_STATUS_META} value={data.status} />
                {data.mustChangePassword && (
                  <span className="mt-1 block text-xs text-muted-foreground">Wajib mengganti kata sandi sementara</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Peran</dt>
              <dd className="flex flex-wrap gap-1">
                {data.roles.map((r) => (
                  <MetaTag key={r}>{ROLE_META[r].label}</MetaTag>
                ))}
              </dd>
              <dt className="text-muted-foreground">Guru tertaut</dt>
              <dd>{data.teacherName ?? <span className="text-muted-foreground">Tidak ditautkan</span>}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{data.email ?? <span className="text-muted-foreground">—</span>}</dd>
              <dt className="text-muted-foreground">Terakhir masuk</dt>
              <dd className="tabular-nums">
                {data.lastLoginAt ? formatDateTime(data.lastLoginAt) : <span className="text-muted-foreground">Belum pernah</span>}
              </dd>
              <dt className="text-muted-foreground">Gagal masuk 7 hari</dt>
              <dd className="tabular-nums">{data.failedLogins7d}</dd>
              <dt className="text-muted-foreground">Dibuat</dt>
              <dd className="tabular-nums">{formatDateTime(data.createdAt)}</dd>
            </dl>

            <section aria-labelledby="recent-logins" className="grid gap-2">
              <h3 id="recent-logins" className="flex items-center gap-2 text-[13px] font-semibold">
                <LogIn aria-hidden className="size-3.5 text-muted-foreground" /> Percobaan masuk terakhir
              </h3>
              {detail.isPending ? (
                <div className="space-y-2" aria-busy="true">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                  <Skeleton className="h-5 w-3/5" />
                </div>
              ) : detail.isError ? (
                <ErrorState error={detail.error} onRetry={() => void detail.refetch()} className="py-6" />
              ) : detail.data.recentLogins.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/90 p-3 text-muted-foreground">
                  Belum ada riwayat masuk.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-md border border-border/80">
                  {detail.data.recentLogins.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <ToneBadge tone={e.success ? 'success' : 'danger'}>{LOGIN_REASON[e.reason]}</ToneBadge>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(e.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Button variant="outline" asChild className="justify-self-start">
              <Link to={auditHrefForActor(data.id)}>
                <History /> Riwayat aktivitas di Audit Log
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
