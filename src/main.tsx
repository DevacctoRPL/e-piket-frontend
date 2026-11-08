import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { createAppRouter } from '@/app/router'
import { env } from '@/config/env'
import '@/styles/globals.css'

async function bootstrap() {
  if (env.enableMockApi) {
    const { startMockApi } = await import('@/mocks/browser')
    await startMockApi()
  }
  const router = createAppRouter()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
}

void bootstrap()
