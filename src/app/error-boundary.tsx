import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-mapping'
import { ForbiddenPage, NotFoundPage } from './guards'

/** Error boundary route: tampilkan pesan aman tanpa stack trace (AC-14). */
export function RouteErrorBoundary() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  if (error instanceof ApiError && error.status === 403) return <ForbiddenPage />
  const isChunkError =
    error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message)
  if (import.meta.env.DEV) console.error(error)
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-tone-danger-bg text-tone-danger">
        <AlertTriangle className="size-7" />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Terjadi kesalahan</h1>
        <p className="text-sm text-muted-foreground">
          {isChunkError
            ? 'Versi aplikasi telah diperbarui. Muat ulang halaman untuk melanjutkan.'
            : error instanceof ApiError
              ? getErrorMessage(error)
              : 'Halaman ini mengalami masalah tak terduga. Coba muat ulang; jika berlanjut, hubungi admin.'}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}>Muat ulang</Button>
        <Button asChild variant="outline">
          <Link to="/">Ke dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
