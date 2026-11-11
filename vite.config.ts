/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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
