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
}
