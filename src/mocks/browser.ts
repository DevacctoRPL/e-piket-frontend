import { setupWorker } from 'msw/browser'
import { registerSeeder } from './db'
import { handlers } from './handlers'
import { seed } from './seed'

registerSeeder(seed)

export const worker = setupWorker(...handlers)

export async function startMockApi() {
  await worker.start({
    onUnhandledRequest(request, print) {
      // Abaikan aset statis; peringatkan request API yang belum punya handler.
      if (new URL(request.url).pathname.startsWith('/api/')) print.warning()
    },
    quiet: true,
  })

  // Saat tab kembali aktif setelah idle/sleep, pastikan Service Worker MSW mengaktifkan ulang clientId
  // sebelum refetchOnWindowFocus dari TanStack Query berjalan.
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    const reactivateWorker = () => {
      if (document.visibilityState === 'hidden') return
      navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
    }
    window.addEventListener('focus', reactivateWorker, true)
    document.addEventListener('visibilitychange', reactivateWorker, true)
  }
}
