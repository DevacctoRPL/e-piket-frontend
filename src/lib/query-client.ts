import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'
import { getErrorMessage } from '@/lib/error-mapping'

function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    // Jangan retry error klien (4xx). Retry aman untuk jaringan/5xx pada GET.
    if (error.status >= 400 && error.status < 500) return false
  }
  return failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // Query yang sudah punya data: tampilkan toast (data lama tetap terlihat).
        // Gunakan id deterministik agar kegagalan beberapa background query bersamaan tidak menumpuk toast duplikat.
        if (query.state.data !== undefined && !(error instanceof ApiError && error.status === 401)) {
          const message = getErrorMessage(error)
          toast.error(message, { id: `query-error:${message}` })
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.options.meta?.silentError) return
        if (error instanceof ApiError && (error.status === 401 || error.status === 422)) return
        toast.error(getErrorMessage(error))
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: unknown
    mutationMeta: { silentError?: boolean }
  }
}

/** Stale time lebih panjang untuk data master & jadwal (PRD §11.4). */
export const MASTER_STALE_TIME = 10 * 60_000
