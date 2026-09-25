/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * The API base a Vercel build should use instead of `.env.production`, or
 * undefined to keep it. Vercel builds Preview deployments in production mode
 * too, so they load `.env.production` and would call api.ujimora.com directly
 * from a *.vercel.app origin, which the API's CORS allowlist refuses. Only a
 * Production build keeps that absolute URL; every other Vercel build uses the
 * same-origin /api/v1 rewrite in vercel.json, unless that environment sets its
 * own VITE_API_URL in the Vercel project. Local and CI builds (no VERCEL_ENV)
 * are unchanged.
 */
export function vercelApiUrlOverride(env: Record<string, string | undefined> = process.env): string | undefined {
  if (!env.VERCEL_ENV || env.VERCEL_ENV === 'production' || env.VITE_API_URL) return undefined
  return '/api/v1'
}

const apiUrlOverride = vercelApiUrlOverride()

export default defineConfig({
  plugins: [react()],
  define: apiUrlOverride ? { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrlOverride) } : undefined,
  resolve: {
    // Force a single React instance. packages/ui is consumed as source and
    // resolves the hoisted root react, while the app has its own nested copy;
    // without dedupe that's two Reacts → "Invalid hook call" in MUI's provider.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8200,
    open: true,
    proxy: {
      '/api/v1': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8100',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './__tests__/setup.ts',
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts'],
    },
  },
})
