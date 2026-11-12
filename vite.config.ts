/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Mengurai daftar host yang diizinkan dari VITE_ALLOWED_HOSTS (mis. domain tunnel preview).
 */
function parseAllowedHosts(raw: string | undefined): string[] | true | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (trimmed === 'true') return true
  const hosts = trimmed
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
  return hosts.length > 0 ? hosts : undefined
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useBackendProxy = env.VITE_ENABLE_MOCK_API === 'false'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      allowedHosts: parseAllowedHosts(env.VITE_ALLOWED_HOSTS),
      proxy: useBackendProxy
        ? {
            // Hanya aktifkan proxy ke backend Go lokal saat VITE_ENABLE_MOCK_API=false.
            '/api': { target: 'http://localhost:8080', changeOrigin: true },
          }
        : undefined,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Test halaman merender UI lengkap; saat suite berjalan paralel, render pertama per file bisa > 5 dtk.
      testTimeout: 20_000,
    },
  }
})
