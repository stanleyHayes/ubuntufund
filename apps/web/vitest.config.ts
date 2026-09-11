import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    // Vitest prefers vitest.config.ts over vite.config.ts, so the
    // `testTimeout: 30000` set there has never applied — these runs used the 5s
    // default. The first test in each file pays that file's module transform
    // (6-9s for the MUI-heavy pages), so it timed out while every later test in
    // the same file passed in ~200ms, producing a different flaky set per run.
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
})
