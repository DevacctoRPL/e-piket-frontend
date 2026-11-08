import { z } from 'zod'

const EnvSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api/v1'),
  VITE_APP_NAME: z.string().min(1).default('Administrasi Sekolah'),
  VITE_DEFAULT_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
  VITE_ENABLE_MOCK_API: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

const parsed = EnvSchema.safeParse(import.meta.env)

if (!parsed.success) {
  throw new Error(`Konfigurasi environment tidak valid: ${parsed.error.message}`)
}

export const env = {
  apiBaseUrl: parsed.data.VITE_API_BASE_URL.replace(/\/$/, ''),
  appName: parsed.data.VITE_APP_NAME,
  timezone: parsed.data.VITE_DEFAULT_TIMEZONE,
  enableMockApi: parsed.data.VITE_ENABLE_MOCK_API,
} as const
